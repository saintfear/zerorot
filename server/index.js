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
const { scheduleContentDiscovery } = require('./jobs/contentDiscoveryScheduler');

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
  
  // Schedule content discovery job (runs every 5 minutes)
  scheduleContentDiscovery();
  console.log('🔍 Content discovery scheduler initialized');
});
