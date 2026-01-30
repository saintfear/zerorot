const OpenAI = require('openai');
const aiContentFilter = require('./aiContentFilter');
const beautyPipeline = require('./beautyPipeline');

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

function engagementScoreFromSignals({ likeCount, commentCount, viewCount }) {
  // Light heuristic (log-scaled) – good enough until we have true "save" counts.
  const l = Math.log10((safeNum(likeCount) ?? 0) + 1);
  const c = Math.log10((safeNum(commentCount) ?? 0) + 1);
  const v = Math.log10((safeNum(viewCount) ?? 0) + 1);
  // Weight comments slightly more than likes; views are weak/noisy.
  const raw = 0.55 * l + 0.85 * c + 0.25 * v;
  // Normalize to ~0-1 for typical ranges.
  return clamp01(raw / 6);
}

class DiscoveryEngineV2 {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.visionModel = process.env.VISION_MODEL || 'gpt-4o-mini';
  }

  async embedTexts(texts) {
    const input = (texts || []).map(t => String(t || '').slice(0, 6000));
    if (input.length === 0) return [];
    const res = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input
    });
    // res.data is ordered
    return (res.data || []).map(d => d.embedding).filter(Boolean);
  }

  async scoreWithVision(post, preferences, feedback) {
    const img = post?.imageUrl;
    if (!img) {
      return { visionScore: null, visionTags: [], imageDescription: null, aiSignals: false };
    }

    // Keep prompt short. Return JSON only.
    const userPref = JSON.stringify(preferences || {});
    const likedAccounts = Array.isArray(preferences?.likedAccounts) ? preferences.likedAccounts.slice(0, 5) : [];
    const likedHints = (feedback?.liked || []).slice(0, 6).map(x => (x.caption || '').slice(0, 200));
    const dislikedHints = (feedback?.disliked || []).slice(0, 6).map(x => (x.caption || '').slice(0, 200));

    const promptText = `User preferences: ${userPref}
Liked accounts: ${JSON.stringify(likedAccounts)}
Examples they liked (captions): ${JSON.stringify(likedHints)}
Examples they disliked (captions): ${JSON.stringify(dislikedHints)}

You will see an Instagram post image and optional caption/alt text.
Return JSON with:
- score: number 0..1 (fit to user's taste)
- tags: short array of style/mood/subject tags
- imageDescription: 1-2 sentences describing the image content and aesthetic
- aiSignals: boolean (true if looks like AI-generated art / obvious AI render)
`;

    const caption = String(post.caption || '').slice(0, 800);
    const alt = String(post.alt || '').slice(0, 800);

    const response = await this.openai.chat.completions.create({
      model: this.visionModel,
      messages: [
        {
          role: 'system',
          content:
            'You are a strict JSON-only response generator. Do not include markdown. ' +
            'Be conservative about aiSignals: only true if it is strongly likely.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `${promptText}\nCaption: ${caption}\nAlt: ${alt}` },
            { type: 'image_url', image_url: { url: img } }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = response?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const visionScore = parsed?.score != null ? clamp01(Number(parsed.score)) : null;
    const visionTags = Array.isArray(parsed?.tags) ? parsed.tags.map(t => String(t).slice(0, 48)) : [];
    const imageDescription = parsed?.imageDescription ? String(parsed.imageDescription).slice(0, 500) : null;
    const aiSignals = !!parsed?.aiSignals;

    return { visionScore, visionTags, imageDescription, aiSignals };
  }

  wantsAiArt(preferences) {
    return Array.isArray(preferences?.topics) && preferences.topics.some(t => /ai\s*art/i.test(String(t)));
  }

  /**
   * Stage 3: "Vibe Check" batch ranking (curator-style).
   *
   * Prompt goal: rank images by soulful / wabi-sabi / emotional resonance
   * and away from overly commercial / ad-like vibes.
   *
   * Returns:
   * - rankings: array of indices (0..n-1) best->worst
   * - items: array of { index, vibeScore 0..1, tags[], imageDescription, aiSignals }
   */
  async vibeCheckBatch(posts, preferences, feedback) {
    const list = Array.isArray(posts) ? posts : [];
    const images = list.filter(p => p && p.imageUrl).slice(0, 8); // keep it sane
    if (images.length === 0) {
      return { rankings: [], items: [] };
    }

    // If no OpenAI key is present, don't attempt.
    if (!String(process.env.OPENAI_API_KEY || '').trim()) {
      return { rankings: images.map((_, i) => i), items: [] };
    }
    if (String(process.env.BEAUTY_VIBE_DISABLED || '').toLowerCase().trim() === 'true') {
      return { rankings: images.map((_, i) => i), items: [] };
    }

    const wantsAiArt = this.wantsAiArt(preferences);
    const likedAccounts = Array.isArray(preferences?.likedAccounts) ? preferences.likedAccounts.slice(0, 6) : [];
    const likedHints = (feedback?.liked || []).slice(0, 6).map(x => (x.caption || '').slice(0, 160));
    const dislikedHints = (feedback?.disliked || []).slice(0, 6).map(x => (x.caption || '').slice(0, 160));

    const promptText = `You are a high-end art curator.
You will be shown a small set of Instagram post images (numbered 0..${images.length - 1}).

Your job:
- Rank them by which feels most "soulful" and least "commercial".
- Emphasize wabi-sabi aesthetics, emotional resonance, restraint, texture, composition, and authenticity.
- Penalize obvious ads, influencer thirst traps, overly polished stock-photo vibes, and generic trends.
- The user strongly prefers real, non-AI-generated content. Set aiSignals=true only if strongly likely.
${wantsAiArt ? '- The user is okay with AI art.\n' : '- Unless the user explicitly wants AI art, strongly penalize AI-generated imagery.\n'}

User taste context (light, don't overfit):
- Liked accounts: ${JSON.stringify(likedAccounts)}
- Captions they liked: ${JSON.stringify(likedHints)}
- Captions they disliked: ${JSON.stringify(dislikedHints)}

Return STRICT JSON only, with:
{
  "rankings": [2,0,1,...], // best->worst, indices 0..${images.length - 1}
  "items": [
    { "index": 0, "vibeScore": 0.0, "tags": ["..."], "imageDescription": "...", "aiSignals": false },
    ...
  ]
}

vibeScore: 0..1 where 1 is exceptionally soulful / non-commercial.`;

    const response = await this.openai.chat.completions.create({
      model: this.visionModel,
      messages: [
        {
          role: 'system',
          content:
            'You are a strict JSON-only response generator. Do not include markdown. ' +
            'If uncertain, be conservative about aiSignals.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            ...images.map(p => ({ type: 'image_url', image_url: { url: p.imageUrl } }))
          ]
        }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = response?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const rankings = Array.isArray(parsed?.rankings)
      ? parsed.rankings.map(x => Number(x)).filter(x => Number.isInteger(x) && x >= 0 && x < images.length)
      : [];

    const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : [];
    const items = itemsRaw
      .map(x => {
        const index = Number(x?.index);
        if (!Number.isInteger(index) || index < 0 || index >= images.length) return null;
        const vibeScore = x?.vibeScore != null ? clamp01(Number(x.vibeScore)) : null;
        const tags = Array.isArray(x?.tags) ? x.tags.map(t => String(t).slice(0, 48)) : [];
        const imageDescription = x?.imageDescription ? String(x.imageDescription).slice(0, 500) : null;
        const aiSignals = !!x?.aiSignals;
        return { index, vibeScore, tags, imageDescription, aiSignals };
      })
      .filter(Boolean);

    // Ensure rankings is a full permutation
    const seen = new Set(rankings);
    const filled = [...rankings];
    for (let i = 0; i < images.length; i++) if (!seen.has(i)) filled.push(i);

    return { rankings: filled, items };
  }

  /**
   * Tournament-style curation so we can rank ~20 images without sending 20 at once.
   * Returns posts sorted best->worst with vibeScore attached.
   */
  async vibeTournament(posts, preferences, feedback) {
    const groupSize = Number(process.env.BEAUTY_VIBE_GROUP_SIZE) > 0 ? Number(process.env.BEAUTY_VIBE_GROUP_SIZE) : 5;
    const keepPerGroup = Number(process.env.BEAUTY_VIBE_KEEP_PER_GROUP) > 0 ? Number(process.env.BEAUTY_VIBE_KEEP_PER_GROUP) : 2;
    const finalKeep = Number(process.env.BEAUTY_FINAL_CURATION_K) > 0 ? Number(process.env.BEAUTY_FINAL_CURATION_K) : 20;

    let pool = (Array.isArray(posts) ? posts : []).filter(p => p && p.imageUrl).slice(0, finalKeep);
    if (pool.length <= 1) return pool;

    // Keep any metadata we get back
    const metaById = new Map(); // instagramId -> { vibeScore, tags, imageDescription, aiSignals }

    const attachMeta = (batch, res) => {
      const items = Array.isArray(res?.items) ? res.items : [];
      for (const it of items) {
        const p = batch[it.index];
        if (!p) continue;
        const id = p.instagramId || p.url || p.imageUrl;
        if (!id) continue;
        metaById.set(id, {
          vibeScore: typeof it.vibeScore === 'number' ? it.vibeScore : null,
          visionTags: it.tags || [],
          imageDescription: it.imageDescription || null,
          aiSignals: !!it.aiSignals
        });
      }
    };

    // Round-robin elimination until small enough, then final rank
    while (pool.length > groupSize) {
      const next = [];
      for (let i = 0; i < pool.length; i += groupSize) {
        const batch = pool.slice(i, i + groupSize);
        if (batch.length === 0) continue;
        if (batch.length === 1) {
          next.push(batch[0]);
          continue;
        }

        let res;
        try {
          res = await this.vibeCheckBatch(batch, preferences, feedback);
        } catch {
          res = { rankings: batch.map((_, j) => j), items: [] };
        }

        attachMeta(batch, res);
        const order = Array.isArray(res?.rankings) ? res.rankings : batch.map((_, j) => j);
        const keep = Math.min(keepPerGroup, batch.length);
        for (let k = 0; k < keep; k++) {
          const idx = order[k];
          if (batch[idx]) next.push(batch[idx]);
        }
      }
      pool = next;
      if (pool.length === 0) break;
    }

    if (pool.length <= 1) return pool;

    // Final ranking
    let finalRes;
    try {
      finalRes = await this.vibeCheckBatch(pool, preferences, feedback);
    } catch {
      finalRes = { rankings: pool.map((_, j) => j), items: [] };
    }
    attachMeta(pool, finalRes);

    const order = Array.isArray(finalRes?.rankings) ? finalRes.rankings : pool.map((_, j) => j);
    const ranked = order.map(i => pool[i]).filter(Boolean);

    // Attach meta + provide a fallback vibeScore from position if missing
    const out = ranked.map((p, idx) => {
      const id = p.instagramId || p.url || p.imageUrl;
      const meta = id ? metaById.get(id) : null;
      const fallback = ranked.length > 1 ? (1 - idx / (ranked.length - 1)) : 1;
      return {
        ...p,
        vibeScore: typeof meta?.vibeScore === 'number' ? meta.vibeScore : clamp01(fallback),
        visionTags: Array.isArray(meta?.visionTags) ? meta.visionTags : (p.visionTags || []),
        imageDescription: meta?.imageDescription || p.imageDescription || null,
        aiSignals: meta?.aiSignals != null ? meta.aiSignals : (p.aiSignals || false)
      };
    });

    return out;
  }

  buildTasteText(preferences, feedback) {
    const topics = Array.isArray(preferences?.topics) ? preferences.topics : [];
    const keywords = Array.isArray(preferences?.keywords) ? preferences.keywords : [];
    const style = preferences?.style ? [String(preferences.style)] : [];
    const accounts = Array.isArray(preferences?.likedAccounts) ? preferences.likedAccounts : [];

    const liked = (feedback?.liked || []).slice(0, 20);
    const disliked = (feedback?.disliked || []).slice(0, 20);

    return [
      `topics: ${topics.join(', ')}`,
      `keywords: ${keywords.join(', ')}`,
      `style: ${style.join(', ')}`,
      `likedAccounts: ${accounts.join(', ')}`,
      `likedCaptions: ${liked.map(x => x.caption || '').join(' | ')}`,
      `dislikedCaptions: ${disliked.map(x => x.caption || '').join(' | ')}`
    ].join('\n');
  }

  postToEmbedText(post) {
    const parts = [
      post.caption || '',
      Array.isArray(post.hashtags) ? post.hashtags.join(' ') : (post.hashtags || ''),
      post.imageDescription || '',
      post.alt || ''
    ]
      .map(s => String(s || '').trim())
      .filter(Boolean);
    return parts.join('\n').slice(0, 6000);
  }

  /**
   * Score + rank posts using:
   * - managed scraping signals (caption/hashtags)
   * - vision scoring + tags (top candidates only)
   * - embedding similarity to the user's taste
   * - engagement signals
   */
  async scoreAndRank(posts, preferences, feedback, options = {}) {
    const inputPosts = Array.isArray(posts) ? posts : [];
    if (inputPosts.length === 0) return [];

    const userId = options?.userId || null;

    // If beauty pipeline is enabled, it becomes the primary discovery/ranking mechanism.
    // We keep legacy v2 logic as a fallback when models/keys are unavailable.
    const useBeauty = beautyPipeline.isEnabled();

    if (useBeauty) {
      try {
        // 0) Cheap pre-ranking just to keep compute bounded
        const preRanked = aiContentFilter.fallbackScoring(inputPosts, preferences, feedback);
        const bulkMax = Number(process.env.BEAUTY_BULK_CANDIDATES) > 0 ? Number(process.env.BEAUTY_BULK_CANDIDATES) : 220;
        const bulk = preRanked.slice(0, Math.min(bulkMax, preRanked.length));

        // 1) Universal beauty filter (LAION aesthetic score)
        const withUniversal = await beautyPipeline.scoreUniversalBeauty(bulk);
        const minAesthetic = Number(process.env.BEAUTY_AESTHETIC_MIN) > 0 ? Number(process.env.BEAUTY_AESTHETIC_MIN) : 7.0;
        const requireAesthetic = String(process.env.BEAUTY_REQUIRE_AESTHETIC || 'true').toLowerCase().trim() === 'true';
        const technicalEnabled = String(process.env.BEAUTY_TECHNICAL_ENABLED || '').toLowerCase().trim() === 'true';
        const minTechnical = Number(process.env.BEAUTY_TECHNICAL_MIN) > 0 ? Number(process.env.BEAUTY_TECHNICAL_MIN) : 4.5;

        const stage1 = withUniversal
          .filter(p => p && p.imageUrl)
          .filter(p => {
            if (typeof p.aestheticScore === 'number') return p.aestheticScore >= minAesthetic;
            return !requireAesthetic;
          })
          .filter(p => {
            if (!technicalEnabled) return true;
            if (typeof p.technicalScore === 'number') return p.technicalScore >= minTechnical;
            // If technical scoring is enabled but unavailable, don't hard-fail the post.
            return true;
          });

        if (stage1.length === 0) {
          // Nothing survived, fall back to legacy v2.
          throw new Error('beauty_stage1_empty');
        }

        // 2) Personal beauty (CLIP taste similarity)
        const tasteVector = await beautyPipeline.getTasteVector({ userId, preferences, feedback });
        const withTaste = await beautyPipeline.scorePersonalBeauty(stage1, tasteVector);

        // Engagement score for tie-breaking / light safety
        const enriched = withTaste.map(p => {
          const likeCount = safeNum(p.likeCount);
          const commentCount = safeNum(p.commentCount);
          const viewCount = safeNum(p.viewCount);
          const engagementScore = engagementScoreFromSignals({ likeCount, commentCount, viewCount });

          // Normalize aesthetic into 0..1 around the configured threshold
          const aes = typeof p.aestheticScore === 'number' ? p.aestheticScore : null;
          const aestheticNorm = aes == null ? 0.5 : clamp01((aes - minAesthetic) / Math.max(1e-6, (10 - minAesthetic)));

          const tasteScore = typeof p.tasteScore === 'number' ? clamp01(p.tasteScore) : 0.5;
          const tech = typeof p.technicalScore === 'number' ? clamp01(p.technicalScore / 10) : null;
          const baseBeauty = clamp01(
            0.55 * tasteScore +
            0.30 * aestheticNorm +
            (technicalEnabled && tech != null ? 0.10 * tech : 0) +
            0.05 * engagementScore
          );

          return {
            ...p,
            likeCount,
            commentCount,
            viewCount,
            engagementScore,
            aestheticNorm,
            technicalScore: typeof p.technicalScore === 'number' ? p.technicalScore : null,
            baseBeauty,
            // For DB/debug compatibility, store CLIP embedding in "embedding"
            embedding: Array.isArray(p.clipEmbedding) ? p.clipEmbedding : (p.embedding || null),
            embeddingSim: typeof p.tasteSim === 'number' ? p.tasteSim : (p.embeddingSim || null)
          };
        });

        enriched.sort((a, b) => (b.baseBeauty || 0) - (a.baseBeauty || 0));

        // 3) Vibe check (Vision LLM) on top slice
        const vibeCandidates = enriched.slice(0, Math.min(enriched.length, Number(process.env.BEAUTY_FINAL_CURATION_K) > 0 ? Number(process.env.BEAUTY_FINAL_CURATION_K) : 20));
        let curated = [];
        try {
          curated = await this.vibeTournament(vibeCandidates, preferences, feedback);
        } catch {
          curated = vibeCandidates.map((p, i) => ({ ...p, vibeScore: clamp01(1 - i / Math.max(1, vibeCandidates.length - 1)) }));
        }

        const wantsAiArt = this.wantsAiArt(preferences);
        const curatedIds = new Set(curated.map(p => p.instagramId || p.url || p.imageUrl).filter(Boolean));

        const curatedWithFinal = curated.map(p => {
          const vibe = typeof p.vibeScore === 'number' ? clamp01(p.vibeScore) : 0.5;
          let final = clamp01(0.70 * vibe + 0.30 * (p.baseBeauty || 0.5));
          if (!wantsAiArt && p.aiSignals) final = clamp01(final - 0.35);
          return { ...p, finalScore: final };
        });
        curatedWithFinal.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

        const rest = enriched
          .filter(p => !curatedIds.has(p.instagramId || p.url || p.imageUrl))
          .map(p => ({ ...p, finalScore: clamp01(0.85 * (p.baseBeauty || 0.5)) }));

        const allRanked = [...curatedWithFinal, ...rest];
        allRanked.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

        // Preserve the output contract used by callers (use .score)
        return allRanked.map(p => ({
          ...p,
          // Make scores "peaky" enough that top picks usually clear the existing >= 0.9 threshold.
          score: clamp01(0.55 + 0.45 * (p.finalScore || 0))
        }));
      } catch (e) {
        // fallthrough to legacy v2 logic below
      }
    }

    // 1) Cheap pre-ranking (text heuristics + thumbs up/down terms)
    const preRanked = aiContentFilter.fallbackScoring(inputPosts, preferences, feedback);

    const maxVision = Number(process.env.AI_VISION_CANDIDATES) > 0 ? Number(process.env.AI_VISION_CANDIDATES) : 12;
    const maxEmbed = Number(process.env.AI_EMBED_CANDIDATES) > 0 ? Number(process.env.AI_EMBED_CANDIDATES) : 30;
    const candidates = preRanked.slice(0, Math.min(Math.max(maxVision, maxEmbed), preRanked.length));

    // 2) Vision scoring for the top slice
    const withVision = [];
    for (let i = 0; i < candidates.length; i++) {
      const p = { ...candidates[i] };
      p.likeCount = safeNum(p.likeCount);
      p.commentCount = safeNum(p.commentCount);
      p.viewCount = safeNum(p.viewCount);
      p.engagementScore = engagementScoreFromSignals(p);

      if (i < maxVision) {
        try {
          const v = await this.scoreWithVision(p, preferences, feedback);
          p.visionScore = v.visionScore;
          p.visionTags = v.visionTags;
          p.imageDescription = v.imageDescription;
          p.aiSignals = v.aiSignals;
        } catch (e) {
          p.visionScore = null;
          p.visionTags = [];
          p.imageDescription = null;
          p.aiSignals = false;
        }
      } else {
        p.visionScore = null;
        p.visionTags = [];
        p.imageDescription = null;
        p.aiSignals = false;
      }

      withVision.push(p);
    }

    // 3) Embedding similarity (taste vector vs candidate vectors)
    let tasteVector = null;
    try {
      const tasteText = this.buildTasteText(preferences, feedback);
      const [taste] = await this.embedTexts([tasteText]);
      tasteVector = taste || null;
    } catch {
      tasteVector = null;
    }

    let candidateEmbeddings = [];
    try {
      const embedSlice = withVision.slice(0, Math.min(maxEmbed, withVision.length));
      const texts = embedSlice.map(p => this.postToEmbedText(p));
      candidateEmbeddings = await this.embedTexts(texts);
      for (let i = 0; i < embedSlice.length; i++) {
        embedSlice[i].embedding = candidateEmbeddings[i] || null;
      }
    } catch {
      // ignore – we can still rank without embeddings
    }

    // 4) Hybrid score
    const wantsAiArt = this.wantsAiArt(preferences);

    const ranked = withVision.map(p => {
      const textScore = safeNum(p.score) ?? 0.5; // from fallback scoring
      const visionScore = p.visionScore != null ? p.visionScore : null;
      const embedSim = tasteVector && Array.isArray(p.embedding) ? cosineSimilarity(tasteVector, p.embedding) : 0;

      // Map cosine similarity (-1..1-ish) to 0..1
      const embedScore = clamp01((embedSim + 1) / 2);

      const eng = safeNum(p.engagementScore) ?? 0;

      // Weighted hybrid: vision > embedding > engagement > text fallback
      let final =
        0.45 * (visionScore != null ? visionScore : textScore) +
        0.30 * embedScore +
        0.15 * eng +
        0.10 * textScore;

      if (!wantsAiArt && p.aiSignals) final -= 0.35;
      final = clamp01(final);

      return {
        ...p,
        embeddingSim: embedSim,
        finalScore: final
      };
    });

    ranked.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    // Preserve the output contract used by callers (use .score)
    return ranked.map(p => ({
      ...p,
      score: p.finalScore
    }));
  }
}

module.exports = new DiscoveryEngineV2();

