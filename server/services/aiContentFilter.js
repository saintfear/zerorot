const OpenAI = require('openai');

class AIContentFilter {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Score and rank content based on user preferences and thumbs up/down feedback
   * @param {object[]} posts
   * @param {object} userPreferences - { topics, style, keywords }
   * @param {{ liked: {caption,hashtags}[], disliked: {caption,hashtags}[] }} [feedback] - training signal from ratings
   */
  async scoreContent(posts, userPreferences, feedback = {}) {
    if (!posts || posts.length === 0) {
      return [];
    }

    try {
      const prompt = this.createScoringPrompt(posts, userPreferences, feedback);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a content curator that scores Instagram posts. Use the user\'s stated preferences and their thumbs-up / thumbs-down history to prefer content similar to what they liked and avoid content similar to what they disliked. Return a JSON object with a "scores" array (0-1) for each post.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content);
      const scoredPosts = posts.map((post, index) => ({
        ...post,
        score: result.scores?.[index] != null ? result.scores[index] : 0.5
      }));
      return scoredPosts.sort((a, b) => (b.score || 0) - (a.score || 0));
    } catch (error) {
      console.error('Error scoring content with AI:', error);
      return this.fallbackScoring(posts, userPreferences, feedback);
    }
  }

  /**
   * Create prompt for AI scoring (includes feedback when provided)
   */
  createScoringPrompt(posts, preferences, feedback = {}) {
    const postsSummary = posts.map((post, i) => ({
      index: i,
      caption: post.caption || '',
      hashtags: post.hashtags || [],
      author: post.author || ''
    }));

    let feedbackBlock = '';
    if (feedback.liked && feedback.liked.length > 0) {
      feedbackBlock += `\nContent the user THUMBS-UP LIKED (prefer similar):\n${JSON.stringify(feedback.liked.slice(0, 15), null, 2)}`;
    }
    if (feedback.disliked && feedback.disliked.length > 0) {
      feedbackBlock += `\nContent the user THUMBS-DOWN DISLIKED (avoid similar):\n${JSON.stringify(feedback.disliked.slice(0, 15), null, 2)}`;
    }

    return `User preferences: ${JSON.stringify(preferences)}
${feedbackBlock}

Instagram posts to score:
${JSON.stringify(postsSummary, null, 2)}

Score each post from 0-1. Prefer content similar to what they liked and penalize content similar to what they disliked. Consider topic, style, hashtags, and overall fit.

Return JSON:
{
  "scores": [0.9, 0.7, 0.5, ...]
}`;
  }

  /**
   * Fallback scoring using simple keyword matching
   */
  fallbackScoring(posts, preferences) {
    const keywords = [
      ...(preferences.topics || []),
      ...(preferences.keywords || []),
      preferences.style
    ].filter(Boolean).map(k => k.toLowerCase());

    // If no keywords, give all posts a moderate score
    if (keywords.length === 0) {
      return posts.map(post => ({
        ...post,
        score: 0.5
      }));
    }

    return posts.map(post => {
      const caption = (post.caption || '').toLowerCase();
      const hashtags = Array.isArray(post.hashtags) 
        ? post.hashtags.join(' ').toLowerCase()
        : (post.hashtags || '').toLowerCase();
      const text = `${caption} ${hashtags}`;

      let score = 0.3; // Base score (lowered to allow more posts through)
      let matches = 0;

      keywords.forEach(keyword => {
        // Check for partial matches too
        const keywordLower = keyword.toLowerCase();
        if (text.includes(keywordLower)) {
          matches++;
          score += 0.15; // Increased per-match score
        } else {
          // Check for word parts (e.g., "cyberpunk" matches "cyber" or "punk")
          const keywordParts = keywordLower.split(/[\s-]+/);
          keywordParts.forEach(part => {
            if (part.length > 3 && text.includes(part)) {
              score += 0.05;
            }
          });
        }
      });

      // Boost score if multiple keywords match
      if (matches > 1) {
        score += 0.1 * (matches - 1);
      }

      score = Math.min(1, score); // Cap at 1.0

      return {
        ...post,
        score
      };
    }).sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Generate newsletter content using AI
   */
  async generateNewsletterContent(topPosts, userPreferences) {
    try {
      const postsSummary = topPosts.map(post => ({
        caption: post.caption,
        url: post.url,
        imageUrl: post.imageUrl,
        author: post.author
      }));

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a friendly newsletter writer for ZeroRot. Create engaging, personalized email content.'
          },
          {
            role: 'user',
            content: `Create a cute, friendly email newsletter for a user interested in: ${JSON.stringify(userPreferences)}

Include these top posts:
${JSON.stringify(postsSummary, null, 2)}

Write a warm greeting, brief intro, and descriptions for each post. Keep it fun and personal!`
          }
        ]
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating newsletter content:', error);
      
      // Fallback: simple template
      return this.fallbackNewsletterContent(topPosts, userPreferences);
    }
  }

  /**
   * Fallback newsletter content
   */
  fallbackNewsletterContent(posts, preferences) {
    let content = `<h2>Good morning! ☀️</h2>`;
    content += `<p>Here's your personalized ZeroRot newsletter with the best ${preferences.topics?.[0] || 'content'} we found for you today!</p>`;
    
    posts.forEach((post, index) => {
      content += `
        <div style="margin: 20px 0; padding: 15px; border: 1px solid #eee; border-radius: 8px;">
          <h3>Post ${index + 1}</h3>
          ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Post image" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 10px;">` : ''}
          <p>${post.caption || 'Check out this amazing content!'}</p>
          ${post.author ? `<p><strong>By:</strong> ${post.author}</p>` : ''}
          <a href="${post.url}" style="color: #007bff; text-decoration: none;">View on Instagram →</a>
        </div>
      `;
    });

    content += `<p style="margin-top: 30px;">Have a great day! 💫</p>`;
    
    return content;
  }
}

module.exports = new AIContentFilter();
