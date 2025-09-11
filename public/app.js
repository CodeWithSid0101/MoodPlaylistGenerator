// App Configuration
const API_BASE_URL = '/api';

// DOM Elements
const moodSelect = document.getElementById('mood');
const generateBtn = document.getElementById('generate-btn');
const playlistContainer = document.getElementById('playlist-container');
const playlistList = document.getElementById('playlist-list');
const logoutBtn = document.getElementById('logout');
const usernameSpan = document.getElementById('username');

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  const accessToken = localStorage.getItem('spotify_access_token');
  
  if (!accessToken) {
    // Redirect to login if not authenticated
    window.location.href = '/';
    return;
  }
  
  // Initialize the app
  try {
    await initializeApp(accessToken);
  } catch (error) {
    console.error('Error initializing app:', error);
    showNotification('Failed to initialize app. Please try again.', 'error');
  }
});

// Initialize the application
async function initializeApp(accessToken) {
  try {
    // Get user profile
    const user = await fetchUserProfile(accessToken);
    if (user) {
      usernameSpan.textContent = user.display_name || user.id;
    }
    
    // Set up event listeners
    setupEventListeners();
    
  } catch (error) {
    console.error('Error initializing app:', error);
    throw error;
  }
}

// Fetch user profile from Spotify
async function fetchUserProfile(accessToken) {
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

// Set up event listeners
function setupEventListeners() {
  // Generate playlist button
  generateBtn.addEventListener('click', handleGeneratePlaylist);
  
  // Logout button
  logoutBtn.addEventListener('click', handleLogout);
  
  // Mood selection change
  moodSelect.addEventListener('change', () => {
    // Clear previous results when mood changes
    playlistContainer.innerHTML = `
      <div class="welcome-message">
        <h2>${moodSelect.options[moodSelect.selectedIndex].text} Mood</h2>
        <p>Click "Generate Playlist" to create your perfect playlist!</p>
      </div>
    `;
  });
}

// Handle playlist generation
async function handleGeneratePlaylist() {
  const mood = moodSelect.value;
  const accessToken = localStorage.getItem('spotify_access_token');
  
  if (!accessToken) {
    showNotification('Please log in to generate playlists', 'error');
    return;
  }
  
  try {
    // Show loading state
    const originalText = generateBtn.innerHTML;
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    
    // Clear previous results
    playlistContainer.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Creating your perfect ${mood} playlist...</p>
      </div>
    `;
    
    // Call the weather-music API with the selected mood
    const response = await fetch(`${API_BASE_URL}/weather-music/mood?mood=${mood}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate playlist');
    }
    
    const tracks = await response.json();
    
    // Display the tracks
    displayTracks(tracks, playlistContainer, `Your ${mood} Playlist`);
    
  } catch (error) {
    console.error('Error generating playlist:', error);
    showNotification(`Error: ${error.message}`, 'error');
    
    // Show error message
    playlistContainer.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Oops! Something went wrong</h3>
        <p>${error.message || 'Failed to generate playlist. Please try again.'}</p>
        <button id="retry-btn" class="btn-primary">
          <i class="fas fa-sync-alt"></i> Try Again
        </button>
      </div>
    `;
    
    // Add retry button event listener
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', handleGeneratePlaylist);
    }
  } finally {
    // Reset button state
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Playlist';
  }
}

// Display tracks in the playlist container
function displayTracks(tracks, container, title) {
  if (!tracks || tracks.length === 0) {
    container.innerHTML = `
      <div class="no-tracks">
        <i class="fas fa-music"></i>
        <h3>No tracks found</h3>
        <p>We couldn't find any tracks matching your mood. Try a different mood or try again later.</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <div class="playlist-header">
      <h2>${title}</h2>
      <button id="save-playlist" class="btn-primary">
        <i class="fas fa-save"></i> Save to Spotify
      </button>
    </div>
    <div class="tracks-grid">
  `;
  
  tracks.forEach((track, index) => {
    const artists = track.artists ? track.artists.map(a => a.name).join(', ') : 'Unknown Artist';
    const albumImage = track.album?.images?.[0]?.url || 'https://via.placeholder.com/64';
    
    html += `
      <div class="track-card" data-track-id="${track.id}">
        <div class="track-number">${index + 1}</div>
        <img src="${albumImage}" alt="${track.album?.name || 'Album'}" class="track-image">
        <div class="track-info">
          <div class="track-name">${track.name || 'Unknown Track'}</div>
          <div class="track-artist">${artists}</div>
        </div>
        <div class="track-actions">
          <button class="btn-icon play-btn" data-preview-url="${track.preview_url}">
            <i class="fas fa-play"></i>
          </button>
          <button class="btn-icon like-btn" data-liked="false">
            <i class="far fa-heart"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
  
  // Add event listeners for the new elements
  setupTrackEventListeners();
  
  // Add save playlist button event listener
  const saveBtn = document.getElementById('save-playlist');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => handleSavePlaylist(tracks, title));
  }
}

// Set up event listeners for track interactions
function setupTrackEventListeners() {
  // Play/pause preview
  document.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const previewUrl = e.currentTarget.dataset.previewUrl;
      if (!previewUrl) {
        showNotification('No preview available for this track', 'info');
        return;
      }
      
      // Toggle play/pause
      const audio = document.getElementById('preview-audio') || document.createElement('audio');
      audio.id = 'preview-audio';
      
      if (audio.src === previewUrl && !audio.paused) {
        audio.pause();
        e.currentTarget.innerHTML = '<i class="fas fa-play"></i>';
      } else {
        // Stop any currently playing preview
        document.querySelectorAll('.play-btn').forEach(b => {
          if (b !== e.currentTarget) {
            b.innerHTML = '<i class="fas fa-play"></i>';
          }
        });
        
        // Play the selected preview
        audio.src = previewUrl;
        audio.play()
          .then(() => {
            e.currentTarget.innerHTML = '<i class="fas fa-pause"></i>';
          })
          .catch(err => {
            console.error('Error playing preview:', err);
            showNotification('Could not play preview', 'error');
          });
      }
    });
  });
  
  // Like/unlike track
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const trackId = e.currentTarget.closest('.track-card').dataset.trackId;
      const isLiked = e.currentTarget.dataset.liked === 'true';
      
      try {
        await toggleSaveTrack(trackId, !isLiked);
        
        // Update UI
        if (isLiked) {
          e.currentTarget.innerHTML = '<i class="far fa-heart"></i>';
          e.currentTarget.dataset.liked = 'false';
          showNotification('Removed from your library', 'success');
        } else {
          e.currentTarget.innerHTML = '<i class="fas fa-heart" style="color: #1DB954;"></i>';
          e.currentTarget.dataset.liked = 'true';
          showNotification('Added to your library', 'success');
        }
      } catch (error) {
        console.error('Error toggling track save:', error);
        showNotification('Failed to update library', 'error');
      }
    });
  });
}

// Save/unsave track in user's library
async function toggleSaveTrack(trackId, save = true) {
  const accessToken = localStorage.getItem('spotify_access_token');
  if (!accessToken) {
    throw new Error('Not authenticated');
  }
  
  const method = save ? 'PUT' : 'DELETE';
  const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to update track save status');
  }
  
  return true;
}

// Save playlist to user's Spotify account
async function handleSavePlaylist(tracks, playlistName) {
  const accessToken = localStorage.getItem('spotify_access_token');
  if (!accessToken) {
    showNotification('Please log in to save playlists', 'error');
    return;
  }
  
  try {
    // Get current user's ID
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }
    
    const user = await userResponse.json();
    const userId = user.id;
    
    // Create a new playlist
    const createResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playlistName,
        description: `Created with MoodPlaylist Generator - ${new Date().toLocaleDateString()}`,
        public: false
      })
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create playlist');
    }
    
    const playlist = await createResponse.json();
    
    // Add tracks to the playlist
    const trackUris = tracks.map(track => track.uri).filter(uri => uri);
    
    if (trackUris.length > 0) {
      const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: trackUris
        })
      });
      
      if (!addTracksResponse.ok) {
        throw new Error('Failed to add tracks to playlist');
      }
    }
    
    showNotification('Playlist saved to your Spotify library!', 'success');
    
    // Open the playlist in Spotify
    window.open(playlist.external_urls.spotify, '_blank');
    
  } catch (error) {
    console.error('Error saving playlist:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Handle user logout
function handleLogout() {
  // Clear local storage
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expires_at');
  
  // Redirect to login page
  window.location.href = '/';
}

// Show notification to user
function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  if (!notification) return;
  
  // Clear any existing notifications
  notification.textContent = '';
  notification.className = '';
  
  // Set notification content and style
  notification.textContent = message;
  notification.classList.add('notification', type);
  
  // Show notification
  notification.style.display = 'block';
  notification.style.opacity = '1';
  
  // Hide notification after delay
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.style.display = 'none';
    }, 300);
  }, 3000);
}
