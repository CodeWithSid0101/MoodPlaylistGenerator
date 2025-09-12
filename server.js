const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Mood Playlist Generator API',
    status: 'Running',
    endpoints: [
      'GET /api/health',
      'POST /api/generate-playlist'
    ]
  });
});

app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!', status: 'OK' });
});

// Mood-based playlist generation endpoint
app.post('/api/generate-playlist', async (req, res) => {
  try {
    const { mood, genre, duration } = req.body;
    
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required' });
    }

    // Placeholder for playlist generation logic
    const playlist = {
      mood,
      genre: genre || 'any',
      duration: duration || 30,
      songs: [
        // This would be populated by your mood-playlist algorithm
        {
          title: "Sample Song",
          artist: "Sample Artist",
          duration: "3:30"
        }
      ]
    };

    res.json({ success: true, playlist });
  } catch (error) {
    console.error('Playlist generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate playlist',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;


// ... existing code...
