'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { getUserMeetings, MeetingData } from '@/app/lib/meeting-service';
import { toast } from 'sonner';
import { formatDistanceToNow } from '@/app/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [recentMeetings, setRecentMeetings] = useState<MeetingData[]>([]);
  const [meetingCode, setMeetingCode] = useState('');
  
  // Load user's recent meetings
  useEffect(() => {
    const loadMeetings = async () => {
      if (!user?.uid) return;
      
      try {
        setIsLoading(true);
        const meetings = await getUserMeetings(user.uid, 5);
        setRecentMeetings(meetings);
      } catch (error) {
        console.error('Error loading meetings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadMeetings();
  }, [user?.uid]);
  
  // Handle joining a meeting by code
  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up and validate meeting code
    const code = meetingCode.trim();
    
    if (!code) {
      toast.error('Please enter a valid meeting code');
      return;
    }
    
    // Navigate to meeting
    router.push(`/meet/${code}`);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white px-4 py-10">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Start a new meeting</h2>
              <p className="text-gray-400 mb-6">
                Create a new meeting and invite others to join
              </p>
              <Link href="/meet/new">
                <Button className="w-full">New Meeting</Button>
              </Link>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Join a meeting</h2>
              <p className="text-gray-400 mb-6">
                Enter a meeting code to join an existing meeting
              </p>
              <form onSubmit={handleJoinMeeting} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter meeting code (xxx-xxx-xxx)"
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  required
                />
                <Button type="submit">Join</Button>
              </form>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Scheduled meetings</h2>
              <p className="text-gray-400">
                You have no upcoming meetings
              </p>
            </div>
          </div>
          
          {/* Recent meetings */}
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Recent Meetings</h2>
            
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : recentMeetings.length > 0 ? (
              <div className="overflow-hidden bg-gray-800 rounded-xl border border-gray-700">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-750">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Meeting Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Participants
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {recentMeetings.map((meeting) => (
                      <tr key={meeting.id} className="hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {meeting.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {meeting.createdAt 
                            ? (typeof meeting.createdAt === 'number' 
                              ? formatDistanceToNow(new Date(meeting.createdAt)) 
                              : typeof meeting.createdAt.toDate === 'function' 
                                ? formatDistanceToNow(meeting.createdAt.toDate()) 
                                : 'Unknown')
                            : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            meeting.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {meeting.status === 'active' ? 'Active' : 'Ended'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {meeting.participants ? meeting.participants.length : 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {meeting.status === 'active' && (
                            <Link href={`/meet/${meeting.id}`}>
                              <Button size="sm" variant="default">
                                Join
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-12 border border-gray-700 text-center">
                <p className="text-gray-400">You don't have any recent meetings</p>
                <Link href="/meet/new" className="mt-4 inline-block">
                  <Button>Start your first meeting</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 