# gallery-dl Installation Status

## Current Status

Based on system checks:
- ❌ gallery-dl is **not installed** via pip3
- ❌ gallery-dl command **not found** in PATH
- ❌ gallery-dl **not found** in common installation locations

## What This Means

ZeroRot is currently using **mock data** for Instagram posts. This is fine for development and testing, but you won't get real Instagram posts until gallery-dl is properly installed.

## To Get Real Instagram Posts

### Step 1: Install gallery-dl

**When your network connection is working**, run:

```bash
pip3 install --user gallery-dl
```

This installs gallery-dl to `~/.local/bin/gallery-dl`

### Step 2: Add to PATH

```bash
# Add to your shell config
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Step 3: Verify

```bash
gallery-dl --version
```

Should show a version number like `1.27.x`

### Step 4: Restart ZeroRot Server

After installing and adding to PATH:
1. Restart your terminal (or run `source ~/.zshrc`)
2. Restart your ZeroRot backend server
3. Check server logs - should see: "✅ Found gallery-dl at: ..."
4. Try "Discover Content" - should get real posts!

## Check Server Logs

When you start the server, look for these messages:

**If gallery-dl is found:**
```
🔍 Searching for gallery-dl...
✅ Found gallery-dl at: gallery-dl
✅ gallery-dl is installed and ready to use
```

**If gallery-dl is NOT found:**
```
🔍 Searching for gallery-dl...
⚠️ gallery-dl not found in common locations
⚠️ gallery-dl not found. Tried: gallery-dl
   Install with: pip3 install gallery-dl
```

## Current Behavior

Right now, ZeroRot will:
1. Try to find gallery-dl → Not found
2. Try puppeteer scraping → Usually fails (blocked by Instagram)
3. Use mock data → ✅ Works! (but not real posts)

## Mock Data is Fine For Now

The mock data:
- ✅ Works perfectly for testing
- ✅ Based on your preferences
- ✅ Lets you test all features
- ❌ Not real Instagram posts

You can continue using ZeroRot with mock data and install gallery-dl later when your network is stable!
