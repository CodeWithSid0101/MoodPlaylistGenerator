const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Weather to mood mapping
const WEATHER_TO_MOOD = {
  'Thunderstorm': 'dramatic',
  'Drizzle': 'chill',
  'Rain': 'melancholic',
  'Snow': 'cozy',
  'Clear': 'happy',
  'Clouds': 'relaxed',
  'Mist': 'dreamy'
};

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Weather API endpoint
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
    const weatherMain = weather.weather[0].main;
    const mood = WEATHER_TO_MOOD[weatherMain] || 'relaxed';

    res.json({
      success: true,
      weather: {
        city: weather.name,
        country: weather.sys.country,
        temperature: Math.round(weather.main.temp),
        description: weather.weather[0].description,
        icon: weather.weather[0].icon,
        humidity: weather.main.humidity,
        windSpeed: weather.wind.speed
      },
      mood: mood
    });
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather data',
      error: error.message
    });
  }
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ status: 'success', message: 'API is working!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment variables:');
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`- SPOTIFY_CLIENT_ID: ${process.env.SPOTIFY_CLIENT_ID ? 'Set' : 'Not set'}`);
  console.log(`- OPENWEATHER_API_KEY: ${process.env.OPENWEATHER_API_KEY ? 'Set' : 'Not set'}`);
});
