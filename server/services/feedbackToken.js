const jwt = require('jsonwebtoken');

/**
 * Signed token for email-based rating actions.
 * Payload is intentionally minimal and expires automatically.
 */
function signRatingToken({ userId, contentItemId, rating }) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  const r = Number(rating);
  if (r !== 1 && r !== -1) {
    throw new Error('Invalid rating (must be 1 or -1)');
  }
  return jwt.sign(
    { userId, contentItemId, rating: r, kind: 'rate_v1' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyRatingToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!decoded || decoded.kind !== 'rate_v1') {
    throw new Error('Invalid token');
  }
  const r = Number(decoded.rating);
  if (r !== 1 && r !== -1) {
    throw new Error('Invalid rating in token');
  }
  return {
    userId: decoded.userId,
    contentItemId: decoded.contentItemId,
    rating: r
  };
}

module.exports = { signRatingToken, verifyRatingToken };

