const axios = require('axios');

/**
 * Managed Instagram scraping via Apify's `apify/instagram-scraper` actor.
 *
 * Why: Instagram blocks datacenter scrapers quickly. Apify provides a managed layer
 * (proxy rotation, anti-bot mitigations) and returns structured JSON.
 *
 * Docs:
 * - Input schema: https://apify.com/apify/instagram-scraper/input-schema
 * - Sync endpoint: https://apify.com/apify/instagram-scraper/api (run-sync-get-dataset-items)
 */
class ApifyInstagramScraper {
  constructor() {
    this.actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID || 'apify~instagram-scraper';
    this.baseUrl = 'https://api.apify.com/v2';
  }

  isConfigured() {
    return !!(process.env.APIFY_API_TOKEN && String(process.env.APIFY_API_TOKEN).trim());
  }

  /**
   * Run Apify actor synchronously and return dataset items.
   * @param {object} input - Apify actor input payload
   */
  async runSyncGetDatasetItems(input) {
    if (!this.isConfigured()) {
      throw new Error('APIFY_API_TOKEN is not set');
    }

    const token = String(process.env.APIFY_API_TOKEN).trim();
    const url = `${this.baseUrl}/acts/${encodeURIComponent(this.actorId)}/run-sync-get-dataset-items`;
    const timeoutMs = Number(process.env.APIFY_TIMEOUT_MS) > 0 ? Number(process.env.APIFY_TIMEOUT_MS) : 120000;

    const res = await axios.post(url, input, {
      params: {
        token,
        // Keep response small and fast; we only need the items.
        format: 'json',
        // You can add clean=true to reduce metadata; leaving default for now.
      },
      timeout: timeoutMs,
      // Apify returns JSON array
      headers: { 'Content-Type': 'application/json' }
    });
    return Array.isArray(res.data) ? res.data : [];
  }

  normalizeCaption(raw) {
    if (!raw || typeof raw !== 'string') return '';
    // Apify sometimes wraps captions in quotes
    return String(raw).replace(/^"+|"+$/g, '').trim();
  }

  /**
   * Map Apify post item to ZeroRot's internal post shape.
   */
  mapPost(item) {
    if (!item) return null;
    const shortCode = item.shortCode || item.shortcode || item.code;
    const instagramId = String(item.id || shortCode || '').trim();
    const url = item.url || (shortCode ? `https://www.instagram.com/p/${shortCode}/` : null);
    const imageUrl = item.displayUrl || item.display_url || (Array.isArray(item.displayResourceUrls) ? item.displayResourceUrls[0] : null);
    const caption = this.normalizeCaption(item.caption || '');
    const hashtags = Array.isArray(item.hashtags) && item.hashtags.length > 0
      ? item.hashtags.map(h => (String(h).startsWith('#') ? String(h) : `#${h}`))
      : [];

    const author = item.ownerUsername ? `@${String(item.ownerUsername).replace(/^@/, '')}` : null;
    const likeCount = typeof item.likesCount === 'number' ? item.likesCount : (typeof item.likes === 'number' ? item.likes : null);
    const commentCount = typeof item.commentsCount === 'number' ? item.commentsCount : null;
    const viewCount = typeof item.videoViewCount === 'number' ? item.videoViewCount : null;

    if (!instagramId || !url) return null;

    return {
      instagramId,
      url,
      caption,
      imageUrl,
      author,
      hashtags,
      timestamp: item.timestamp || item.takenAtTimestamp || null,
      // Engagement signals (best-effort; depends on the content type)
      likeCount,
      commentCount,
      viewCount,
      alt: item.alt || null,
      source: 'apify'
    };
  }

  /**
   * Scrape posts for one or more Instagram URLs (profiles/hashtags/places).
   * @param {string[]} directUrls
   * @param {object} [options]
   * @param {number} [options.resultsLimit]
   */
  async scrapePostsByDirectUrls(directUrls, options = {}) {
    const urls = (directUrls || []).map(u => String(u).trim()).filter(Boolean);
    if (urls.length === 0) return [];

    const resultsLimit = Number(options.resultsLimit) > 0 ? Number(options.resultsLimit) : 30;

    const input = {
      directUrls: urls,
      resultsType: 'posts',
      resultsLimit,
      // Keep runs polite; Apify manages throttling internally, but we still keep limits low.
      addParentData: false
    };

    const items = await this.runSyncGetDatasetItems(input);
    const mapped = items.map(i => this.mapPost(i)).filter(Boolean);

    // Deduplicate by instagramId
    return Array.from(new Map(mapped.map(p => [p.instagramId, p])).values());
  }
}

module.exports = new ApifyInstagramScraper();

