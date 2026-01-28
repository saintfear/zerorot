const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');
const instagramScraper = require('../services/instagramScraper');
const aiContentFilter = require('../services/aiContentFilter');

const router = express.Router();
const prisma = new PrismaClient();

// Get user's newsletters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const newsletters = await prisma.newsletter.findMany({
      where: { userId: req.user.id },
      include: {
        items: {
          include: {
            contentItem: true
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { sentAt: 'desc' },
      take: 10
    });

    res.json(newsletters);
  } catch (error) {
    console.error('Get newsletters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manually trigger newsletter generation and send
router.post('/send', authenticateToken, async (req, res) => {
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

    // Discover and score content (use user's Instagram cookies when set)
    const rawPosts = await instagramScraper.searchByPreferences(preferences, {
      cookies: user.instagramCookies || undefined
    });
    if (!rawPosts || rawPosts.length === 0) {
      return res.status(404).json({ error: 'No real Instagram posts found. Connect Instagram and try again.' });
    }

    // Load thumbs up/down feedback for personalization
    const rated = await prisma.contentItem.findMany({
      where: { userId: user.id, rating: { not: null } },
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

    const scoredPosts = await aiContentFilter.scoreContent(rawPosts, preferences, feedback);
    // Only include very high-relevance posts (>= 0.9)
    const filteredPosts = scoredPosts.filter(post => (post.score || 0) >= 0.9);
    const topPosts = filteredPosts.length > 0 
      ? filteredPosts.slice(0, 5)
      : scoredPosts.slice(0, 5);

    if (topPosts.length === 0) {
      return res.status(404).json({ 
        error: 'No relevant content found. Try updating your preferences.' 
      });
    }

    // Save content items
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

    // Generate newsletter content
    const newsletterContent = await aiContentFilter.generateNewsletterContent(
      topPosts,
      preferences
    );

    const subject = `✨ Your ZeroRot Newsletter - ${new Date().toLocaleDateString()}`;

    // Create newsletter record
    const newsletter = await prisma.newsletter.create({
      data: {
        userId: user.id,
        subject,
        content: newsletterContent,
        items: {
          create: savedItems.map((item, index) => ({
            contentItemId: item.id,
            order: index
          }))
        }
      },
      include: {
        items: {
          include: {
            contentItem: true
          }
        }
      }
    });

    // Send email (if configured)
    const emailConfigured = process.env.EMAIL_USER && 
                            process.env.EMAIL_USER !== 'your-email@gmail.com' &&
                            process.env.EMAIL_PASS && 
                            process.env.EMAIL_PASS !== 'your-app-specific-password';
    
    if (emailConfigured) {
      try {
        await emailService.sendNewsletter(user.email, subject, newsletterContent);
        console.log(`✅ Newsletter email sent to ${user.email}`);
      } catch (emailError) {
        console.error('⚠️ Failed to send email (but newsletter was saved):', emailError.message);
        // Continue even if email fails - newsletter is still saved
      }
    } else {
      console.log('ℹ️ Email not configured - newsletter saved but not sent');
    }

    res.json({
      message: emailConfigured 
        ? 'Newsletter sent successfully!' 
        : 'Newsletter created! (Email not configured - check server logs)',
      newsletter
    });
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
