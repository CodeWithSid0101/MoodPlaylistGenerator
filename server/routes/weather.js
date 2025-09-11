import express from 'express';
import axios from 'axios';
import { getAccessToken } from '../spotify-api.js';

const router = express.Router();

// Weather to mood mapping
const WEATHER_TO_MOOD = {
  'Thunderstorm': 'dramatic',
  'Drizzle': 'chill',
  'Rain': 'melancholic',
  'Snow': 'cozy',
  'Clear': 'happy',
  'Clouds': 'relaxed',
  'Mist': 'dreamy',
  'Smoke': 'mysterious',
  'Haze': 'ethereal',
  'Dust': 'gritty',
  'Fog': 'mysterious',
  'Sand': 'exotic',
  'Ash': 'dark',
  'Squall': 'intense',
  'Tornado': 'intense'
};

// Mood to Spotify genre mapping
const MOOD_TO_GENRE = {
  'happy': ['pop', 'dance', 'disco'],
  'sad': ['sad', 'blues', 'soul'],
  'energetic': ['rock', 'edm', 'hip-hop'],
  'relaxed': ['chill', 'ambient', 'jazz'],
  'focused': ['classical', 'piano', 'instrumental'],
  'romantic': ['r&b', 'love songs', 'slow jams'],
  'dramatic': ['classical', 'soundtrack', 'epic'],
  'melancholic': ['indie', 'folk', 'acoustic'],
  'cozy': ['jazz', 'acoustic', 'soul'],
  'dreamy': ['dream-pop', 'shoegaze', 'ambient'],
  'mysterious': ['trip-hop', 'dark-ambient', 'experimental'],
  'ethereal': ['ethereal-wave', 'darkwave', 'dream-pop'],
  'gritty': ['punk', 'grunge', 'metal'],
  'exotic': ['world', 'reggae', 'afrobeat'],
  'dark': ['goth', 'darkwave', 'industrial'],
  'intense': ['metal', 'hardcore', 'techno']
};

// Get weather and music recommendations by city
router.get('/:city', async (req, res, next) => {
  try {
    const { city } = req.params;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }

    // Get weather data from OpenWeather API
    const weatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
    );

    const weatherData = weatherResponse.data;
    const weatherMain = weatherData.weather[0].main;
    const weatherDesc = weatherData.weather[0].description;
    const temp = Math.round(weatherData.main.temp);
    
    // Map weather to mood
    const mood = WEATHER_TO_MOOD[weatherMain] || 'relaxed';
    const genres = MOOD_TO_GENRE[mood] || ['pop'];

    // Get Spotify recommendations based on mood
    const accessToken = await getAccessToken();
    const recommendationsResponse = await axios.get(
      'https://api.spotify.com/v1/recommendations',
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: {
          seed_genres: genres.slice(0, 2).join(','),
          limit: 10,
          target_energy: mood === 'relaxed' ? 0.3 : mood === 'energetic' ? 0.9 : 0.6,
          target_valence: mood === 'happy' ? 0.9 : mood === 'sad' ? 0.2 : 0.5
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
      album_art: track.album.images[0]?.url
    }));

    res.json({
      success: true,
      weather: {
        city: weatherData.name,
        country: weatherData.sys.country,
        temp,
        condition: weatherMain,
        description: weatherDesc,
        icon: weatherData.weather[0].icon
      },
      mood,
      tracks
    });
  } catch (error) {
    console.error('Error in weather endpoint:', error.response?.data || error.message);
    next(error);
  }
});

// Get weather and music by coordinates
router.get('/coords/:lat/:lon', async (req, res, next) => {
  try {
    console.log('=== /coords endpoint called ===');
    const { lat, lon } = req.params;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    console.log('Request params:', { lat, lon });
    console.log('OpenWeather API Key:', apiKey ? 'Set' : 'Missing');
    
    if (!lat || !lon) {
      console.error('Missing latitude or longitude');
      return res.status(400).json({ 
        status: 'error',
        message: 'Latitude and longitude are required',
        details: ''
      });
    }

    if (!apiKey) {
      console.error('OpenWeather API key is missing');
      return res.status(500).json({
        status: 'error',
        message: 'Server configuration error',
        details: 'OpenWeather API key is not configured'
      });
    }

    // Get weather data from OpenWeather API
    console.log('Fetching weather data from OpenWeather API...');
    let weatherResponse;
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
      console.log('OpenWeather API URL:', url);
      
      weatherResponse = await axios.get(url, {
        validateStatus: status => status < 500 // Don't throw for 4xx errors
      });
      
      console.log('OpenWeather API response status:', weatherResponse.status);
      
      if (weatherResponse.status !== 200) {
        console.error('OpenWeather API error:', weatherResponse.data);
        throw new Error(`OpenWeather API returned status ${weatherResponse.status}: ${JSON.stringify(weatherResponse.data)}`);
      }
    } catch (error) {
      console.error('Error fetching weather data:', error.message);
      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }

    const weatherData = weatherResponse.data;
    console.log('Weather data received:', JSON.stringify(weatherData, null, 2));
    const weatherMain = weatherData.weather[0].main;
    const weatherDesc = weatherData.weather[0].description;
    const temp = Math.round(weatherData.main.temp);
    
    // Map weather to mood
    const mood = WEATHER_TO_MOOD[weatherMain] || 'relaxed';
    const genres = MOOD_TO_GENRE[mood] || ['pop'];

    // Get Spotify recommendations based on mood
    const accessToken = await getAccessToken();
    const recommendationsResponse = await axios.get(
      'https://api.spotify.com/v1/recommendations',
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: {
          seed_genres: genres.slice(0, 2).join(','),
          limit: 10,
          target_energy: mood === 'relaxed' ? 0.3 : mood === 'energetic' ? 0.9 : 0.6,
          target_valence: mood === 'happy' ? 0.9 : mood === 'sad' ? 0.2 : 0.5
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
      album_art: track.album.images[0]?.url
    }));

    res.json({
      success: true,
      weather: {
        city: weatherData.name,
        country: weatherData.sys.country,
        temp,
        condition: weatherMain,
        description: weatherDesc,
        icon: weatherData.weather[0].icon
      },
      mood,
      tracks
    });
  } catch (error) {
    console.error('Error in coords endpoint:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    });
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      res.status(error.response.status).json({
        status: 'error',
        message: error.response.data?.message || 'Request failed',
        details: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).json({
        status: 'error',
        message: 'No response received from the server',
        details: error.message
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      res.status(500).json({
        status: 'error',
        message: 'Error setting up the request',
        details: error.message
      });
    }
  }
});

// Export the router
export default router;
