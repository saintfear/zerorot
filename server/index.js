const path = require('path');
// Always load the repo-root .env (even if you start the server from /server)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contentRoutes = require('./routes/content');
const newsletterRoutes = require('./routes/newsletters');
const feedbackRoutes = require('./routes/feedback');
const { scheduleNewsletterJob } = require('./jobs/newsletterScheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/newsletters', newsletterRoutes);
app.use('/api/feedback', feedbackRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ZeroRot API is running' });
});

// Serve Next.js static export (client/out) for all non-API routes
const outPath = path.join(__dirname, '..', 'client', 'out');
app.use(express.static(outPath, { index: false }));
app.get('*', (req, res) => {
  // Skip API routes (already handled above)
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  // Serve index.html for SPA-style routing (e.g. /dashboard without trailing slash)
  const reqPath = req.path.endsWith('/') ? req.path : req.path + '/';
  const filePath = path.join(outPath, reqPath === '/' ? 'index.html' : reqPath.slice(1) + 'index.html');
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(outPath, 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ZeroRot server running on http://localhost:${PORT}`);
  
  // Debug: Check if email config is loaded (strip quotes from .env values)
  const emailUserRaw = process.env.EMAIL_USER || '';
  const emailPassRaw = process.env.EMAIL_PASS || '';
  const emailUser = String(emailUserRaw).replace(/^["']|["']$/g, '').trim();
  const emailPass = String(emailPassRaw).replace(/^["']|["']$/g, '').trim();
  const emailConfigured = emailUser && 
                          emailUser !== 'your-email@gmail.com' &&
                          emailPass && 
                          emailPass !== 'your-app-specific-password' &&
                          emailUser.includes('@') &&
                          emailPass.length >= 8;
  console.log('📧 Email config status:', {
    loaded: !!emailUserRaw && !!emailPassRaw,
    userRaw: emailUserRaw ? `"${emailUserRaw.substring(0, 15)}..."` : 'NOT SET',
    userClean: emailUser ? `${emailUser.substring(0, 15)}...` : 'NOT SET',
    passLength: emailPass.length,
    configured: emailConfigured
  });
  
  // Schedule daily newsletter job
  scheduleNewsletterJob();
  console.log('📧 Newsletter scheduler initialized');
});
