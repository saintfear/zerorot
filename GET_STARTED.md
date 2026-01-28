# Getting ZeroRot Running

## Current Status

✅ **Backend dependencies**: Installed  
⏳ **Frontend dependencies**: Installing (may take a few minutes)

## Quick Start Steps

### 1. Wait for Frontend Installation
The frontend dependencies are installing in the background. Wait a few minutes, then check:
```bash
cd /Users/chesterposey/zerorot/client
ls node_modules  # Should show a directory if installed
```

If not installed after 5-10 minutes, manually run:
```bash
cd /Users/chesterposey/zerorot/client
npm install
```

### 2. Configure Environment Variables

Edit `/Users/chesterposey/zerorot/.env` with your actual values:

**Required:**
- `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
- `DATABASE_URL` - Your PostgreSQL connection string
- `JWT_SECRET` - Already set (change for production)

**Optional (for email):**
- `EMAIL_USER` and `EMAIL_PASS` - For sending newsletters
  - For Gmail: Use an App Password (not regular password)
  - Generate at: https://myaccount.google.com/apppasswords

**Note:** The app will work with mock data if Instagram credentials aren't set.

### 3. Set Up Database

If you have PostgreSQL installed:
```bash
cd /Users/chesterposey/zerorot
npx prisma migrate dev
npx prisma generate
```

If you don't have PostgreSQL:
- Install PostgreSQL: `brew install postgresql@14` (or download from postgresql.org)
- Or use a cloud database (Supabase, Railway, etc.)
- Update `DATABASE_URL` in `.env`

### 4. Run the Application

**Option A: Run both together**
```bash
cd /Users/chesterposey/zerorot
npm run dev
```

**Option B: Run separately (recommended for debugging)**

Terminal 1 - Backend:
```bash
cd /Users/chesterposey/zerorot
npm run dev:server
```

Terminal 2 - Frontend:
```bash
cd /Users/chesterposey/zerorot/client
npm run dev
```

### 5. Access the App

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/api/health

## Testing Without Full Setup

You can test the app with minimal configuration:

1. **Skip database** (for now): Comment out database operations
2. **Use mock data**: The Instagram scraper falls back to mock data
3. **Skip email**: Test without sending emails

The app will work with just:
- Frontend dependencies installed
- Backend dependencies installed (✅ done)
- Basic `.env` file (✅ created)

## Troubleshooting

**Frontend won't install:**
- Check internet connection
- Try: `npm cache clean --force` then `npm install`
- Try: `npm install --legacy-peer-deps`

**Database errors:**
- Ensure PostgreSQL is running: `brew services start postgresql`
- Or use a cloud database service

**Port already in use:**
- Change `PORT` in `.env` to a different number
- Update `FRONTEND_URL` accordingly

## Next Steps After Setup

1. Sign up for an account at http://localhost:3000
2. Set your content preferences (e.g., "French cooking", "cyberpunk fashion")
3. Click "Discover Content" to test content discovery
4. Click "Send Test Newsletter" to receive an email

The daily newsletter will automatically send at 8:00 AM to all users with preferences set!
