# How to Start ZeroRot Server

## The Issue

There are permission errors when trying to bind to certain ports. This is a macOS security feature.

## Solution: Run Manually

**Open a terminal and run:**

```bash
cd /Users/chesterposey/zerorot
node server/index.js
```

The server is configured to run on **port 4000**.

You should see:
```
🚀 ZeroRot server running on http://localhost:4000
📧 Newsletter scheduler initialized
```

## If You Get Permission Errors

Try a different port by editing `.env`:
```
PORT=5000
```

Then update `client/lib/api.ts`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
```

## Current Configuration

- **Backend Port**: 4000 (in `.env`)
- **Frontend Port**: 3000 (default Next.js)
- **API URL**: http://localhost:4000/api

## Test the Server

Once running, test with:
```bash
curl http://localhost:4000/api/health
```

Should return: `{"status":"ok","message":"ZeroRot API is running"}`

## Start Both Servers

**Terminal 1 - Backend:**
```bash
cd /Users/chesterposey/zerorot
node server/index.js
```

**Terminal 2 - Frontend:**
```bash
cd /Users/chesterposey/zerorot/client
npm run dev
```

Then visit: http://localhost:3000
