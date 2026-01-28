# Troubleshooting "Something went wrong" on Sign In

## Common Issues

### 1. Backend Server Not Running

The most common cause is that the backend server isn't running.

**Check if server is running:**
```bash
curl http://127.0.0.1:3002/api/health
```

**Start the backend server:**
```bash
cd /Users/chesterposey/zerorot
node server/index.js
```

You should see:
```
🚀 ZeroRot server running on http://127.0.0.1:3002
📧 Newsletter scheduler initialized
```

### 2. Port Mismatch

The frontend is configured to connect to port 3002. Make sure:
- Backend is running on port 3002 (check `.env` file: `PORT=3002`)
- Frontend API URL is set correctly (already fixed in `lib/api.ts`)

### 3. CORS Issues

If you see CORS errors in the browser console, check:
- Backend `.env` has: `FRONTEND_URL="http://localhost:3000"`
- Frontend is running on port 3000

### 4. Database Issues

If the server starts but login fails:
```bash
cd /Users/chesterposey/zerorot
npx prisma generate
```

### 5. Check Browser Console

Open browser DevTools (F12) and check:
- Network tab: See if the request is being made
- Console tab: Look for error messages
- Check the actual error response from the API

## Quick Fix Steps

1. **Start backend:**
   ```bash
   cd /Users/chesterposey/zerorot
   node server/index.js
   ```

2. **Start frontend (in another terminal):**
   ```bash
   cd /Users/chesterposey/zerorot/client
   npm run dev
   ```

3. **Test the API:**
   ```bash
   curl http://127.0.0.1:3002/api/health
   ```

4. **Try signing in again**

If it still doesn't work, check the server console for error messages when you try to sign in.
