const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const instagramScraper = require('../services/instagramScraper');
const aiContentFilter = require('../services/aiContentFilter');

const router = express.Router();
const prisma = new PrismaClient();

// Discover new content based on user preferences
router.post('/discover', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Parse preferences from JSON string
    let preferences = {};
    if (user.preferences) {
      try {
        preferences = JSON.parse(user.preferences);
      } catch (e) {
        preferences = {};
      }
    }

    if (!preferences || Object.keys(preferences).length === 0) {
      return res.status(400).json({ 
        error: 'Please set your content preferences first' 
      });
    }

    // Scrape Instagram for content (use user's Instagram cookies when set)
    console.log('🔍 Discovering content for user:', user.email);
    const rawPosts = await instagramScraper.searchByPreferences(preferences, {
      cookies: user.instagramCookies || undefined
    });

    if (!rawPosts || rawPosts.length === 0) {
      return res.json({ message: 'No real Instagram posts found. Connect Instagram and add preferences, then try again.', posts: [] });
    }

    // Load thumbs up/down feedback for better personalization
    const rated = await prisma.contentItem.findMany({
      where: { userId: user.id, rating: { not: null }, instagramId: { not: { startsWith: 'mock_' } } },
      select: { caption: true, hashtags: true, rating: true }
    });
    const feedback = {
      liked: rated.filter(r => r.rating === 1).map(r => ({
        caption: r.caption || '',
        hashtags: typeof r.hashtags === 'string' ? (() => { try { return JSON.parse(r.hashtags); } catch { return []; } })() : (r.hashtags || [])
      })),
      disliked: rated.filter(r => r.rating === -1).map(r => ({
        caption: r.caption || '',
        hashtags: typeof r.hashtags === 'string' ? (() => { try { return JSON.parse(r.hashtags); } catch { return []; } })() : (r.hashtags || [])
      }))
    };

    // Score and rank content using AI (with feedback for training)
    console.log('🤖 Scoring content with AI (using your thumbs up/down)...');
    const scoredPosts = await aiContentFilter.scoreContent(rawPosts, preferences, feedback);

    // Get top posts (score > 0.3 for more lenient matching, or top 10 if we have few results)
    const filteredPosts = scoredPosts.filter(post => (post.score || 0) > 0.3);
    const topPosts = filteredPosts.length > 0 
      ? filteredPosts.slice(0, 10)
      : scoredPosts.slice(0, 5); // If no posts pass threshold, return top 5 anyway

    // Save content items to database
    const savedItems = await Promise.all(
      topPosts.map(post =>
        prisma.contentItem.upsert({
          where: { instagramId: post.instagramId },
          update: {
            score: post.score,
            caption: post.caption,
            imageUrl: post.imageUrl,
            author: post.author,
            hashtags: Array.isArray(post.hashtags) ? JSON.stringify(post.hashtags) : (post.hashtags || null)
          },
          create: {
            instagramId: post.instagramId,
            url: post.url,
            caption: post.caption,
            imageUrl: post.imageUrl,
            author: post.author,
            hashtags: Array.isArray(post.hashtags) ? JSON.stringify(post.hashtags) : (post.hashtags || null),
            score: post.score,
            userId: user.id
          }
        })
      )
    );

    res.json({
      message: `Found ${topPosts.length} relevant posts`,
      posts: savedItems
    });
  } catch (error) {
    console.error('Content discovery error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's saved content (exclude mock/AI-generated posts)
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const content = await prisma.contentItem.findMany({
      where: {
        userId: req.user.id,
        instagramId: { not: { startsWith: 'mock_' } }
      },
      orderBy: { discoveredAt: 'desc' },
      take: 50
    });

    res.json(content);
  } catch (error) {
    console.error('Get saved content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rate a content item (thumbs up / down) for training
router.put('/items/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let { rating } = req.body;
    if (rating !== 1 && rating !== -1 && rating !== null && rating !== undefined) {
      const r = String(rating).toLowerCase();
      if (r === 'up') rating = 1;
      else if (r === 'down') rating = -1;
      else rating = null;
    }
    const item = await prisma.contentItem.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!item) {
      return res.status(404).json({ error: 'Content item not found' });
    }
    const updated = await prisma.contentItem.update({
      where: { id },
      data: { rating: rating === null || rating === undefined ? null : Number(rating) }
    });
    res.json(updated);
  } catch (error) {
    console.error('Rate content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
