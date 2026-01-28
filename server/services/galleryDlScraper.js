const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * Instagram Scraper using gallery-dl
 * 
 * gallery-dl is a powerful command-line tool for downloading content
 * from Instagram and other sites. This service uses it to fetch posts.
 * 
 * Installation: pip install gallery-dl
 * Or: brew install gallery-dl (on macOS)
 */

class GalleryDlScraper {
  constructor() {
    this.galleryDlPath = null; // Will be found asynchronously
    this.findPath();
  }

  async findPath() {
    this.galleryDlPath = await this.findGalleryDlPath();
  }

  /**
   * Find gallery-dl executable path
   */
  async findGalleryDlPath() {
    // Try common locations
    const possiblePaths = [
      'gallery-dl', // In PATH
      'python3 -m gallery_dl', // As Python module
      '/usr/local/bin/gallery-dl',
      '/opt/homebrew/bin/gallery-dl',
      `${process.env.HOME}/.local/bin/gallery-dl`,
      `${process.env.HOME}/Library/Python/3.9/bin/gallery-dl`,
      `${process.env.HOME}/Library/Python/3.10/bin/gallery-dl`,
      `${process.env.HOME}/Library/Python/3.11/bin/gallery-dl`,
      `${process.env.HOME}/Library/Python/3.12/bin/gallery-dl`,
    ];

    console.log('🔍 Searching for gallery-dl...');
    
    // Test each path
    for (const path of possiblePaths) {
      try {
        const testCommand = path.includes('python3') 
          ? `${path} --version` 
          : `${path} --version`;
        const { stdout, stderr } = await execAsync(testCommand, { timeout: 5000 });
        if (stdout || (!stderr || (!stderr.includes('not found') && !stderr.includes('No module')))) {
          console.log(`✅ Found gallery-dl at: ${path}`);
          return path;
        }
      } catch (error) {
        // Try next path
        continue;
      }
    }

    console.log('⚠️ gallery-dl not found in common locations');
    // Default fallback - will fail gracefully in isInstalled()
    return 'gallery-dl';
  }

  /**
   * Check if gallery-dl is installed
   */
  async isInstalled() {
    // Make sure path is found
    if (!this.galleryDlPath) {
      await this.findPath();
    }

    try {
      const command = this.galleryDlPath.includes('python3') 
        ? `${this.galleryDlPath} --version`
        : `${this.galleryDlPath} --version`;
      const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
      if (stdout || !stderr.includes('not found') && !stderr.includes('No module')) {
        console.log(`✅ Found gallery-dl at: ${this.galleryDlPath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.log(`⚠️ gallery-dl not found. Tried: ${this.galleryDlPath}`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Install with: pip3 install gallery-dl`);
      return false;
    }
  }

  /**
   * Fetch Instagram posts from a hashtag
   * @param {string} hashtag
   * @param {number} [limit=20]
   * @param {{ cookies?: string, page?: number }} [options] - Netscape-format cookies.txt + page for pagination
   */
  async fetchHashtagPosts(hashtag, limit = 20, options = {}) {
    // Ensure path is found
    if (!this.galleryDlPath) {
      await this.findPath();
    }

    const isInstalled = await this.isInstalled();
    if (!isInstalled) {
      throw new Error('gallery-dl is not installed. Install with: pip3 install gallery-dl');
    }

    let tempCookiesFile = null;
    try {
      // Remove # if present
      const cleanHashtag = hashtag.replace('#', '').toLowerCase();
      const url = `https://www.instagram.com/explore/tags/${cleanHashtag}/`;

      // Create temp directory for JSON output
      const tempDir = path.join(__dirname, '../../temp');
      await fs.mkdir(tempDir, { recursive: true });
      const outputFile = path.join(tempDir, `hashtag_${cleanHashtag}_${Date.now()}.json`);

      // Use gallery-dl to fetch posts metadata
      // Handle both direct command and python module
      const isPythonModule = this.galleryDlPath.includes('python3');
      const commandPrefix = isPythonModule 
        ? this.galleryDlPath 
        : this.galleryDlPath;
      
      console.log(`📥 Fetching posts for hashtag "${hashtag}" using gallery-dl...`);
      
      const page = Number(options.page) > 0 ? Number(options.page) : 1;
      const start = (page - 1) * limit + 1;
      const end = page * limit;

      // Cookies: per-user content wins, then global file paths
      let cookiesPath = null;
      if (options.cookies && typeof options.cookies === 'string' && options.cookies.trim().length > 0) {
        const userCookiesFile = path.join(tempDir, `cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
        await fs.writeFile(userCookiesFile, options.cookies.trim(), 'utf8');
        cookiesPath = userCookiesFile;
        tempCookiesFile = userCookiesFile;
        console.log('   Using your Instagram session (saved cookies).');
      } else {
        const possibleCookiePaths = [
          path.join(process.env.HOME || '', '.config/gallery-dl/cookies.txt'),
          path.join(process.env.HOME || '', 'cookies.txt'),
          path.join(__dirname, '../../cookies.txt'),
        ];
        for (const cookiePath of possibleCookiePaths) {
          try {
            await fs.access(cookiePath);
            cookiesPath = cookiePath;
            break;
          } catch (e) {
            // Try next path
          }
        }
      }
      
      const cookiesFlag = cookiesPath ? `--cookies "${cookiesPath}"` : '';
      
      // For Python module, use the full command; for direct command, use as-is
      // Capture both stdout and stderr to see what's happening
      const command = isPythonModule
        ? `${commandPrefix} --dump-json ${cookiesFlag} --range ${start}-${end} "${url}" > "${outputFile}" 2>&1 || true`
        : `${commandPrefix} --dump-json ${cookiesFlag} --range ${start}-${end} "${url}" > "${outputFile}" 2>&1 || true`;
      
      if (!cookiesPath) {
        console.log('   No cookies - some content may require login. Connect Instagram in your dashboard.');
      }

      try {
        // Don't redirect stderr to /dev/null so we can see errors
        const commandWithErrors = command.replace('2>/dev/null', '2>&1');
        const { stdout, stderr } = await execAsync(commandWithErrors, { 
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000 // 30 second timeout
        });
        
        // Log errors (but ignore SSL warnings)
        if (stderr && !stderr.includes('NotOpenSSLWarning') && stderr.trim().length > 0) {
          console.log('gallery-dl stderr:', stderr.substring(0, 500));
        }
        
        // Also check stdout for errors
        if (stdout && stdout.includes('error') && stdout.includes('HttpError')) {
          console.log('gallery-dl error in output:', stdout.substring(0, 500));
        }
      } catch (error) {
        // Command failed - log the actual error
        console.error('gallery-dl command failed:', error.message);
        if (error.stderr) {
          console.error('gallery-dl stderr:', error.stderr.substring(0, 500));
        }
        // Continue to check output file anyway (might have partial data)
      }

      // Read and parse the JSON output
      let posts = [];
      try {
        const fileContent = await fs.readFile(outputFile, 'utf-8');
        
        if (!fileContent || fileContent.trim().length === 0) {
          console.log(`⚠️ gallery-dl output file is empty for "${hashtag}"`);
          await fs.unlink(outputFile).catch(() => {});
          return [];
        }

        // gallery-dl outputs one JSON object per line, or sometimes a JSON array
        let lines = [];
        if (fileContent.trim().startsWith('[')) {
          // It's a JSON array
          try {
            const array = JSON.parse(fileContent);
            lines = array.map(item => JSON.stringify(item));
          } catch (e) {
            // Fall back to line-by-line
            lines = fileContent.trim().split('\n');
          }
        } else {
          // Line-by-line JSON
          lines = fileContent.trim().split('\n');
        }
        
        posts = lines
          .filter(line => {
            const trimmed = line.trim();
            return trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['));
          })
          .map(line => {
            try {
              const parsed = JSON.parse(line);
              // Handle arrays
              if (Array.isArray(parsed)) {
                return parsed.filter(item => item.url || item.shortcode || item.id);
              }
              // Filter out non-post entries (gallery-dl outputs various metadata)
              if (parsed.url || parsed.shortcode || parsed.id || parsed.media_id) {
                return parsed;
              }
              return null;
            } catch (e) {
              return null;
            }
          })
          .flat() // Flatten arrays
          .filter(Boolean);

        if (posts.length > 0) {
          console.log(`✅ Successfully fetched ${posts.length} posts for "${hashtag}"`);
        } else {
          console.log(`⚠️ No posts found for "${hashtag}"`);
          
          // Check if file contains error messages
          if (fileContent.includes('NameResolutionError') || fileContent.includes('resolve')) {
            console.log(`   ❌ DNS Error: Cannot resolve Instagram domain`);
            console.log(`   💡 Fix DNS: sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4`);
          } else if (fileContent.includes('LoginRequired') || fileContent.includes('login')) {
            console.log(`   ⚠️ Instagram requires login - export cookies from Brave browser`);
          } else if (fileContent.includes('error') || fileContent.includes('Error')) {
            console.log(`   ❌ Error in gallery-dl output`);
            console.log(`   Preview: ${fileContent.substring(0, 300)}`);
          } else {
            console.log(`   ℹ️ Empty response - Instagram may be blocking or hashtag doesn't exist`);
            console.log(`   File content: ${fileContent.substring(0, 200)}`);
          }
        }

        // Clean up temp file
        await fs.unlink(outputFile).catch(() => {});
      } catch (error) {
        console.error(`❌ Error reading gallery-dl output for "${hashtag}":`, error.message);
        // Clean up temp file even on error
        await fs.unlink(outputFile).catch(() => {});
      }

      // Transform gallery-dl format to our format
      return posts.slice(0, limit).map(post => this.transformPost(post));

    } catch (error) {
      console.error(`Error fetching hashtag "${hashtag}" with gallery-dl:`, error.message);
      throw error;
    } finally {
      if (tempCookiesFile) {
        await fs.unlink(tempCookiesFile).catch(() => {});
      }
    }
  }

  /**
   * Fetch Instagram posts from a user profile
   * @param {string} username - Instagram username (no @)
   * @param {number} [limit=20]
   * @param {{ cookies?: string, page?: number }} [options] - Netscape-format cookies for login + page for pagination
   */
  async fetchUserPosts(username, limit = 20, options = {}) {
    if (!(await this.isInstalled())) {
      throw new Error('gallery-dl is not installed');
    }

    const cleanUser = String(username).replace(/^@/, '').trim();
    if (!cleanUser) return [];

    let tempCookiesFile = null;
    try {
      const url = `https://www.instagram.com/${cleanUser}/`;
      const page = Number(options.page) > 0 ? Number(options.page) : 1;
      const start = (page - 1) * limit + 1;
      const end = page * limit;
      const tempDir = path.join(__dirname, '../../temp');
      await fs.mkdir(tempDir, { recursive: true });
      const outputFile = path.join(tempDir, `user_${cleanUser}_${Date.now()}.json`);

      let cookiesPath = null;
      if (options.cookies && typeof options.cookies === 'string' && options.cookies.trim().length > 0) {
        const userCookiesFile = path.join(tempDir, `cookies_user_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
        await fs.writeFile(userCookiesFile, options.cookies.trim(), 'utf8');
        cookiesPath = userCookiesFile;
        tempCookiesFile = userCookiesFile;
      } else {
        const possibleCookiePaths = [
          path.join(process.env.HOME || '', '.config/gallery-dl/cookies.txt'),
          path.join(process.env.HOME || '', 'cookies.txt'),
          path.join(__dirname, '../../cookies.txt'),
        ];
        for (const p of possibleCookiePaths) {
          try {
            await fs.access(p);
            cookiesPath = p;
            break;
          } catch (_) {}
        }
      }
      const cookiesFlag = cookiesPath ? `--cookies "${cookiesPath}"` : '';

      const commandPrefix = this.galleryDlPath.includes('python3') ? this.galleryDlPath : this.galleryDlPath;
      const command = `${commandPrefix} --dump-json ${cookiesFlag} --range ${start}-${end} "${url}" 2>&1 > "${outputFile}" || true`;

      try {
        await execAsync(command, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
      } catch (error) {
        console.log('gallery-dl user fetch completed (may have warnings)');
      }

      let posts = [];
      try {
        const fileContent = await fs.readFile(outputFile, 'utf-8');
        const lines = fileContent.trim().split('\n').filter(line => {
          const t = line.trim();
          return t && t.startsWith('{') && t.endsWith('}');
        });
        posts = lines.map(line => {
          try {
            const parsed = JSON.parse(line);
            if (parsed.url || parsed.shortcode || parsed.id) return parsed;
            return null;
          } catch (_) { return null; }
        }).filter(Boolean);
        await fs.unlink(outputFile).catch(() => {});
      } catch (error) {
        console.error('Error reading gallery-dl user output:', error.message);
        await fs.unlink(outputFile).catch(() => {});
      }

      return posts.slice(0, limit).map(post => this.transformPost(post));
    } catch (error) {
      console.error(`Error fetching user "${cleanUser}" with gallery-dl:`, error.message);
      throw error;
    } finally {
      if (tempCookiesFile) await fs.unlink(tempCookiesFile).catch(() => {});
    }
  }

  /**
   * Transform gallery-dl post format to our format
   */
  transformPost(post) {
    // gallery-dl post structure varies, try to extract what we need
    // Handle different possible field names
    const postId = post.id || post.shortcode || post.media_id || post.media_pk || `gallery_${Date.now()}_${Math.random()}`;
    const shortcode = post.shortcode || (post.id && typeof post.id === 'string' ? post.id : null);
    
    // Get URL - gallery-dl provides various URL formats
    let url = post.url || post.permalink || post._url;
    if (!url && shortcode) {
      url = `https://www.instagram.com/p/${shortcode}/`;
    }
    
    // Get image URL - try multiple possible fields
    const imageUrl = post.url || post.media_url || post.display_url || post.thumbnail || 
                     post.images?.[0] || post.image || '';
    
    // Get caption
    const caption = post.caption || post.description || post.title || post.text || '';
    
    // Get author
    let author = '';
    if (post.owner_username) {
      author = `@${post.owner_username}`;
    } else if (post.username) {
      author = `@${post.username}`;
    } else if (post.owner && post.owner.username) {
      author = `@${post.owner.username}`;
    }
    
    return {
      instagramId: String(postId),
      url: url || '',
      caption: caption,
      imageUrl: imageUrl,
      author: author,
      hashtags: this.extractHashtags(caption),
      timestamp: post.timestamp || post.date || post.created_time || new Date().toISOString()
    };
  }

  /**
   * Extract hashtags from text
   */
  extractHashtags(text) {
    const hashtagRegex = /#[\w]+/g;
    return text.match(hashtagRegex) || [];
  }

  /**
   * Search by user preferences
   * @param {object} preferences - { topics, style, keywords, likedAccounts?: string[] }
   * @param {{ cookies?: string }} [options] - Netscape-format cookies for Instagram
   */
  async searchByPreferences(preferences, options = {}) {
    const { topics, style, keywords, likedAccounts } = preferences;
    const allPosts = [];

    try {
      // Fetch from accounts the user likes (strong taste signal)
      const accounts = Array.isArray(likedAccounts) ? likedAccounts : [];
      for (const account of accounts.slice(0, 5)) {
        const user = String(account).replace(/^@/, '').trim();
        if (!user) continue;
        try {
          console.log(`🔍 Fetching posts from account: @${user}`);
          const posts = await this.fetchUserPosts(user, 8, options);
          if (posts && posts.length > 0) {
            console.log(`✅ Found ${posts.length} posts from @${user}`);
            allPosts.push(...posts);
          }
        } catch (error) {
          console.log(`⚠️ Failed to fetch @${user}:`, error.message);
        }
      }

      // Search by topics/hashtags
      if (topics && Array.isArray(topics) && topics.length > 0) {
        for (const topic of topics.slice(0, 3)) {
          try {
            console.log(`🔍 Fetching posts for hashtag: ${topic}`);
            const posts = await this.fetchHashtagPosts(topic, 10, options);
            if (posts && posts.length > 0) {
              console.log(`✅ Found ${posts.length} posts for "${topic}"`);
              allPosts.push(...posts);
            }
          } catch (error) {
            console.log(`⚠️ Failed to fetch "${topic}":`, error.message);
          }
        }
      }

      // Search by keywords (as hashtags)
      if (keywords && Array.isArray(keywords) && keywords.length > 0) {
        for (const keyword of keywords.slice(0, 2)) {
          try {
            console.log(`🔍 Fetching posts for keyword: ${keyword}`);
            const posts = await this.fetchHashtagPosts(keyword, 5, options);
            if (posts && posts.length > 0) {
              allPosts.push(...posts);
            }
          } catch (error) {
            console.log(`⚠️ Failed to fetch keyword "${keyword}":`, error.message);
          }
        }
      }

      // Search by style
      if (style && style.trim()) {
        try {
          console.log(`🔍 Fetching posts for style: ${style}`);
          const posts = await this.fetchHashtagPosts(style, 5, options);
          if (posts && posts.length > 0) {
            allPosts.push(...posts);
          }
        } catch (error) {
          console.log(`⚠️ Failed to fetch style "${style}":`, error.message);
        }
      }

      // Remove duplicates
      const uniquePosts = Array.from(
        new Map(allPosts.map(post => [post.instagramId, post])).values()
      );

      console.log(`✅ Total unique posts found: ${uniquePosts.length}`);
      return uniquePosts;

    } catch (error) {
      console.error('Error in searchByPreferences:', error);
      throw error;
    }
  }
}

module.exports = new GalleryDlScraper();
