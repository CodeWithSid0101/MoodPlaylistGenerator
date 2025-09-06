// === Spotify App Config ===
const client_id = 'e220331f3909482ab6ebce2730a49e8f'; // Your Client ID
const redirect_uri = 'https://mood-playlist-generator-tau.vercel.app/callback/index.html';
const scopes = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email'
].join(' ');

// === Helper to get token from URL ===
function getAccessTokenFromUrl() {
  const hash = window.location.hash.substring(1); // remove '#'
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

// === Mood to seed track map ===
const moodSeedTracks = {
  happy: '3AJwUDP919kvQ9QcozQPxg',  // Happy – Pharrell Williams
  sad: '7qEHsqek33rTcFNT9PFqLf',    // Someone Like You – Adele
  chill: '1vCWHaC5f2uS3yhpwWbIA6',  // Wake Me Up – Avicii
  angry: '0VjIjW4GlUZAMYd2vXMi3b'   // Blinding Lights – The Weeknd
};

// === For index.html (Login Page) ===
if (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
  const loginBtn = document.getElementById('login');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const authUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}`;
      window.location.href = authUrl;
    });
  }
}

// === For callback/index.html (Playlist Page) ===
if (window.location.pathname.includes('/callback')) {
  console.log("Callback page loaded:", window.location.href);

  const accessToken = getAccessTokenFromUrl();

  if (!accessToken) {
    document.body.innerHTML = '<p style="color:red;">❌ No access token found. Please <a href="/">login again</a>.</p>';
    throw new Error('No access token found in URL hash');
  }

  // Clean up URL bar (remove #access_token part)
  window.history.replaceState({}, document.title, '/callback/index.html');

  // DOM elements
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

      if (!res.ok) throw new Error('Failed to fetch tracks');

      const data = await res.json();

      if (!data.tracks.length) {
        playlistDiv.innerHTML = 'No tracks found.';
        return;
      }

      // Show playlist
      playlistDiv.innerHTML = '<h3>🎧 Your Playlist:</h3>' + data.tracks.map(track => {
        const artistNames = track.artists.map(a => a.name).join(', ');
        return `<div class="song">${track.name} - ${artistNames}</div>`;
      }).join('');

    } catch (err) {
      console.error(err);
      playlistDiv.innerHTML = '❌ Could not fetch playlist. Try again.';
    }
  });
}
