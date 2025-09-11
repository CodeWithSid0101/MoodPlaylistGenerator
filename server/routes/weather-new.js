import express from 'express';
import axios from 'axios';
import spotifyApi from '../spotify-api.js';

const router = express.Router();

// Helper function to get recommendations with retry logic
async function getRecommendations(params, accessToken, retryCount = 0) {
  const maxRetries = 2;
  
  // Common seed genres that work well with Spotify API
  const commonGenres = [
    'pop', 'rock', 'edm', 'hip-hop', 'r-n-b', 
    'classical', 'jazz', 'blues', 'country', 'electronic',
    'indie', 'alternative', 'metal', 'k-pop', 'reggae',
    'soul', 'funk', 'disco', 'techno', 'house', 'trance'
  ];
  
  // Common seed tracks as fallback
  const seedTracks = '4iV5W9uYEdYUVa79Axb7Rh,1301WleyT98MSxVHPZCA6M,3nFJbZCHP4d9vduKjJLdBL';
  
  try {
    // Ensure we have valid seed genres
    let seedGenres = '';
    if (params.seed_genres) {
      // Filter out any invalid genres
      const validGenres = params.seed_genres.split(',')
        .filter(genre => commonGenres.includes(genre.trim()));
      
      if (validGenres.length > 0) {
        seedGenres = validGenres.join(',');
      }
    }
    
    // If no valid genres, use a default set
    if (!seedGenres) {
      seedGenres = 'pop,rock';
      console.log('Using fallback seed genres:', seedGenres);
    }
    
    // Ensure we have required parameters
    const requestParams = {
      limit: 10,
      market: 'US',
      seed_genres: seedGenres,
      seed_tracks: seedTracks,  // Add seed tracks as fallback
      min_popularity: 50,       // Filter out obscure tracks
      ...params
    };
    
    // Remove any undefined or null parameters
    Object.keys(requestParams).forEach(key => {
      if (requestParams[key] === undefined || requestParams[key] === null) {
        delete requestParams[key];
      }
    });
    
    // Log the full request URL for debugging
    const baseUrl = 'https://api.spotify.com/v1/recommendations';
    const queryString = Object.entries(requestParams)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    const fullUrl = `${baseUrl}?${queryString}`;
    
    console.log('Sending request to Spotify API:');
    console.log('URL:', fullUrl);
    console.log('Headers:', {
      'Authorization': 'Bearer [REDACTED]',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    
    const startTime = Date.now();
    const response = await axios.get(
      baseUrl,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        params: requestParams,
        paramsSerializer: params => {
          return Object.entries(params)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');
        },
        validateStatus: status => status < 500, // Don't throw for 4xx errors
        timeout: 10000 // 10 second timeout
      }
    );
    
    const responseTime = Date.now() - startTime;
    console.log(`Request completed in ${responseTime}ms`);
    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', JSON.stringify(response.headers, null, 2));
    console.log('Response data:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
    
    console.log('Spotify API response status:', response.status);
    
    if (response.status !== 200) {
      console.error('Spotify API error response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      });
      
      // Try with different genres if the first attempt fails
      if (retryCount < maxRetries) {
        console.log(`Retrying with different genres... (${retryCount + 1}/${maxRetries})`);
        // Try with different genres
        const fallbackGenres = ['pop', 'rock', 'edm', 'hip-hop'].filter(g => !params.seed_genres.includes(g));
        params.seed_genres = fallbackGenres.slice(0, 2).join(',');
        return getRecommendations(params, accessToken, retryCount + 1);
      }
      
      throw new Error(`Spotify API returned status ${response.status}: ${JSON.stringify(response.data || response.statusText)}`);
    }
    
    return response;
  } catch (error) {
    console.error('Error in getRecommendations:', error.message);
    
    if (retryCount < maxRetries) {
      console.log(`Retrying after error... (${retryCount + 1}/${maxRetries})`);
      return getRecommendations(params, accessToken, retryCount + 1);
    }
    
    throw error;
  }
}

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
      console.log('Weather data:', JSON.stringify(weatherResponse.data, null, 2));
    } catch (error) {
      console.error('OpenWeather API error:', error.message);
      if (error.response) {
        console.error('OpenWeather error response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }
    
    if (weatherResponse.status !== 200) {
      throw new Error(`OpenWeather API returned status ${weatherResponse.status}`);
    }
    
    // Map weather to mood and genres
    const { weather, main, name } = weatherResponse.data;
    const weatherMain = weather[0].main;
    const temp = main.temp;
    
    const { mood, genres } = mapWeatherToMood(weatherMain, temp);
    console.log('Mapped weather to mood:', { weatherMain, temp, mood, genres });
    
    // Get Spotify recommendations
    console.log('Getting Spotify access token...');
    let accessToken;
    try {
      accessToken = await spotifyApi.getAccessToken();
      console.log('Successfully obtained Spotify access token');
    } catch (error) {
      console.error('Failed to get Spotify access token:', error.message);
      throw new Error(`Spotify authentication failed: ${error.message}`);
    }
    
    // Prepare parameters for Spotify API
    const params = {
      seed_genres: genres.slice(0, 2).join(','),
      limit: 10,
      market: 'US',
      min_popularity: 50,
      target_energy: mood === 'relaxed' ? 0.3 : mood === 'energetic' ? 0.9 : 0.6,
      target_valence: mood === 'happy' ? 0.9 : mood === 'sad' ? 0.2 : 0.5
    };
    
    console.log('Spotify API request params:', JSON.stringify(params, null, 2));
    
    // Add fallback seed tracks
    const seedTracks = ['4iV5W9uYEdYUVa79Axb7Rh', '1301WleyT98MSxVHPZCA6M', '3nFJbZCHP4d9vduKjJLdBL'];
    if (seedTracks.length > 0) {
      params.seed_tracks = seedTracks.slice(0, 3).join(',');
    }
    
    // Get recommendations from Spotify
    let recommendations;
    try {
      console.log('Getting Spotify recommendations...');
      recommendations = await getRecommendations(accessToken, params);
      console.log(`Received ${recommendations.tracks.length} recommendations from Spotify`);
    } catch (error) {
      console.error('Error getting Spotify recommendations:', error.message);
      if (error.response) {
        console.error('Spotify error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data
        });
      }
      throw new Error(`Failed to get music recommendations: ${error.message}`);
    }
    
    // Format the response
    const response = {
      status: 'success',
      location: name || 'Current Location',
      weather: {
        main: weatherMain,
        description: weather[0].description,
        temp: temp,
        humidity: main.humidity,
        wind: weatherResponse.data.wind?.speed || 0,
        icon: weather[0].icon
      },
      mood: mood,
      genres: genres,
      tracks: recommendations.tracks.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        preview_url: track.preview_url,
        external_url: track.external_urls.spotify,
        image: track.album.images[0]?.url || null
      }))
    };
    
    console.log('Sending successful response');
    res.json(response);
    
  } catch (error) {
    console.error('Error in /coords endpoint:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Export the router
export default router;
