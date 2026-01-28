require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contentRoutes = require('./routes/content');
const newsletterRoutes = require('./routes/newsletters');
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ZeroRot API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ZeroRot server running on http://localhost:${PORT}`);
  
  // Schedule daily newsletter job
  scheduleNewsletterJob();
  console.log('📧 Newsletter scheduler initialized');
});
