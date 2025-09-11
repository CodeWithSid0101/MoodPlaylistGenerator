import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { addUserToDashboard, removeUserFromDashboard } from '../spotify-api.js';

const router = express.Router();

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data storage path
const dataDir = path.join(__dirname, '../data');
const usersFilePath = path.join(dataDir, 'users.json');

// Get sync fs methods
import { existsSync, mkdirSync, writeFileSync } from 'fs';

// Ensure data directory exists
const ensureDataDirectory = async () => {
  try {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize users file if it doesn't exist
    if (!existsSync(usersFilePath)) {
      writeFileSync(usersFilePath, JSON.stringify({ users: [] }), 'utf8');
    }
  } catch (error) {
    console.error('Error initializing data directory:', error);
    throw error;
  }
};

// Initialize data directory
ensureDataDirectory()
  .then(() => console.log('Data directory initialized'))
  .catch(err => {
    console.error('Failed to initialize data directory:', err);
    process.exit(1);
  });

// Validation schemas
const userSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(30)
    .required()
    .pattern(/^[a-zA-Z0-9_]+$/)
    .messages({
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot be longer than 30 characters',
      'any.required': 'Username is required'
    }),
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string().min(8).max(30).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,30}$/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot be longer than 30 characters',
      'any.required': 'Password is required'
    })
});

// Helper functions
const readUsers = async () => {
  try {
    // Ensure directory exists
    await fs.ensureDir(path.dirname(usersFilePath));
    
    // Check if file exists, if not create it with empty users array
    const exists = await fs.pathExists(usersFilePath);
    if (!exists) {
      await fs.writeJson(usersFilePath, { users: [] }, { spaces: 2 });
      return { users: [] };
    }
    
    // Read and parse the file
    return await fs.readJson(usersFilePath);
  } catch (error) {
    console.error('Error in readUsers:', error);
    throw new Error(`Failed to read users: ${error.message}`);
  }
};

const writeUsers = async (users) => {
  try {
    if (!Array.isArray(users)) {
      throw new Error('Users must be an array');
    }
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(usersFilePath));
    
    // Write the file with proper error handling
    await fs.writeJson(usersFilePath, { users }, { spaces: 2 });
    
    // Verify the file was written
    const fileStats = await fs.stat(usersFilePath);
    if (fileStats.size === 0) {
      throw new Error('Failed to write user data: File is empty');
    }
    
    return true;
  } catch (error) {
    console.error('Error in writeUsers:', {
      error: error.message,
      code: error.code,
      path: usersFilePath,
      stack: error.stack
    });
    throw new Error(`Failed to save user data: ${error.message}`);
  }
};

// Spotify OAuth2 endpoints
router.get('/spotify/login', (req, res) => {
  const scope = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private'
  ].join(' ');

  const queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: scope,
    redirect_uri: process.env.NODE_ENV === 'production' 
      ? 'https://mood-playlist-generator.onrender.com/api/users/spotify/callback'
      : 'http://localhost:10000/api/users/spotify/callback',
    state: 'some-state-for-csrf-protection'
  });

  res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

// Spotify callback handler
router.get('/spotify/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/login?error=${encodeURIComponent(error)}`);
  }

  try {
    // Exchange the authorization code for an access token
    const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.NODE_ENV === 'production'
        ? 'https://mood-playlist-generator.onrender.com/api/users/spotify/callback'
        : 'http://localhost:10000/api/users/spotify/callback',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in } = response.data;
    
    // Get user info
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    // Store tokens in session or database as needed
    // For now, we'll just send them to the frontend
    res.redirect(`/?access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`);
  } catch (error) {
    console.error('Error during Spotify authentication:', error);
    res.redirect('/login?error=authentication_failed');
  }
});

// Register a new user
// Debug endpoint to check if route is accessible
router.get('/register', (req, res) => {
  console.log('GET /register endpoint hit');
  res.status(200).json({
    status: 'success',
    message: 'Registration endpoint is working',
    method: 'GET',
    post_available: true,
    required_fields: {
      username: 'string',
      email: 'string',
      password: 'string (min 8 chars, must include uppercase, lowercase, number, special char)'
    }
  });
});

// Register a new user
router.post('/register', async (req, res, next) => {
  console.log('=== Registration Request ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  try {
    if (!req.body) {
      console.error('No request body received');
      return res.status(400).json({
        status: 'error',
        message: 'Request body is required'
      });
    }
    
    // Log raw body for debugging
    console.log('Raw body:', JSON.stringify(req.body));
    
    // Validate request body
    const { error, value } = userSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path[0],
        message: detail.message
      }));
      
      console.error('Validation errors:', JSON.stringify(errorDetails, null, 2));
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errorDetails
      });
    }
    
    const { username, email, password } = value;
    console.log('Processing registration for:', { username, email });
    
    // Check if user already exists
    let usersData;
    try {
      console.log('Reading users file...');
      usersData = await readUsers();
      console.log('Current users count:', usersData?.users?.length || 0);
    } catch (error) {
      console.error('Error reading users file:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      return res.status(500).json({
        status: 'error',
        message: 'Failed to read user data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    const users = Array.isArray(usersData?.users) ? usersData.users : [];
    console.log('Checking for existing user with email:', email);
    
    if (users.some(user => user.email === email)) {
      console.log('Registration failed: Email already exists');
      return res.status(400).json({
        status: 'error',
        message: 'Email already registered',
        field: 'email'
      });
    }
    
    try {
      console.log('Hashing password...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create new user
      const newUser = {
        id: uuidv4(),
        username,
        email,
        password: hashedPassword,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log('New user created:', { id: newUser.id, email: newUser.email });
      
      // Save user
      users.push(newUser);
      console.log('Attempting to save users...');
      
      const writeSuccess = await writeUsers(users);
      console.log('Write operation result:', writeSuccess);
      
      if (!writeSuccess) {
        throw new Error('Failed to save user data: write operation returned false');
      }
      
      // Don't send password hash in response
      const { password: _, ...userWithoutPassword } = newUser;
      
      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: {
          user: userWithoutPassword
        }
      });
      
    } catch (error) {
      console.error('Error during user registration:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      
      // Remove sensitive data from error response
      const errorResponse = {
        status: 'error',
        message: 'Failed to register user',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
      
      res.status(500).json(errorResponse);
    }
  } catch (error) {
    console.error('Unexpected error in registration endpoint:', error);
    
    // Handle specific error cases
    let statusCode = 500;
    let errorMessage = 'An unexpected error occurred during registration';
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      status: 'error',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    next(error);
  }
});

// Get user by ID
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const data = readUsers();
    const user = data.users.find(u => u.id === id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't send password hash in response
    const { password, ...userData } = user;
    res.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Error getting user:', error);
    next(error);
  }
});

// Update user
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const data = readUsers();
    const userIndex = data.users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow updating ID
    if (updates.id) {
      delete updates.id;
    }

    // Update user data
    const updatedUser = {
      ...data.users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    data.users[userIndex] = updatedUser;
    
    if (writeUsers(data)) {
      const { password, ...userData } = updatedUser;
      res.json({
        success: true,
        message: 'User updated successfully',
        user: userData
      });
    } else {
      throw new Error('Failed to update user data');
    }
  } catch (error) {
    console.error('Error updating user:', error);
    next(error);
  }
});

// Delete user
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const data = readUsers();
    const userIndex = data.users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    data.users.splice(userIndex, 1);
    
    if (writeUsers(data)) {
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } else {
      throw new Error('Failed to delete user data');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    next(error);
  }
});

// List all users (for admin purposes)
router.get('/', (req, res, next) => {
  try {
    const data = readUsers();
    // Don't send passwords in the response
    const users = data.users.map(({ password, ...user }) => user);
    
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Error listing users:', error);
    next(error);
  }
});

// Export the router
export default router;
