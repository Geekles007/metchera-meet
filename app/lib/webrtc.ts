import Peer from 'simple-peer';
import { socket, socketEvents } from './socket';

// Helper function to check if we're in a browser environment
const isBrowser = () => typeof window !== 'undefined';

interface PeerConnection {
  peerId: string;
  peer: Peer.Instance;
  initiator: boolean;
  destroyed: boolean; // Add flag to track destroyed state
}

export class WebRTCConnection {
  private peers: Map<string, PeerConnection>;
  private localStream: MediaStream | null;
  private onStreamCallback: ((peerId: string, stream: MediaStream) => void) | null;
  private pendingSignals: Map<string, any[]>; // Store pending signals for peers not yet created

  constructor(onStream?: (peerId: string, stream: MediaStream) => void) {
    this.peers = new Map();
    this.localStream = null;
    this.onStreamCallback = onStream || null;
    this.pendingSignals = new Map();

    // Set up socket event listeners for signaling
    if (isBrowser()) {
      try {
        // Make sure socket is available (client-side only)
        if (socket && typeof socket.on === 'function') {
          socket.on(socketEvents.receiveSignal, ({ signal, from }: { signal: any; from: string }) => {
            this.handleSignal(signal, from);
          });
        } else {
          console.warn('Socket not initialized correctly for WebRTC');
        }
      } catch (err) {
        console.error('Error setting up socket listener:', err);
      }
    }
  }

  /**
   * Initialize local media stream with specified constraints
   */
  async initLocalStream(video = true, audio = true): Promise<MediaStream> {
    try {
      // Define constraints for getUserMedia
      const constraints: MediaStreamConstraints = {
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
        } : false,
      };
      
      // Clear any existing stream first
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
      
      // Try getting user media with a timeout
      try {
        // First check if permissions are granted by checking permissions API
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
            const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            
            if (video && cameraPermission.state === 'denied') {
              throw new Error('Camera permission denied. Please allow camera access in your browser settings.');
            }
            
            if (audio && micPermission.state === 'denied') {
              throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
            }
          } catch (permErr) {
            // Some browsers don't support the permissions API properly, so just continue
            console.warn('Permission check error:', permErr);
          }
        }
        
        const stream = await Promise.race([
          navigator.mediaDevices.getUserMedia(constraints),
          new Promise<MediaStream>((_, reject) => {
            setTimeout(() => reject(new Error('Media access timeout - device might be in use by another application')), 15000);
          })
        ]) as MediaStream;
        
        // Verify we have the required tracks
        if (video && stream.getVideoTracks().length === 0) {
          console.warn('No video tracks in media stream');
        }
        
        if (audio && stream.getAudioTracks().length === 0) {
          console.warn('No audio tracks in media stream');
        }
        
        this.localStream = stream;
        return stream;
      } catch (mediaError: any) {
        console.error('Error accessing media devices:', mediaError);
        
        // Add more detailed error messages
        if (mediaError.name === 'NotAllowedError') {
          throw new Error('Camera or microphone access denied. Please check browser permissions.');
        } else if (mediaError.name === 'NotFoundError') {
          throw new Error('No camera or microphone found. Please connect a device and try again.');
        } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'AbortError') {
          throw new Error('Camera or microphone is already in use by another application.');
        }
        
        // If video fails, try audio only as fallback
        if (video && audio) {
          console.log('Trying audio only as fallback...');
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false 
          });
          
          this.localStream = audioOnlyStream;
          return audioOnlyStream;
        } else {
          throw new Error(`Could not access ${video ? 'camera' : ''}${video && audio ? ' and ' : ''}${audio ? 'microphone' : ''}. ${mediaError.message || 'Please check your device permissions.'}`);
        }
      }
    } catch (error) {
      console.error('Error in initLocalStream:', error);
      throw error;
    }
  }

  /**
   * Set callback for when a remote stream is received
   */
  setOnStream(callback: (peerId: string, stream: MediaStream) => void): void {
    this.onStreamCallback = callback;
  }

  /**
   * Check if peer connection exists
   */
  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId) && !this.peers.get(peerId)!.destroyed;
  }

  /**
   * Create a new peer connection with another user
   */
  createPeer(peerId: string, initiator: boolean, stream: MediaStream): PeerConnection {
    try {
      // If the peer already exists but is destroyed, remove it first
      if (this.peers.has(peerId)) {
        const existingPeer = this.peers.get(peerId)!;
        
        if (existingPeer.destroyed) {
          // If the peer is marked as destroyed, remove it
          this.peers.delete(peerId);
        } else {
          // If not destroyed, just return it
          console.log(`Peer ${peerId} already exists`);
          return existingPeer;
        }
      }

      console.log(`Creating new peer connection with ${peerId}, initiator: ${initiator}`);

      // Create a new peer connection
      const peer = new Peer({
        initiator,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      // Handle the peer signals
      peer.on('signal', (signal) => {
        try {
          if (this.peers.has(peerId) && !this.peers.get(peerId)!.destroyed) {
            console.log(`Sending signal to ${peerId}`);
            socket.emit(socketEvents.sendSignal, {
              signal,
              to: peerId,
            });
          } else {
            console.warn(`Not sending signal: Peer ${peerId} is destroyed or removed`);
          }
        } catch (err) {
          console.error('Error sending signal:', err);
        }
      });

      // Handle receiving remote stream
      peer.on('stream', (remoteStream) => {
        console.log(`Received stream from peer ${peerId}`);
        if (this.onStreamCallback && this.peers.has(peerId) && !this.peers.get(peerId)!.destroyed) {
          this.onStreamCallback(peerId, remoteStream);
        }
      });

      peer.on('connect', () => {
        console.log(`Connected to peer ${peerId}`);
      });

      peer.on('close', () => {
        console.log(`Peer connection with ${peerId} closed`);
        // Mark peer as destroyed
        if (this.peers.has(peerId)) {
          this.peers.get(peerId)!.destroyed = true;
        }
      });

      peer.on('error', (err) => {
        console.error(`Peer error with ${peerId}:`, err);
        // Mark peer as destroyed on error
        if (this.peers.has(peerId)) {
          this.peers.get(peerId)!.destroyed = true;
        }
      });

      // Store the peer connection
      const peerConnection: PeerConnection = {
        peerId,
        peer,
        initiator,
        destroyed: false
      };
      this.peers.set(peerId, peerConnection);

      // Apply any pending signals for this peer
      this.applyPendingSignals(peerId);

      return peerConnection;
    } catch (err) {
      console.error('Error creating peer:', err);
      throw err;
    }
  }

  /**
   * Apply any pending signals for a peer
   */
  private applyPendingSignals(peerId: string): void {
    if (this.pendingSignals.has(peerId)) {
      const signals = this.pendingSignals.get(peerId)!;
      console.log(`Applying ${signals.length} pending signals for peer ${peerId}`);
      
      signals.forEach(signal => {
        try {
          const peerConnection = this.peers.get(peerId);
          if (peerConnection && !peerConnection.destroyed) {
            peerConnection.peer.signal(signal);
          }
        } catch (err) {
          console.error(`Error applying pending signal to peer ${peerId}:`, err);
        }
      });
      
      this.pendingSignals.delete(peerId);
    }
  }

  /**
   * Handle incoming signals from other peers
   */
  handleSignal(signal: any, from: string): void {
    try {
      console.log(`Received signal from ${from}`);
      
      const peerConnection = this.peers.get(from);

      if (peerConnection && !peerConnection.destroyed) {
        // If peer exists and is not destroyed, signal it directly
        console.log(`Signaling existing peer ${from}`);
        peerConnection.peer.signal(signal);
      } else {
        // If peer doesn't exist or is destroyed, store the signal for later
        console.log(`Storing signal from ${from} for later`);
        if (!this.pendingSignals.has(from)) {
          this.pendingSignals.set(from, []);
        }
        this.pendingSignals.get(from)!.push(signal);
        
        // Note: Don't create a new peer here
        // The caller will need to create it with createPeer
        // This fixes the "Called in wrong state: stable" error
      }
    } catch (err) {
      console.error(`Error handling signal from ${from}:`, err);
    }
  }

  /**
   * Remove a peer connection
   */
  removePeer(peerId: string): void {
    const peerConnection = this.peers.get(peerId);
    if (peerConnection && !peerConnection.destroyed) {
      console.log(`Removing peer connection with ${peerId}`);
      
      // Mark as destroyed before calling destroy
      // This prevents any callbacks from sending signals
      peerConnection.destroyed = true;
      
      try {
        peerConnection.peer.destroy();
      } catch (err) {
        console.error(`Error destroying peer ${peerId}:`, err);
      }
      
      this.peers.delete(peerId);
      this.pendingSignals.delete(peerId);
    }
  }

  /**
   * Close all peer connections
   */
  closeAllConnections(): void {
    console.log(`Closing all peer connections`);
    this.peers.forEach((peerConnection, peerId) => {
      // Mark as destroyed first to prevent callbacks
      peerConnection.destroyed = true;
      try {
        peerConnection.peer.destroy();
      } catch (err) {
        console.error(`Error destroying peer ${peerId} during cleanup:`, err);
      }
    });
    this.peers.clear();
    this.pendingSignals.clear();
  }

  /**
   * Toggle audio
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Toggle video
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Replace video track with screen sharing
   */
  async replaceTrackWithScreen(): Promise<void> {
    try {
      // Get screen sharing stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      if (!this.localStream) {
        throw new Error('Local stream not initialized');
      }

      // Save the screen video track
      const screenTrack = screenStream.getVideoTracks()[0];

      // Handle when user ends screen sharing from browser UI
      screenTrack.onended = () => {
        this.stopScreenSharing().catch(err => {
          console.error('Error stopping screen share:', err);
        });
      };

      // Replace the video track in all peer connections
      this.peers.forEach((peerConnection) => {
        if (!peerConnection.destroyed) {
          try {
            // Try to access senders from peer connection (simple-peer doesn't directly expose this)
            // @ts-ignore - We're trying to access internal RTCPeerConnection
            const pc = peerConnection.peer._pc as RTCPeerConnection;
            let trackReplaced = false;
            
            if (pc && pc.getSenders) {
              const videoSender = pc.getSenders().find(sender => 
                sender.track && sender.track.kind === 'video'
              );
              if (videoSender) {
                videoSender.replaceTrack(screenTrack);
                trackReplaced = true;
              }
            }
            
            // Fallback: Replace the entire stream if track replacement didn't work
            if (!trackReplaced) {
              console.warn('Could not replace track using sender, falling back to full replacement');
              
              // Fallback: Replace the entire stream with a new one containing audio from camera and video from screen
              const audioTracks = this.localStream!.getAudioTracks();
              const newStream = new MediaStream([...audioTracks, screenTrack]);
              
              // Store the current peer ID to reconnect after replacing the stream
              const peerId = peerConnection.peerId;
              const wasInitiator = peerConnection.initiator;
              
              // Remove current peer connection
              this.removePeer(peerId);
              
              // Create a new connection with the updated stream
              this.createPeer(peerId, wasInitiator, newStream);
            }
          } catch (err) {
            console.error('Error replacing track:', err);
          }
        }
      });

      // Replace local video track with screen track
      const oldVideoTracks = this.localStream.getVideoTracks();
      oldVideoTracks.forEach(track => this.localStream!.removeTrack(track));
      this.localStream.addTrack(screenTrack);

    } catch (err) {
      console.error('Error sharing screen:', err);
      throw err;
    }
  }

  /**
   * Stop screen sharing and restore camera video
   */
  async stopScreenSharing(): Promise<void> {
    try {
      if (!this.localStream) {
        throw new Error('Local stream not initialized');
      }

      // Stop the current video track (screen sharing)
      this.localStream.getVideoTracks().forEach(track => {
        track.stop();
        this.localStream!.removeTrack(track);
      });

      // Get a new camera stream
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      // Add the camera video track to the local stream
      const cameraTrack = cameraStream.getVideoTracks()[0];
      this.localStream.addTrack(cameraTrack);

      // Replace the video track in all peer connections
      this.peers.forEach((peerConnection) => {
        if (!peerConnection.destroyed) {
          try {
            // Try to access senders from peer connection (simple-peer doesn't directly expose this)
            // @ts-ignore - We're trying to access internal RTCPeerConnection
            const pc = peerConnection.peer._pc as RTCPeerConnection;
            let trackReplaced = false;
            
            if (pc && pc.getSenders) {
              const videoSender = pc.getSenders().find(sender => 
                sender.track && sender.track.kind === 'video'
              );
              if (videoSender) {
                videoSender.replaceTrack(cameraTrack);
                trackReplaced = true;
              }
            }
            
            // Fallback: Replace the entire stream if track replacement didn't work
            if (!trackReplaced) {
              console.warn('Could not replace track using sender, falling back to full replacement');
              
              // Create a new stream with audio and new video
              const audioTracks = this.localStream!.getAudioTracks();
              const newStream = new MediaStream([...audioTracks, cameraTrack]);
              
              // Store the current peer ID to reconnect after replacing the stream
              const peerId = peerConnection.peerId;
              const wasInitiator = peerConnection.initiator;
              
              // Remove current peer connection
              this.removePeer(peerId);
              
              // Create a new connection with the updated stream
              this.createPeer(peerId, wasInitiator, newStream);
            }
          } catch (err) {
            console.error('Error replacing track:', err);
          }
        }
      });

    } catch (err) {
      console.error('Error stopping screen sharing:', err);
      throw err;
    }
  }

  /**
   * Get all peer connections
   */
  getAllPeers(): Map<string, PeerConnection> {
    return this.peers;
  }
} 