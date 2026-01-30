/**
 * ZeroRot "Beauty Pipeline" — core primitives:
 * - CLIP image embeddings (ViT-B/32 via Transformers.js / Xenova)
 * - LAION aesthetic predictor head (universal beauty score 1..10-ish)
 * - User taste vector (average embedding of seed images) + cosine similarity
 *
 * Notes:
 * - Model weights are lazily downloaded on first use by @xenova/transformers.
 * - Everything is best-effort: failures should never crash discovery; callers can fallback.
 */
const path = require('path');
const apifyInstagramScraper = require('./managedScraper/apifyInstagramScraper');
const laionHead = require('./laionAestheticHead.vit_b_32.json');

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function safeNum(x) {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function l2Normalize(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return vec;
  let s = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = Number(vec[i]) || 0;
    s += v * v;
  }
  const n = Math.sqrt(s);
  if (!Number.isFinite(n) || n === 0) return vec;
  return vec.map(x => (Number(x) || 0) / n);
}

function avgVectors(vectors) {
  const vecs = (vectors || []).filter(v => Array.isArray(v) && v.length > 0);
  if (vecs.length === 0) return null;
  const n = vecs[0].length;
  const out = new Array(n).fill(0);
  for (const v of vecs) {
    for (let i = 0; i < n; i++) out[i] += Number(v[i]) || 0;
  }
  for (let i = 0; i < n; i++) out[i] /= vecs.length;
  return out;
}

async function mapWithConcurrency(items, limit, fn) {
  const list = Array.isArray(items) ? items : [];
  const lim = Math.max(1, Math.min(Number(limit) || 1, 32));
  const out = new Array(list.length);
  let idx = 0;
  const workers = new Array(Math.min(lim, list.length)).fill(0).map(async () => {
    while (true) {
      const i = idx++;
      if (i >= list.length) return;
      out[i] = await fn(list[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

function engagementScore(p) {
  // Similar to seedExpandDiscovery's composite
  const likeCount = safeNum(p?.likeCount) ?? 0;
  const commentCount = safeNum(p?.commentCount) ?? 0;
  const viewCount = safeNum(p?.viewCount) ?? 0;
  return likeCount + 2 * commentCount + 0.5 * viewCount;
}

function computeLaplacianEnergy(gray, width, height) {
  // Simple sharpness proxy (higher = sharper). Operates on 8-bit grayscale pixels.
  // We compute mean of squared Laplacian response (a common blur metric).
  const w = width | 0;
  const h = height | 0;
  if (!gray || w < 3 || h < 3) return 0;
  let sum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      const c = gray[i];
      const lap = (-4 * c) + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
      sum += lap * lap;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

class BeautyPipeline {
  constructor() {
    this._clipPromise = null;
    this._transformersPromise = null;

    // Simple in-memory caches (best-effort; reset on server restart)
    this._imageEmbeddingCache = new Map(); // imageUrl -> { t, embedding }
    this._tasteVectorCache = new Map(); // key -> { t, expiresAt, vector }
  }

  isEnabled() {
    // Enabled by default when DISCOVERY_ENGINE=v2.
    return String(process.env.BEAUTY_PIPELINE || 'true').toLowerCase().trim() !== 'false';
  }

  async _getTransformers() {
    if (!this._transformersPromise) {
      // @xenova/transformers is ESM; use dynamic import from CommonJS.
      this._transformersPromise = import('@xenova/transformers');
    }
    return await this._transformersPromise;
  }

  async getClipImageExtractor() {
    if (this._clipPromise) return await this._clipPromise;

    this._clipPromise = (async () => {
      const { pipeline, env } = await this._getTransformers();

      // Make cache location explicit when running under server/ (optional).
      // This helps avoid re-downloading in some deployment setups.
      const cacheDir = String(process.env.TRANSFORMERS_CACHE || '').trim();
      if (cacheDir) {
        env.cacheDir = cacheDir;
      } else {
        // Default to a project-local cache to keep things self-contained
        env.cacheDir = path.join(process.cwd(), '.cache', 'transformers');
      }

      const modelId = String(process.env.BEAUTY_CLIP_MODEL || 'Xenova/clip-vit-base-patch32').trim();
      const quantized = String(process.env.BEAUTY_CLIP_QUANTIZED || 'false').toLowerCase().trim() === 'true';

      return await pipeline('image-feature-extraction', modelId, { quantized });
    })();

    return await this._clipPromise;
  }

  _getEmbeddingCacheMax() {
    const n = Number(process.env.BEAUTY_EMBED_CACHE_MAX);
    return n > 0 ? Math.min(5000, n) : 750;
  }

  _getEmbeddingCacheTtlMs() {
    const n = Number(process.env.BEAUTY_EMBED_CACHE_TTL_MS);
    return n > 0 ? n : 24 * 60 * 60 * 1000; // 24h
  }

  _embeddingCacheGet(url) {
    const key = String(url || '').trim();
    if (!key) return null;
    const hit = this._imageEmbeddingCache.get(key);
    if (!hit) return null;
    if ((Date.now() - hit.t) > this._getEmbeddingCacheTtlMs()) {
      this._imageEmbeddingCache.delete(key);
      return null;
    }
    return hit.embedding || null;
  }

  _embeddingCacheSet(url, embedding) {
    const key = String(url || '').trim();
    if (!key || !Array.isArray(embedding) || embedding.length === 0) return;

    this._imageEmbeddingCache.set(key, { t: Date.now(), embedding });

    // Naive eviction (FIFO-ish by insertion order)
    const max = this._getEmbeddingCacheMax();
    while (this._imageEmbeddingCache.size > max) {
      const firstKey = this._imageEmbeddingCache.keys().next().value;
      if (!firstKey) break;
      this._imageEmbeddingCache.delete(firstKey);
    }
  }

  async embedImage(imageUrl) {
    if (!this.isEnabled()) return null;
    if (String(process.env.BEAUTY_CLIP_DISABLED || '').toLowerCase().trim() === 'true') return null;

    const url = String(imageUrl || '').trim();
    if (!url) return null;

    const cached = this._embeddingCacheGet(url);
    if (cached) return cached;

    const extractor = await this.getClipImageExtractor();
    const tensor = await extractor(url);
    const dims = Array.isArray(tensor?.dims) ? tensor.dims : [];
    const data = tensor?.data;

    // Expected [1, 512] for clip-vit-base-patch32 image embedding
    if (!data || !dims || dims.length !== 2) return null;

    const emb = Array.from(data);
    if (emb.length !== laionHead.embedding_dim) return null;

    const normalized = l2Normalize(emb);
    this._embeddingCacheSet(url, normalized);
    return normalized;
  }

  async assessTechnicalQuality(imageUrl) {
    // NIMA-style "technical beauty" proxy: sharpness + basic resolution sanity.
    // (True NIMA can be plugged in later; this is a cheap, local guardrail.)
    if (!this.isEnabled()) return null;
    if (String(process.env.BEAUTY_TECHNICAL_ENABLED || '').toLowerCase().trim() !== 'true') return null;

    const url = String(imageUrl || '').trim();
    if (!url) return null;

    const { RawImage } = await this._getTransformers();
    const img = await RawImage.read(url);
    if (!img || !img.data || !img.width || !img.height) return null;

    // Resize down for speed (keeps blur signal)
    const target = Number(process.env.BEAUTY_TECHNICAL_SIZE) > 0 ? Number(process.env.BEAUTY_TECHNICAL_SIZE) : 128;
    const resized = await img.clone().rgb().resize(target, -1);
    const w = resized.width | 0;
    const h = resized.height | 0;
    if (w <= 0 || h <= 0) return null;

    // Grayscale
    const rgb = resized.data; // Uint8Array-like
    const gray = new Uint8Array(w * h);
    for (let i = 0, j = 0; j < gray.length; i += 3, j++) {
      const r = rgb[i] || 0;
      const g = rgb[i + 1] || 0;
      const b = rgb[i + 2] || 0;
      gray[j] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
    }

    const energy = computeLaplacianEnergy(gray, w, h);

    // Map energy to 0..10-ish (log-scaled)
    // Typical energies: blurry ~ < 20, sharp ~ 50-300+ (varies widely).
    const log = Math.log10(energy + 1);
    let score01 = clamp01(log / 2.5); // 0..~1

    // Resolution penalty (use original)
    const minDim = Math.min(Number(img.width) || 0, Number(img.height) || 0);
    if (minDim > 0 && minDim < 256) score01 *= 0.65;

    return 10 * score01;
  }

  scoreLaionAestheticFromEmbedding(clipEmbedding) {
    const emb = Array.isArray(clipEmbedding) ? clipEmbedding : null;
    if (!emb || emb.length !== laionHead.embedding_dim) return null;
    const w = laionHead.weight;
    if (!Array.isArray(w) || w.length !== laionHead.embedding_dim) return null;

    let dot = 0;
    for (let i = 0; i < w.length; i++) dot += (Number(w[i]) || 0) * (Number(emb[i]) || 0);
    const bias = Number(laionHead.bias) || 0;
    const score = dot + bias;
    return Number.isFinite(score) ? score : null;
  }

  /**
   * Stage 1: bulk embed + universal beauty scoring.
   * Adds:
   * - clipEmbedding (float[] length 512, L2-normalized)
   * - aestheticScore (number ~1..10)
   * - technicalScore (number ~0..10, optional)
   */
  async scoreUniversalBeauty(posts) {
    const list = Array.isArray(posts) ? posts : [];
    const concurrency = Number(process.env.BEAUTY_CLIP_CONCURRENCY) > 0 ? Number(process.env.BEAUTY_CLIP_CONCURRENCY) : 2;

    return await mapWithConcurrency(list, concurrency, async (post) => {
      const p = { ...post };
      if (!p.imageUrl) {
        p.clipEmbedding = null;
        p.aestheticScore = null;
        p.technicalScore = null;
        return p;
      }

      try {
        const emb = await this.embedImage(p.imageUrl);
        p.clipEmbedding = emb;
        p.aestheticScore = emb ? this.scoreLaionAestheticFromEmbedding(emb) : null;
        try {
          p.technicalScore = await this.assessTechnicalQuality(p.imageUrl);
        } catch {
          p.technicalScore = null;
        }
      } catch {
        p.clipEmbedding = null;
        p.aestheticScore = null;
        p.technicalScore = null;
      }

      return p;
    });
  }

  /**
   * Build a user "taste vector" (average CLIP embedding) from:
   * - Seed accounts (preferred) via Apify, OR
   * - Previously-liked items (fallback) if caller supplies feedback.liked[].imageUrl
   */
  async getTasteVector({ userId, preferences, feedback }) {
    const maxSeedPosts = Number(process.env.BEAUTY_TASTE_SEED_POSTS) > 0 ? Number(process.env.BEAUTY_TASTE_SEED_POSTS) : 20;
    const ttlMs = Number(process.env.BEAUTY_TASTE_CACHE_TTL_MS) > 0 ? Number(process.env.BEAUTY_TASTE_CACHE_TTL_MS) : 24 * 60 * 60 * 1000;

    const accounts = (Array.isArray(preferences?.likedAccounts) ? preferences.likedAccounts : [])
      .map(a => String(a).replace(/^@/, '').trim())
      .filter(Boolean)
      .slice(0, 8);

    const cacheKey = `${userId || 'anon'}:${accounts.join(',')}:${maxSeedPosts}`;
    const hit = this._tasteVectorCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now() && Array.isArray(hit.vector)) return hit.vector;

    let seedImageUrls = [];
    const preferApify = String(process.env.BEAUTY_TASTE_SOURCE || 'seed_accounts').toLowerCase().trim() !== 'liked_items';

    if (preferApify && accounts.length > 0 && apifyInstagramScraper.isConfigured()) {
      const resultsPerAccount = Number(process.env.BEAUTY_TASTE_RESULTS_PER_ACCOUNT) > 0
        ? Number(process.env.BEAUTY_TASTE_RESULTS_PER_ACCOUNT)
        : 25;

      // Fetch posts for each liked account and pick top by engagement
      const urls = accounts.map(u => `https://www.instagram.com/${u}/`);
      const posts = await apifyInstagramScraper.scrapePostsByDirectUrls(urls, { resultsLimit: resultsPerAccount });
      const withScore = (posts || [])
        .filter(p => p && p.imageUrl)
        .map(p => ({ ...p, _eng: engagementScore(p) }));
      withScore.sort((a, b) => (b._eng - a._eng));
      seedImageUrls = withScore.slice(0, maxSeedPosts).map(p => p.imageUrl).filter(Boolean);
    }

    // Fallback: use previously liked items (image URLs) if supplied
    if (seedImageUrls.length === 0) {
      const liked = Array.isArray(feedback?.liked) ? feedback.liked : [];
      seedImageUrls = liked
        .map(x => x?.imageUrl)
        .filter(Boolean)
        .slice(0, maxSeedPosts);
    }

    if (seedImageUrls.length === 0) return null;

    const concurrency = Number(process.env.BEAUTY_CLIP_CONCURRENCY) > 0 ? Number(process.env.BEAUTY_CLIP_CONCURRENCY) : 2;
    const embs = await mapWithConcurrency(seedImageUrls, concurrency, async (url) => {
      try {
        return await this.embedImage(url);
      } catch {
        return null;
      }
    });

    const vec = avgVectors(embs.filter(Boolean));
    const normalized = vec ? l2Normalize(vec) : null;
    if (!normalized) return null;

    this._tasteVectorCache.set(cacheKey, { t: Date.now(), expiresAt: Date.now() + ttlMs, vector: normalized });
    return normalized;
  }

  /**
   * Stage 2: compute CLIP cosine similarity between each post and the taste vector.
   * Adds:
   * - tasteSim (cosine similarity, roughly -1..1)
   * - tasteScore (mapped to 0..1)
   */
  async scorePersonalBeauty(posts, tasteVector) {
    const list = Array.isArray(posts) ? posts : [];
    const tv = Array.isArray(tasteVector) ? tasteVector : null;
    if (!tv) return list.map(p => ({ ...p, tasteSim: 0, tasteScore: 0.5 }));

    const concurrency = Number(process.env.BEAUTY_CLIP_CONCURRENCY) > 0 ? Number(process.env.BEAUTY_CLIP_CONCURRENCY) : 2;
    return await mapWithConcurrency(list, concurrency, async (post) => {
      const p = { ...post };
      try {
        const emb = Array.isArray(p.clipEmbedding) ? p.clipEmbedding : (p.imageUrl ? await this.embedImage(p.imageUrl) : null);
        p.clipEmbedding = emb || null;
        const sim = tv && emb ? cosineSimilarity(tv, emb) : 0;
        p.tasteSim = sim;
        p.tasteScore = clamp01((sim + 1) / 2);
      } catch {
        p.tasteSim = 0;
        p.tasteScore = 0.5;
      }
      return p;
    });
  }
}

module.exports = new BeautyPipeline();

