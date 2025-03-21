'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { createMeeting } from '@/app/lib/meeting-service';
import { generateMeetingId } from '@/app/lib/utils';
import { toast } from 'sonner';

export default function NewMeetingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isCreating, setIsCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return; // Wait for auth to load
    
    // Generate a new meeting ID and redirect to that meeting
    const setupMeeting = async () => {
      try {
        setIsCreating(true);
        
        // Use user info from auth if available, or create a guest ID
        const userId = user?.uid || 'anon-' + Math.random().toString(36).substring(2, 9);
        const userName = user?.displayName || 'Anonymous User';
        
        let meetingId;
        
        // Create meeting in Firebase only if user is authenticated
        if (user) {
          meetingId = await createMeeting(userId, userName);
        } else {
          // For anonymous users, just generate a meeting ID without Firebase
          meetingId = generateMeetingId();
          toast.info('Creating anonymous meeting. This meeting will not be saved to your account.');
        }
        
        // Redirect to meeting page
        router.push(`/meet/${meetingId}`);
      } catch (err) {
        console.error('Error creating meeting:', err);
        setError('Failed to create meeting. Please try again.');
        setIsCreating(false);
        toast.error('Failed to create meeting');
      }
    };

    setupMeeting();
  }, [router, user, loading]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center">
          {error ? (
            <>
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Error</h2>
              <p className="text-gray-400 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-white animate-pulse" 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Creating your meeting</h2>
              <p className="text-gray-400">Just a moment while we set things up...</p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
} 