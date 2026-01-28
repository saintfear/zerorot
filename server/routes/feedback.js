const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyRatingToken } = require('../services/feedbackToken');

const router = express.Router();
const prisma = new PrismaClient();

function htmlPage(title, body) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
             background: #faf5eb; color: #4a3d2e; padding: 24px; }
      .card { max-width: 680px; margin: 0 auto; background: #fffaf0; border: 2px solid #d4c4a8; border-radius: 12px; padding: 20px; }
      a { color: #8b7355; }
    </style>
  </head>
  <body>
    <div class="card">
      ${body}
    </div>
  </body>
</html>`;
}

// Email-friendly rating endpoint (no auth header; uses signed token)
// Example: /api/feedback/rate?t=<token>
router.get('/rate', async (req, res) => {
  try {
    const token = String(req.query.t || '').trim();
    if (!token) {
      return res.status(400).send(htmlPage('ZeroRot', `<h2>Missing token</h2><p>This rating link is incomplete.</p>`));
    }

    const { userId, contentItemId, rating } = verifyRatingToken(token);

    // Only allow rating on an item that belongs to that user
    const item = await prisma.contentItem.findFirst({
      where: { id: contentItemId, userId }
    });
    if (!item) {
      return res.status(404).send(htmlPage('ZeroRot', `<h2>Not found</h2><p>This post can’t be rated (it may have been removed).</p>`));
    }

    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { rating }
    });

    const msg = rating === 1 ? '👍 Saved! We’ll show you more like this.' : '👎 Saved! We’ll show you less like this.';
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.send(htmlPage('ZeroRot', `<h2>Thanks</h2><p>${msg}</p><p><a href="${appUrl}/dashboard">Back to ZeroRot</a></p>`));
  } catch (e) {
    return res.status(400).send(htmlPage('ZeroRot', `<h2>Invalid link</h2><p>This rating link is expired or invalid.</p>`));
  }
});

module.exports = router;

