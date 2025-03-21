'use client';

import { useState, useEffect } from 'react';
import { User, Mic, MicOff, Video, VideoOff, ScreenShare } from 'lucide-react';
import { socket, socketEvents } from '@/app/lib/socket';

interface RoomUser {
  id: string;
  name: string;
  socketId?: string;
  roomId?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  isScreenSharing?: boolean;
}

interface Participant {
  id: string;
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
}

interface ParticipantListProps {
  roomId: string;
  currentUserId: string;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  roomId,
  currentUserId,
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    // Listen for participant updates using the correct socket events
    socket.on(socketEvents.participantJoined, ({ user, users }: { user: RoomUser; users: RoomUser[] }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.id === user.id)) {
          return prev;
        }
        return [...prev, {
          id: user.id,
          name: user.name,
          audioEnabled: user.audioEnabled ?? true,
          videoEnabled: user.videoEnabled ?? true,
          isScreenSharing: user.isScreenSharing ?? false,
        }];
      });
    });

    socket.on(socketEvents.participantLeft, ({ userId: leftUserId, users }: { userId: string; users: RoomUser[] }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== leftUserId));
    });

    socket.on(socketEvents.updateMedia, ({ userId, updates }: { userId: string; updates: Partial<Participant> }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, ...updates } : p))
      );
    });

    socket.on(socketEvents.roomInfo, (room: { id: string, users: RoomUser[], messages: any[] }) => {
      // Filter out the current user and format participant data
      setParticipants(
        room.users
          .filter(user => user.id !== currentUserId)
          .map(user => ({
            id: user.id,
            name: user.name,
            audioEnabled: user.audioEnabled ?? true,
            videoEnabled: user.videoEnabled ?? true,
            isScreenSharing: user.isScreenSharing ?? false,
          }))
      );
    });

    // Request current participants on mount
    socket.emit(socketEvents.getParticipants, roomId);

    // Debug logging to help identify the issue
    socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    return () => {
      socket.off(socketEvents.participantJoined);
      socket.off(socketEvents.participantLeft);
      socket.off(socketEvents.updateMedia);
      socket.off(socketEvents.roomInfo);
      socket.off('error');
    };
  }, [roomId, currentUserId]);

  return (
    <div className="bg-gray-900 overflow-hidden h-full flex flex-col">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Participants ({participants.length + 1})</h2>
      </div>

      <div className="p-2 overflow-y-auto flex-1">
        <ul className="space-y-2">
          {/* Current user (always first in the list) */}
          <li className="flex items-center justify-between p-3 rounded-lg bg-blue-900/30">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-lg mr-3">
                {currentUserId.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-white">You</p>
              </div>
            </div>
          </li>
          
          {/* Other participants */}
          {participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <User size={48} className="mb-2 opacity-50" />
              <p>No other participants</p>
            </div>
          ) : (
            participants.map((participant) => (
              <li
                key={participant.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800 hover:bg-gray-700"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg mr-3">
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{participant.name}</p>
                    {participant.isScreenSharing && (
                      <div className="flex items-center text-xs text-blue-400">
                        <ScreenShare size={12} className="mr-1" />
                        <span>Sharing screen</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2">
                  {participant.audioEnabled ? (
                    <Mic size={16} className="text-green-500" />
                  ) : (
                    <MicOff size={16} className="text-red-500" />
                  )}
                  {participant.videoEnabled ? (
                    <Video size={16} className="text-green-500" />
                  ) : (
                    <VideoOff size={16} className="text-red-500" />
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}; 