import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();
const usersFilePath = path.join(__dirname, '../../data/users.json');

// Helper function to read users
const readUsers = async () => {
    try {
        const data = await fs.readFile(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users:', error);
        return { users: [] };
    }
};

// Helper function to write users
const writeUsers = async (users) => {
    try {
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error writing users:', error);
        throw error;
    }
};

// Admin middleware
const isAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // In production, verify JWT or session
    if (token !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
};

// Get all users (admin only)
router.get('/users', isAdmin, async (req, res) => {
    try {
        const data = await readUsers();
        res.json(data.users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get pending approvals
router.get('/pending', isAdmin, async (req, res) => {
    try {
        const data = await readUsers();
        const pendingUsers = data.users.filter(user => user.status === 'pending');
        res.json(pendingUsers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending users' });
    }
});

// Approve user
router.post('/approve/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const data = await readUsers();
        
        const userIndex = data.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        data.users[userIndex].status = 'approved';
        data.users[userIndex].approvedAt = new Date().toISOString();
        
        await writeUsers(data);
        res.json({ message: 'User approved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

// Reject user
router.post('/reject/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const data = await readUsers();
        
        data.users = data.users.filter(user => user.id !== userId);
        
        await writeUsers(data);
        res.json({ message: 'User rejected successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject user' });
    }
});

export default router;
        res.json({ 
            success: true, 
            message: `User ${approve ? 'approved' : 'rejected'} successfully` 
        });
    } catch (error) {
        console.error('Error updating approval status:', error);
        res.status(500).json({ error: 'Failed to update approval status' });
    }
});

export default router;
