// === Spotify App Config ===
const client_id = 'e220331f3909482ab6ebce2730a49e8f'; // Your actual Client ID
const redirect_uri = 'https://mood-playlist-generator-tau.vercel.app/callback';
const scopes = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email'
].join(' ');

// === Helper: Extract token from URL hash ===
function getAccessTokenFromUrl() {
  const hash = window.location.hash.substring(1); // Remove '#'
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

// === Shared mood → seed track mapping ===
const moodSeedTracks = {
  happy: '3AJwUDP919kvQ9QcozQPxg',  // Happy – Pharrell Williams
  sad: '7qEHsqek33rTcFNT9PFqLf',    // Someone Like You – Adele
  chill: '1vCWHaC5f2uS3yhpwWbIA6',  // Wake Me Up – Avicii
  angry: '0VjIjW4GlUZAMYd2vXMi3b'   // Blinding Lights – The Weeknd
};

// === Entry for Homepage (index.html) ===
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
  const loginBtn = document.getElementById('login');

  loginBtn.addEventListener('click', () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
  });
}

// === Entry for Callback Page (callback/index.html) ===
if (window.location.pathname.includes('/callback')) {
  const accessToken = getAccessTokenFromUrl();

  if (!accessToken) {
    document.body.innerHTML = '<p style="color:red;">No access token found. Please <a href="/">login again</a>.</p>';
    throw new Error('No access token found');
  }

  // Clean up URL after extracting token
  window.history.replaceState({}, document.title, '/callback');

  // DOM Elements
  const generateBtn = document.getElementById('generate');
  const moodSelector = document.getElementById('mood');
  const playlistDiv = document.getElementById('playlist');

  generateBtn.addEventListener('click', async () => {
    const mood = moodSelector.value;
    const seedTrack = moodSeedTracks[mood];
    playlistDiv.innerHTML = '🎶 Generating playlist...';

    try {
      const res = await fetch(`https://api.spotify.com/v1/recommendations?seed_tracks=${seedTrack}&limit=10`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch Spotify recommendations');
      }

      const data = await res.json();
      if (!data.tracks || data.tracks.length === 0) {
        playlistDiv.innerHTML = 'No songs found for this mood.';
        return;
      }

      // Display tracks
      playlistDiv.innerHTML = '<h3>🎧 Your Playlist:</h3>' + data.tracks.map(track => {
        const artistNames = track.artists.map(a => a.name).join(', ');
        return `<div class="song">${track.name} - ${artistNames}</div>`;
      }).join('');

    } catch (err) {
      console.error(err);
      playlistDiv.innerHTML = '❌ Error fetching playlist. Please try again.';
    }
  });
}
