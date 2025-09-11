require('dotenv').config();
const express = require('express');
const path = require('path');
const weatherRouter = require('./routes/weather-new');
const spotifyApi = require('./spotify-api');

// Initialize Express app
const app = express();
const PORT = 10001; // Different port to avoid conflicts

// Set up logging
const fs = require('fs');
const util = require('util');
const logFile = fs.createWriteStream('test-weather-route.log', { flags: 'a' });
const logStdout = process.stdout;

console.log = function() {
  const message = util.format.apply(null, arguments) + '\n';
  logFile.write(message);
  logStdout.write(message);
};

console.error = console.log;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log environment configuration
console.log(`Starting test server on port ${PORT}`);
console.log('Environment variables:', JSON.stringify({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ? '***' : 'Missing',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ? '***' : 'Missing',
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY ? '***' : 'Missing'
}, null, 2));

// Initialize Spotify API
if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
  spotifyApi.setCredentials(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET);
  console.log('Spotify credentials initialized');
} else {
  console.error('Missing Spotify API credentials');
}

// Test route
app.get('/', (req, res) => {
  res.send('Test Weather Route Server is running!');
});

// Use the weather router
app.use('/api/v1/weather', weatherRouter);

// Error handling middleware with detailed logging
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
    ...(err.response && {
      response: {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
        headers: err.response.headers
      }
    })
  });
  
  const errorResponse = {
    status: 'error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && {
      details: err.details || err.stack,
      ...(err.response && { response: err.response.data })
    })
  };
  
  res.status(err.status || 500).json(errorResponse);
});

// Start server
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/v1/weather/coords/51.5074/0.1278`);
});
