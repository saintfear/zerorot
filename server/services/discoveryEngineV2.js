const OpenAI = require('openai');
const aiContentFilter = require('./aiContentFilter');

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
  async scoreAndRank(posts, preferences, feedback) {
    const inputPosts = Array.isArray(posts) ? posts : [];
    if (inputPosts.length === 0) return [];

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
    const wantsAiArt = Array.isArray(preferences?.topics) && preferences.topics.some(t => /ai\s*art/i.test(String(t)));

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

