# ZeroRot Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- SQLite (no server needed)
- OpenAI API key
- Email account (Gmail or other SMTP service)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Set Up Database

1. Update `.env` with your SQLite database URL (repo-root relative):
```
DATABASE_URL="file:./dev.db"
```

2. Run migrations:
```bash
npx prisma migrate dev
npx prisma generate
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

- **DATABASE_URL**: Your SQLite connection string (example: `file:./dev.db`)
- **JWT_SECRET**: A random secret string for JWT tokens
- **OPENAI_API_KEY**: Your OpenAI API key (get from https://platform.openai.com)
- **EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS**: Your SMTP email credentials
  - For Gmail: Use an App Password (not your regular password)
  - Enable 2FA and generate an app password at: https://myaccount.google.com/apppasswords

### 4. Run the Application

**Development mode:**
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
cd client
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### 5. Test the Application

1. Sign up for an account
2. Set your content preferences (e.g., "French cooking", "cyberpunk fashion")
3. Click "Discover Content" to test content discovery
4. Click "Send Test Newsletter" to receive an email

## Important Notes

### Instagram Scraping

⚠️ **Warning**: The Instagram scraping implementation in this codebase is for demonstration purposes. Instagram has strict Terms of Service regarding scraping.

**For Production:**
- Use Instagram Basic Display API (requires user OAuth)
- Use Instagram Graph API (for business accounts)
- Partner with official Instagram data providers
- Respect rate limits and terms of service

The current implementation includes:
- Puppeteer-based scraping (may be blocked by Instagram)
- Mock data fallback for development
- Rate limiting considerations

### Email Configuration

For Gmail:
1. Enable 2-Factor Authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in `EMAIL_PASS`

For other providers, check their SMTP settings.

### Daily Newsletter

The newsletter job runs daily at 8:00 AM. To test immediately:
- Use the "Send Test Newsletter" button in the dashboard
- Or modify the cron schedule in `server/jobs/newsletterScheduler.js`

## Troubleshooting

**Database connection errors:**
- Check `DATABASE_URL` format (SQLite looks like `file:./dev.db`)
- Ensure the process can write to the folder where the DB file lives

**Email not sending:**
- Verify SMTP credentials
- Check email service logs
- For Gmail, ensure App Password is used (not regular password)

**Instagram scraping not working:**
- Instagram may block automated access
- Use mock data mode for development
- Consider using official APIs for production

**OpenAI API errors:**
- Verify API key is correct
- Check API quota/credits
- Ensure model access (gpt-4o-mini)
