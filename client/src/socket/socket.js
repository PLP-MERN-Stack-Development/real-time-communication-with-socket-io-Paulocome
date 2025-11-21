 // socket.js - Socket.io client setup with React hook

import { io } from 'socket.io-client';
import { useEffect, useState, useCallback } from 'react';

// Socket.io server URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create socket instance with reconnection settings
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'], // fallback to long polling
});

// Custom React hook to manage socket events
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Connect to the socket server with optional username
  const connect = useCallback((username) => {
    if (!socket.connected) socket.connect();
    if (username) {
      socket.emit('user_join', username);
    }
  }, []);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socket.connected) socket.disconnect();
  }, []);

  // Send a public message
  const sendMessage = useCallback((message) => {
    if (!message) return;
    socket.emit('send_message', { message });
  }, []);

  // Send a private message
  const sendPrivateMessage = useCallback((to, message) => {
    if (!to || !message) return;
    socket.emit('private_message', { to, message });
  }, []);

  // Set typing status
  const setTyping = useCallback((isTyping) => {
    socket.emit('typing', isTyping);
  }, []);

  // Load socket events
  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    const handlePrivateMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    const handleUserList = (userList) => setUsers(userList);

    const handleUserJoined = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const handleUserLeft = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const handleTypingUsers = (typing) => setTypingUsers(typing);

    // Register events
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('private_message', handlePrivateMessage);
    socket.on('user_list', handleUserList);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('typing_users', handleTypingUsers);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('private_message', handlePrivateMessage);
      socket.off('user_list', handleUserList);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('typing_users', handleTypingUsers);
    };
  }, []);

  return {
    socket,
    isConnected,
    messages,
    lastMessage,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
  };
};

export default socket;
  
