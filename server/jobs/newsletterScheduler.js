const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/emailService');
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
 * Schedule daily newsletter job
 * Runs every day at 8:00 AM
 */
function scheduleNewsletterJob() {
  // Cron expression: minute hour day month weekday
  // '0 8 * * *' = Every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('📧 Running daily newsletter job...');
    
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

      console.log(`Found ${users.length} users to send newsletters to`);

      for (const user of users) {
        try {
          await sendNewsletterToUser(user);
        } catch (error) {
          console.error(`Error sending newsletter to ${user.email}:`, error);
          // Continue with other users even if one fails
        }
      }

      console.log('✅ Newsletter job completed');
    } catch (error) {
      console.error('❌ Newsletter job failed:', error);
    }
  });

  console.log('⏰ Newsletter scheduler: Daily at 8:00 AM');
}

/**
 * Get stored high-quality content that hasn't been used in recent newsletters
 */
async function getUnusedStoredContent(userId, limit = 5) {
  // Get content items that:
  // 1. Belong to this user
  // 2. Have high score (>= 0.9)
  // 3. Haven't been used in any newsletters (or only in old ones)
  const storedItems = await prisma.contentItem.findMany({
    where: {
      userId: userId,
      score: { gte: 0.9 },
      // Exclude items that are in newsletters from the last 7 days
      newsletterItems: {
        none: {
          newsletter: {
            sentAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        }
      }
    },
    orderBy: [
      { score: 'desc' },
      { discoveredAt: 'desc' }
    ],
    take: limit * 2 // Get more to allow for deduplication
  });

  // Filter out mock posts (SQLite doesn't support startsWith in Prisma)
  const realItems = storedItems.filter(item => !(item.instagramId || '').startsWith('mock_'));

  // Deduplicate by caption
  const deduped = dedupeByCaptionKeepFirst(realItems.map(item => ({
    instagramId: item.instagramId,
    url: item.url,
    caption: item.caption,
    imageUrl: item.imageUrl,
    author: item.author,
    hashtags: item.hashtags,
    score: item.score,
    id: item.id
  }))).slice(0, limit);

  return deduped;
}

/**
 * Send newsletter to a single user
 */
async function sendNewsletterToUser(user) {
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
    console.log(`Skipping ${user.email} - no preferences set`);
    return;
  }

  console.log(`📬 Sending newsletter to ${user.email}...`);

  // First, try to use stored high-quality content that hasn't been used recently
  const storedContent = await getUnusedStoredContent(user.id, 5);
  
  let savedItems = [];
  
  if (storedContent.length >= 5) {
    // Use stored content if we have enough
    console.log(`Using ${storedContent.length} stored high-quality posts for ${user.email}`);
    savedItems = storedContent.map(item => ({
      id: item.id,
      instagramId: item.instagramId,
      url: item.url,
      caption: item.caption,
      imageUrl: item.imageUrl,
      author: item.author,
      hashtags: item.hashtags,
      score: item.score
    }));
  } else {
    // Fall back to discovering new content if we don't have enough stored
    console.log(`Only ${storedContent.length} stored posts available, discovering new content for ${user.email}...`);
    
    // Discover and score content (use user's Instagram cookies when set)
    const rawPosts = await instagramScraper.searchByPreferences(preferences, {
      cookies: user.instagramCookies || undefined
    });
    
    if (!rawPosts || rawPosts.length === 0) {
      // If no new posts and we have some stored content, use what we have
      if (storedContent.length > 0) {
        console.log(`No new posts found, using ${storedContent.length} stored posts`);
        savedItems = storedContent.map(item => ({
          id: item.id,
          instagramId: item.instagramId,
          url: item.url,
          caption: item.caption,
          imageUrl: item.imageUrl,
          author: item.author,
          hashtags: item.hashtags,
          score: item.score
        }));
      } else {
        console.log(`No real Instagram posts for ${user.email}`);
        return;
      }
    } else {
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
      const topPosts = dedupeByCaptionKeepFirst(scoredPosts.filter(post => (post.score || 0) >= 0.9)).slice(0, 5);

      if (topPosts.length === 0 && storedContent.length === 0) {
        console.log(`No relevant content found for ${user.email}`);
        return;
      }

      // Combine stored content with new discoveries (prioritize stored)
      const combined = [...storedContent, ...topPosts];
      const finalDeduped = dedupeByCaptionKeepFirst(combined).slice(0, 5);

      // Save new content items (stored ones already exist)
      savedItems = await Promise.all(
        finalDeduped.map(post => {
          if (post.id) {
            // Already stored, return as-is
            return Promise.resolve({
              id: post.id,
              instagramId: post.instagramId,
              url: post.url,
              caption: post.caption,
              imageUrl: post.imageUrl,
              author: post.author,
              hashtags: post.hashtags,
              score: post.score
            });
          } else {
            // New post, save it
            return prisma.contentItem.upsert({
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
            });
          }
        })
      );
    }
  }

  // Generate newsletter content
  const newsletterContent = await aiContentFilter.generateNewsletterContent(savedItems, preferences, {
    userId: user.id
  });

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
    }
  });

  // Send email
  await emailService.sendNewsletter(user.email, subject, newsletterContent);

  console.log(`✅ Newsletter sent to ${user.email}`);
}

module.exports = { scheduleNewsletterJob, sendNewsletterToUser };
