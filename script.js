// === Shared constants ===
const client_id = 'e220331f3909482ab6ebce2730a49e8f'; // Your Spotify Client ID
const redirect_uri = 'https://mood-playlist-generator-tau.vercel.app/callback'; // Your Redirect URI registered in Spotify Dashboard
const scopes = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email',
].join(' ');

// Helper to extract access token from URL hash
function getAccessTokenFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

// --------- CODE FOR index.html ---------
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
  const loginBtn = document.getElementById('login');
  const playlistDiv = document.getElementById('playlist');
  const moodSelector = document.getElementById('mood');

  loginBtn.addEventListener('click', () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
  });
}

// --------- CODE FOR /callback/index.html ---------
if (window.location.pathname.includes('/callback')) {
  const accessToken = getAccessTokenFromUrl();

  if (!accessToken) {
    document.body.innerHTML = '<p style="color:red;">No access token found. Please <a href="/">login again</a>.</p>';
    throw new Error('No access token found');
  }

  // Clean URL (remove token from address bar)
  window.history.replaceState({}, document.title, '/callback');

  const moodSelector = document.getElementById('mood');
  const generateBtn = document.getElementById('generate');
  const playlistDiv = document.getElementById('playlist');

  const moodSeedTracks = {
    happy: '3AJwUDP919kvQ9QcozQPxg',  // Pharrell Williams - Happy
    sad: '7qEHsqek33rTcFNT9PFqLf',    // Adele - Someone Like You
    chill: '1vCWHaC5f2uS3yhpwWbIA6',  // Avicii - Wake Me Up (chill vibe)
    angry: '0VjIjW4GlUZAMYd2vXMi3b'   // The Weeknd - Blinding Lights (energetic)
  };

  generateBtn.addEventListener('click', async () => {
    const mood = moodSelector.value;
    playlistDiv.innerHTML = 'Loading playlist...';

    try {
      const seedTrack = moodSeedTracks[mood];
      const res = await fetch(`https://api.spotify.com/v1/recommendations?seed_tracks=${seedTrack}&limit=10`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!res.ok) {
        playlistDiv.innerHTML = 'Failed to fetch playlist. Please refresh or login again.';
        return;
      }

      const data = await res.json();

      if (!data.tracks || data.tracks.length === 0) {
        playlistDiv.innerHTML = 'No tracks found for this mood.';
        return;
      }

      playlistDiv.innerHTML = '<h3>🎧 Your Playlist:</h3>' + data.tracks.map(track => {
        const artists = track.artists.map(a => a.name).join(', ');
        return `<div class="song">${track.name} - ${artists}</div>`;
      }).join('');

    } catch (error) {
      playlistDiv.innerHTML = 'Error loading playlist.';
      console.error(error);
    }
  });
}
