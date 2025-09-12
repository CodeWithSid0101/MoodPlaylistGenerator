const express = require('express');
const axios = require('axios');
const Playlist = require('../models/Playlist');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Generate playlist parameters based on mood and prompt
const generatePlaylistParameters = (prompt, mood, genres, targetLength) => {
  try {
    // Mood-based audio features
    const moodMapping = {
      'happy': { target_valence: 0.8, target_energy: 0.7, target_danceability: 0.6 },
      'sad': { target_valence: 0.2, target_energy: 0.3, target_danceability: 0.3 },
      'energetic': { target_energy: 0.9, target_danceability: 0.8, target_valence: 0.7 },
      'chill': { target_valence: 0.5, target_energy: 0.3, target_danceability: 0.4 },
      'romantic': { target_valence: 0.6, target_energy: 0.4, target_danceability: 0.5 },
      'party': { target_danceability: 0.9, target_energy: 0.8, target_valence: 0.8 },
      'workout': { target_energy: 0.9, target_danceability: 0.7, target_valence: 0.6 },
      'focus': { target_valence: 0.5, target_energy: 0.4, target_danceability: 0.3 },
      'sleep': { target_valence: 0.3, target_energy: 0.2, target_danceability: 0.2 }
    };

    const audioFeatures = moodMapping[mood] || { target_valence: 0.5, target_energy: 0.5 };
    
    // Genre seeds
    const availableGenres = [
      'pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'classical', 'country', 
      'r-n-b', 'indie', 'alternative', 'blues', 'folk', 'reggae', 'latin'
      ];
    
    let seedGenres = [];
    if (genres && genres.length > 0) {
      seedGenres = genres
        .map(g => g.toLowerCase().replace(/[^a-z-]/g, ''))
        .filter(g => availableGenres.includes(g))
        .slice(0, 2);
    }

    if (seedGenres.length === 0) {
      seedGenres = ['pop'];
    }

    return {
      ...audioFeatures,
      seed_genres: seedGenres.join(','),
      limit: Math.min(Math.max(targetLength, 5), 100),
      market: 'US'
    };
  } catch (error) {
    console.error('Error generating playlist parameters:', error);
    return {
      seed_genres: 'pop',
      limit: 20,
      market: 'US'
    };
  }
};

// Create new playlist
router.post('/', auth, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      prompt, 
      mood = 'custom', 
      genres = [], 
      targetLength = 20,
      isPublic = false 
    } = req.body;

    // Validation
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Playlist description/prompt is required' });
    }

    if (targetLength < 5 || targetLength > 100) {
      return res.status(400).json({ 
        error: 'Number of songs must be between 5 and 100' 
      });
    }

    // Create playlist
    const playlist = new Playlist({
      name: name.trim(),
      description: description?.trim() || '',
      prompt: prompt.trim(),
      userId: req.user._id,
      mood,
      genres: Array.isArray(genres) ? genres.filter(g => g.trim()) : [],
      targetLength: parseInt(targetLength),
      isPublic: Boolean(isPublic),
      generationStatus: 'pending'
    });
    await playlist.save();

    // Add to user's playlists
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { playlists: playlist._id }
    });

    res.status(201).json({
      success: true,
      message: 'Playlist created successfully',
      playlist: {
        id: playlist._id,
        name: playlist.name,
        description: playlist.description,
        prompt: playlist.prompt,
        mood: playlist.mood,
        genres: playlist.genres,
        targetLength: playlist.targetLength,
        generationStatus: playlist.generationStatus,
        createdAt: playlist.createdAt
      }
    });

  } catch (error) {
    console.error('Create playlist error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages[0] });
  }
    
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Generate tracks for playlist
router.post('/:id/generate', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlist.generationStatus === 'generating') {
      return res.status(400).json({ 
        error: 'Playlist generation already in progress' 
      });
    }

    // Update status to generating
    playlist.generationStatus = 'generating';
    playlist.errorMessage = null;
    await playlist.save();

    try {
      // Get user with Spotify tokens
      const user = await User.findById(req.user._id).select('+spotifyAccessToken +spotifyRefreshToken');
      
      if (!user.spotifyId || !user.isSpotifyTokenValid()) {
        throw new Error('Spotify account not connected or token expired');
      }

      // Get generation parameters
      const genParams = generatePlaylistParameters(
        playlist.prompt,
        playlist.mood,
        playlist.genres,
        playlist.targetLength
      );

      // Get recommendations from Spotify
      const response = await axios.get(
        `https://api.spotify.com/v1/recommendations`,
        {
          headers: { 
            Authorization: `Bearer ${user.spotifyAccessToken}` 
          },
          params: genParams,
          timeout: 10000
        }
      );

      if (!response.data?.tracks) {
        throw new Error('No tracks received from Spotify');
      }

      // Process tracks
      const tracks = response.data.tracks.map(track => ({
        trackId: track.id,
        name: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        duration: track.duration_ms,
        preview_url: track.preview_url,
        external_urls: track.external_urls,
        image: track.album.images[0]?.url,
        popularity: track.popularity,
        explicit: track.explicit
      }));

      // Update playlist with tracks
      playlist.tracks = tracks;
      playlist.generationStatus = 'completed';
      playlist.isGenerated = true;
      playlist.errorMessage = null;
      await playlist.save();

      res.json({
        success: true,
        message: 'Playlist generated successfully',
        playlist: {
          id: playlist._id,
          name: playlist.name,
          tracks: playlist.tracks,
          generationStatus: playlist.generationStatus,
          actualLength: playlist.actualLength
        }
      });

    } catch (genError) {
      // Update playlist with error status
      playlist.generationStatus = 'failed';
      playlist.errorMessage = genError.message;
      await playlist.save();
      
      throw genError;
    }

  } catch (error) {
    console.error('Generate playlist error:', error);
    
    if (error.message.includes('Spotify')) {
      return res.status(401).json({ 
        error: 'Spotify connection required. Please connect your Spotify account.' 
      });
    }

    res.status(500).json({ 
      error: error.message || 'Failed to generate playlist tracks' 
    });
  }
});

// Get user playlists
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, mood, search, status } = req.query;
    
    const query = { userId: req.user._id };
    
    if (mood && mood !== 'all') {
      query.mood = mood;
    }
    
    if (status && status !== 'all') {
      query.generationStatus = status;
    }
    
    if (search?.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { prompt: searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [playlists, total] = await Promise.all([
      Playlist.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip)
        .select('-tracks'), // Don't send tracks in list view
      Playlist.countDocuments(query)
    ]);

    res.json({
      success: true,
      playlists,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        hasNext: skip + playlists.length < total,
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// Get playlist by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        { isPublic: true }
      ]
    }).populate('userId', 'name email');

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Increment plays count if not owner
    if (!playlist.userId._id.equals(req.user._id)) {
      playlist.plays = (playlist.plays || 0) + 1;
    await playlist.save();
    }

    res.json({
      success: true,
      playlist
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid playlist ID' });
  }
    
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

// Update playlist
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Update fields
    if (name?.trim()) playlist.name = name.trim();
    if (description !== undefined) playlist.description = description.trim();
    if (typeof isPublic === 'boolean') playlist.isPublic = isPublic;

    await playlist.save();
    res.json({
      success: true,
      message: 'Playlist updated successfully',
      playlist: {
        id: playlist._id,
        name: playlist.name,
        description: playlist.description,
        isPublic: playlist.isPublic,
        updatedAt: playlist.updatedAt
      }
    });

  } catch (error) {
    console.error('Update playlist error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages[0] });
  }
    
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

// Delete playlist
router.delete('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Remove from user's playlists array
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { playlists: playlist._id }
    });

    res.json({
      success: true,
      message: 'Playlist deleted successfully'
    });

  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// Get public playlists (discovery feature)
router.get('/public/discover', async (req, res) => {
  try {
    const { page = 1, limit = 12, mood } = req.query;
    
    const query = { isPublic: true, generationStatus: 'completed' };
    
    if (mood && mood !== 'all') {
      query.mood = mood;
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(20, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [playlists, total] = await Promise.all([
      Playlist.find(query)
        .populate('userId', 'name')
        .sort({ likes: -1, createdAt: -1 })
        .limit(limitNum)
        .skip(skip)
        .select('-tracks'),
      Playlist.countDocuments(query)
    ]);

    res.json({
      success: true,
      playlists,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total
      }
    });

  } catch (error) {
    console.error('Discover playlists error:', error);
    res.status(500).json({ error: 'Failed to fetch public playlists' });
  }
});

module.exports = router;
