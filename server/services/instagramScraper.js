const axios = require('axios');
const cheerio = require('cheerio');
const galleryDlScraper = require('./galleryDlScraper');

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
    const { topics, style, keywords } = preferences;
    const { cookies: userCookies, page } = options;
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
}

module.exports = new InstagramScraper();
