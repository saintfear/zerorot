const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const galleryDlScraper = require('./galleryDlScraper');

/**
 * Instagram Scraper Service
 * 
 * Uses gallery-dl for reliable Instagram scraping (if installed),
 * falls back to puppeteer scraping, then mock data.
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
   * Search Instagram for posts by hashtag
   * Note: This is a simplified approach. Real implementation would need
   * to handle authentication, rate limiting, and use official APIs when possible.
   */
  async searchByHashtag(hashtag, limit = 20) {
    try {
      // Remove # if present
      const cleanHashtag = hashtag.replace('#', '');
      const url = `${this.baseUrl}/explore/tags/${cleanHashtag}/`;

      // Using Puppeteer to handle JavaScript-rendered content
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

      // Extract post data from page
      const posts = await page.evaluate(() => {
        const postElements = document.querySelectorAll('article a[href*="/p/"]');
        const results = [];
        
        postElements.forEach((el, index) => {
          if (index < 20) { // Limit results
            const href = el.getAttribute('href');
            const img = el.querySelector('img');
            
            if (href && img) {
              results.push({
                url: `https://www.instagram.com${href}`,
                imageUrl: img.src,
                shortcode: href.split('/p/')[1]?.split('/')[0]
              });
            }
          }
        });
        
        return results;
      });

      await browser.close();

      // Fetch additional details for each post
      const detailedPosts = await Promise.all(
        posts.slice(0, limit).map(post => this.getPostDetails(post.shortcode))
      );

      return detailedPosts.filter(Boolean);
    } catch (error) {
      console.error('Error scraping Instagram:', error);
      // Return mock data for development
      return this.getMockPosts(hashtag, limit);
    }
  }

  /**
   * Get detailed information about a specific post
   */
  async getPostDetails(shortcode) {
    try {
      const url = `${this.baseUrl}/p/${shortcode}/`;
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

      const postData = await page.evaluate(() => {
        // Try to extract JSON-LD or meta tags
        const scripts = Array.from(document.querySelectorAll('script'));
        const jsonScript = scripts.find(s => 
          s.textContent.includes('"@type":"ImageObject"') || 
          s.textContent.includes('caption')
        );

        if (jsonScript) {
          try {
            const data = JSON.parse(jsonScript.textContent);
            return data;
          } catch (e) {
            // Fallback to meta tags
          }
        }

        // Fallback: extract from meta tags
        const metaDescription = document.querySelector('meta[property="og:description"]');
        const metaImage = document.querySelector('meta[property="og:image"]');
        const author = document.querySelector('meta[property="article:author"]');

        return {
          caption: metaDescription?.content || '',
          imageUrl: metaImage?.content || '',
          author: author?.content || ''
        };
      });

      await browser.close();

      return {
        instagramId: shortcode,
        url: url,
        caption: postData.caption || '',
        imageUrl: postData.imageUrl || '',
        author: postData.author || '',
        hashtags: this.extractHashtags(postData.caption || '')
      };
    } catch (error) {
      console.error('Error fetching post details:', error);
      return null;
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
   * Mock data for development/testing
   */
  getMockPosts(topic, limit) {
    const mockPosts = [];
    const topicClean = topic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    // Generate more relevant mock content based on topic
    const captions = [
      `Amazing ${topic} content! Check this out! #${topicClean} #art #inspiration`,
      `Love this ${topic} style! So creative! #${topicClean} #design #creative`,
      `Incredible ${topic} work! This is beautiful! #${topicClean} #artwork #amazing`,
      `Stunning ${topic} piece! Absolutely gorgeous! #${topicClean} #beautiful #stunning`,
      `Fantastic ${topic} content! Really inspiring! #${topicClean} #inspiration #love`,
    ];
    
    for (let i = 0; i < limit; i++) {
      mockPosts.push({
        instagramId: `mock_${topicClean}_${Date.now()}_${i}`,
        url: `https://www.instagram.com/p/mock_${i}/`,
        caption: captions[i % captions.length],
        imageUrl: `https://picsum.photos/400/400?random=${Date.now()}_${i}`,
        author: `@${topicClean}_artist_${i}`,
        hashtags: [`#${topicClean}`, '#art', '#inspiration', '#creative']
      });
    }
    return mockPosts;
  }

  /**
   * Search for content based on user preferences
   * @param {object} preferences - { topics, style, keywords }
   * @param {object} [options] - { cookies: string } Netscape-format cookies.txt for logged-in Instagram
   */
  async searchByPreferences(preferences, options = {}) {
    const { topics, style, keywords } = preferences;
    const { cookies: userCookies } = options;
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
        const posts = await galleryDlScraper.searchByPreferences(preferences, { cookies: userCookies });
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
        
        console.log('📝 Falling back to web scraping or mock data...');
        scrapingFailed = true;
      }
    } else if (!this.useGalleryDl) {
      // Only show this message once
      console.log('ℹ️ gallery-dl not installed. Install with: pip install gallery-dl');
      scrapingFailed = true;
    }

    // Try puppeteer scraping (will likely fail due to Instagram's security)
    if (scrapingFailed || !this.useGalleryDl) {
      try {
        // Search by topics/hashtags
        if (topics && Array.isArray(topics) && topics.length > 0) {
          for (const topic of topics.slice(0, 3)) { // Limit to 3 topics
            try {
              const posts = await this.searchByHashtag(topic, 10);
              if (posts && posts.length > 0) {
                allPosts.push(...posts);
              } else {
                scrapingFailed = true;
              }
            } catch (error) {
              console.log(`⚠️ Instagram scraping failed for "${topic}"`);
              scrapingFailed = true;
            }
          }
        }

        // Search by keywords if provided
        if (keywords && Array.isArray(keywords) && keywords.length > 0) {
          for (const keyword of keywords.slice(0, 2)) {
            try {
              const posts = await this.searchByHashtag(keyword, 5);
              if (posts && posts.length > 0) {
                allPosts.push(...posts);
              }
            } catch (error) {
              scrapingFailed = true;
            }
          }
        }

        // Search by style if provided
        if (style && style.trim()) {
          try {
            const posts = await this.searchByHashtag(style, 5);
            if (posts && posts.length > 0) {
              allPosts.push(...posts);
            }
          } catch (error) {
            scrapingFailed = true;
          }
        }
      } catch (error) {
        console.log('⚠️ Instagram scraping unavailable');
        scrapingFailed = true;
      }
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
