# Installing gallery-dl for Instagram Scraping

## What is gallery-dl?

gallery-dl is a powerful command-line tool that can download images and videos from Instagram and many other sites. It's more reliable than web scraping because it handles Instagram's authentication and rate limiting better.

## Installation

### Option 1: Using pip (Python package manager)

```bash
pip install gallery-dl
```

Or if you need to use pip3:
```bash
pip3 install gallery-dl
```

### Option 2: Using Homebrew (macOS)

```bash
brew install gallery-dl
```

### Option 3: Using pipx (recommended for isolated install)

```bash
pipx install gallery-dl
```

## Verify Installation

After installing, verify it works:

```bash
gallery-dl --version
```

You should see a version number like `1.27.x`.

## Test It

Try downloading a post to test:

```bash
gallery-dl --dump-json "https://www.instagram.com/explore/tags/cyberpunk/" | head -1
```

This should output JSON metadata for a post.

## How ZeroRot Uses It

Once installed, ZeroRot will automatically:
1. Detect gallery-dl is installed
2. Use it to fetch real Instagram posts
3. Fall back to mock data if gallery-dl fails

## Troubleshooting

**"gallery-dl: command not found"**
- Make sure it's in your PATH
- Try: `which gallery-dl` to find it
- On macOS with Homebrew, it should be at `/opt/homebrew/bin/gallery-dl` or `/usr/local/bin/gallery-dl`

**Permission errors**
- You might need to install with `sudo pip install gallery-dl` (not recommended)
- Better: use `pip install --user gallery-dl` or `pipx install gallery-dl`

**Instagram login required**
- Some Instagram content requires login
- gallery-dl can use cookies for authentication (advanced)
- For public hashtags, login usually isn't needed

## After Installation

1. Restart your ZeroRot backend server
2. Try "Discover Content" in the dashboard
3. Check server logs - you should see: "✅ gallery-dl is installed and ready to use"
4. You should now get real Instagram posts!

## Rate Limiting

gallery-dl respects Instagram's rate limits better than web scraping, but:
- Don't make too many requests too quickly
- Instagram may still rate limit if you're too aggressive
- The app limits to 3 topics, 2 keywords max to stay safe
