const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

// In-memory store for active rooms and users
const rooms = new Map();
const users = new Map();

// Create HTTP server
const server = http.createServer();

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join a room
  socket.on('join-room', ({ roomId, user }) => {
    try {
      // Create user with socket ID
      const userId = user.id || uuidv4();
      const newUser = {
        id: userId,
        socketId: socket.id,
        name: user.name,
        roomId,
      };

      // Store user information
      users.set(socket.id, newUser);

      // Join the socket room
      socket.join(roomId);

      // Create room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          users: [],
          messages: [],
        });
      }

      // Add user to room
      const room = rooms.get(roomId);
      room.users.push(newUser);
      rooms.set(roomId, room);

      // Notify room members of the new user
      io.to(roomId).emit('user-joined', { user: newUser, users: room.users });

      // Send room information to the new user
      socket.emit('room-info', room);

      console.log(`User ${userId} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave a room
  socket.on('leave-room', ({ roomId, userId }) => {
    try {
      if (!rooms.has(roomId)) return;

      const room = rooms.get(roomId);
      
      // Remove user from room
      room.users = room.users.filter((user) => user.id !== userId);
      
      // Update or delete room based on remaining users
      if (room.users.length === 0) {
        rooms.delete(roomId);
      } else {
        rooms.set(roomId, room);
      }

      // Remove user from users map
      users.delete(socket.id);

      // Leave socket room
      socket.leave(roomId);

      // Notify remaining room members
      io.to(roomId).emit('user-left', { userId, users: room.users });

      console.log(`User ${userId} left room ${roomId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // WebRTC signaling
  socket.on('signal', ({ signal, to }) => {
    try {
      const fromUser = users.get(socket.id);
      
      if (!fromUser) return;
      
      // Find target socket
      const targetUser = Array.from(users.values()).find((user) => user.id === to);
      
      if (targetUser) {
        io.to(targetUser.socketId).emit('signal', {
          signal,
          from: fromUser.id,
        });
      }
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  });

  // Handle media updates
  socket.on('update-media', ({ roomId, userId, updates }) => {
    try {
      if (!rooms.has(roomId)) return;

      const room = rooms.get(roomId);
      const userIndex = room.users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) return;
      
      // Update user's media status
      room.users[userIndex] = {
        ...room.users[userIndex],
        ...updates
      };
      
      // Save updated room state
      rooms.set(roomId, room);
      
      // Broadcast update to all users in the room
      io.to(roomId).emit('update-media', { userId, updates });
      
      console.log(`Media update in room ${roomId} for user ${userId}:`, updates);
    } catch (error) {
      console.error('Error updating media status:', error);
    }
  });

  // Chat messaging
  socket.on('send-message', ({ roomId, message }) => {
    try {
      if (!rooms.has(roomId)) return;

      const room = rooms.get(roomId);
      
      // Make sure the message object has a valid string sender
      if (typeof message.sender === 'object') {
        message = {
          ...message,
          sender: message.sender.name || 'Unknown'
        };
      }
      
      // Add message to room history
      room.messages.push(message);
      rooms.set(roomId, room);

      // Broadcast message to room (including sender for consistent UI)
      io.to(roomId).emit('new-message', message);

      console.log(`New message in room ${roomId} from user ${message.sender}`);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    try {
      const user = users.get(socket.id);
      
      if (user && user.roomId) {
        // Handle user leaving all rooms
        if (rooms.has(user.roomId)) {
          const room = rooms.get(user.roomId);
          
          // Remove user from room
          room.users = room.users.filter((u) => u.id !== user.id);
          
          // Update or delete room
          if (room.users.length === 0) {
            rooms.delete(user.roomId);
          } else {
            rooms.set(user.roomId, room);
            
            // Notify remaining room members
            io.to(user.roomId).emit('user-left', { userId: user.id, users: room.users });
          }
        }
        
        // Remove user record
        users.delete(socket.id);
      }

      console.log('Client disconnected:', socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Start the server
const PORT = process.env.SOCKET_PORT || 4000;

server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});

module.exports = server; 