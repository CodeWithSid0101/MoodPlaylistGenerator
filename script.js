// === Spotify App Config ===
const client_id = 'e220331f3909482ab6ebce2730a49e8f'; // Your Client ID
const redirect_uri = 'https://moodplaylistgenerator-wrzn.onrender.com/callback/index.html';
const scopes = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-top-read',
  'user-library-read',
  'user-library-modify',
  'user-read-recently-played',
  'streaming'
].join(' ');

// === PKCE Helper Functions ===
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(codeVerifier) {
  const hashed = await sha256(codeVerifier);
  return base64urlencode(hashed);
}

// === Mood to seed track map ===
const moodSeedTracks = {
  happy: '3AJwUDP919kvQ9QcozQPxg',  // Happy – Pharrell Williams
  sad: '7qEHsqek33rTcFNT9PFqLf',    // Someone Like You – Adele
  chill: '1vCWHaC5f2uS3yhpwWbIA6',  // Wake Me Up – Avicii
  angry: '0VjIjW4GlUZAMYd2vXMi3b'   // Blinding Lights – The Weeknd
};

// === User Authentication Check ===
async function checkUserApproval(email) {
  try {
    const apiUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000/api/users'
      : `${window.location.origin}/api/users`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }
    
    const data = await response.json();
    const user = data.users.find(u => u.email === email);
    
    if (!user) {
      return { approved: false, message: 'User not registered. Please sign up first.' };
    }
    
    if (user.status !== 'approved') {
      return { 
        approved: false, 
        message: `Your account is ${user.status}. Please wait for admin approval.` 
      };
    }
    
    return { approved: true, user };
  } catch (error) {
    console.error('Error checking user approval:', error);
    return { approved: false, message: 'Unable to verify user status. Please try again.' };
  }
}

// === Start Authorization (Login Page) ===
if (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
  const loginBtn = document.getElementById('login');

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      // Add loading state
      const originalText = loginBtn.innerHTML;
      loginBtn.classList.add('btn-loading');
      loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking Access...';
      loginBtn.disabled = true;
      
      try {
        // Check if user is registered and approved
        const userEmail = await showEmailModal();
        if (!userEmail) {
          showNotification('Email is required to proceed.', 'error');
          return;
        }
        
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying User...';
        const approvalCheck = await checkUserApproval(userEmail);
        
        if (!approvalCheck.approved) {
          showNotification(approvalCheck.message, 'error');
          if (approvalCheck.message.includes('not registered')) {
            setTimeout(() => {
              window.location.href = 'signup.html';
            }, 2000);
          }
          return;
        }
        
        // Store approved user info
        localStorage.setItem('approved_user_email', userEmail);
        
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Spotify...';
        const codeVerifier = generateRandomString(128);
        localStorage.setItem('code_verifier', codeVerifier);

        const codeChallenge = await generateCodeChallenge(codeVerifier);

        const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirect_uri)}&code_challenge_method=S256&code_challenge=${codeChallenge}`;

        showNotification('Redirecting to Spotify...', 'success');
        setTimeout(() => {
          window.location.href = authUrl;
        }, 1000);
        
      } catch (error) {
        console.error('Login error:', error);
        showNotification('An error occurred. Please try again.', 'error');
      } finally {
        // Reset button state
        setTimeout(() => {
          loginBtn.classList.remove('btn-loading');
          loginBtn.innerHTML = originalText;
          loginBtn.disabled = false;
        }, 1000);
      }
    });
  }
}

// === Handle Callback (Playlist Page) ===
if (window.location.pathname.includes('/callback')) {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  async function getAccessToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');

    const body = new URLSearchParams({
      client_id,
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      code_verifier: codeVerifier
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!response.ok) throw new Error('Failed to get access token');
    return await response.json();
  }

  (async () => {
    if (!code) {
      document.body.innerHTML = '<p style="color:red;">❌ No code returned. Please <a href="/">login again</a>.</p>';
      return;
    }

    try {
      const tokenResponse = await getAccessToken(code);
      const accessToken = tokenResponse.access_token;
      
      // Store the access token in localStorage for later use
      localStorage.setItem('spotify_access_token', accessToken);

      console.log("Access Token:", accessToken);

      // Update UI
      window.history.replaceState({}, document.title, '/callback/index.html');
      const generateBtn = document.getElementById('generate');
      const moodSelector = document.getElementById('mood');
      const playlistDiv = document.getElementById('playlist');

      // Get user profile first
      try {
        const userRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (userRes.ok) {
          const userData = await userRes.json();
          document.getElementById('user-info').innerHTML = `
            <div class="user-profile">
              <img src="${userData.images?.[0]?.url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxNSIgeT0iMTUiPgo8cGF0aCBkPSJNMTUgMTBDMTcuNzYxNCAxMCAyMCA3Ljc2MTQyIDIwIDVDMjAgMi4yMzg1OCAxNy43NjE0IDAgMTUgMEMxMi4yMzg2IDAgMTAgMi4yMzg1OCAxMCA1QzEwIDcuNzYxNDIgMTIuMjM4NiAxMCAxNSAxMFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xNSAxMkMxMS42ODYzIDEyIDkgMTQuNjg2MyA5IDE4VjI1SDIxVjE4QzIxIDE0LjY4NjMgMTguMzEzNyAxMiAxNSAxMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K'}" alt="Profile" class="profile-img">
              <div class="user-details">
                <h3>Welcome, ${userData.display_name || userData.id}!</h3>
                <p>${userData.followers?.total || 0} followers</p>
              </div>
            </div>
          `;
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      }

      // Add event listener for the liked songs button
      const likedBtn = document.getElementById('show-liked');
      likedBtn.addEventListener('click', async () => {
        playlistDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>🎶 Loading your liked songs...</p></div>';
        await showLikedSongs(accessToken, playlistDiv);
      });

      // Add Shuffle Play handler (preview-based)
      const shuffleBtn = document.getElementById('shuffle-play');
      if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
          if (!window._shuffle || window._shuffle.isPlaying !== true) {
            startShuffle();
          } else {
            stopShuffle();
          }
        });
      }

      function getPlayableTracks() {
        const tracks = window._currentTracks || window._allTracks || [];
        const seen = new Set();
        const playable = [];
        for (const t of tracks) {
          if (t?.id && t.preview_url && !seen.has(t.id)) {
            seen.add(t.id);
            playable.push(t);
          }
        }
        return playable;
      }

      function startShuffle() {
        const playable = getPlayableTracks();
        if (!playable.length) {
          // Fallback: try to shuffle and play on user's active device via Web API
          startDeviceShufflePlayback().catch(() => {
            showNotification('No previewable tracks. Open Spotify app and start playback once, then retry Shuffle.', 'error');
          });
          return;
        }
        const queue = shuffleArray(playable);
        window._shuffle = { isPlaying: true, queue, index: 0, audio: null };
        playCurrent();
        if (shuffleBtn) {
          shuffleBtn.classList.add('btn-loading');
          shuffleBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
        }
      }

      async function startDeviceShufflePlayback() {
        try {
          const accessToken = localStorage.getItem('spotify_access_token');
          if (!accessToken) throw new Error('No token');

          // Ensure there is an active device
          const devicesRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!devicesRes.ok) throw new Error('devices failed');
          const devices = await devicesRes.json();
          const active = (devices.devices || []).find(d => d.is_active) || (devices.devices || [])[0];
          if (!active) throw new Error('no device');

          // Shuffle on
          await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${encodeURIComponent(active.id)}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          // Build URIs from current list
          const tracks = window._currentTracks || window._allTracks || [];
          const uris = tracks.map(t => t.uri).filter(Boolean);
          if (!uris.length) throw new Error('no uris');

          // Start playback with shuffled order (let Spotify handle shuffle)
          await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(active.id)}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris })
          });

          showNotification('Shuffle started on your active Spotify device.', 'success');
        } catch (e) {
          throw e;
        }
      }

      function playCurrent() {
        const state = window._shuffle;
        if (!state || state.isPlaying !== true) return;
        const track = state.queue[state.index];
        try {
          if (state.audio) { try { state.audio.pause(); } catch(_){} }
          const audio = new Audio(track.preview_url);
          state.audio = audio;
          highlightPlaying(track.id);
          audio.onended = () => { nextShuffle(); };
          audio.onerror = () => { nextShuffle(); };
          audio.play().then(() => {
            showNotification(`▶️ ${track.name} — ${(track.artists||[]).map(a=>a.name).join(', ')}`, 'success');
          }).catch(() => nextShuffle());
        } catch (_) {
          nextShuffle();
        }
      }

      function nextShuffle() {
        const state = window._shuffle;
        if (!state || state.isPlaying !== true) return;
        state.index = (state.index + 1) % state.queue.length;
        playCurrent();
      }

      function stopShuffle() {
        const state = window._shuffle;
        if (state?.audio) { try { state.audio.pause(); } catch(_){} }
        window._shuffle = { isPlaying: false, queue: [], index: 0, audio: null };
        if (shuffleBtn) {
          shuffleBtn.classList.remove('btn-loading');
          shuffleBtn.innerHTML = '<i class="fas fa-random"></i> Shuffle Play';
        }
        clearPlayingHighlight();
      }

      function highlightPlaying(trackId) {
        document.querySelectorAll('.track-item').forEach(el => el.classList.remove('playing'));
        const el = document.querySelector(`.track-item[data-track-id="${trackId}"]`);
        if (el) el.classList.add('playing');
      }

      function clearPlayingHighlight() {
        document.querySelectorAll('.track-item').forEach(el => el.classList.remove('playing'));
      }

      // Add event listener for mood selector to filter songs immediately
      moodSelector.addEventListener('change', async () => {
        const mood = moodSelector.value;
        window._currentMood = mood;
        
        // Use _allTracks if available, otherwise use _currentTracks
        const tracksToFilter = window._allTracks || window._currentTracks;
        
        // Only filter if we already have tracks
        if (tracksToFilter && tracksToFilter.length > 0) {
          playlistDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>🎶 Filtering songs by ' + mood + ' mood...</p></div>';
          
          // Filter the tracks by the selected mood
          const filteredTracks = filterTracksByMood(tracksToFilter, mood);
          
          // Display the filtered tracks
          setTimeout(() => {
            if (filteredTracks.length > 0) {
              displayTracks(filteredTracks, playlistDiv, 'Songs Filtered by ' + mood.charAt(0).toUpperCase() + mood.slice(1) + ' Mood');
            } else {
              playlistDiv.innerHTML = '<div class="no-tracks">No tracks found for ' + mood + ' mood. Try generating a new playlist.</div>';
            }
          }, 500); // Small delay for better UX
        }
      });
      
      generateBtn.addEventListener('click', async () => {
        const mood = moodSelector.value;
        window._currentMood = mood;
        const seedTrack = moodSeedTracks[mood];

        playlistDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>🎶 Generating your mood playlist...</p></div>';

        try {
          // 0) Try mood-similar generation from user's history + related artists
          try {
            const didGenerate = await generateMoodSimilarFromHistory(accessToken, mood, playlistDiv);
            if (didGenerate) {
              return;
            }
          } catch (e) {
            console.log('Mood-similar generation failed, proceeding to playlists/recommendations:', e);
          }

          // First try to get user's playlists
          let playlistData = null;
          try {
            const playlistsRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (playlistsRes.ok) {
              playlistData = await playlistsRes.json();
            }
          } catch (err) {
            console.log('Could not fetch playlists, using recommendations instead');
          }

          // If we have playlists, show them, otherwise use recommendations
          if (playlistData && playlistData.items && playlistData.items.length > 0) {
            const moodPlaylists = playlistData.items.filter(playlist => 
              playlist.name.toLowerCase().includes(mood) || 
              playlist.description?.toLowerCase().includes(mood)
            );

            if (moodPlaylists.length > 0) {
              playlistDiv.innerHTML = '<h3>🎧 Your Mood Playlists:</h3>' + 
                moodPlaylists.map(playlist => `
                  <div class="playlist-item">
                    <div class="playlist-info">
                      <h4>${playlist.name}</h4>
                      <p>${playlist.description || 'No description'}</p>
                      <span class="track-count">${playlist.tracks.total} tracks</span>
                    </div>
                    <img src="${playlist.images?.[0]?.url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNjY3ZWVhIi8+CjxzdmcgeD0iMjAiIHk9IjIwIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIwIDIwTDMwIDMwTDIwIDQwTDEwIDMwTDIwIDIwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cjwvc3ZnPgo='}" alt="Playlist" class="playlist-img">
                  </div>
                `).join('');
            } else {
              // Fallback to recommendations
              try {
                await generateRecommendations(accessToken, seedTrack, playlistDiv);
              } catch (err) {
                console.error('Recommendations failed, trying top tracks:', err);
                await generateTopTracks(accessToken, playlistDiv);
              }
            }
          } else {
            // Fallback to recommendations
            try {
              await generateRecommendations(accessToken, seedTrack, playlistDiv);
            } catch (err) {
              console.error('Recommendations failed, trying top tracks:', err);
              await generateTopTracks(accessToken, playlistDiv);
            }
          }

        } catch (err) {
          console.error(err);
          playlistDiv.innerHTML = '<div class="error">❌ Could not fetch playlists. Please try again.</div>';
        }
      });

      async function generateRecommendations(accessToken, seedTrack, playlistDiv) {
        // Since Spotify deprecated the recommendations API, we'll use alternative approaches
        const mood = document.getElementById('mood').value;
        
        try {
          // Try to get recently played tracks first
          const recentlyPlayedRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=20', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (recentlyPlayedRes.ok) {
            const recentlyData = await recentlyPlayedRes.json();
            if (recentlyData.items && recentlyData.items.length > 0) {
              // Store all tracks before filtering
              const allTracks = recentlyData.items.map(item => item.track);
              window._allTracks = allTracks;
              
              const moodFilteredTracks = filterTracksByMood(allTracks, mood);
              if (moodFilteredTracks.length > 0) {
                displayTracks(moodFilteredTracks.slice(0, 20), playlistDiv, 'Recently Played Tracks for Your Mood');
                return;
              }
            }
          } else if (recentlyPlayedRes.status === 403) {
            console.log('Recently played access denied (403) - skipping this endpoint');
          } else {
            console.log('Recently played failed with status:', recentlyPlayedRes.status);
          }
        } catch (err) {
          console.log('Recently played failed, trying saved tracks:', err);
        }

        // Try saved tracks (liked songs) as another alternative
        try {
          const savedTracksRes = await fetch('https://api.spotify.com/v1/me/tracks?limit=20', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (savedTracksRes.ok) {
            const savedData = await savedTracksRes.json();
            if (savedData.items && savedData.items.length > 0) {
              // Store all tracks before filtering
              const allTracks = savedData.items.map(item => item.track);
              window._allTracks = allTracks;
              
              const moodFilteredTracks = filterTracksByMood(allTracks, mood);
              if (moodFilteredTracks.length > 0) {
                displayTracks(moodFilteredTracks.slice(0, 20), playlistDiv, 'Your Liked Songs for This Mood');
                return;
              }
            }
          } else if (savedTracksRes.status === 403) {
            console.log('Saved tracks access denied (403) - skipping this endpoint');
          } else {
            console.log('Saved tracks failed with status:', savedTracksRes.status);
          }
        } catch (err) {
          console.log('Saved tracks failed, trying top tracks:', err);
        }

        // Final fallback to top tracks
        await generateTopTracks(accessToken, playlistDiv);
      }

      function filterTracksByMood(tracks, mood) {
        // Simple mood-based filtering based on track characteristics
        const moodKeywords = {
          happy: ['happy', 'joy', 'upbeat', 'cheerful', 'bright', 'sunny', 'dance', 'party'],
          sad: ['sad', 'melancholy', 'blue', 'lonely', 'heartbreak', 'tears', 'cry', 'miss'],
          chill: ['chill', 'relax', 'calm', 'peaceful', 'ambient', 'soft', 'gentle', 'mellow'],
          angry: ['angry', 'rage', 'furious', 'intense', 'heavy', 'aggressive', 'loud', 'power']
        };

        const keywords = moodKeywords[mood] || moodKeywords.chill;
        
        return tracks.filter(track => {
          const trackText = `${track.name} ${track.artists.map(a => a.name).join(' ')} ${track.album.name}`.toLowerCase();
          return keywords.some(keyword => trackText.includes(keyword));
        });
      }

      function displayTracks(tracks, playlistDiv, title) {
        if (!tracks.length) {
          playlistDiv.innerHTML = '<div class="no-tracks">No tracks found for this mood.</div>';
          return;
        }
        
        // Store the current tracks for mood filtering
        window._currentTracks = tracks;

        // Default fallback image as base64 SVG
        const defaultImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjNjY3ZWVhIi8+CjxzdmcgeD0iMTUiIHk9IjE1IiB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE1IDE1TDIyLjUgMjIuNUwxNSAzMEw3LjUgMjIuNUwxNSAxNVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K';

        // Cross-session de-duplication of shown tracks
        const shownKeyMood = window._currentMood ? `shown_track_ids_${window._currentMood}` : 'shown_track_ids';
        if (!window._shownTrackIds) {
          try {
            window._shownTrackIds = new Set(JSON.parse(localStorage.getItem(shownKeyMood) || '[]'));
          } catch { window._shownTrackIds = new Set(); }
        }

        // Filter out tracks already shown in this session
        const unseen = tracks.filter(t => t && t.id && !window._shownTrackIds.has(t.id));
        const listToShow = unseen.length ? unseen : tracks;

        // Shuffle to avoid same order repeatedly
        const shuffled = shuffleArray(listToShow).slice(0, 20);

        // Check if tracks are already in user's library
        checkUserSavedTracks(shuffled.map(track => track.id))
          .then(savedResults => {
            playlistDiv.innerHTML = `<h3>🎧 ${title}:</h3>` + 
              shuffled.map((track, index) => {
                // Safely handle track data
                const trackName = track.name || 'Unknown Track';
                const artists = track.artists ? track.artists.map(a => a.name).join(', ') : 'Unknown Artist';
                const albumName = track.album?.name || 'Unknown Album';
                const albumImage = track.album?.images?.[0]?.url || defaultImage;
                const spotifyUrl = track.external_urls?.spotify || '#';
                const isSaved = savedResults && savedResults[index];
                const heartIcon = isSaved ? '❤️' : '🤍';

                return `
                  <div class="track-item" data-track-id="${track.id}">
                    <img src="${albumImage}" alt="Album" class="track-img" onerror="this.src='${defaultImage}'">
                    <div class="track-info">
                      <h4>${trackName}</h4>
                      <p>${artists}</p>
                      <span class="album-name">${albumName}</span>
                    </div>
                    <div class="track-actions">
                      <button type="button" class="like-button" data-track-id="${track.id}" data-saved="${isSaved}" onclick="handleLikeButtonClick(event)">${heartIcon}</button>
                      <a href="${spotifyUrl}" target="_blank" class="spotify-link">🎵</a>
                    </div>
                  </div>
                `;
              }).join('');

            // Add event listeners to like buttons
            const likeButtons = document.querySelectorAll('.like-button');
            console.log('Found like buttons:', likeButtons.length);
            likeButtons.forEach(button => {
              // Remove any existing event listeners to prevent duplicates
              button.removeEventListener('click', handleLikeButtonClick);
              // Add the event listener
              button.addEventListener('click', handleLikeButtonClick);
              console.log('Added event listener to button:', button.getAttribute('data-track-id'));
            });

            // Persist shown IDs
            try {
              for (const t of shuffled) { if (t?.id) window._shownTrackIds.add(t.id); }
              localStorage.setItem(shownKeyMood, JSON.stringify([...window._shownTrackIds]));
            } catch {}
          })
          .catch(error => {
            console.error('Error checking saved tracks:', error);
            // Fallback to display without saved status
            renderTracksWithoutSavedStatus();
          });

        // Inject minimal CSS for playing highlight (once)
        if (!document.getElementById('playing-style')) {
          const s = document.createElement('style');
          s.id = 'playing-style';
          s.textContent = `.track-item.playing{outline:2px solid #1db954;border-radius:8px;background:rgba(29,185,84,0.08);}`;
          document.head.appendChild(s);
        }

        // Fallback function if checking saved status fails
        function renderTracksWithoutSavedStatus() {
          playlistDiv.innerHTML = `<h3>🎧 ${title}:</h3>` + 
            shuffled.map(track => {
              // Safely handle track data
              const trackName = track.name || 'Unknown Track';
              const artists = track.artists ? track.artists.map(a => a.name).join(', ') : 'Unknown Artist';
              const albumName = track.album?.name || 'Unknown Album';
              const albumImage = track.album?.images?.[0]?.url || defaultImage;
              const spotifyUrl = track.external_urls?.spotify || '#';

              return `
                <div class="track-item" data-track-id="${track.id}">
                  <img src="${albumImage}" alt="Album" class="track-img" onerror="this.src='${defaultImage}'">
                  <div class="track-info">
                    <h4>${trackName}</h4>
                    <p>${artists}</p>
                    <span class="album-name">${albumName}</span>
                  </div>
                  <div class="track-actions">
                    <button class="like-button" data-track-id="${track.id}" data-saved="false">🤍</button>
                    <a href="${spotifyUrl}" target="_blank" class="spotify-link">🎵</a>
                  </div>
                </div>
              `;
            }).join('');

          // Add event listeners to like buttons
          document.querySelectorAll('.like-button').forEach(button => {
            button.addEventListener('click', handleLikeButtonClick);
          });
        }
      }

      function shuffleArray(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
      
      // Check if tracks are saved in user's library - make it globally accessible
      window.checkUserSavedTracks = async function(trackIds) {
        if (!trackIds || trackIds.length === 0) return [];
        
        try {
          const accessToken = localStorage.getItem('spotify_access_token');
          if (!accessToken) return [];
          
          // Split into chunks of 50 (Spotify API limit)
          const chunks = [];
          for (let i = 0; i < trackIds.length; i += 50) {
            chunks.push(trackIds.slice(i, i + 50));
          }
          
          // Process each chunk
          const results = [];
          for (const chunk of chunks) {
            const idsParam = chunk.join(',');
            const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${idsParam}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (response.ok) {
              const data = await response.json();
              results.push(...data);
            } else {
              console.error('Failed to check saved tracks status:', response.status);
              return [];
            }
          }
          
          return results;
        } catch (error) {
          console.error('Error checking saved tracks:', error);
          return [];
        }
      }
      
      // Handle like button click - make it globally accessible
      window.handleLikeButtonClick = async function(event) {
        console.log('Like button clicked!');
        const button = event.currentTarget || event.target; // Support both event binding methods
        const trackId = button.getAttribute('data-track-id');
        const isSaved = button.getAttribute('data-saved') === 'true';
        console.log('Track ID:', trackId, 'Is Saved:', isSaved);
        
        try {
          const accessToken = localStorage.getItem('spotify_access_token');
          if (!accessToken) {
            console.error('No access token found in localStorage');
            showNotification('Please log in to save tracks', 'error');
            return;
          }
          
          console.log(`Attempting to ${isSaved ? 'remove from' : 'add to'} library track: ${trackId}`);
          
          let response;
          if (isSaved) {
            // Remove from library
            response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ ids: [trackId] })
            });
          } else {
            // Add to library
            response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ ids: [trackId] })
            });
          }
          
          console.log('API response status:', response.status);
          
          if (response.ok) {
            // Update button state
            const newSavedState = !isSaved;
            button.setAttribute('data-saved', newSavedState);
            button.textContent = newSavedState ? '❤️' : '🤍';
            
            // Show notification
            const message = newSavedState ? 'Track added to your Liked Songs' : 'Track removed from your Liked Songs';
            showNotification(message, 'success');
            console.log(`Successfully ${newSavedState ? 'added to' : 'removed from'} library`);
          } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('Failed to update library:', response.status, errorText);
            showNotification('Failed to update library', 'error');
          }
        } catch (error) {
          console.error('Error updating library:', error);
          showNotification('Error updating library', 'error');
        }
      }
      
      // Show notification - make it globally accessible
      window.showNotification = function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Fade in
        setTimeout(() => {
          notification.classList.add('show');
        }, 10);
        
        // Fade out and remove
        setTimeout(() => {
          notification.classList.remove('show');
          setTimeout(() => {
            notification.remove();
          }, 300);
        }, 3000);
      }

      // === New: Generate mood-similar tracks from user's history and related artists ===
      async function generateMoodSimilarFromHistory(accessToken, mood, playlistDiv) {
        try {
          const seedTracks = await collectUserHistoryTracks(accessToken);
          if (!seedTracks.length) return false;

          // Detect user's preferred language from their tracks
          const userLanguage = detectUserLanguage(seedTracks);
          console.log('Detected user language:', userLanguage);

          // Filter seeds by mood first
          const moodSeedsKeyword = filterTracksByMood(seedTracks, mood).slice(0, 50);
          // Also try audio-features filtering for better mood detection
          const moodSeedsByAudio = await filterTracksByAudioFeatures(seedTracks.slice(0, 100), mood, accessToken);
          const combinedMoodSeeds = [...moodSeedsByAudio, ...moodSeedsKeyword];
          const uniqueMoodSeeds = dedupeTracksById(combinedMoodSeeds);
          const moodSeeds = uniqueMoodSeeds.slice(0, 20);
          const seedsToUse = (moodSeeds.length ? moodSeeds : seedTracks).slice(0, 20);

          // Enhanced collection strategy: multiple approaches
          const collected = [];
          const seenTrackIds = new Set();

          // 1. Artist's own top tracks (always works)
          const artistCount = new Map();
          for (const track of seedsToUse) {
            for (const artist of (track.artists || [])) {
              const prev = artistCount.get(artist.id) || 0;
              artistCount.set(artist.id, prev + 1);
            }
          }
          const topArtistIds = [...artistCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5) // Increased from 3 to 5
            .map(([id]) => id)
            .filter(Boolean);

          for (const artistId of topArtistIds) {
            try {
              const ownTopRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (ownTopRes.ok) {
                const ownTopData = await ownTopRes.json();
                const tracks = ownTopData.tracks || [];
                for (const t of tracks) {
                  if (!seenTrackIds.has(t.id)) { collected.push(t); seenTrackIds.add(t.id); }
                }
              }
            } catch {}
          }

          // 2. Genre-based expansion (more reliable than related-artists)
          const genreExpanded = await expandByGenres(seedsToUse, accessToken, mood, userLanguage);
          for (const t of genreExpanded) {
            if (!seenTrackIds.has(t.id)) { collected.push(t); seenTrackIds.add(t.id); }
          }

          // 3. Search-based expansion with language preference
          const searchExpanded = await expandBySearch(seedsToUse, accessToken, mood, userLanguage);
          for (const t of searchExpanded) {
            if (!seenTrackIds.has(t.id)) { collected.push(t); seenTrackIds.add(t.id); }
          }

          // 4. Spotify's curated playlists by genre/mood
          const curatedExpanded = await expandByCuratedPlaylists(accessToken, mood, userLanguage);
          for (const t of curatedExpanded) {
            if (!seenTrackIds.has(t.id)) { collected.push(t); seenTrackIds.add(t.id); }
          }

          if (!collected.length) return false;

          // Apply mood and language filtering
          const moodFiltered = await filterTracksByMoodAndLanguage(collected, mood, userLanguage, accessToken);
          const finalList = moodFiltered.slice(0, 20);

          displayTracks(finalList, playlistDiv, `Similar ${mood.charAt(0).toUpperCase() + mood.slice(1)} Songs Based On Your Taste`);
          return true;
        } catch (err) {
          console.log('generateMoodSimilarFromHistory error:', err);
          return false;
        }
      }

      function dedupeTracksById(tracks) {
        const seen = new Set();
        const out = [];
        for (const t of tracks) {
          const id = t?.id;
          if (id && !seen.has(id)) { out.push(t); seen.add(id); }
        }
        return out;
      }

      async function filterTracksByAudioFeatures(tracks, mood, accessToken) {
        try {
          const ids = tracks.map(t => t?.id).filter(Boolean).slice(0, 100);
          if (!ids.length) return [];
          const features = await getAudioFeatures(ids, accessToken);
          const idToFeatures = new Map();
          for (const f of features) { if (f && f.id) idToFeatures.set(f.id, f); }

          // Enhanced mood thresholds using valence, energy, danceability, and acousticness
          const thresholds = {
            happy: (f) => {
              // High valence (positive mood), good energy, danceable
              return f.valence >= 0.6 && f.energy >= 0.5 && f.danceability >= 0.5 && f.acousticness <= 0.7;
            },
            sad: (f) => {
              // Low valence (negative mood), low energy, more acoustic
              return f.valence <= 0.4 && f.energy <= 0.5 && f.acousticness >= 0.3;
            },
            chill: (f) => {
              // Low energy, high acousticness, moderate valence
              return f.energy <= 0.5 && f.acousticness >= 0.4 && f.valence >= 0.3 && f.valence <= 0.7;
            },
            angry: (f) => {
              // High energy, low valence, low acousticness (aggressive)
              return f.energy >= 0.7 && f.valence <= 0.5 && f.acousticness <= 0.3 && f.danceability >= 0.4;
            }
          };
          const match = thresholds[mood] || thresholds.chill;

          return tracks.filter(t => {
            const f = idToFeatures.get(t?.id);
            return f ? !!match(f) : false;
          });
        } catch {
          return [];
        }
      }

      async function getAudioFeatures(ids, accessToken) {
        if (window._disableAudioFeatures === true) return [];
        const batched = [];
        
        // Try smaller batches first (some tokens have limits)
        const batchSize = 50; // Reduced from 100
        for (let i = 0; i < ids.length; i += batchSize) {
          const slice = ids.slice(i, i + batchSize);
          const res = await fetch(`https://api.spotify.com/v1/audio-features?ids=${encodeURIComponent(slice.join(','))}` , {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            batched.push(...(data.audio_features || []));
          } else if (res.status === 403) {
            // Some sessions/tokens cannot access audio features → disable for this session
            console.log('Audio features unavailable (403). Disabling audio-features filtering for this session.');
            window._disableAudioFeatures = true;
            return [];
          } else if (res.status === 429) {
            // Rate limited - wait a bit and try smaller batch
            console.log('Audio features rate limited, waiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Try with even smaller batch
            const smallSlice = slice.slice(0, 10);
            const retryRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${encodeURIComponent(smallSlice.join(','))}` , {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              batched.push(...(retryData.audio_features || []));
            }
          } else {
            // Soft-fail; continue without this batch
            console.log('Audio features batch failed with status:', res.status);
          }
        }
        return batched;
      }

      // === Language detection and enhanced filtering ===
      function detectUserLanguage(tracks) {
        const languageCount = new Map();
        const languageKeywords = {
          'hindi': ['hindi', 'bollywood', 'indian', 'desi'],
          'english': ['english', 'pop', 'rock', 'hip hop', 'rap'],
          'spanish': ['spanish', 'latin', 'reggaeton', 'flamenco'],
          'korean': ['korean', 'k-pop', 'korean pop'],
          'japanese': ['japanese', 'j-pop', 'anime'],
          'french': ['french', 'français'],
          'german': ['german', 'deutsch'],
          'portuguese': ['portuguese', 'brazilian', 'samba', 'bossa nova']
        };

        for (const track of tracks) {
          const text = `${track.name} ${track.artists?.map(a => a.name).join(' ')} ${track.album?.name || ''}`.toLowerCase();
          for (const [lang, keywords] of Object.entries(languageKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
              languageCount.set(lang, (languageCount.get(lang) || 0) + 1);
            }
          }
        }

        // Return most common language, default to english
        const sorted = [...languageCount.entries()].sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][0] : 'english';
      }

      async function filterTracksByMoodAndLanguage(tracks, mood, userLanguage, accessToken) {
        // First apply mood filtering
        const moodFiltered = filterTracksByMood(tracks, mood);
        
        // Then apply language preference
        const languageFiltered = filterTracksByLanguage(moodFiltered, userLanguage);
        
        // If we have enough language-matched tracks, use them
        if (languageFiltered.length >= 10) {
          return shuffleArray(languageFiltered);
        }
        
        // Otherwise, mix language-matched with mood-matched
        const mixed = [...languageFiltered, ...moodFiltered.filter(t => !languageFiltered.includes(t))];
        return shuffleArray(dedupeTracksById(mixed));
      }

      function filterTracksByLanguage(tracks, preferredLanguage) {
        const languageKeywords = {
          'hindi': ['hindi', 'bollywood', 'indian', 'desi'],
          'english': ['english', 'pop', 'rock', 'hip hop', 'rap'],
          'spanish': ['spanish', 'latin', 'reggaeton', 'flamenco'],
          'korean': ['korean', 'k-pop', 'korean pop'],
          'japanese': ['japanese', 'j-pop', 'anime'],
          'french': ['french', 'français'],
          'german': ['german', 'deutsch'],
          'portuguese': ['portuguese', 'brazilian', 'samba', 'bossa nova']
        };

        const keywords = languageKeywords[preferredLanguage] || languageKeywords.english;
        
        return tracks.filter(track => {
          const text = `${track.name} ${track.artists?.map(a => a.name).join(' ')} ${track.album?.name || ''}`.toLowerCase();
          return keywords.some(keyword => text.includes(keyword));
        });
      }

      async function expandBySearch(seedTracks, accessToken, mood, userLanguage) {
        try {
          const moodKeywords = {
            happy: ['happy', 'joy', 'upbeat', 'cheerful', 'party', 'dance'],
            sad: ['sad', 'melancholy', 'heartbreak', 'blue', 'lonely'],
            chill: ['chill', 'relax', 'calm', 'ambient', 'lofi'],
            angry: ['angry', 'rage', 'heavy', 'aggressive', 'intense']
          };

          const languageKeywords = {
            'hindi': ['hindi', 'bollywood'],
            'english': ['pop', 'rock'],
            'spanish': ['latin', 'spanish'],
            'korean': ['k-pop'],
            'japanese': ['j-pop'],
            'french': ['french'],
            'german': ['german'],
            'portuguese': ['brazilian']
          };

          const moodWords = moodKeywords[mood] || moodKeywords.happy;
          const langWords = languageKeywords[userLanguage] || languageKeywords.english;
          
          // Create diverse search queries
          const queries = [];
          for (const moodWord of moodWords.slice(0, 3)) {
            for (const langWord of langWords.slice(0, 2)) {
              queries.push(`${moodWord} ${langWord}`);
              queries.push(`year:2020-2024 ${moodWord} ${langWord}`);
            }
          }

          const aggregated = [];
          const seenTrackIds = new Set();
          
          for (const query of queries.slice(0, 6)) {
            const tracks = await searchTracksByQuery(query, accessToken);
            for (const t of tracks) {
              if (t.id && !seenTrackIds.has(t.id)) {
                aggregated.push(t);
                seenTrackIds.add(t.id);
              }
            }
            if (aggregated.length > 40) break;
          }

          return aggregated;
        } catch (e) {
          console.log('expandBySearch error:', e);
          return [];
        }
      }

      // === Spotify Curated Playlists ===
      async function expandByCuratedPlaylists(accessToken, mood, userLanguage) {
        try {
          const moodToCategories = {
            happy: ['pop', 'dance', 'party', 'workout', 'summer'],
            sad: ['indie', 'acoustic', 'singer-songwriter', 'folk'],
            chill: ['chill', 'ambient', 'lounge', 'study', 'focus'],
            angry: ['rock', 'metal', 'punk', 'alternative', 'grunge']
          };

          // Use multiple markets for better availability
          const markets = ['US', 'GB', 'IN', 'AU', 'CA'];
          // Add language-specific market if available
          const languageToMarkets = {
            'hindi': 'IN',
            'english': 'US',
            'spanish': 'ES',
            'korean': 'KR',
            'japanese': 'JP',
            'french': 'FR',
            'german': 'DE',
            'portuguese': 'BR'
          };
          
          const langMarket = languageToMarkets[userLanguage];
          if (langMarket && !markets.includes(langMarket)) {
            markets.unshift(langMarket); // Add language market at the beginning
          }
          
          console.log(`Using markets: ${markets.join(', ')} with preference for language: ${userLanguage}`);
          const aggregated = [];
          const seenTrackIds = new Set();

          // Try each market until we get results
          let categoriesData = null;
          for (const market of markets) {
            try {
              console.log(`Trying browse categories for market: ${market}`);
              const categoriesRes = await fetch(`https://api.spotify.com/v1/browse/categories?country=${market}&limit=20`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });

              if (categoriesRes.ok) {
                categoriesData = await categoriesRes.json();
                console.log(`Successfully fetched categories for market: ${market}`);
                break; // Exit the loop if successful
              } else {
                console.log(`Failed to fetch categories for market: ${market} with status: ${categoriesRes.status}`);
              }
            } catch (e) {
              console.log(`Error fetching categories for market: ${market}`, e);
            }
          }

          // If still no categories, try without country parameter
          if (!categoriesData) {
            try {
              console.log('Trying global categories as last resort');
              const globalRes = await fetch(`https://api.spotify.com/v1/browse/categories?limit=20`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (globalRes.ok) {
                categoriesData = await globalRes.json();
                console.log('Successfully fetched global categories');
              }
            } catch (e) {
              console.log('Global categories fetch failed:', e);
            }
          }

          const categories = moodToCategories[mood] || moodToCategories.happy;
          
          if (categoriesData?.categories?.items) {
            // Find categories that match our mood
            const relevantCategories = categoriesData.categories.items.filter(cat => 
              categories.some(c => cat.name.toLowerCase().includes(c))
            );

            console.log(`Found ${relevantCategories.length} relevant categories for mood: ${mood}`);

            // Get playlists from relevant categories
            for (const category of relevantCategories.slice(0, 3)) {
              let playlistsData = null;
              
              // Try each market for playlists
              for (const market of markets) {
                try {
                  console.log(`Trying playlists for category ${category.name} in market: ${market}`);
                  const playlistsRes = await fetch(`https://api.spotify.com/v1/browse/categories/${category.id}/playlists?country=${market}&limit=10`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                  });

                  if (playlistsRes.ok) {
                    playlistsData = await playlistsRes.json();
                    console.log(`Successfully fetched playlists for category ${category.name} in market: ${market}`);
                    break; // Exit the loop if successful
                  } else {
                    console.log(`Failed to fetch playlists for category ${category.name} in market: ${market} with status: ${playlistsRes.status}`);
                  }
                } catch (e) {
                  console.log(`Error fetching playlists for category ${category.name} in market: ${market}`, e);
                }
              }

              // If still no playlists, try without country parameter
              if (!playlistsData) {
                try {
                  console.log(`Trying global playlists for category ${category.name} as last resort`);
                  const globalPlaylistsRes = await fetch(`https://api.spotify.com/v1/browse/categories/${category.id}/playlists?limit=10`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                  });
                  if (globalPlaylistsRes.ok) {
                    playlistsData = await globalPlaylistsRes.json();
                    console.log(`Successfully fetched global playlists for category ${category.name}`);
                  }
                } catch (e) {
                  console.log(`Global playlists fetch failed for category ${category.name}:`, e);
                }
              }

              if (playlistsData?.playlists?.items) {
                const playlists = playlistsData.playlists.items;
                console.log(`Found ${playlists.length} playlists for category ${category.name}`);

                // Get tracks from random playlists
                const randomPlaylists = shuffleArray(playlists).slice(0, 3);
                for (const playlist of randomPlaylists) {
                  const tracks = await getPlaylistTracks(playlist.id, accessToken);
                  console.log(`Found ${tracks.length} tracks in playlist ${playlist.name}`);
                  for (const t of tracks) {
                    if (t.id && !seenTrackIds.has(t.id)) {
                      aggregated.push(t);
                      seenTrackIds.add(t.id);
                    }
                  }
                  if (aggregated.length > 30) break;
                }
              }
            }
          }

          // Try featured playlists as another source
          let featuredData = null;
          for (const market of markets) {
            try {
              console.log(`Trying featured playlists for market: ${market}`);
              const featuredRes = await fetch(`https://api.spotify.com/v1/browse/featured-playlists?country=${market}&limit=20`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });

              if (featuredRes.ok) {
                featuredData = await featuredRes.json();
                console.log(`Successfully fetched featured playlists for market: ${market}`);
                break; // Exit the loop if successful
              } else {
                console.log(`Failed to fetch featured playlists for market: ${market} with status: ${featuredRes.status}`);
              }
            } catch (e) {
              console.log(`Error fetching featured playlists for market: ${market}`, e);
            }
          }

          // If still no featured playlists, try without country parameter
          if (!featuredData) {
            try {
              console.log('Trying global featured playlists as last resort');
              const globalFeaturedRes = await fetch(`https://api.spotify.com/v1/browse/featured-playlists?limit=20`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (globalFeaturedRes.ok) {
                featuredData = await globalFeaturedRes.json();
                console.log('Successfully fetched global featured playlists');
              }
            } catch (e) {
              console.log('Global featured playlists fetch failed:', e);
            }
          }

          if (featuredData?.playlists?.items) {
            const featuredPlaylists = featuredData.playlists.items;
            console.log(`Found ${featuredPlaylists.length} featured playlists`);
            
            // Filter featured playlists by mood keywords
            const moodKeywords = {
              happy: ['happy', 'party', 'dance', 'upbeat', 'summer'],
              sad: ['sad', 'melancholy', 'acoustic', 'indie'],
              chill: ['chill', 'relax', 'ambient', 'study', 'focus'],
              angry: ['rock', 'metal', 'punk', 'alternative']
            };

            const keywords = moodKeywords[mood] || moodKeywords.happy;
            const relevantFeatured = featuredPlaylists.filter(playlist => 
              keywords.some(keyword => (playlist.name || '').toLowerCase().includes(keyword) || 
                            (playlist.description || '').toLowerCase().includes(keyword))
            );

            console.log(`Found ${relevantFeatured.length} mood-relevant featured playlists`);
            const randomFeatured = shuffleArray(relevantFeatured.length > 0 ? relevantFeatured : featuredPlaylists).slice(0, 3);
            
            for (const playlist of randomFeatured) {
              const tracks = await getPlaylistTracks(playlist.id, accessToken);
              console.log(`Found ${tracks.length} tracks in featured playlist ${playlist.name}`);
              for (const t of tracks) {
                if (t.id && !seenTrackIds.has(t.id)) {
                  aggregated.push(t);
                  seenTrackIds.add(t.id);
                }
              }
              if (aggregated.length > 50) break;
            }
          }

          // If we still don't have enough tracks, generate random tracks based on mood and language
          if (aggregated.length < 10) {
            console.log('Not enough tracks from playlists, generating random tracks based on mood and language');
            const randomTracks = await generateRandomTracksByMoodAndLanguage(accessToken, mood, userLanguage);
            for (const t of randomTracks) {
              if (t.id && !seenTrackIds.has(t.id)) {
                aggregated.push(t);
                seenTrackIds.add(t.id);
              }
            }
          }

          console.log(`Found ${aggregated.length} tracks from curated playlists and random generation`);
          return aggregated;
        } catch (e) {
          console.log('expandByCuratedPlaylists error:', e);
          // Even if there's an error, try to generate random tracks as fallback
          try {
            console.log('Attempting fallback to random track generation');
            return await generateRandomTracksByMoodAndLanguage(accessToken, mood, userLanguage);
          } catch (fallbackError) {
            console.log('Random track generation fallback also failed:', fallbackError);
            return [];
          }
        }
      }
      
      // New function to generate random tracks based on mood and language when playlists fail
      async function generateRandomTracksByMoodAndLanguage(accessToken, mood, userLanguage) {
        try {
          const moodKeywords = {
            happy: ['happy', 'joy', 'upbeat', 'cheerful', 'party', 'dance'],
            sad: ['sad', 'melancholy', 'heartbreak', 'blue', 'lonely'],
            chill: ['chill', 'relax', 'calm', 'ambient', 'lofi'],
            angry: ['angry', 'rage', 'heavy', 'aggressive', 'intense']
          };

          const languageKeywords = {
            'hindi': ['hindi', 'bollywood', 'indian'],
            'english': ['pop', 'rock', 'english'],
            'spanish': ['latin', 'spanish', 'reggaeton'],
            'korean': ['k-pop', 'korean'],
            'japanese': ['j-pop', 'japanese', 'anime'],
            'french': ['french', 'français'],
            'german': ['german', 'deutsch'],
            'portuguese': ['brazilian', 'portuguese']
          };

          const keywords = moodKeywords[mood] || moodKeywords.happy;
          const langWords = languageKeywords[userLanguage] || languageKeywords.english;
          
          // Create search queries combining mood and language
          const queries = [];
          for (const moodWord of keywords.slice(0, 3)) {
            for (const langWord of langWords.slice(0, 2)) {
              queries.push(`${moodWord} ${langWord}`);
              // Add year range for more recent tracks
              queries.push(`year:2020-2024 ${moodWord} ${langWord}`);
            }
          }

          // Add some genre-based queries
          const genreQueries = [];
          if (mood === 'happy') {
            genreQueries.push('genre:pop genre:dance', 'genre:disco');
          } else if (mood === 'sad') {
            genreQueries.push('genre:indie genre:acoustic', 'genre:singer-songwriter');
          } else if (mood === 'chill') {
            genreQueries.push('genre:ambient genre:chill', 'genre:lofi');
          } else if (mood === 'angry') {
            genreQueries.push('genre:rock genre:metal', 'genre:punk');
          }
          
          // Add language-specific genres
          if (userLanguage === 'hindi') {
            genreQueries.push('genre:bollywood', 'genre:indian');
          } else if (userLanguage === 'korean') {
            genreQueries.push('genre:k-pop');
          } else if (userLanguage === 'japanese') {
            genreQueries.push('genre:j-pop', 'genre:anime');
          }
          
          queries.push(...genreQueries);

          const aggregated = [];
          const seenTrackIds = new Set();
          
          // Shuffle queries for variety
          const shuffledQueries = shuffleArray(queries);
          
          for (const query of shuffledQueries.slice(0, 8)) {
            console.log(`Searching for tracks with query: ${query}`);
            const tracks = await searchTracksByQuery(query, accessToken);
            console.log(`Found ${tracks.length} tracks for query: ${query}`);
            
            for (const t of tracks) {
              if (t.id && !seenTrackIds.has(t.id)) {
                aggregated.push(t);
                seenTrackIds.add(t.id);
              }
            }
            
            if (aggregated.length > 40) break;
          }

          return aggregated;
        } catch (e) {
          console.log('generateRandomTracksByMoodAndLanguage error:', e);
          return [];
        }
      }

      async function getPlaylistTracks(playlistId, accessToken) {
        try {
          const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=20`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!res.ok) return [];
          
          const data = await res.json();
          return (data.items || []).map(item => item.track).filter(track => track && track.id);
        } catch {
          return [];
        }
      }

      // === Genre fallback helpers ===
      async function expandByGenres(seedTracks, accessToken, mood, userLanguage) {
        try {
          // Collect unique artist IDs from seeds
          const artistIds = [];
          const seen = new Set();
          for (const t of seedTracks) {
            for (const a of (t.artists || [])) {
              if (a.id && !seen.has(a.id)) { seen.add(a.id); artistIds.push(a.id); }
            }
          }
          const genres = await getArtistGenres(artistIds.slice(0, 10), accessToken);
          if (!genres.length) return [];

          // Build mood keyword list
          const moodKeywords = {
            happy: ['happy', 'joy', 'upbeat', 'cheerful', 'party'],
            sad: ['sad', 'melancholy', 'heartbreak', 'blue', 'lonely'],
            chill: ['chill', 'relax', 'calm', 'ambient', 'lofi'],
            angry: ['angry', 'rage', 'heavy', 'aggressive', 'intense']
          };
          const keywords = moodKeywords[mood] || moodKeywords.chill;

          // Compose a few search queries combining popular genres with mood terms
          const topGenres = genres.slice(0, 5);
          const queries = [];
          for (const g of topGenres) {
            for (const kw of keywords.slice(0, 3)) {
              queries.push(`${kw} genre:${JSON.stringify(g).replace(/"/g,'')}`);
            }
          }

          // Execute searches and aggregate tracks
          const aggregated = [];
          const seenTrackIds = new Set();
          for (const q of queries.slice(0, 8)) {
            const tracks = await searchTracksByQuery(q, accessToken);
            for (const t of tracks) {
              if (t.id && !seenTrackIds.has(t.id)) { aggregated.push(t); seenTrackIds.add(t.id); }
            }
            if (aggregated.length > 60) break;
          }

          // Apply stronger genre-based mood filter
          const genreFiltered = await filterTracksByGenresHeuristic(aggregated, mood, accessToken);
          if (genreFiltered.length) return genreFiltered;
          // Then keyword fallback
          const keywordFiltered = filterTracksByMood(aggregated, mood);
          return keywordFiltered.length ? keywordFiltered : aggregated;
        } catch (e) {
          console.log('expandByGenres error:', e);
          return [];
        }
      }

      async function getArtistGenres(artistIds, accessToken) {
        const genres = [];
        for (const id of artistIds) {
          try {
            const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (res.ok) {
              const data = await res.json();
              for (const g of (data.genres || [])) {
                if (g && !genres.includes(g)) genres.push(g);
              }
            }
          } catch {}
          if (genres.length > 10) break;
        }
        return genres;
      }

      async function searchTracksByQuery(query, accessToken) {
        try {
          const offset = String(Math.floor(Math.random() * 5) * 10); // 0,10,20,30,40 for variety
          const params = new URLSearchParams({ q: query, type: 'track', limit: '10', market: 'US', offset });
          const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!res.ok) return [];
          const data = await res.json();
          return (data.tracks?.items) || [];
        } catch {
          return [];
        }
      }

      // === Mood via artist genres heuristic ===
      async function filterTracksByGenresHeuristic(tracks, mood, accessToken) {
        try {
          const artistIds = [];
          const seen = new Set();
          for (const t of tracks) {
            for (const a of (t.artists || [])) {
              if (a.id && !seen.has(a.id)) { seen.add(a.id); artistIds.push(a.id); }
            }
          }
          const genreMap = await getArtistsGenresBulk(artistIds.slice(0, 50), accessToken);
          const sets = getMoodGenreSets();
          const include = sets[mood]?.include || sets.chill.include;
          const exclude = sets[mood]?.exclude || sets.chill.exclude;

          const matches = tracks.filter(t => {
            const g = new Set();
            for (const a of (t.artists || [])) {
              const arr = genreMap.get(a.id) || [];
              for (const gg of arr) g.add(gg);
            }
            const genres = [...g];
            const text = `${t.name} ${t.album?.name || ''}`.toLowerCase();
            // Exclusion first
            if (exclude.some(x => text.includes(x) || genres.some(gg => gg.includes(x)))) return false;
            // Inclusion by genre or keyword presence
            return include.some(x => text.includes(x) || genres.some(gg => gg.includes(x)));
          });
          return matches;
        } catch {
          return [];
        }
      }

      function getMoodGenreSets() {
        return {
          happy: {
            include: ['happy', 'dance', 'party', 'pop', 'dance pop', 'bollywood dance', 'edm', 'house', 'funk', 'feel good'],
            exclude: ['sad', 'melancholy', 'heartbreak', 'breakup', 'cry', 'tears']
          },
          sad: {
            include: ['sad', 'melancholy', 'romance', 'acoustic', 'piano', 'singer-songwriter', 'ballad'],
            exclude: ['party', 'edm', 'festival']
          },
          chill: {
            include: ['chill', 'relax', 'lofi', 'ambient', 'soft', 'acoustic', 'indie'],
            exclude: ['metal', 'hardcore', 'aggressive']
          },
          angry: {
            include: ['metal', 'hard rock', 'aggressive', 'trap metal', 'industrial', 'hardcore', 'grunge'],
            exclude: ['lullaby', 'ambient', 'piano']
          }
        };
      }

      async function getArtistsGenresBulk(artistIds, accessToken) {
        const map = new Map();
        for (let i = 0; i < artistIds.length; i += 50) {
          const slice = artistIds.slice(i, i + 50);
          try {
            const params = new URLSearchParams({ ids: slice.join(',') });
            const res = await fetch(`https://api.spotify.com/v1/artists?${params.toString()}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (res.ok) {
              const data = await res.json();
              for (const a of (data.artists || [])) {
                map.set(a.id, a.genres || []);
              }
            }
          } catch {}
        }
        return map;
      }
      async function collectUserHistoryTracks(accessToken) {
        const aggregated = [];

        // Recently played (optional)
        try {
          const rp = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (rp.ok) {
            const data = await rp.json();
            aggregated.push(...(data.items || []).map(i => i.track).filter(Boolean));
          }
        } catch {}

        // Saved tracks
        try {
          const saved = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (saved.ok) {
            const data = await saved.json();
            aggregated.push(...(data.items || []).map(i => i.track).filter(Boolean));
          }
        } catch {}

        // Top tracks across ranges
        const ranges = ['short_term', 'medium_term', 'long_term'];
        for (const r of ranges) {
          try {
            const tt = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${r}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (tt.ok) {
              const data = await tt.json();
              aggregated.push(...(data.items || []));
            }
          } catch {}
        }

        // Dedupe by track id
        const seen = new Set();
        const deduped = [];
        for (const t of aggregated) {
          if (t && t.id && !seen.has(t.id)) {
            deduped.push(t);
            seen.add(t.id);
          }
        }
        return deduped;
      }

      async function generateTopTracks(accessToken, playlistDiv) {
        try {
          const mood = document.getElementById('mood').value;
          
          // Try different time ranges to get more variety
          const timeRanges = ['medium_term', 'short_term', 'long_term'];
          
          for (const timeRange of timeRanges) {
            console.log(`Trying top tracks for ${timeRange}...`);
            const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=${timeRange}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });

            console.log(`Top tracks ${timeRange} response status:`, res.status);

            if (res.ok) {
              const data = await res.json();
              console.log(`Top tracks ${timeRange} data:`, data);
              
              if (data.items && data.items.length > 0) {
                // Store all tracks before filtering
                const allTracks = data.items;
                window._allTracks = allTracks;
                
                const moodFilteredTracks = filterTracksByMood(allTracks, mood);
                console.log(`Mood filtered tracks for ${mood}:`, moodFilteredTracks.length);
                
                if (moodFilteredTracks.length > 0) {
                  displayTracks(moodFilteredTracks.slice(0, 20), playlistDiv, `Your Top ${mood.charAt(0).toUpperCase() + mood.slice(1)} Tracks`);
                  return;
                }
              }
            } else {
              console.log(`Top tracks ${timeRange} failed with status:`, res.status);
            }
          }

          // If no mood-filtered tracks found, show all top tracks
          console.log('No mood-filtered tracks found, trying all top tracks...');
          const res = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=medium_term', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          console.log('Final top tracks response status:', res.status);

          if (!res.ok) {
            console.error('Top tracks API failed:', res.status, res.statusText);
            // Try to get user's saved tracks as final fallback
            await generateSavedTracksFallback(accessToken, playlistDiv);
            return;
          }

          const data = await res.json();
          console.log('Final top tracks data:', data);

          if (!data.items || data.items.length === 0) {
            console.log('No top tracks found, trying saved tracks...');
            await generateSavedTracksFallback(accessToken, playlistDiv);
            return;
          }

          displayTracks(data.items, playlistDiv, 'Your Top Tracks');
        } catch (err) {
          console.error('Top tracks also failed:', err);
          await generateSavedTracksFallback(accessToken, playlistDiv);
        }
      }

      // Function to show all liked songs
      async function showLikedSongs(accessToken, playlistDiv) {
        try {
          console.log('Fetching liked songs...');
          const res = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          console.log('Liked songs response status:', res.status);

          if (res.ok) {
            const data = await res.json();
            console.log('Liked songs data:', data);
            
            if (data.items && data.items.length > 0) {
              // Store all tracks before displaying
              const allTracks = data.items.map(item => item.track);
              window._allTracks = allTracks;
              displayTracks(allTracks, playlistDiv, 'Your Liked Songs');
              return;
            } else {
              playlistDiv.innerHTML = `
                <div class="no-tracks">
                  <h3>No Liked Songs Found</h3>
                  <p>You haven't liked any songs on Spotify yet.</p>
                  <p>Start liking songs on Spotify to see them here!</p>
                </div>
              `;
            }
          } else {
            playlistDiv.innerHTML = '<div class="error">❌ Unable to fetch your liked songs. Please check your Spotify connection and try again.</div>';
          }
        } catch (err) {
          console.error('Error fetching liked songs:', err);
          playlistDiv.innerHTML = '<div class="error">❌ An error occurred while fetching your liked songs. Please try again later.</div>';
        }
      }

      async function generateSavedTracksFallback(accessToken, playlistDiv) {
        try {
          console.log('Trying saved tracks as final fallback...');
          const res = await fetch('https://api.spotify.com/v1/me/tracks?limit=20', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          console.log('Saved tracks response status:', res.status);

          if (res.ok) {
            const data = await res.json();
            console.log('Saved tracks data:', data);
            
            if (data.items && data.items.length > 0) {
              const mood = document.getElementById('mood').value;
              // Store all tracks before filtering
              const allTracks = data.items.map(item => item.track);
              window._allTracks = allTracks;
              
              const moodFilteredTracks = filterTracksByMood(allTracks, mood);
              
              if (moodFilteredTracks.length > 0) {
                displayTracks(moodFilteredTracks.slice(0, 20), playlistDiv, 'Your Liked Songs for This Mood');
                return;
              } else {
                displayTracks(allTracks.slice(0, 20), playlistDiv, 'Your Liked Songs');
                return;
              }
            }
          }

          // If everything fails, show a helpful message
          playlistDiv.innerHTML = `
            <div class="no-tracks">
              <h3>🎵 Welcome to Spotify!</h3>
              <p>It looks like you're new to Spotify or don't have enough listening history yet.</p>
              <p>To get personalized recommendations:</p>
              <ul style="text-align: left; margin: 20px 0;">
                <li>🎧 Listen to more music on Spotify</li>
                <li>❤️ Like songs you enjoy</li>
                <li>📱 Use Spotify for a few days</li>
                <li>🎵 Create some playlists</li>
              </ul>
              <p>Come back in a few days and we'll have great recommendations for you!</p>
            </div>
          `;
        } catch (err) {
          console.error('Saved tracks fallback also failed:', err);
          playlistDiv.innerHTML = '<div class="error">❌ Unable to fetch music data. Please check your Spotify connection and try again.</div>';
        }
      }

    } catch (err) {
      console.error(err);
      document.body.innerHTML = '<p style="color:red;">❌ Failed to exchange code. Please <a href="/">login again</a>.</p>';
    }
  })();
}

// === Utility Functions ===
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => notification.remove());
  
  // Create new notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Show notification
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  // Auto-hide after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 4000);
}

// Add enhanced button interactions
document.addEventListener('DOMContentLoaded', () => {
  // Add pulse animation to logo on page load
  const logoCircle = document.querySelector('.logo-circle');
  if (logoCircle) {
    logoCircle.classList.add('pulse');
  }
  
  // Add ripple effect to buttons
  const buttons = document.querySelectorAll('button, .login-btn, .signup-btn');
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
});

// CSS for ripple effect (will be added via JavaScript)
const rippleCSS = `
.ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  transform: scale(0);
  animation: rippleEffect 0.6s linear;
  pointer-events: none;
}

@keyframes rippleEffect {
  to {
    transform: scale(4);
    opacity: 0;
  }
}
`;

// Add ripple CSS to head
const style = document.createElement('style');
style.textContent = rippleCSS;
document.head.appendChild(style);

// Email Modal Functions
function showEmailModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('emailModal');
    const emailInput = document.getElementById('emailInput');
    const confirmBtn = document.getElementById('confirmEmail');
    const cancelBtn = document.getElementById('cancelEmail');
    const closeBtn = document.getElementById('closeModal');
    const modalContainer = modal.querySelector('.modal-container');

    // Show modal with animation
    modal.classList.add('show');
    modalContainer.classList.add('animate-in');
    
    // Focus on input after animation
    setTimeout(() => {
      emailInput.focus();
    }, 200);

    // Handle confirm
    const handleConfirm = () => {
      const email = emailInput.value.trim();
      if (email && isValidEmail(email)) {
        hideModal();
        resolve(email);
      } else {
        emailInput.style.borderColor = '#ff6b6b';
        emailInput.style.boxShadow = '0 0 20px rgba(255, 107, 107, 0.3)';
        setTimeout(() => {
          emailInput.style.borderColor = '#667eea';
          emailInput.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.3)';
        }, 2000);
        emailInput.focus();
      }
    };

    // Handle cancel/close
    const handleCancel = () => {
      hideModal();
      resolve(null);
    };

    // Hide modal function
    const hideModal = () => {
      modal.classList.remove('show');
      modalContainer.classList.remove('animate-in');
      emailInput.value = '';
      
      // Remove event listeners
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      closeBtn.removeEventListener('click', handleCancel);
      emailInput.removeEventListener('keypress', handleKeyPress);
      modal.removeEventListener('click', handleOverlayClick);
    };

    // Handle enter key
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };

    // Handle overlay click
    const handleOverlayClick = (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    };

    // Add event listeners
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    emailInput.addEventListener('keypress', handleKeyPress);
    modal.addEventListener('click', handleOverlayClick);

    // Add input animation on focus
    emailInput.addEventListener('focus', () => {
      emailInput.parentElement.style.transform = 'scale(1.02)';
    });

    emailInput.addEventListener('blur', () => {
      emailInput.parentElement.style.transform = 'scale(1)';
    });
  });
}

// Email validation function
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
