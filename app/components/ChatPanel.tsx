'use client';

import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from './ui/button';
import { socket, socketEvents } from '@/app/lib/socket';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  roomId: string;
  userId: string;
  userName: string;
  messages?: Message[];
  onSendMessage?: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  roomId, 
  userId, 
  userName, 
  messages = [], 
  onSendMessage 
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only register this effect if we're not using external messages
    if (!onSendMessage) {
      socket.on(socketEvents.chatMessage, (message: Message) => {
        // We don't need this handler if messages are managed externally
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted' && (!document.hasFocus() || document.visibilityState === 'hidden')) {
            new Notification(`New message from ${message.sender}`, {
              body: message.text.substring(0, 50) + (message.text.length > 50 ? '...' : '')
            });
          }
        }
      });

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      return () => {
        socket.off(socketEvents.chatMessage);
      };
    }
  }, [onSendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    if (onSendMessage) {
      // Use the parent component's handler
      onSendMessage(newMessage);
      setNewMessage('');
      return;
    }

    // Only use this if we're not using the parent's handler
    const message: Message = {
      id: `${Date.now()}-${userId}-${Math.random().toString(36).substring(2, 10)}`,
      sender: userName,
      text: newMessage,
      timestamp: Date.now(),
    };

    socket.emit(socketEvents.sendMessage, { roomId, message });
    setNewMessage('');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-100 dark:bg-gray-800">
        <h2 className="text-lg font-semibold">Chat</h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No messages yet
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 ${
                message.sender === userName ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block p-3 rounded-lg ${
                  message.sender === userName
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                {message.sender !== userName && (
                  <div className="font-medium text-sm mb-1">{message.sender}</div>
                )}
                <div>{message.text}</div>
                <div className="text-xs mt-1 opacity-70">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t dark:border-gray-700">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-l-lg focus:outline-none"
            placeholder="Type a message..."
          />
          <Button
            onClick={handleSendMessage}
            className="px-4 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600"
          >
            <Send size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}; 