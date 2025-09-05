const clientId = 'e220331f3909482ab6ebce2730a49e8f';
const redirectUri = 'https://mood-playlist-generator-tau.vercel.app/callback';
const scopes = 'user-read-private user-read-email playlist-read-private';

const loginBtn = document.getElementById('login-button');
const moodSelector = document.getElementById('mood');
const generateBtn = document.getElementById('generate');
const weatherDiv = document.getElementById('weather');
const playlistDiv = document.getElementById('playlist');
const userInfoDiv = document.getElementById('user-info');

let accessToken = localStorage.getItem('spotifyAccessToken');

// If user is logged in, hide login button and enable mood selector
if (accessToken) {
  loginBtn.style.display = 'none';
  moodSelector.disabled = false;
  generateBtn.disabled = false;
  fetchUserProfile();
} else {
  loginBtn.style.display = 'block';
  moodSelector.disabled = true;
  generateBtn.disabled = true;
}

loginBtn.addEventListener('click', () => {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
});

generateBtn.addEventListener('click', async () => {
  try {
    // 1. Get user location
    const coords = await getUserLocation();
    const lat = coords.latitude;
    const lon = coords.longitude;

    // 2. Fetch weather using lat/lon
    const apiKey = '81165c8839597701582170a90141d335'; // Your OpenWeatherMap API key
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );

    if (!res.ok) throw new Error("Failed to fetch weather");

    const data = await res.json();

    const weather = data.weather[0].main;
    const temp = data.main.temp;
    const city = data.name;

    weatherDiv.innerHTML = `📍 Weather in ${city}: <strong>${weather}</strong>, ${temp}°C`;

    // 3. Generate playlist by mood from Spotify
    const mood = moodSelector.value;
    const playlists = await getPlaylistsByMood(mood);

    if (playlists.length > 0) {
      playlistDiv.innerHTML = `<h3>🎧 Your Playlist:</h3>` + playlists.map(pl => 
        `<div class="song">
          <a href="${pl.external_urls.spotify}" target="_blank">${pl.name}</a> by ${pl.owner.display_name}
        </div>`).join('');
    } else {
      playlistDiv.innerHTML = "No playlists found for this mood.";
    }

  } catch (error) {
    console.error("Error:", error);
    weatherDiv.innerHTML = "❌ Could not get location or weather.";
    playlistDiv.innerHTML = "";
  }
});

// Fetch Spotify user profile
async function fetchUserProfile() {
  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error('Failed to fetch user profile');
    const data = await res.json();
    userInfoDiv.innerHTML = `<p>Logged in as <strong>${data.display_name}</strong></p>`;
  } catch (error) {
    console.error(error);
    localStorage.removeItem('spotifyAccessToken');
    userInfoDiv.innerHTML = 'Failed to load user info. Please login again.';
    loginBtn.style.display = 'block';
    moodSelector.disabled = true;
    generateBtn.disabled = true;
  }
}

// Get playlists by mood keyword using Spotify Search API
async function getPlaylistsByMood(mood) {
  try {
    const query = encodeURIComponent(mood);
    const res = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=playlist&limit=5`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error('Failed to fetch playlists');
    const data = await res.json();
    return data.playlists.items;
  } catch (error) {
    console.error(error);
    return [];
  }
}

// Get user geolocation
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Geolocation not supported");
    } else {
      navigator.geolocation.getCurrentPosition(
        pos => resolve(pos.coords),
        err => reject(err.message)
      );
    }
  });
}
