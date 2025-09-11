import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { promises as fs } from 'fs';
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
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().pattern(new RegExp('^[a-zA-Z0-9]{8,30}$')).required()
});

// Helper functions
const readUsers = () => {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return { users: [] };
  }
};

const writeUsers = (data) => {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing users file:', error);
    return false;
  }
};

// Register a new user
router.post('/register', async (req, res, next) => {
  try {
    console.log('Registration request received:', req.body);
    
    // Validate request body
    const { error, value } = userSchema.validate(req.body);
    if (error) {
      console.error('Validation error:', error.details);
      return res.status(400).json({
        status: 'error',
        message: error.details[0].message
      });
    }
    
    const { username, email, password } = value;
    
    // Check if user already exists
    const users = await readUsers();
    if (users.some(user => user.email === email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already registered'
      });
    }
    
    // Hash password
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
    
    // Save user
    users.push(newUser);
    const writeSuccess = await writeUsers(users);
    
    if (!writeSuccess) {
      throw new Error('Failed to save user data');
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
    console.error('Error in user registration:', error);
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
