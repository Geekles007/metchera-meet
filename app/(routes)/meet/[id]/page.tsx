'use client';

import React, { useState, useEffect } from 'react';
import { MeetingRoom } from '@/app/components/MeetingRoom';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';
import { getMeeting, joinMeeting } from '@/app/lib/meeting-service';

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading: authLoading } = useAuth(); // Get authenticated user
  const [isClient, setIsClient] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingData, setMeetingData] = useState<any>(null);
  const [cameraPermissionChecked, setCameraPermissionChecked] = useState(false);
  const [retryCamera, setRetryCamera] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Wait until we're on the client side to unwrap params
  useEffect(() => {
    setIsClient(true);

    const unwrapParams = async () => {
      try {
        // Instead of using React.use inside a try/catch, access the params differently
        let id: string;
        
        // Check if params is a Promise or already resolved object
        if (params instanceof Promise) {
          const resolvedParams = await params;
          id = resolvedParams.id;
        } else {
          // Fallback if params is not a Promise
          id = (params as any).id;
        }

        if (!id) {
          throw new Error('Invalid meeting ID');
        }
        
        setMeetingId(id);
        
        // For authenticated users, fetch meeting data from Firebase
        if (user) {
          // Fetch meeting data from Firebase
          try {
            const meeting = await getMeeting(id);
            
            if (!meeting) {
              throw new Error('Meeting not found');
            }
            
            if (meeting.status === 'ended') {
              throw new Error('This meeting has already ended');
            }
            
            setMeetingData(meeting);
          } catch (err) {
            console.warn('Meeting data not found, continuing as anonymous', err);
            // Don't throw the error, allow joining as anonymous
          }
        }
        
        // Either way, allow the meeting to proceed
        setIsLoading(false);
      } catch (err) {
        console.error('Error in meeting page:', err);
        setError('Could not load meeting. ' + (err instanceof Error ? err.message : 'Unknown error'));
        setIsLoading(false);
      }
    };

    unwrapParams();
  }, [params, user]);

  // Join the meeting in Firebase when user and meeting ID are available
  useEffect(() => {
    if (!isClient || !meetingId) return;

    // Determine if user is anonymous
    const isUserAnonymous = !user;
    setIsAnonymous(isUserAnonymous);

    // Join meeting in Firebase only if not anonymous
    if (!isUserAnonymous && meetingData) {
      const joinMeetingInFirebase = async () => {
        try {
          const userId = user?.uid;
          const userName = user?.displayName || 'Guest User';
          
          await joinMeeting(meetingId, userId, userName);
        } catch (err) {
          console.error('Error joining meeting in Firebase:', err);
          // Don't set error here as the meeting might still work with WebRTC
        }
      };

      joinMeetingInFirebase();
    } else {
      // For anonymous users, just set loading to false
      setIsLoading(false);
    }
  }, [isClient, meetingId, meetingData, user]);

  // Check camera permissions
  useEffect(() => {
    if (!isClient) return;

    // Check camera permissions
    const checkCameraPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // If successful, immediately stop the tracks to release the camera
        stream.getTracks().forEach(track => track.stop());
        setCameraPermissionChecked(true);
      } catch (err: any) {
        console.error('Camera permission error:', err);
        
        if (err.name === 'NotAllowedError') {
          toast.error('Camera permission denied. Please allow camera access in your browser settings and try again.');
        } else if (err.name === 'NotFoundError') {
          toast.error('No camera or microphone found. Please connect a device and try again.');
        } else {
          toast.error(`Camera error: ${err.message || 'Unknown error'}`);
        }
        
        setCameraPermissionChecked(true);
      }
    };

    checkCameraPermissions();
  }, [isClient, retryCamera]);

  // Create user info using authenticated user data if available, or create anonymous user
  const userInfo = isClient ? {
    id: user?.uid || 'anon-' + Math.random().toString(36).substring(2, 9),
    name: user?.displayName || 'Anonymous User',
  } : { id: '', name: '' };

  // Show loading state while preparing the meeting or authentication is loading
  if (isLoading || authLoading || !cameraPermissionChecked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Loading meeting...</p>
        </div>
      </div>
    );
  }

  // Show error message if something went wrong
  if (error || !meetingId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center p-8 bg-gray-800 rounded-xl max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Could Not Join Meeting</h2>
          <p className="text-gray-400 mb-6">{error || 'Invalid meeting ID'}</p>
          <p className="text-gray-400 mb-6">You can still join this meeting anonymously, but your participation won't be saved.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Return to Home
            </button>
            <button 
              onClick={() => {
                // Set anonymous mode and clear error to continue
                setIsAnonymous(true);
                setError(null);
                setIsLoading(false);
              }}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Join Anonymously
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only render MeetingRoom when we're on client and have a valid meeting ID
  return isClient && meetingId ? (
    <MeetingRoom
      roomId={meetingId}
      userId={userInfo.id}
      userName={userInfo.name}
      isAnonymous={isAnonymous}
      onExit={() => {
        window.location.href = '/';
      }}
    />
  ) : null;
} 