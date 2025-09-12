const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
  trackId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: String,
    required: true,
    trim: true
  },
  album: {
    type: String,
    trim: true
  },
  duration: {
    type: Number,
    min: 0
  },
  preview_url: String,
  external_urls: {
    spotify: String
  },
  image: String,
  popularity: {
    type: Number,
    min: 0,
    max: 100
  },
  explicit: {
    type: Boolean,
    default: false
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const playlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Playlist name is required'],
    trim: true,
    minlength: [1, 'Playlist name cannot be empty'],
    maxlength: [100, 'Playlist name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, 'Description cannot exceed 300 characters']
  },
  prompt: {
    type: String,
    required: [true, 'Playlist prompt is required'],
    trim: true,
    minlength: [5, 'Prompt must be at least 5 characters'],
    maxlength: [500, 'Prompt cannot exceed 500 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  spotifyPlaylistId: {
    type: String,
    default: null
  },
  spotifyUrl: {
    type: String,
    default: null
  },
  tracks: [trackSchema],
  isPublic: {
    type: Boolean,
    default: false
  },
  mood: {
    type: String,
    enum: {
      values: ['happy', 'sad', 'energetic', 'chill', 'romantic', 'party', 'workout', 'focus', 'sleep', 'nostalgic', 'custom'],
      message: 'Invalid mood selection'
    },
    default: 'custom'
  },
  genres: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  targetLength: {
    type: Number,
    default: 20,
    min: [5, 'Playlist must have at least 5 songs'],
    max: [100, 'Playlist cannot exceed 100 songs']
  },
  actualLength: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDuration: {
    type: Number,
    default: 0,
    min: 0
  },
  imageUrl: {
    type: String,
    default: null
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  likes: {
    type: Number,
    default: 0,
    min: 0
  },
  plays: {
    type: Number,
    default: 0,
    min: 0
  },
  isGenerated: {
    type: Boolean,
    default: false
  },
  generationStatus: {
    type: String,
    enum: {
      values: ['pending', 'generating', 'completed', 'failed'],
      message: 'Invalid generation status'
    },
    default: 'pending'
  },
  errorMessage: {
    type: String,
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

// Update timestamps and calculated fields before saving
playlistSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  if (this.tracks && this.tracks.length > 0) {
    this.actualLength = this.tracks.length;
    this.totalDuration = this.tracks.reduce((sum, track) => {
      return sum + (track.duration || 0);
    }, 0);
  } else {
    this.actualLength = 0;
    this.totalDuration = 0;
  }
  
  next();
});

// Instance methods
playlistSchema.methods.addTrack = function(trackData) {
  if (!trackData.trackId || !trackData.name || !trackData.artist) {
    throw new Error('Track must have trackId, name, and artist');
  }
  
  // Check if track already exists
  const exists = this.tracks.some(track => track.trackId === trackData.trackId);
  if (exists) {
    throw new Error('Track already exists in playlist');
  }
  
  this.tracks.push(trackData);
  return this;
};

playlistSchema.methods.removeTrack = function(trackId) {
  const initialLength = this.tracks.length;
  this.tracks = this.tracks.filter(track => track.trackId !== trackId);
  
  if (this.tracks.length === initialLength) {
    throw new Error('Track not found in playlist');
  }
  
  return this;
};

playlistSchema.methods.getDurationFormatted = function() {
  const totalMs = this.totalDuration;
  if (!totalMs) return '0m';
  
  const minutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
};

playlistSchema.methods.getStats = function() {
  return {
    totalTracks: this.actualLength,
    totalDuration: this.getDurationFormatted(),
    averagePopularity: this.tracks.length > 0 
      ? Math.round(this.tracks.reduce((sum, track) => sum + (track.popularity || 0), 0) / this.tracks.length)
      : 0,
    explicitTracks: this.tracks.filter(track => track.explicit).length
  };
};

// Static methods
playlistSchema.statics.getPopularMoods = async function() {
  return this.aggregate([
    { $group: { _id: '$mood', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
};

playlistSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalPlaylists: { $sum: 1 },
        totalTracks: { $sum: '$actualLength' },
        totalDuration: { $sum: '$totalDuration' },
        publicPlaylists: {
          $sum: { $cond: ['$isPublic', 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalPlaylists: 0,
    totalTracks: 0,
    totalDuration: 0,
    publicPlaylists: 0
  };
};

// Indexes for better performance
playlistSchema.index({ userId: 1, createdAt: -1 });
playlistSchema.index({ isPublic: 1, likes: -1 });
playlistSchema.index({ mood: 1 });
playlistSchema.index({ genres: 1 });
playlistSchema.index({ generationStatus: 1 });
playlistSchema.index({ spotifyPlaylistId: 1 });

module.exports = mongoose.model('Playlist', playlistSchema);
