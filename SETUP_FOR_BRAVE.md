# Complete Setup Guide for Brave Browser Users

## The Issue

Brave browser works because it uses **Secure DNS** (its own DNS). But command-line tools like gallery-dl use your **system DNS**, which isn't working. That's why Instagram works in Brave but not for ZeroRot.

## Step 1: Fix System DNS (Required)

Your system DNS needs to work for gallery-dl to access Instagram:

```bash
# Set Google DNS
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4

# Flush DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Test it works
ping -c 2 www.instagram.com
```

You should see responses, not "cannot resolve host".

## Step 2: Export Instagram Cookies from Brave (Recommended)

Cookies help gallery-dl access Instagram content that requires login.

### Quick Method:

1. **Install Cookie Extension in Brave**:
   - Go to: `brave://extensions/`
   - Search for: **"Get cookies.txt LOCALLY"** or **"Cookie-Editor"**
   - Install it

2. **Login to Instagram**:
   - Open https://www.instagram.com in Brave
   - Make sure you're logged in

3. **Export Cookies**:
   - Click the cookie extension icon
   - Export cookies for `instagram.com`
   - Save as **Netscape format** (cookies.txt)
   - Save to: `~/cookies.txt` (your home directory)

4. **Move to Right Location**:
   ```bash
   mkdir -p ~/.config/gallery-dl
   mv ~/cookies.txt ~/.config/gallery-dl/cookies.txt
   ```

   Or if that doesn't work due to permissions:
   ```bash
   # Save directly to home directory
   # ZeroRot will find it there too
   ```

## Step 3: Restart ZeroRot Server

After fixing DNS (and optionally adding cookies):

```bash
# Stop your current server (Ctrl+C)
# Then restart:
cd /Users/chesterposey/zerorot
node server/index.js
```

## Step 4: Test It

1. Go to ZeroRot dashboard
2. Click "Discover Content"
3. Check server logs - should see:
   ```
   ✅ Found gallery-dl at: python3 -m gallery_dl
   📥 Fetching posts for hashtag "cyberpunk" using gallery-dl...
   ✅ Successfully fetched X posts for "cyberpunk"
   ```
4. You should see real Instagram posts!

## What's Already Done

✅ gallery-dl installed and detected
✅ Code updated to use gallery-dl automatically
✅ Cookie support added (auto-detects if cookies exist)
✅ Multiple cookie file locations checked
❌ System DNS needs fixing (your step)
⚠️ Cookies optional but recommended

## Troubleshooting

**Still getting DNS errors?**
- Try: `sudo networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1` (Cloudflare DNS)
- Or check System Settings → Network → DNS manually

**Cookies not working?**
- Make sure you're logged into Instagram in Brave first
- Check file exists: `ls -la ~/.config/gallery-dl/cookies.txt`
- Or try saving to `~/cookies.txt` instead

**Still no posts?**
- Check server logs for error messages
- Instagram may require login for hashtag searches
- Try exporting cookies again (they expire)

## Summary

1. **Fix system DNS** (required) - 2 minutes
2. **Export cookies from Brave** (optional but recommended) - 5 minutes
3. **Restart server** - 30 seconds
4. **Get real Instagram posts!** 🎉

The code is ready - just needs DNS fixed and optionally cookies!
