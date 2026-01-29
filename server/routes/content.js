const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const instagramScraper = require('../services/instagramScraper');
const aiContentFilter = require('../services/aiContentFilter');
const discoveryEngineV2 = require('../services/discoveryEngineV2');

const router = express.Router();
const prisma = new PrismaClient();

function normalizeCaption(caption) {
  if (!caption || typeof caption !== 'string') return '';
  return caption
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

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

    const page = Number(req.body?.page) > 0 ? Number(req.body.page) : 1;

    // Scrape Instagram for content (use user's Instagram cookies when set)
    console.log('🔍 Discovering content for user:', user.email);
    const rawPosts = await instagramScraper.searchByPreferences(preferences, {
      cookies: user.instagramCookies || undefined,
      page
    });

    if (!rawPosts || rawPosts.length === 0) {
      return res.json({ message: 'No real Instagram posts found. Connect Instagram and add preferences, then try again.', posts: [] });
    }

    // Load thumbs up/down feedback for better personalization
    const ratedRows = await prisma.contentItem.findMany({
      where: { userId: user.id, rating: { not: null } },
      select: { caption: true, hashtags: true, rating: true, instagramId: true }
    });
    const rated = ratedRows.filter(r => !(r.instagramId || '').startsWith('mock_'));
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
    const engine = String(process.env.DISCOVERY_ENGINE || '').toLowerCase().trim();
    let scoredPosts = [];
    if (engine === 'v2') {
      console.log('🤖 Scoring content with Discovery Engine v2 (vision + embeddings + engagement)...');
      scoredPosts = await discoveryEngineV2.scoreAndRank(rawPosts, preferences, feedback);
    } else {
      console.log('🤖 Scoring content with AI (using your thumbs up/down)...');
      scoredPosts = await aiContentFilter.scoreContent(rawPosts, preferences, feedback);
    }

    // Filter out posts this user has already saved (only surface truly new content)
    const scoredIds = scoredPosts.map(post => post.instagramId).filter(Boolean);
    const alreadySaved = await prisma.contentItem.findMany({
      where: {
        userId: user.id,
        instagramId: { in: scoredIds }
      },
      select: { instagramId: true }
    });
    const seenSet = new Set(alreadySaved.map(i => i.instagramId));
    const newScoredPosts = scoredPosts.filter(post => !seenSet.has(post.instagramId));

    if (newScoredPosts.length === 0) {
      return res.json({
        message: 'No new posts found (you have already saved everything in this slice). Try adjusting topics/accounts or come back later.',
        posts: []
      });
    }

    // Get top *new* posts (score >= 0.9 only)
    const filteredPosts = newScoredPosts.filter(post => (post.score || 0) >= 0.9);
    const candidatePosts = filteredPosts.length > 0
      ? filteredPosts
      : newScoredPosts; // If none meet threshold, still allow a small fallback slice below

    // Deduplicate carousel/album items: don't show multiple posts with the same caption.
    // Keep the highest-score item for each caption.
    const sorted = [...candidatePosts].sort((a, b) => (b.score || 0) - (a.score || 0));
    const byCaption = new Map();
    const deduped = [];
    for (const post of sorted) {
      const key = normalizeCaption(post.caption);
      if (key) {
        if (byCaption.has(key)) continue;
        byCaption.set(key, true);
      }
      deduped.push(post);
      if (deduped.length >= 10) break;
    }
    const topPosts = deduped;

    // Save content items to database (always set userId so they show in this user's Saved Content)
    const savedItems = await Promise.all(
      topPosts.map(post =>
        prisma.contentItem.upsert({
          where: { userId_instagramId: { userId: user.id, instagramId: post.instagramId } },
          update: {
            userId: user.id,
            score: post.score,
            caption: post.caption,
            imageUrl: post.imageUrl,
            author: post.author,
            hashtags: Array.isArray(post.hashtags) ? JSON.stringify(post.hashtags) : (post.hashtags || null),
            likeCount: typeof post.likeCount === 'number' ? post.likeCount : null,
            commentCount: typeof post.commentCount === 'number' ? post.commentCount : null,
            viewCount: typeof post.viewCount === 'number' ? post.viewCount : null,
            engagementScore: typeof post.engagementScore === 'number' ? post.engagementScore : null,
            imageDescription: post.imageDescription ? String(post.imageDescription) : null,
            visionTags: Array.isArray(post.visionTags) ? JSON.stringify(post.visionTags) : (post.visionTags || null),
            embedding: Array.isArray(post.embedding) ? JSON.stringify(post.embedding) : (post.embedding || null),
            embeddingSim: typeof post.embeddingSim === 'number' ? post.embeddingSim : null,
            source: post.source ? String(post.source) : null
          },
          create: {
            instagramId: post.instagramId,
            url: post.url,
            caption: post.caption,
            imageUrl: post.imageUrl,
            author: post.author,
            hashtags: Array.isArray(post.hashtags) ? JSON.stringify(post.hashtags) : (post.hashtags || null),
            score: post.score,
            userId: user.id,
            likeCount: typeof post.likeCount === 'number' ? post.likeCount : null,
            commentCount: typeof post.commentCount === 'number' ? post.commentCount : null,
            viewCount: typeof post.viewCount === 'number' ? post.viewCount : null,
            engagementScore: typeof post.engagementScore === 'number' ? post.engagementScore : null,
            imageDescription: post.imageDescription ? String(post.imageDescription) : null,
            visionTags: Array.isArray(post.visionTags) ? JSON.stringify(post.visionTags) : (post.visionTags || null),
            embedding: Array.isArray(post.embedding) ? JSON.stringify(post.embedding) : (post.embedding || null),
            embeddingSim: typeof post.embeddingSim === 'number' ? post.embeddingSim : null,
            source: post.source ? String(post.source) : null
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
      where: { userId: req.user.id },
      orderBy: { discoveredAt: 'desc' },
      take: 80
    });
    const realOnly = content.filter(item => !(item.instagramId || '').startsWith('mock_'));
    // Also collapse carousel duplicates by caption (keep newest)
    const seenCaptions = new Set();
    const unique = [];
    for (const item of realOnly) {
      const key = normalizeCaption(item.caption || '');
      if (key && seenCaptions.has(key)) continue;
      if (key) seenCaptions.add(key);
      unique.push(item);
      if (unique.length >= 50) break;
    }
    res.json(unique);
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
