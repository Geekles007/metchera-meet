'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  MessageCircle,
  ScreenShare,
  Users,
  Settings,
  MoreVertical,
} from 'lucide-react';
import { WebRTCConnection } from '../lib/webrtc';
import { socket, socketEvents } from '../lib/socket';
import { MeetingRecorder } from '../lib/recording';
import { ChatPanel } from './ChatPanel';
import { ParticipantList } from './ParticipantList';
import { RecordingIcon } from './ui/icons';
import { toast } from 'sonner';
import { leaveMeeting, endMeeting } from '../lib/meeting-service';

interface MeetingRoomProps {
  roomId: string;
  userId: string;
  userName: string;
  isAnonymous?: boolean;
  onExit: () => void;
}

interface Participant {
  id: string;
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  stream?: MediaStream;
}

interface RoomUser {
  id: string;
  name: string;
  socketId?: string;
  roomId?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  isScreenSharing?: boolean;
}

interface Room {
  id: string;
  users: RoomUser[];
  messages: any[];
}

// Helper function to check if we're in a browser environment
const isBrowser = () => typeof window !== 'undefined';

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  roomId,
  userId,
  userName,
  isAnonymous = false,
  onExit,
}) => {
  // State for mounted check
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  
  // State for video streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; timestamp: number; }[]>([]);

  // Refs
  const webrtcRef = useRef<WebRTCConnection | null>(null);
  const recorderRef = useRef<MeetingRecorder | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  // Add state to track if video element is ready
  const [isVideoElementReady, setIsVideoElementReady] = useState(false);

  // Helper function to safely set video source
  const setVideoSource = useCallback((videoElement: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!videoElement || !stream) return false;
    
    try {
      videoElement.srcObject = null; // Reset first
      videoElement.srcObject = stream;
      return true;
    } catch (e) {
      console.error('Error attaching stream to video element:', e);
      return false;
    }
  }, []);

  // Effect to update video srcObject when both stream and element are ready
  useEffect(() => {
    if (localStream && localVideoRef.current && isVideoElementReady) {
      console.log('Setting srcObject on local video element');
      if (setVideoSource(localVideoRef.current, localStream)) {
        // Force a play attempt
        localVideoRef.current.play().catch(e => {
          console.warn('Auto-play prevented for local video:', e);
        });
        
        // Verify if we have video tracks (if not, we're in audio-only mode)
        const hasVideo = localStream.getVideoTracks().length > 0;
        if (!hasVideo) {
          // Update UI to indicate audio-only mode
          setIsVideoOff(true);
          toast.warning('Using audio only. Camera not available or permission denied.', {
            duration: 5000,
          });
        }
      }
    }
  }, [localStream, isVideoElementReady, setVideoSource]);

  // Helper function to determine grid columns based on number of participants
  const getGridColumns = (count: number): string => {
    if (count <= 1) return 'repeat(1, minmax(0, 1fr))';
    if (count === 2) return 'repeat(2, minmax(0, 1fr))';
    if (count <= 4) return 'repeat(2, minmax(0, 1fr))';
    if (count <= 9) return 'repeat(3, minmax(0, 1fr))';
    return 'repeat(4, minmax(0, 1fr))';
  };

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
    
    // Show a toast notification for anonymous users
    if (isAnonymous) {
      toast.info(
        'You\'re in an anonymous meeting. Session data won\'t be saved and participants cannot see your account details.',
        { duration: 6000 }
      );
    }
    
    return () => setIsMounted(false);
  }, [isAnonymous]);

  // Handle receiving remote stream from a peer
  const handleRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    console.log(`Handling remote stream from peer ${peerId}`);
    
    // Update participant with stream
    setParticipants(prev => {
      const updatedParticipants = prev.map(p => {
        if (p.id === peerId) {
          return { ...p, stream };
        }
        return p;
      });
      
      // If this is a new participant that doesn't exist yet,
      // we'll get their info from a socket event later
      if (!updatedParticipants.some(p => p.id === peerId)) {
        console.log('Received stream for unknown participant, waiting for user info');
      }
      
      return updatedParticipants;
    });
    
    // Attach stream to video element if it exists
    if (remoteVideoRefs.current[peerId]) {
      remoteVideoRefs.current[peerId]!.srcObject = stream;
    }
  }, []);

  // Initialize connection after component is mounted
  useEffect(() => {
    if (!isMounted) return;
    
    let isComponentMounted = true;
    setIsLoading(true);
    setLoadingError(null);
    
    // Initialize WebRTC connection with stream handler
    webrtcRef.current = new WebRTCConnection(handleRemoteStream);
    
    // Initialize recorder
    recorderRef.current = new MeetingRecorder();
    
    // Setup local stream
    const setupLocalStream = async () => {
      try {
        if (webrtcRef.current && isComponentMounted) {
          // First check if video is already active in another tab to avoid sharing conflicts
          // Display loading status to the user
          const stream = await webrtcRef.current.initLocalStream();
          
          // Check if component is still mounted before updating state
          if (isComponentMounted) {
            console.log('Local stream obtained:', stream);
            console.log('Video tracks:', stream.getVideoTracks().length);
            
            setLocalStream(stream);
            setIsLoading(false);
            
            // Don't try to set video srcObject here - it will be handled by the effect

            // Join the room with user info
            socket.emit(socketEvents.joinRoom, {
              roomId,
              user: {
                id: userId,
                name: userName || 'Anonymous User', // Provide fallback name
                audioEnabled: true,
                videoEnabled: stream.getVideoTracks().length > 0, // Only claim video is on if we actually have video
                isScreenSharing: false,
                isAnonymous: isAnonymous
              }
            });
          }
        }
      } catch (error: any) {
        console.error('Error setting up local stream:', error);
        // Don't update state if component unmounted
        if (!isComponentMounted) return;
        
        setIsLoading(false);
        
        // More specific error message
        const errorMessage = error.message || 'Could not access camera or microphone';
        setLoadingError(
          `${errorMessage}. Please ensure you have granted the necessary permissions.`
        );
        
        // Try to join with audio only if the error seems to be camera-related
        if (error.message && error.message.includes('camera')) {
          try {
            // Attempt audio-only join
            if (webrtcRef.current) {
              const audioStream = await webrtcRef.current.initLocalStream(false, true);
              if (isComponentMounted) {
                setLocalStream(audioStream);
                setIsVideoOff(true);
                
                // Join room in audio-only mode
                socket.emit(socketEvents.joinRoom, {
                  roomId,
                  user: {
                    id: userId,
                    name: userName,
                    audioEnabled: true,
                    videoEnabled: false,
                    isScreenSharing: false,
                    isAnonymous: isAnonymous
                  }
                });
                
                // Update UI but keep error visible
                toast.warning('Joined with audio only. Camera access failed.', {
                  duration: 5000,
                });
              }
            }
          } catch (audioError) {
            console.error('Failed to join with audio only:', audioError);
          }
        }
      }
    };
    
    // Delay socket setup to ensure server connection
    setTimeout(() => {
      if (isComponentMounted) {
        setupLocalStream();
      }
    }, 1000);
    
    // Handle room information when joining
    if (socket && typeof socket.on === 'function') {
      socket.on(socketEvents.roomInfo, (room: Room) => {
        if (!isComponentMounted) return;
        
        console.log('Room info received:', room);
        
        // Set participants from room users (exclude self)
        const otherUsers = room.users.filter((u: RoomUser) => u.id !== userId);
        setParticipants(otherUsers.map((user: RoomUser) => ({
          id: user.id,
          name: user.name,
          audioEnabled: true,
          videoEnabled: true,
          isScreenSharing: false,
        })));
      });
      
      // Handle participant joining the room
      socket.on(socketEvents.participantJoined, ({ user, users }: { user: RoomUser; users: RoomUser[] }) => {
        if (!isComponentMounted) return;
        
        console.log('Participant joined:', user);
        
        // Add new participant to the list
        setParticipants(prev => {
          // Check if participant is already in the list
          if (!prev.some(p => p.id === user.id)) {
            return [...prev, {
              id: user.id,
              name: user.name,
              audioEnabled: user.audioEnabled === undefined ? true : user.audioEnabled,
              videoEnabled: user.videoEnabled === undefined ? true : user.videoEnabled,
              isScreenSharing: user.isScreenSharing === undefined ? false : user.isScreenSharing,
            }];
          }
          return prev;
        });
        
        // Show a notification that a user has joined
        toast.info(`${user.name} has joined the meeting`, { duration: 3000 });
      });
      
      // Handle participant leaving the room
      socket.on(socketEvents.participantLeft, ({ userId: leftUserId, users }: { userId: string; users: RoomUser[] }) => {
        if (!isComponentMounted) return;
        
        console.log('Participant left:', leftUserId);
        
        // Get the participant's name before removing them
        const leavingParticipant = participants.find(p => p.id === leftUserId);
        
        // Remove participant from the list
        setParticipants(prev => prev.filter(p => p.id !== leftUserId));
        
        // Clean up peer connection
        if (webrtcRef.current) {
          webrtcRef.current.removePeer(leftUserId);
        }
        
        // Show a notification that a user has left
        if (leavingParticipant) {
          toast.info(`${leavingParticipant.name} has left the meeting`, { duration: 3000 });
        }
      });
      
      // Listen for media updates from other participants
      socket.on(socketEvents.updateMedia, ({ userId: updatedUserId, updates }: { userId: string; updates: any }) => {
        if (!isComponentMounted || updatedUserId === userId) return; // Skip our own updates
        
        console.log('Media update received:', updatedUserId, updates);
        
        setParticipants(prev => {
          return prev.map(p => {
            if (p.id === updatedUserId) {
              const updatedParticipant = { ...p, ...updates };
              
              // Show notifications for media changes
              if (updates.audioEnabled !== undefined && updates.audioEnabled !== p.audioEnabled) {
                const action = updates.audioEnabled ? 'unmuted' : 'muted';
                toast.info(`${p.name} has ${action} their microphone`, { duration: 3000 });
              }
              
              if (updates.videoEnabled !== undefined && updates.videoEnabled !== p.videoEnabled) {
                const action = updates.videoEnabled ? 'enabled' : 'disabled';
                toast.info(`${p.name} has ${action} their camera`, { duration: 3000 });
              }
              
              if (updates.isScreenSharing !== undefined && updates.isScreenSharing !== p.isScreenSharing) {
                const action = updates.isScreenSharing ? 'started' : 'stopped';
                toast.info(`${p.name} has ${action} sharing their screen`, { duration: 3000 });
              }
              
              return updatedParticipant;
            }
            return p;
          });
        });
      });

      // Listen for chat messages
      socket.on(socketEvents.chatMessage, (message: { id: string; sender: string; text: string; timestamp: number }) => {
        if (!isComponentMounted) return;
        
        console.log('Chat message received:', message);
        
        // Add message to chat messages state if it doesn't already exist
        setChatMessages(prev => {
          // Check if this message already exists
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        
        // If chat is not open, show a notification
        if (!showChat) {
          toast.info(`New message from ${message.sender}`, { duration: 3000 });
        }
      });
    }
    
    // Cleanup function
    return () => {
      isComponentMounted = false;
      
      if (webrtcRef.current) {
        webrtcRef.current.closeAllConnections();
      }
      
      if (recorderRef.current && isRecording) {
        recorderRef.current.stopRecording();
      }
      
      socket.emit(socketEvents.leaveRoom, { roomId, userId });
      
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      // Disconnect from socket events
      socket.off(socketEvents.roomInfo);
      socket.off(socketEvents.participantJoined);
      socket.off(socketEvents.participantLeft);
      socket.off(socketEvents.updateMedia);
      socket.off(socketEvents.chatMessage);
    };
  }, [isMounted, roomId, userId, userName, handleRemoteStream, isRecording, showChat]);

  // Handle peer connection creation when participants join and localStream is available
  useEffect(() => {
    if (!isMounted || !localStream) return;
    
    let isComponentMounted = true;
    
    // Set up WebRTC peer connection for each new participant
    const handleNewParticipant = ({ user }: { user: RoomUser }) => {
      // Only create peer for new users
      if (user.id === userId) return;
      
      console.log('Setting up peer connection for new participant:', user.name);
      
      if (localStream && webrtcRef.current) {
        try {
          // Create a WebRTC peer connection as the initiator
          webrtcRef.current.createPeer(user.id, true, localStream);
        } catch (err) {
          console.error(`Error creating peer for ${user.name}:`, err);
        }
      }
    };
    
    // Set up socket listeners for new participants
    if (socket && typeof socket.on === 'function') {
      socket.on(socketEvents.participantJoined, handleNewParticipant);
    }
    
    // Create connections with existing participants
    if (participants.length > 0) {
      console.log(`Attempting to connect to ${participants.length} existing participants`);
      participants.forEach(participant => {
        if (participant.id !== userId) {
          try {
            if (webrtcRef.current && !webrtcRef.current.hasPeer(participant.id)) {
              console.log(`Creating peer connection with existing participant ${participant.id}`);
              webrtcRef.current.createPeer(participant.id, true, localStream);
            }
          } catch (err) {
            console.error(`Error connecting to participant ${participant.id}:`, err);
          }
        }
      });
    }
    
    return () => {
      isComponentMounted = false;
      if (socket && typeof socket.off === 'function') {
        socket.off(socketEvents.participantJoined, handleNewParticipant);
      }
    };
  }, [isMounted, localStream, userId, participants]);

  // Handle WebRTC signaling
  useEffect(() => {
    if (!isMounted || !localStream) return;
    
    // Handle incoming signals
    const handleSignal = ({ signal, from }: { signal: any; from: string }) => {
      if (!webrtcRef.current || !localStream) {
        console.warn('Cannot handle signal: WebRTC or local stream not initialized');
        return;
      }
      
      try {
        // First, just pass the signal to the handler - it will store it if peer doesn't exist
        webrtcRef.current.handleSignal(signal, from);
        
        // If we don't have a peer yet, create one (as non-initiator)
        if (!webrtcRef.current.hasPeer(from)) {
          console.log(`Creating new peer from signal: ${from}`);
          webrtcRef.current.createPeer(from, false, localStream);
        }
      } catch (err) {
        console.error(`Error handling signal from ${from}:`, err);
      }
    };
    
    // Set up signal handler
    if (socket && typeof socket.on === 'function') {
      socket.on(socketEvents.receiveSignal, handleSignal);
    }
    
    return () => {
      if (socket && typeof socket.off === 'function') {
        socket.off(socketEvents.receiveSignal, handleSignal);
      }
    };
  }, [isMounted, localStream]);

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const newState = !isMuted;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !newState;
      });
      setIsMuted(newState);
      
      if (webrtcRef.current) {
        webrtcRef.current.toggleAudio(!newState);
      }
      
      // Update participant status
      socket.emit(socketEvents.updateMedia, {
        roomId,
        userId,
        updates: { audioEnabled: !newState }
      });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const newState = !isVideoOff;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !newState;
      });
      setIsVideoOff(newState);
      
      if (webrtcRef.current) {
        webrtcRef.current.toggleVideo(!newState);
      }
      
      // Update participant status
      socket.emit(socketEvents.updateMedia, {
        roomId,
        userId,
        updates: { videoEnabled: !newState }
      });
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (!webrtcRef.current) return;
    
    if (!isScreenSharing) {
      try {
        await webrtcRef.current.replaceTrackWithScreen();
        setIsScreenSharing(true);
        
        // Update participant status
        socket.emit(socketEvents.updateMedia, {
          roomId,
          userId,
          updates: { isScreenSharing: true }
        });
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    } else {
      try {
        await webrtcRef.current.stopScreenSharing();
        setIsScreenSharing(false);
        
        // Update participant status
        socket.emit(socketEvents.updateMedia, {
          roomId,
          userId,
          updates: { isScreenSharing: false }
        });
      } catch (error) {
        console.error('Error stopping screen share:', error);
      }
    }
  };

  // Toggle recording
  const toggleRecording = async () => {
    if (!recorderRef.current || !localStream) return;
    
    if (!isRecording) {
      try {
        await recorderRef.current.startRecording(localStream);
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting recording:', error);
      }
    } else {
      try {
        const recordingBlob = await recorderRef.current.stopRecording();
        
        if (recordingBlob) {
          // Upload recording to storage
          const downloadUrl = await recorderRef.current.uploadRecording(
            recordingBlob,
            userId,
            roomId
          );
          
          console.log('Recording saved at:', downloadUrl);
        }
        
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
  };

  // Send chat message
  const sendMessage = (text: string) => {
    const message = {
      id: `${Date.now()}-${userId}-${Math.random().toString(36).substring(2, 10)}`,
      sender: userName,
      text,
      timestamp: Date.now(),
    };
    
    // Update local state immediately
    setChatMessages(prev => [...prev, message]);
    
    // Send message to server
    socket.emit(socketEvents.sendMessage, { roomId, message });
  };

  // Handle exit meeting
  const handleExitMeeting = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stopRecording();
    }
    
    if (webrtcRef.current) {
      webrtcRef.current.closeAllConnections();
    }
    
    // Update meeting in Firebase only if not anonymous
    if (roomId && userId && !isAnonymous) {
      try {
        leaveMeeting(roomId, userId);
      } catch (error) {
        console.error('Error leaving meeting in Firebase:', error);
      }
    }
    
    socket.emit(socketEvents.leaveRoom, { roomId, userId });
    onExit();
  };

  // Show loading spinner while setting up the meeting
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-xl font-semibold mb-2">Setting up your meeting...</h2>
          <p className="text-gray-400">Please allow camera and microphone access</p>
        </div>
      </div>
    );
  }

  // Show error message if we couldn't get camera/mic access
  if (loadingError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center p-8 bg-gray-800 rounded-xl max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Could Not Join Meeting</h2>
          <p className="text-gray-400 mb-6">{loadingError}</p>
          <button 
            onClick={onExit}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-4 relative">
          <motion.div 
            style={{ 
              display: 'grid',
              gridTemplateColumns: getGridColumns(participants.length + 1),
              gap: '1rem',
              height: '100%'
            }}
            layout
          >
            {/* Local video */}
            <motion.div 
              style={{ 
                position: 'relative',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                backgroundColor: 'rgb(31, 41, 55)'
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <video
                ref={(el) => {
                  localVideoRef.current = el;
                  if (el) setIsVideoElementReady(true);
                }}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : 'block'}`}
                style={{ minHeight: "240px" }}
              />
              {isVideoOff && (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-3xl">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg">
                {userName} {isMuted && <MicOff className="inline w-4 h-4 ml-1 text-red-500" />}
              </div>
              {isScreenSharing && (
                <div className="absolute top-4 right-4 bg-blue-600 px-3 py-1 rounded-lg">
                  Sharing Screen
                </div>
              )}
            </motion.div>

            {/* Remote videos */}
            <AnimatePresence>
              {participants.map((participant) => {
                // Add ref to the map when a participant is created
                if (!remoteVideoRefs.current[participant.id]) {
                  remoteVideoRefs.current[participant.id] = null;
                }
                
                return (
                  <motion.div
                    key={participant.id}
                    style={{
                      position: 'relative',
                      borderRadius: '0.75rem',
                      overflow: 'hidden',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      backgroundColor: 'rgb(31, 41, 55)'
                    }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                  >
                    {participant.stream ? (
                      <video
                        ref={(el) => {
                          remoteVideoRefs.current[participant.id] = el;
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-700">
                        <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-3xl">
                          {participant.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg">
                      {participant.name}
                      {!participant.audioEnabled && <MicOff className="inline w-4 h-4 ml-1 text-red-500" />}
                    </div>
                    {participant.isScreenSharing && (
                      <div className="absolute top-4 right-4 bg-blue-600 px-3 py-1 rounded-lg">
                        Sharing Screen
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Sidebars */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              style={{
                width: '20rem',
                backgroundColor: 'rgb(31, 41, 55)',
                borderLeft: '1px solid rgb(55, 65, 81)'
              }}
            >
              <ChatPanel
                roomId={roomId}
                userId={userId}
                userName={userName}
                messages={chatMessages}
                onSendMessage={sendMessage}
              />
            </motion.div>
          )}

          {showParticipants && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              style={{
                width: '20rem',
                backgroundColor: 'rgb(31, 41, 55)',
                borderLeft: '1px solid rgb(55, 65, 81)'
              }}
            >
              <ParticipantList
                roomId={roomId}
                currentUserId={userId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control bar */}
      <motion.div
        style={{
          height: '5rem',
          backgroundColor: 'rgb(31, 41, 55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          borderTop: '1px solid rgb(55, 65, 81)'
        }}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex space-x-3">
          <Button
            variant="meetControl"
            size="meetIcon"
            onClick={toggleAudio}
            className={isMuted ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isMuted ? <MicOff /> : <Mic />}
          </Button>
          
          <Button
            variant="meetControl"
            size="meetIcon"
            onClick={toggleVideo}
            className={isVideoOff ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isVideoOff ? <VideoOff /> : <Video />}
          </Button>

          <Button
            variant="meetControl"
            size="meetIcon"
            onClick={toggleScreenShare}
            className={isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            <ScreenShare />
          </Button>

          <Button
            variant="meetControl"
            size="meetIcon"
            onClick={toggleRecording}
            className={isRecording ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            <RecordingIcon />
          </Button>

          <Button
            variant="meetControl"
            size="meetIcon"
            onClick={() => setShowChat(!showChat)}
            className={showChat ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            <MessageCircle />
          </Button>

          <Button
            variant="meetControl"
            size="meetIcon"
            onClick={() => setShowParticipants(!showParticipants)}
            className={showParticipants ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            <div className="relative">
              <Users />
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">
                {participants.length + 1}
              </span>
            </div>
          </Button>

          <Button
            variant="danger"
            size="meetIcon"
            onClick={handleExitMeeting}
          >
            <Phone className="rotate-[135deg]" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}; 