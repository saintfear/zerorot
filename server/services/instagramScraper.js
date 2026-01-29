const galleryDlScraper = require('./galleryDlScraper');
const apifyInstagramScraper = require('./managedScraper/apifyInstagramScraper');

/**
 * Instagram Scraper Service
 * 
 * Uses gallery-dl for reliable Instagram scraping (if installed).
 * 
 * Install gallery-dl: pip install gallery-dl
 * Or: brew install gallery-dl (on macOS)
 */

class InstagramScraper {
  constructor() {
    this.baseUrl = 'https://www.instagram.com';
    this.useGalleryDl = false;
    // Check asynchronously (don't block constructor)
    this.checkGalleryDl().catch(() => {});
  }

  async checkGalleryDl() {
    try {
      this.useGalleryDl = await galleryDlScraper.isInstalled();
      if (this.useGalleryDl) {
        console.log('✅ gallery-dl is installed and ready to use');
      } else {
        console.log('ℹ️ gallery-dl not found. Install with: pip install gallery-dl or brew install gallery-dl');
      }
    } catch (error) {
      this.useGalleryDl = false;
    }
  }


  /**
   * Extract hashtags from caption
   */
  extractHashtags(caption) {
    const hashtagRegex = /#[\w]+/g;
    return caption.match(hashtagRegex) || [];
  }


  /**
   * Search for content based on user preferences
   * @param {object} preferences - { topics, style, keywords }
   * @param {object} [options] - { cookies?: string, page?: number } cookies + page for pagination
   */
  async searchByPreferences(preferences, options = {}) {
    const { cookies: userCookies, page } = options;
    const provider = String(process.env.INSTAGRAM_SCRAPE_PROVIDER || '').toLowerCase().trim();

    // Managed scraping provider (recommended for production).
    // Uses Apify which handles anti-bot mitigation and returns structured JSON.
    if (provider === 'apify') {
      if (!apifyInstagramScraper.isConfigured()) {
        console.log('⚠️ INSTAGRAM_SCRAPE_PROVIDER=apify but APIFY_API_TOKEN is not set. Falling back to gallery-dl.');
      } else {
        try {
          const posts = await this.searchByPreferencesViaApify(preferences, { page });
          if (posts && posts.length > 0) return posts;
          console.log('⚠️ Apify returned 0 posts. Falling back to gallery-dl.');
        } catch (e) {
          console.log('⚠️ Apify scraping failed:', e?.message || e);
          console.log('   Falling back to gallery-dl.');
        }
      }
    }

    const allPosts = [];
    let scrapingFailed = false;

    // Try gallery-dl first (most reliable)
    // Re-check if gallery-dl is available (in case it was installed after server start)
    const galleryDlAvailable = await galleryDlScraper.isInstalled().catch(() => false);
    if (galleryDlAvailable) {
      this.useGalleryDl = true;
      try {
        console.log('✅ Using gallery-dl to fetch real Instagram posts...');
        if (userCookies) {
          console.log('   Using your Instagram session (cookies).');
        }
        const posts = await galleryDlScraper.searchByPreferences(preferences, { cookies: userCookies, page });
        if (posts && posts.length > 0) {
          console.log(`✅ Found ${posts.length} real Instagram posts via gallery-dl!`);
          return posts;
        } else {
          console.log('⚠️ No posts found via gallery-dl, trying fallback...');
          scrapingFailed = true;
        }
      } catch (error) {
        const errorMsg = error.message || '';
        console.log('⚠️ gallery-dl failed:', errorMsg);
        
        if (errorMsg.includes('DNS_ERROR') || errorMsg.includes('resolve')) {
          console.log('   💡 DNS issue detected. Instagram cannot be reached.');
          console.log('   💡 Fix: sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4');
        }
        
        console.log('📝 gallery-dl failed. Returning none (no puppeteer fallback).');
        scrapingFailed = true;
      }
    } else if (!this.useGalleryDl) {
      // Only show this message once
      console.log('ℹ️ gallery-dl not installed. Install with: pip install gallery-dl');
      scrapingFailed = true;
    }

    // Never return mock/AI-generated posts — only real Instagram content
    if (scrapingFailed || allPosts.length === 0) {
      console.log('📝 No real Instagram posts found. Returning none (no mock content).');
    }

    // Remove duplicates
    const uniquePosts = Array.from(
      new Map(allPosts.map(post => [post.instagramId, post])).values()
    );

    return uniquePosts;
  }

  cleanHashtag(tag) {
    return String(tag || '')
      .trim()
      .replace(/^#/, '')
      .replace(/[^\w]/g, '')
      .toLowerCase();
  }

  /**
   * Managed scraping via Apify.
   * This only scrapes public pages (profiles/hashtags). We do NOT pass login cookies.
   */
  async searchByPreferencesViaApify(preferences, options = {}) {
    const { topics, style, keywords, likedAccounts } = preferences || {};
    const page = Number(options.page) > 0 ? Number(options.page) : 1;

    // Keep runs small/polite. Pagination is coarse; we just increase limits slightly per page.
    const baseLimit = Number(process.env.APIFY_RESULTS_LIMIT) > 0 ? Number(process.env.APIFY_RESULTS_LIMIT) : 30;
    const resultsLimit = Math.min(120, baseLimit + (page - 1) * 10);

    const urls = [];

    // Accounts the user likes (strong taste signal)
    (Array.isArray(likedAccounts) ? likedAccounts : [])
      .slice(0, 5)
      .map(a => String(a).replace(/^@/, '').trim())
      .filter(Boolean)
      .forEach(u => urls.push(`https://www.instagram.com/${u}/`));

    // Topics/hashtags
    (Array.isArray(topics) ? topics : [])
      .slice(0, 4)
      .map(t => this.cleanHashtag(t))
      .filter(Boolean)
      .forEach(t => urls.push(`https://www.instagram.com/explore/tags/${t}/`));

    // Keywords (as hashtags)
    (Array.isArray(keywords) ? keywords : [])
      .slice(0, 3)
      .map(k => this.cleanHashtag(k))
      .filter(Boolean)
      .forEach(k => urls.push(`https://www.instagram.com/explore/tags/${k}/`));

    // Style (as hashtag)
    if (style && String(style).trim()) {
      const t = this.cleanHashtag(style);
      if (t) urls.push(`https://www.instagram.com/explore/tags/${t}/`);
    }

    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length === 0) return [];

    console.log(`✅ Using Apify managed scraping (${uniqueUrls.length} sources, limit ${resultsLimit})...`);
    const posts = await apifyInstagramScraper.scrapePostsByDirectUrls(uniqueUrls, { resultsLimit });
    return posts || [];
  }
}

module.exports = new InstagramScraper();
