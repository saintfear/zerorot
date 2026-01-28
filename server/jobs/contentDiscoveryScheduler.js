const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const instagramScraper = require('../services/instagramScraper');
const aiContentFilter = require('../services/aiContentFilter');

const prisma = new PrismaClient();

function normalizeCaption(caption) {
  if (!caption || typeof caption !== 'string') return '';
  return caption.toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupeByCaptionKeepFirst(posts) {
  const seen = new Set();
  const out = [];
  for (const p of posts) {
    const key = normalizeCaption(p.caption || '');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * Background job to continuously discover and store high-quality content
 * Runs every 5 minutes
 */
function scheduleContentDiscovery() {
  // Cron expression: '*/5 * * * *' = Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔍 Running content discovery job...');
    
    try {
      // Get all users with preferences set
      const users = await prisma.user.findMany({
        where: {
          preferences: {
            not: null
          }
        }
      });

      // Parse preferences for each user
      users.forEach(user => {
        if (user.preferences) {
          try {
            user.preferences = JSON.parse(user.preferences);
          } catch (e) {
            user.preferences = {};
          }
        }
      });

      console.log(`Found ${users.length} users for content discovery`);

      for (const user of users) {
        try {
          await discoverAndStoreContentForUser(user);
        } catch (error) {
          console.error(`Error discovering content for ${user.email}:`, error);
          // Continue with other users even if one fails
        }
      }

      // Cleanup low-quality content for all users
      await cleanupLowQualityContent();

      console.log('✅ Content discovery job completed');
    } catch (error) {
      console.error('❌ Content discovery job failed:', error);
    }
  });

  console.log('⏰ Content discovery scheduler: Every 5 minutes');
}

/**
 * Discover and store high-quality content for a single user
 */
async function discoverAndStoreContentForUser(user) {
  // Parse preferences if it's a string
  let preferences = user.preferences;
  if (typeof preferences === 'string') {
    try {
      preferences = JSON.parse(preferences);
    } catch (e) {
      preferences = {};
    }
  }

  if (!preferences || Object.keys(preferences).length === 0) {
    return;
  }

  // Rotate through pages to discover different content each time
  // Use a simple round-robin: page = (current minute / 5) % 10 + 1
  const currentMinute = new Date().getMinutes();
  const page = (Math.floor(currentMinute / 5) % 10) + 1;

  console.log(`📡 Discovering content for ${user.email} (page ${page})...`);

  // Scrape Instagram for content (use user's Instagram cookies when set)
  const rawPosts = await instagramScraper.searchByPreferences(preferences, {
    cookies: user.instagramCookies || undefined,
    page
  });

  if (!rawPosts || rawPosts.length === 0) {
    return;
  }

  // Load thumbs up/down feedback for personalization
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

  // Score content using AI
  const scoredPosts = await aiContentFilter.scoreContent(rawPosts, preferences, feedback);

  // Filter out posts this user has already saved
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
    return;
  }

  // Prefer to store very high-quality content (score >= 0.9),
  // but if nothing reaches that bar, fall back to strong candidates (>= 0.7)
  const highQualityPosts = newScoredPosts.filter(post => (post.score || 0) >= 0.9);
  const strongFallbackPosts = newScoredPosts.filter(post => (post.score || 0) >= 0.7);

  if (highQualityPosts.length === 0 && strongFallbackPosts.length === 0) {
    return;
  }

  const candidatePosts = highQualityPosts.length > 0 ? highQualityPosts : strongFallbackPosts;

  // Deduplicate by caption and keep a small, high-signal slice
  const deduped = dedupeByCaptionKeepFirst(candidatePosts).slice(0, 10);

  // Save high-quality content items
  const savedCount = await Promise.all(
    deduped.map(post =>
      prisma.contentItem.upsert({
        where: { instagramId: post.instagramId },
        update: {
          userId: user.id,
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

  console.log(`✅ Stored ${savedCount.length} high-quality posts for ${user.email}`);
}

/**
 * Cleanup low-quality content from the database
 * Deletes content with score < 0.6 that hasn't been rated by users
 */
async function cleanupLowQualityContent() {
  try {
    // Find all content items with low scores that haven't been rated
    const lowQualityItems = await prisma.contentItem.findMany({
      where: {
        score: {
          lt: 0.6 // Score below 0.6
        },
        rating: null, // Not rated by user (user might want to keep rated items)
        // Don't delete items that are in newsletters (keep them for reference)
        newsletterItems: {
          none: {}
        }
      },
      select: {
        id: true,
        instagramId: true,
        score: true
      }
    });

    if (lowQualityItems.length === 0) {
      return;
    }

    // Delete low-quality items
    const deleteResult = await prisma.contentItem.deleteMany({
      where: {
        id: {
          in: lowQualityItems.map(item => item.id)
        }
      }
    });

    console.log(`🗑️  Deleted ${deleteResult.count} low-quality content items`);
  } catch (error) {
    console.error('Error cleaning up low-quality content:', error);
  }
}

module.exports = { scheduleContentDiscovery };
