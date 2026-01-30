const apifyInstagramScraper = require('./managedScraper/apifyInstagramScraper');

function safeNum(x) {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

function toUsername(u) {
  return String(u || '').replace(/^@/, '').trim();
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function parseTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function engagement(p) {
  // Simple engagement composite; comments are a stronger signal than likes
  return safeNum(p.likeCount) + 2 * safeNum(p.commentCount) + 0.5 * safeNum(p.viewCount);
}

/**
 * Seed-and-Expand Discovery
 *
 * Given user "seed" accounts (likedAccounts), expand into a cluster via public
 * profile suggestions, then harvest each account's strongest recent posts by
 * "engagement delta" (post engagement / account average engagement).
 *
 * This intentionally avoids scraping full "following lists" because those are typically
 * behind login and higher-risk. If you later add a logged-in following-scraper provider,
 * this module can use it as an alternative expansion source.
 */
class SeedExpandDiscovery {
  isEnabled() {
    return String(process.env.DISCOVERY_SEED_EXPAND || '').toLowerCase().trim() === 'true';
  }

  getConfig() {
    const hardCapPostsPerAccount = 1000; // safety cap to avoid runaway Apify costs
    return {
      maxSeeds: Number(process.env.DISCOVERY_SEED_MAX_SEEDS) > 0 ? Number(process.env.DISCOVERY_SEED_MAX_SEEDS) : 3,
      maxExpandedAccounts: Number(process.env.DISCOVERY_SEED_MAX_EXPANDED) > 0 ? Number(process.env.DISCOVERY_SEED_MAX_EXPANDED) : 50,
      maxAccountsTotal: Number(process.env.DISCOVERY_SEED_MAX_ACCOUNTS_TOTAL) > 0 ? Number(process.env.DISCOVERY_SEED_MAX_ACCOUNTS_TOTAL) : 60,
      // "All posts" means: scrape as many as the provider will return, capped for cost.
      postsPerAccount: Math.min(
        hardCapPostsPerAccount,
        Number(process.env.DISCOVERY_SEED_POSTS_PER_ACCOUNT) > 0 ? Number(process.env.DISCOVERY_SEED_POSTS_PER_ACCOUNT) : 200
      ),
      keepPerAccount: Number(process.env.DISCOVERY_SEED_KEEP_PER_ACCOUNT) > 0 ? Number(process.env.DISCOVERY_SEED_KEEP_PER_ACCOUNT) : 5,
      // Optional time window. Set to 0 to include all available posts.
      daysBack: Number(process.env.DISCOVERY_SEED_DAYS_BACK) >= 0 ? Number(process.env.DISCOVERY_SEED_DAYS_BACK) : 0,
      // Threshold for "viral in niche"
      deltaThreshold: Number(process.env.DISCOVERY_SEED_DELTA_THRESHOLD) > 0 ? Number(process.env.DISCOVERY_SEED_DELTA_THRESHOLD) : 2,
      // Batch URLs to keep Apify runs reasonable
      batchSize: Number(process.env.DISCOVERY_SEED_BATCH_SIZE) > 0 ? Number(process.env.DISCOVERY_SEED_BATCH_SIZE) : 8,
    };
  }

  async expandAccountsFromSeeds(seedUsernames, cfg) {
    if (!apifyInstagramScraper.isConfigured()) return [];
    return await apifyInstagramScraper.expandSeedAccountsViaSuggestions(seedUsernames, {
      maxSeeds: cfg.maxSeeds,
      maxExpand: cfg.maxExpandedAccounts
    });
  }

  async fetchPostsForAccounts(usernames, cfg) {
    const names = uniq(usernames.map(toUsername)).filter(Boolean);
    if (names.length === 0) return [];
    if (!apifyInstagramScraper.isConfigured()) return [];

    const urls = names.map(u => `https://www.instagram.com/${u}/`);
    const out = [];

    for (let i = 0; i < urls.length; i += cfg.batchSize) {
      const slice = urls.slice(i, i + cfg.batchSize);
      const posts = await apifyInstagramScraper.scrapePostsByDirectUrls(slice, { resultsLimit: cfg.postsPerAccount });
      (posts || []).forEach(p => out.push(p));
    }

    return out;
  }

  pickTopPostsByDelta(posts, cfg) {
    const now = Date.now();
    const minTs = cfg.daysBack > 0 ? (now - cfg.daysBack * 24 * 60 * 60 * 1000) : null;

    const byAuthor = new Map();
    for (const p of posts) {
      const author = toUsername(p.author || '');
      if (!author) continue;
      if (!byAuthor.has(author)) byAuthor.set(author, []);
      byAuthor.get(author).push(p);
    }

    const chosen = [];

    for (const [author, list] of byAuthor.entries()) {
      // If a time window is configured, filter; otherwise consider all available posts.
      const poolByTime = minTs == null
        ? list
        : list.filter(p => {
            const t = parseTimestamp(p.timestamp);
            return t == null ? true : t >= minTs;
          });
      if (poolByTime.length === 0) continue;

      const scores = poolByTime.map(p => engagement(p));
      const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
      const denom = avg > 0 ? avg : 1;

      const enriched = poolByTime.map(p => {
        const e = engagement(p);
        const delta = e / denom;
        return { ...p, _eng: e, _delta: delta };
      });

      // Prefer niche-viral posts, otherwise take the strongest ones
      const viral = enriched.filter(p => p._delta >= cfg.deltaThreshold);
      const pool = viral.length > 0 ? viral : enriched;

      pool.sort((a, b) => (b._delta - a._delta) || (b._eng - a._eng));
      const top = pool.slice(0, cfg.keepPerAccount).map(p => {
        // store a soft engagementScore signal for downstream ranker
        return {
          ...p,
          engagementScore: Math.max(0, Math.min(1, p._delta / 4)),
          source: p.source ? `${p.source}+seed_expand` : 'seed_expand'
        };
      });
      chosen.push(...top);
    }

    // Dedupe by instagramId
    return Array.from(new Map(chosen.map(p => [p.instagramId, p])).values());
  }

  /**
   * Main entry: given preference.likedAccounts, return harvested posts from expanded cluster.
   */
  async discoverFromSeeds(preferences) {
    const cfg = this.getConfig();
    const seeds = (Array.isArray(preferences?.likedAccounts) ? preferences.likedAccounts : [])
      .map(toUsername)
      .filter(Boolean)
      .slice(0, cfg.maxSeeds);

    if (seeds.length === 0) return [];
    if (!this.isEnabled()) return [];

    const expanded = await this.expandAccountsFromSeeds(seeds, cfg);
    const accounts = uniq([...seeds, ...expanded]).slice(0, cfg.maxAccountsTotal);

    const posts = await this.fetchPostsForAccounts(accounts, cfg);
    return this.pickTopPostsByDelta(posts, cfg);
  }
}

module.exports = new SeedExpandDiscovery();

