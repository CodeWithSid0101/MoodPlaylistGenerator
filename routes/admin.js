const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Playlist = require('../models/Playlist');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      totalPlaylists,
      activeUsers,
      spotifyConnectedUsers,
      recentUsers,
      recentPlaylists,
      monthlyUsers,
      popularMoods
    ] = await Promise.all([
      User.countDocuments(),
      Playlist.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ spotifyAccessToken: { $ne: null } }),
      User.find({ isAdmin: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email createdAt isActive'),
      Playlist.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .select('name prompt createdAt generationStatus actualLength'),
      User.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 6 }
      ]),
      Playlist.aggregate([
        { $group: { _id: '$mood', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalPlaylists,
        activeUsers,
        spotifyConnectedUsers,
        recentUsers: recentUsers || [],
        recentPlaylists: recentPlaylists || [],
        monthlyUsers: monthlyUsers || [],
        popularMoods: popularMoods || []
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
});

// Get all users with pagination
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    
    const query = {};
    
    if (search?.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }
    
    if (status && status !== 'all') {
      query.isActive = status === 'active';
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip)
        .select('-password -spotifyAccessToken -spotifyRefreshToken')
        .populate('playlists', 'name createdAt generationStatus'),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -spotifyAccessToken -spotifyRefreshToken')
      .populate({
        path: 'playlists',
        select: 'name prompt mood generationStatus actualLength createdAt isPublic',
        options: { sort: { createdAt: -1 } }
      });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user statistics
    const userStats = await Playlist.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalPlaylists: { $sum: 1 },
          totalTracks: { $sum: '$actualLength' },
          publicPlaylists: {
            $sum: { $cond: ['$isPublic', 1, 0] }
          },
          completedPlaylists: {
            $sum: { $cond: [{ $eq: ['$generationStatus', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = userStats[0] || {
      totalPlaylists: 0,
      totalTracks: 0,
      publicPlaylists: 0,
      completedPlaylists: 0
    };

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        stats
      }
    });

  } catch (error) {
    console.error('Get user details error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user status
router.put('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean value' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isAdmin && !isActive) {
      return res.status(400).json({ error: 'Cannot deactivate admin users' });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Delete user (soft delete by deactivating)
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isAdmin) {
      return res.status(400).json({ error: 'Cannot delete admin users' });
    }

    // Soft delete by deactivating
    user.isActive = false;
    await user.save();

    // Optionally, also make all user playlists private
    await Playlist.updateMany(
      { userId: user._id },
      { isPublic: false }
    );

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Get all playlists with filters
router.get('/playlists', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, mood } = req.query;
    
    const query = {};
    
    if (search?.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { prompt: searchRegex }
      ];
    }
    
    if (status && status !== 'all') {
      query.generationStatus = status;
    }

    if (mood && mood !== 'all') {
      query.mood = mood;
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [playlists, total] = await Promise.all([
      Playlist.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip)
        .populate('userId', 'name email')
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
    console.error('Get playlists error:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// Delete playlist
router.delete('/playlists/:id', adminAuth, async (req, res) => {
  try {
    const playlist = await Playlist.findByIdAndDelete(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Remove from user's playlists array
    await User.findByIdAndUpdate(playlist.userId, {
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

// Get system health
router.get('/health', adminAuth, async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    const memoryUsage = process.memoryUsage();
    
    const systemInfo = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        name: 'MongoDB'
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };

    res.json({
      success: true,
      health: systemInfo
    });

  } catch (error) {
    console.error('System health check error:', error);
    res.status(500).json({ error: 'Failed to get system health' });
  }
});

module.exports = router;