const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory storage (replace with database in production)
let users = [];
let playlists = [];

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Mood Playlist Generator API',
    status: 'Running',
    endpoints: [
      'POST /api/register',
      'POST /api/login', 
      'GET /api/health',
      'POST /api/generate-playlist',
      'GET /admin/dashboard',
      'GET /admin/users'
    ]
  });
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user exists
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = {
      id: users.length + 1,
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// Protected Routes
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!', status: 'OK' });
});

// Playlist generation (protected)
app.post('/api/generate-playlist', authenticateToken, async (req, res) => {
  try {
    const { mood, genre, duration } = req.body;
    
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required' });
    }

    const playlist = {
      id: playlists.length + 1,
      userId: req.user.id,
      mood,
      genre: genre || 'any',
      duration: duration || 30,
      songs: [
        {
          title: "Happy Song",
          artist: "Mood Artist",
          duration: "3:30"
        },
        {
          title: "Energetic Track",
          artist: "Vibe Creator", 
          duration: "4:15"
        }
      ],
      createdAt: new Date().toISOString()
    };

    playlists.push(playlist);

    res.json({ success: true, playlist });
  } catch (error) {
    console.error('Playlist generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate playlist',
      message: error.message 
    });
  }
});

// Admin Routes
app.get('/admin/dashboard', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    success: true,
    stats: {
      totalUsers: users.length,
      totalPlaylists: playlists.length,
      adminUser: req.user.username,
      lastLogin: new Date().toISOString()
    },
    recentActivity: playlists.slice(-5)
  });
});

app.get('/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const userList = users.map(({ password, ...user }) => user);
  res.json({
    success: true,
    users: userList
  });
});

app.delete('/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users.splice(userIndex, 1);
  res.json({ success: true, message: 'User deleted successfully' });
});

// Static pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/admin', authenticateToken, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Create default admin user
  if (users.length === 0) {
    bcrypt.hash('admin123', 10).then(hash => {
      users.push({
        id: 1,
        username: 'admin',
        email: 'admin@moodplaylist.com',
        password: hash,
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      console.log('Default admin user created - Email: admin@moodplaylist.com, Password: admin123');
    });
  }
});

module.exports = app;


// ... existing code...
