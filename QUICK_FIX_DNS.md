# Quick Fix: Access Instagram

## The Problem

Your system **cannot resolve Instagram's domain name**. This is a DNS issue.

## Quick Fix (2 minutes)

### Step 1: Change DNS Settings

Open Terminal and run:

```bash
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4
```

(Enter your password when prompted)

### Step 2: Test It Works

```bash
ping -c 2 www.instagram.com
```

You should see responses, not "cannot resolve host".

### Step 3: Restart ZeroRot Server

After DNS is fixed:
1. Restart your backend server
2. Try "Discover Content" in the dashboard
3. Check server logs - should see real posts!

## If Instagram Still Requires Login

Even with DNS fixed, Instagram may require authentication for some content. You can:

1. **Export cookies from your browser** (after logging into Instagram)
2. **Save to**: `~/.config/gallery-dl/cookies.txt`
3. **ZeroRot will automatically use them**

I've already updated the code to automatically use cookies if they exist!

## What's Already Done

✅ gallery-dl installed and detected
✅ Code updated to use gallery-dl
✅ Cookie support added (automatic if cookies file exists)
❌ DNS needs to be fixed (your step)

## After DNS Fix

Once DNS is working:
- ZeroRot will automatically use gallery-dl
- You'll get real Instagram posts
- No code changes needed!

Try the DNS fix above and let me know if it works!
