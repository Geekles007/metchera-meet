import { io } from 'socket.io-client';

// Socket.io client instance
let socket: any;

// Make sure the socket URL is properly formatted
const getSocketUrl = () => {
  // Get the URL from environment or use default
  let url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
  
  // Trim any whitespace
  url = url.trim();
  
  // Ensure it has a valid protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  
  return url;
};

// Interface for chat messages
export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

// Interface for room participants
export interface Participant {
  id: string;
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
}

// ONLY initialize socket on the client side
if (typeof window !== 'undefined') {
  // Create socket connection only in browser environment
  socket = io(getSocketUrl(), {
    autoConnect: false,
    transports: ['websocket'],
  });
  
  // Connect the socket
  socket.connect();
  
  // Handle socket reconnection
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    setTimeout(() => {
      if (socket.disconnected) {
        socket.connect();
      }
    }, 5000);
  });
} else {
  // Provide a dummy socket for server-side rendering that won't actually do anything
  socket = {
    on: () => {},
    emit: () => {},
    connect: () => {},
    disconnect: () => {},
    disconnected: true,
  };
}

// Export the socket instance
export { socket };

// Export socket events for easy access
export const socketEvents = {
  // Connection events
  connect: 'connect',
  disconnect: 'disconnect',
  
  // Room events
  joinRoom: 'join-room',
  leaveRoom: 'leave-room',
  roomInfo: 'room-info',
  
  // Participant events
  participantJoined: 'user-joined',
  participantLeft: 'user-left',
  participantUpdate: 'user-update',
  participantsList: 'users-list',
  getParticipants: 'get-participants',
  
  // Chat events
  sendMessage: 'send-message',
  chatMessage: 'new-message',
  
  // Media events
  updateMedia: 'update-media',
  
  // Signaling events
  sendSignal: 'signal',
  receiveSignal: 'signal',
}; 