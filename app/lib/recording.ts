import RecordRTC from 'recordrtc';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

interface RecordingOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  videoBitsPerSecond?: number;
  bitsPerSecond?: number;
}

export class MeetingRecorder {
  private recorder: RecordRTC | null;
  private stream: MediaStream | null;
  private isRecording: boolean;
  private recordingId: string;
  private recordingOptions: RecordingOptions;

  constructor() {
    this.recorder = null;
    this.stream = null;
    this.isRecording = false;
    this.recordingId = '';
    this.recordingOptions = {
      mimeType: 'video/webm;codecs=vp9',
      bitsPerSecond: 128000,
    };
  }

  /**
   * Start recording the meeting
   */
  async startRecording(stream: MediaStream, options?: RecordingOptions): Promise<void> {
    if (this.isRecording) {
      console.warn('Recording is already in progress');
      return;
    }

    this.stream = stream;
    this.recordingId = uuidv4();

    try {
      const mergedOptions = { ...this.recordingOptions, ...options };
      
      // Use type assertion to satisfy TypeScript
      const mimeType = mergedOptions.mimeType as "video/webm;codecs=vp9";
      
      this.recorder = new RecordRTC(stream, {
        type: 'video',
        mimeType,
        bitsPerSecond: mergedOptions.bitsPerSecond,
      });

      this.recorder.startRecording();
      this.isRecording = true;
      console.log('Recording started with ID:', this.recordingId);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.recorder || !this.isRecording) {
      console.warn('No recording in progress');
      return null;
    }

    return new Promise((resolve, reject) => {
      this.recorder!.stopRecording(() => {
        const blob = this.recorder!.getBlob();
        
        // Clean up
        this.isRecording = false;
        this.recorder = null;
        
        if (this.stream) {
          // Only stop tracks that are for the recorder, not the user's actual media
          // In a real app, you'd need to be more careful about which tracks to stop
          // this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        resolve(blob);
      });
    });
  }

  /**
   * Upload recording to storage
   */
  async uploadRecording(blob: Blob, userId: string, roomId: string): Promise<string> {
    if (!blob) {
      throw new Error('No recording blob to upload');
    }

    const filename = `recordings/${userId}/${roomId}/${this.recordingId}.webm`;
    const storageRef = ref(storage, filename);

    try {
      // Upload the recording blob
      await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      console.log('Recording uploaded successfully:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading recording:', error);
      throw error;
    }
  }

  /**
   * Check if recording is in progress
   */
  isRecordingInProgress(): boolean {
    return this.isRecording;
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.recorder && this.isRecording) {
      this.recorder.pauseRecording();
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.recorder && this.isRecording) {
      this.recorder.resumeRecording();
    }
  }

  // Get the current recording ID
  getCurrentRecordingId(): string {
    return this.recordingId;
  }
} 