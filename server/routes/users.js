const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get current user (never expose instagramCookies to client, only a boolean)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        preferences: true,
        instagramCookies: true,
        createdAt: true
      }
    });
    // Don't send raw cookies to frontend; frontend only needs to know if connected
    if (user) {
      user.instagramConnected = !!user.instagramCookies;
      delete user.instagramCookies;
    }

    // Parse preferences JSON string
    if (user && user.preferences) {
      try {
        user.preferences = JSON.parse(user.preferences);
      } catch (e) {
        user.preferences = {};
      }
    } else if (user) {
      user.preferences = {};
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Instagram cookies (Netscape-format cookies.txt for real Instagram fetching)
router.put('/instagram-cookies', authenticateToken, async (req, res) => {
  try {
    const { cookies } = req.body;
    if (cookies === undefined || cookies === null) {
      return res.status(400).json({ error: 'Missing "cookies" in body' });
    }
    const value = typeof cookies === 'string' ? cookies.trim() : '';
    await prisma.user.update({
      where: { id: req.user.id },
      data: { instagramCookies: value || null }
    });
    res.json({
      message: value ? 'Instagram session saved. Real posts will use your login.' : 'Instagram session cleared.'
    });
  } catch (error) {
    console.error('Update Instagram cookies error:', error);
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('unknown column') || (msg.includes('column') && msg.includes('instagram')) || msg.includes('no such column')) {
      return res.status(503).json({
        error: 'Database schema needs updating. In the zerorot folder run: npx prisma db push then restart the server.'
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { preferences } = req.body;

    // Store preferences as JSON string
    const preferencesString = preferences ? JSON.stringify(preferences) : null;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences: preferencesString },
      select: {
        id: true,
        email: true,
        name: true,
        preferences: true
      }
    });

    // Parse preferences for response
    if (user.preferences) {
      try {
        user.preferences = JSON.parse(user.preferences);
      } catch (e) {
        user.preferences = {};
      }
    } else {
      user.preferences = {};
    }

    res.json(user);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
