const express = require('express');
const axios = require('axios');
const User = require('../models/User');
const Playlist = require('../models/Playlist');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Spotify API configuration
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';

// Validate Spotify configuration
const validateSpotifyConfig = () => {
  const requiredVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI'];
  const missing = requiredVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing Spotify configuration: ${missing.join(', ')}`);
  }
};

// Get Spotify authorization URL
router.get('/auth', auth, (req, res) => {
  try {
        validateSpotifyConfig();

        const scopes = [
            'playlist-modify-public',
      'playlist-modify-private', 
            'user-read-private',
            'user-read-email',
            'user-library-read',
            'user-top-read'
        ].join(' ');

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: process.env.SPOTIFY_CLIENT_ID,
            scope: scopes,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            state: req.user._id.toString(),
            show_dialog: 'true'
        });

        const authUrl = `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params}`;

    res.json({
      success: true,
            authUrl
        });

  } catch (error) {
        console.error('Spotify auth URL error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate Spotify authorization URL' 
});
  }
});

// Handle Spotify callback
router.get('/callback', async (req, res) => {
  try {
        const { code, state, error } = req.query;

        if (error) {
            console.error('Spotify auth error:', error);
      return res.redirect('/?error=spotify_auth_denied');
        }

        if (!code || !state) {
            return res.redirect('/?error=missing_auth_data');
        }

        validateSpotifyConfig();
        const userId = state;

    // Exchange code for tokens
        const authHeader = Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64');

        const tokenResponse = await axios.post(
            `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            }),
            {
                headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 10000
            }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get Spotify profile
        const profileResponse = await axios.get(`${SPOTIFY_API_BASE}/me`, {
            headers: { Authorization: `Bearer ${access_token}` },
            timeout: 10000
        });

        const spotifyProfile = profileResponse.data;

    // Update user
        const user = await User.findByIdAndUpdate(
            userId,
            {
                spotifyId: spotifyProfile.id,
                spotifyAccessToken: access_token,
                spotifyRefreshToken: refresh_token,
                spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000),
                profilePicture: spotifyProfile.images?.[0]?.url || null
            },
            { new: true }
        );

        if (!user) {
            return res.redirect('/?error=user_not_found');
        }

        res.redirect('/dashboard?success=spotify_connected');

  } catch (error) {
        console.error('Spotify callback error:', error);
        res.redirect('/?error=spotify_connection_failed');
  }
});

// Refresh Spotify token
const refreshSpotifyToken = async (user) => {
    try {
        if (!user.spotifyRefreshToken) {
            throw new Error('No refresh token available');
        }

        validateSpotifyConfig();

        const authHeader = Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64');

        const response = await axios.post(
            `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: user.spotifyRefreshToken,
            }),
            {
                headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 10000
            }
        );

        const { access_token, expires_in, refresh_token } = response.data;

    // Update user with new tokens
        const updateData = {
            spotifyAccessToken: access_token,
            spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
        };

        if (refresh_token) {
            updateData.spotifyRefreshToken = refresh_token;
        }

        await User.findByIdAndUpdate(user._id, updateData);

        return access_token;

    } catch (error) {
        console.error('Token refresh error:', error);
    throw new Error('Failed to refresh Spotify token');
    }
};

// Get valid Spotify token
const getValidSpotifyToken = async (user) => {
    if (user.isSpotifyTokenValid()) {
        return user.spotifyAccessToken;
    }

    if (user.spotifyRefreshToken) {
        return await refreshSpotifyToken(user);
    }

  throw new Error('No valid Spotify token available. Please reconnect your Spotify account.');
};

// Create playlist on Spotify
router.post('/create-playlist', auth, async (req, res) => {
    try {
        const { playlistId } = req.body;

        if (!playlistId) {
            return res.status(400).json({ error: 'Playlist ID is required' });
        }

        const playlist = await Playlist.findOne({ 
            _id: playlistId, 
            userId: req.user._id 
        });

        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        if (playlist.spotifyPlaylistId) {
            return res.status(400).json({ 
                error: 'Playlist already exists on Spotify',
                spotifyUrl: playlist.spotifyUrl 
            });
        }

        // Get fresh user data with Spotify tokens
        const user = await User.findById(req.user._id).select('+spotifyAccessToken +spotifyRefreshToken');
        
        if (!user.spotifyId) {
            return res.status(401).json({ 
                error: 'Spotify account not connected. Please connect your Spotify account first.' 
            });
        }
        const token = await getValidSpotifyToken(user);

        // Create playlist on Spotify
        const createResponse = await axios.post(
            `${SPOTIFY_API_BASE}/users/${user.spotifyId}/playlists`,
            {
                name: playlist.name,
                description: playlist.description || `Generated playlist: ${playlist.prompt.substring(0, 200)}`,
                public: playlist.isPublic
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        const spotifyPlaylist = createResponse.data;

        // Add tracks to playlist if available
        if (playlist.tracks && playlist.tracks.length > 0) {
            const trackUris = playlist.tracks
                .filter(track => track.trackId)
                .map(track => `spotify:track:${track.trackId}`);

            if (trackUris.length > 0) {
                // Spotify allows max 100 tracks per request
                const chunks = [];
                for (let i = 0; i < trackUris.length; i += 100) {
                    chunks.push(trackUris.slice(i, i + 100));
                }

                for (const chunk of chunks) {
                    await axios.post(
                    `${SPOTIFY_API_BASE}/playlists/${spotifyPlaylist.id}/tracks`,
                        { uris: chunk },
                        {
                            headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                            },
                            timeout: 10000
                    }
                );
            }
        }
        }

        // Update playlist with Spotify data
        playlist.spotifyPlaylistId = spotifyPlaylist.id;
        playlist.spotifyUrl = spotifyPlaylist.external_urls.spotify;
        playlist.imageUrl = spotifyPlaylist.images?.[0]?.url;
        await playlist.save();

        res.json({
            success: true,
            message: 'Playlist created on Spotify successfully!',
            playlist: {
                id: playlist._id,
                name: playlist.name,
                spotifyUrl: playlist.spotifyUrl,
                spotifyPlaylistId: playlist.spotifyPlaylistId
            }
        });

    } catch (error) {
        console.error('Create Spotify playlist error:', error);
        
        if (error.response?.status === 401) {
            return res.status(401).json({ 
                error: 'Spotify authentication expired. Please reconnect your account.' 
            });
        }

        if (error.response?.status === 403) {
            return res.status(403).json({ 
                error: 'Spotify access denied. Please check your account permissions.' 
});
        }

        res.status(500).json({ 
            error: error.message || 'Failed to create playlist on Spotify' 
        });
    }
});
// Disconnect Spotify account
router.delete('/disconnect', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            spotifyId: null,
            spotifyAccessToken: null,
            spotifyRefreshToken: null,
            spotifyTokenExpiry: null
        });

        res.json({
            success: true,
            message: 'Spotify account disconnected successfully'
        });

    } catch (error) {
        console.error('Spotify disconnect error:', error);
        res.status(500).json({ 
            error: 'Failed to disconnect Spotify account' 
});
    }
});

// Search Spotify tracks (optional feature)
router.get('/search', auth, async (req, res) => {
    try {
        const { q, type = 'track', limit = 20 } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const user = await User.findById(req.user._id).select('+spotifyAccessToken +spotifyRefreshToken');
        
        if (!user.spotifyId) {
            return res.status(401).json({ 
                error: 'Spotify account not connected' 
            });
        }

        const token = await getValidSpotifyToken(user);

        const response = await axios.get(`${SPOTIFY_API_BASE}/search`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                q: q.trim(),
                type,
                limit: Math.min(parseInt(limit), 50),
                market: 'US'
            },
            timeout: 10000
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Spotify search error:', error);
        
        if (error.response?.status === 401) {
            return res.status(401).json({ 
                error: 'Spotify authentication required' 
            });
        }

        res.status(500).json({ 
            error: 'Search failed' 
        });
    }
});

module.exports = router;
