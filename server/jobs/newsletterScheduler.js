const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/emailService');
const instagramScraper = require('../services/instagramScraper');
const aiContentFilter = require('../services/aiContentFilter');
const discoveryEngineV2 = require('../services/discoveryEngineV2');

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

  // Discover and score content (use user's Instagram cookies when set)
  const rawPosts = await instagramScraper.searchByPreferences(preferences, {
    cookies: user.instagramCookies || undefined
  });
  if (!rawPosts || rawPosts.length === 0) {
    console.log(`No real Instagram posts for ${user.email}`);
    return;
  }

  // Load thumbs up/down feedback for personalization
  const rated = await prisma.contentItem.findMany({
    where: { userId: user.id, rating: { not: null } },
    select: { caption: true, hashtags: true, rating: true, imageUrl: true }
  });
  const feedback = {
    liked: rated.filter(r => r.rating === 1).map(r => ({
      caption: r.caption || '',
      hashtags: typeof r.hashtags === 'string' ? (() => { try { return JSON.parse(r.hashtags); } catch { return []; } })() : (r.hashtags || []),
      imageUrl: r.imageUrl || null
    })),
    disliked: rated.filter(r => r.rating === -1).map(r => ({
      caption: r.caption || '',
      hashtags: typeof r.hashtags === 'string' ? (() => { try { return JSON.parse(r.hashtags); } catch { return []; } })() : (r.hashtags || []),
      imageUrl: r.imageUrl || null
    }))
  };

  const engine = String(process.env.DISCOVERY_ENGINE || '').toLowerCase().trim();
  const scoredPosts = engine === 'v2'
    ? await discoveryEngineV2.scoreAndRank(rawPosts, preferences, feedback, { userId: user.id })
    : await aiContentFilter.scoreContent(rawPosts, preferences, feedback);
  const topPosts = dedupeByCaptionKeepFirst(scoredPosts.filter(post => (post.score || 0) >= 0.9)).slice(0, 5);

  if (topPosts.length === 0) {
    console.log(`No relevant content found for ${user.email}`);
    return;
  }

  // Save content items
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
