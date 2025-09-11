import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

// Admin middleware to check if user is admin
const isAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // In a real app, verify the token and check admin status
    if (token !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
};

// Get pending user approvals
router.get('/pending', isAdmin, async (req, res) => {
    try {
        // In a real app, fetch from your database
        // This is a mock response
        res.json({
            users: [
                { _id: '1', username: 'user1', email: 'user1@example.com' },
                { _id: '2', username: 'user2', email: 'user2@example.com' }
            ]
        });
    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }
});

// Approve/Reject user
router.post('/:id/approve', isAdmin, async (req, res) => {
    try {
        const { approve } = req.body;
        const { id } = req.params;

        // In a real app, update the user's status in your database
        // This is a mock response
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
