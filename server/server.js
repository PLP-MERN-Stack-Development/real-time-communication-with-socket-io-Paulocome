  // server.js - Robust Socket.io Chat Server

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

// --- MongoDB Models --- //
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  socketId: { type: String },
  online: { type: Boolean, default: true },
});
const MessageSchema = new mongoose.Schema({
  sender: String,
  senderId: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
  isPrivate: { type: Boolean, default: false },
  to: String, // recipient socketId for private messages
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// --- Express + HTTP + Socket.io --- //
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// --- Middleware --- //
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Connect to MongoDB --- //
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chat', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// --- Socket.io Connection --- //
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User join with basic authentication (username)
  socket.on('user_join', async (username) => {
    try {
      let user = await User.findOne({ username });
      if (!user) {
        user = await User.create({ username, socketId: socket.id, online: true });
      } else {
        user.socketId = socket.id;
        user.online = true;
        await user.save();
      }

      const users = await User.find({ online: true });
      io.emit('user_list', users);
      io.emit('user_joined', { username, id: socket.id });
      console.log(`${username} joined the chat`);
    } catch (err) {
      console.error('Error on user_join:', err);
    }
  });

  // Handle sending message
  socket.on('send_message', async (messageData) => {
    try {
      const user = await User.findOne({ socketId: socket.id });
      const message = await Message.create({
        ...messageData,
        sender: user?.username || 'Anonymous',
        senderId: socket.id,
      });

      io.emit('receive_message', message);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  // Typing indicator
  socket.on('typing', async (isTyping) => {
    try {
      const user = await User.findOne({ socketId: socket.id });
      if (user) {
        io.emit('typing_users', { [user.username]: isTyping });
      }
    } catch (err) {
      console.error('Error on typing:', err);
    }
  });

  // Private message
  socket.on('private_message', async ({ to, message }) => {
    try {
      const user = await User.findOne({ socketId: socket.id });
      const msg = await Message.create({
        sender: user?.username || 'Anonymous',
        senderId: socket.id,
        message,
        isPrivate: true,
        to,
      });

      socket.to(to).emit('private_message', msg);
      socket.emit('private_message', msg);
    } catch (err) {
      console.error('Error on private_message:', err);
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    try {
      const user = await User.findOne({ socketId: socket.id });
      if (user) {
        user.online = false;
        await user.save();
        io.emit('user_left', { username: user.username, id: socket.id });

        const users = await User.find({ online: true });
        io.emit('user_list', users);
      }
      console.log(`User disconnected: ${socket.id}`);
    } catch (err) {
      console.error('Error on disconnect:', err);
    }
  });
});

// --- API Routes --- //
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: -1 }).limit(100);
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({ online: true });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/', (req, res) => {
  res.send('Socket.io Robust Chat Server is running');
});

// --- Start Server --- //
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, server, io };
  
