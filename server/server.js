// Server-side script to handle user registration for Spotify Developer Dashboard
// Load environment variables from .env file
const path = require('path');

// Try multiple approaches to load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (error) {
  console.log('Dotenv config failed, trying alternative approach');
}

// Fallback: Set environment variables directly if not loaded
if (!process.env.OPENWEATHER_API_KEY) {
  process.env.OPENWEATHER_API_KEY = '81165c8839597701582170a90141d335';
}
if (!process.env.SPOTIFY_CLIENT_ID) {
  process.env.SPOTIFY_CLIENT_ID = 'e220331f3909482ab6ebce2730a49e8f';
}
if (!process.env.SPOTIFY_CLIENT_SECRET) {
  process.env.SPOTIFY_CLIENT_SECRET = 'b57beb3b92694f1788792f731d85d07b';
}
if (!process.env.PORT) {
  process.env.PORT = '3000';
}

// Debug environment variables
console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OPENWEATHER_API_KEY exists:', !!process.env.OPENWEATHER_API_KEY);
console.log('SPOTIFY_CLIENT_ID exists:', !!process.env.SPOTIFY_CLIENT_ID);
console.log('PORT:', process.env.PORT);

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const spotifyApi = require('./spotify-api');

// Initialize Spotify API with credentials from environment variables
if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
  spotifyApi.setCredentials(
    process.env.SPOTIFY_CLIENT_ID,
    process.env.SPOTIFY_CLIENT_SECRET
  );
  console.log('Spotify API credentials loaded');
} else {
  console.warn('Spotify API credentials not found in environment variables');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Data storage path
const dataDir = path.join(__dirname, 'data');
const usersFilePath = path.join(dataDir, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize users file if it doesn't exist
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, JSON.stringify({ users: [] }), 'utf8');
}

// Helper function to read users
function readUsers() {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return { users: [] };
  }
}

// Helper function to write users
function writeUsers(data) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing users file:', error);
    return false;
  }
}

// Routes
app.post('/api/register', (req, res) => {
  try {
    const { username, email } = req.body;
    
    // Validate input
    if (!username || !email) {
      return res.status(400).json({ success: false, message: 'Username and email are required' });
    }
    
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    
    // Read existing users
    const data = readUsers();
    
    // Check if user already exists
    const userExists = data.users.some(user => user.email === email);
    if (userExists) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }
    
    // Add new user
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      registeredAt: new Date().toISOString(),
      status: 'pending' // pending, approved, rejected
    };
    
    data.users.push(newUser);
    
    // Save updated users
if (writeUsers(data)) {
  // Queue the user for addition to Spotify Developer Dashboard
  try {
    // This is an async operation but we don't need to wait for it
    spotifyApi.addUserToDashboard(newUser)
      .then(result => {
        console.log('User queued for Spotify Dashboard:', result);
      })
      .catch(err => {
        console.error('Failed to queue user for Spotify Dashboard:', err);
      });
  } catch (error) {
    console.error('Error in Spotify API integration:', error);
    // We continue even if Spotify integration fails
  }
  
  return res.status(201).json({ 
    success: true, 
    message: 'User registered successfully',
    user: newUser
  });
} else {
  return res.status(500).json({ success: false, message: 'Failed to save user data' });
}
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const data = readUsers();
    res.json({ success: true, users: data.users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Admin routes
app.put('/api/users/:userId/status', (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    
    const data = readUsers();
    const userIndex = data.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update user status
    data.users[userIndex].status = status;
    
    // If approved, integrate with Spotify Developer Dashboard API
if (status === 'approved') {
  try {
    // Add the user to Spotify Developer Dashboard
    spotifyApi.addUserToDashboard(data.users[userIndex])
      .then(result => {
        console.log('User added to Spotify Dashboard:', result);
      })
      .catch(err => {
        console.error('Failed to add user to Spotify Dashboard:', err);
      });
  } catch (error) {
    console.error('Error in Spotify API integration:', error);
    // We continue even if Spotify integration fails
  }
}
    
    if (writeUsers(data)) {
      return res.json({ 
        success: true, 
        message: `User status updated to ${status}`,
        user: data.users[userIndex]
      });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to update user status' });
    }
    
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Server error during status update' });
  }
});

app.delete('/api/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const data = readUsers();
    const userIndex = data.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Store user info before removal
    const removedUser = data.users[userIndex];
    
    // Remove user from Spotify Developer Dashboard if they were approved
if (data.users[userIndex].status === 'approved') {
  try {
    spotifyApi.removeUserFromDashboard(data.users[userIndex].email)
      .then(result => {
        console.log('User removed from Spotify Dashboard:', result);
      })
      .catch(err => {
        console.error('Failed to remove user from Spotify Dashboard:', err);
      });
  } catch (error) {
    console.error('Error in Spotify API integration:', error);
  }
}

// Remove user from local storage
data.users.splice(userIndex, 1);
    
    if (writeUsers(data)) {
      return res.json({ 
        success: true, 
        message: 'User deleted successfully',
        user: removedUser
      });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
    
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Server error during user deletion' });
  }
});

// Serve static files for admin dashboard and main app
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/callback', express.static(path.join(__dirname, '../callback')));
app.use(express.static(path.join(__dirname, '..')));

// Weather-to-mood mapping
const weatherMoodMap = {
  'clear sky': { mood: 'happy', genres: ['pop', 'dance', 'funk', 'disco'] },
  'few clouds': { mood: 'relaxed', genres: ['indie', 'alternative', 'chill'] },
  'scattered clouds': { mood: 'contemplative', genres: ['indie-rock', 'alternative', 'folk'] },
  'broken clouds': { mood: 'mellow', genres: ['acoustic', 'singer-songwriter', 'indie'] },
  'shower rain': { mood: 'cozy', genres: ['jazz', 'blues', 'soul'] },
  'rain': { mood: 'melancholic', genres: ['indie', 'alternative', 'ambient'] },
  'thunderstorm': { mood: 'intense', genres: ['rock', 'metal', 'electronic'] },
  'snow': { mood: 'peaceful', genres: ['classical', 'ambient', 'folk'] },
  'mist': { mood: 'dreamy', genres: ['ambient', 'chillout', 'downtempo'] }
};

// OpenWeather API endpoint by city name
app.get('/api/weather/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'OpenWeather API key not configured' 
      });
    }

    const weatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
    );

    const weather = weatherResponse.data;
    const weatherDescription = weather.weather[0].description;
    const moodData = weatherMoodMap[weatherDescription] || weatherMoodMap['few clouds'];

    res.json({
      success: true,
      weather: {
        city: weather.name,
        country: weather.sys.country,
        temperature: Math.round(weather.main.temp),
        description: weatherDescription,
        icon: weather.weather[0].icon,
        humidity: weather.main.humidity,
        windSpeed: weather.wind.speed
      },
      mood: moodData.mood,
      recommendedGenres: moodData.genres
    });

  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch weather data' 
    });
  }
});

// OpenWeather API endpoint by coordinates
app.get('/api/weather-coords/:lat/:lon', async (req, res) => {
  try {
    const { lat, lon } = req.params;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'OpenWeather API key not configured' 
      });
    }

    const weatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );

    const weather = weatherResponse.data;
    const weatherDescription = weather.weather[0].description;
    const moodData = weatherMoodMap[weatherDescription] || weatherMoodMap['few clouds'];

    res.json({
      success: true,
      weather: {
        city: weather.name,
        country: weather.sys.country,
        temperature: Math.round(weather.main.temp),
        description: weatherDescription,
        icon: weather.weather[0].icon,
        humidity: weather.main.humidity,
        windSpeed: weather.wind.speed,
        coordinates: { lat: weather.coord.lat, lon: weather.coord.lon }
      },
      mood: moodData.mood,
      recommendedGenres: moodData.genres
    });

  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch weather data' 
    });
  }
});

// Combined weather + music recommendations by coordinates
app.get('/api/weather-music-coords/:lat/:lon', async (req, res) => {
  try {
    const { lat, lon } = req.params;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'OpenWeather API key not configured' 
      });
    }

    // Get weather data directly by coordinates
    const weatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );

    const weather = weatherResponse.data;
    const weatherDescription = weather.weather[0].description;
    const moodData = weatherMoodMap[weatherDescription] || weatherMoodMap['few clouds'];

    const weatherData = {
      weather: {
        city: weather.name,
        country: weather.sys.country,
        temperature: Math.round(weather.main.temp),
        description: weatherDescription,
        icon: weather.weather[0].icon,
        humidity: weather.main.humidity,
        windSpeed: weather.wind.speed,
        coordinates: { lat: weather.coord.lat, lon: weather.coord.lon }
      },
      mood: moodData.mood,
      recommendedGenres: moodData.genres
    };

    // Get Spotify access token
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get music recommendations for each genre
    const musicPromises = weatherData.recommendedGenres.map(async genre => {
      try {
        const response = await axios.get(
          `https://api.spotify.com/v1/recommendations?seed_genres=${genre}&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        return response.data.tracks.map(track => ({
          id: track.id,
          name: track.name,
          artist: track.artists[0].name,
          album: track.album.name,
          preview_url: track.preview_url,
          external_url: track.external_urls.spotify,
          image: track.album.images[0]?.url,
          duration_ms: track.duration_ms
        }));
      } catch (err) {
        console.error(`Error fetching ${genre} recommendations:`, err.message);
        return [];
      }
    });

    const musicResponses = await Promise.all(musicPromises);
    const allTracks = musicResponses.flat();

    // Shuffle and limit tracks
    const shuffledTracks = allTracks.sort(() => 0.5 - Math.random()).slice(0, 20);

    res.json({
      success: true,
      weather: weatherData.weather,
      mood: weatherData.mood,
      recommendedGenres: weatherData.recommendedGenres,
      tracks: shuffledTracks,
      autoDetected: true
    });

  } catch (error) {
    console.error('Weather-music coords API error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.response?.data?.message || 'Failed to fetch weather-based music recommendations' 
    });
  }
});

// Spotify genre-based playlist recommendations
app.get('/api/spotify/recommendations/:genre', async (req, res) => {
  try {
    const { genre } = req.params;
    const limit = req.query.limit || 20;
    
    // Get Spotify access token
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get recommendations based on genre
    const recommendationsResponse = await axios.get(
      `https://api.spotify.com/v1/recommendations?seed_genres=${genre}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const tracks = recommendationsResponse.data.tracks.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      album: track.album.name,
      preview_url: track.preview_url,
      external_url: track.external_urls.spotify,
      image: track.album.images[0]?.url,
      duration_ms: track.duration_ms
    }));

    res.json({
      success: true,
      genre: genre,
      tracks: tracks
    });

  } catch (error) {
    console.error('Spotify recommendations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch Spotify recommendations' 
    });
  }
});

// Get popular playlists by genre
app.get('/api/spotify/playlists/:genre', async (req, res) => {
  try {
    const { genre } = req.params;
    const limit = req.query.limit || 10;
    
    // Get Spotify access token
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Search for playlists by genre
    const playlistsResponse = await axios.get(
      `https://api.spotify.com/v1/search?q=genre:${genre}&type=playlist&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const playlists = playlistsResponse.data.playlists.items.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      owner: playlist.owner.display_name,
      tracks_total: playlist.tracks.total,
      external_url: playlist.external_urls.spotify,
      image: playlist.images[0]?.url
    }));

    res.json({
      success: true,
      genre: genre,
      playlists: playlists
    });

  } catch (error) {
    console.error('Spotify playlists error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch Spotify playlists' 
    });
  }
});

// Combined weather + music recommendations
app.get('/api/weather-music/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'OpenWeather API key not configured' 
      });
    }

    // Get weather data directly
    const weatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
    );

    const weather = weatherResponse.data;
    const weatherDescription = weather.weather[0].description;
    const moodData = weatherMoodMap[weatherDescription] || weatherMoodMap['few clouds'];

    const weatherData = {
      weather: {
        city: weather.name,
        country: weather.sys.country,
        temperature: Math.round(weather.main.temp),
        description: weatherDescription,
        icon: weather.weather[0].icon,
        humidity: weather.main.humidity,
        windSpeed: weather.wind.speed
      },
      mood: moodData.mood,
      recommendedGenres: moodData.genres
    };

    // Get Spotify access token
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get music recommendations for each genre
    const musicPromises = weatherData.recommendedGenres.map(async genre => {
      try {
        const response = await axios.get(
          `https://api.spotify.com/v1/recommendations?seed_genres=${genre}&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        return response.data.tracks.map(track => ({
          id: track.id,
          name: track.name,
          artist: track.artists[0].name,
          album: track.album.name,
          preview_url: track.preview_url,
          external_url: track.external_urls.spotify,
          image: track.album.images[0]?.url,
          duration_ms: track.duration_ms
        }));
      } catch (err) {
        console.error(`Error fetching ${genre} recommendations:`, err.message);
        return [];
      }
    });

    const musicResponses = await Promise.all(musicPromises);
    const allTracks = musicResponses.flat();

    // Shuffle and limit tracks
    const shuffledTracks = allTracks.sort(() => 0.5 - Math.random()).slice(0, 20);

    res.json({
      success: true,
      weather: weatherData.weather,
      mood: weatherData.mood,
      recommendedGenres: weatherData.recommendedGenres,
      tracks: shuffledTracks
    });

  } catch (error) {
    console.error('Weather-music API error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.response?.data?.message || 'Failed to fetch weather-based music recommendations' 
    });
  }
});

// Serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
