const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  spotifyId: {
    type: String,
    default: null
  },
  spotifyAccessToken: {
    type: String,
    default: null,
    select: false
  },
  spotifyRefreshToken: {
    type: String,
    default: null,
    select: false
  },
  spotifyTokenExpiry: {
    type: Date,
    default: null
  },
  profilePicture: {
    type: String,
    default: null
  },
  preferences: {
    favoriteGenres: {
      type: [String],
      default: []
    },
    defaultPlaylistLength: {
      type: Number,
      default: 20,
      min: 5,
      max: 100
    }
  },
  playlists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Playlist'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it has been modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamp before saving
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Check if Spotify token is valid
userSchema.methods.isSpotifyTokenValid = function() {
  return this.spotifyAccessToken && 
         this.spotifyTokenExpiry && 
         new Date() < this.spotifyTokenExpiry;
};

// Get user stats
userSchema.methods.getStats = async function() {
  const Playlist = mongoose.model('Playlist');
  
  try {
  const playlistCount = await Playlist.countDocuments({ userId: this._id });
    const publicPlaylistCount = await Playlist.countDocuments({ 
      userId: this._id, 
      isPublic: true 
  });
  
  return {
    totalPlaylists: playlistCount,
    publicPlaylists: publicPlaylistCount,
    spotifyConnected: this.isSpotifyTokenValid(),
    memberSince: this.createdAt
  };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      totalPlaylists: 0,
      publicPlaylists: 0,
      spotifyConnected: false,
      memberSince: this.createdAt
};
  }
};

// Index for performance
userSchema.index({ email: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
