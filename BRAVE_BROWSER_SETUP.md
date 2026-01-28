# Using Brave Browser with ZeroRot

## Why System DNS Matters

Brave browser uses its own DNS (Secure DNS), which is why Instagram works in your browser but not for gallery-dl. Command-line tools like gallery-dl use your **system DNS**, which isn't working.

## Solution: Fix System DNS

Even though Brave works, you need to fix system DNS for gallery-dl to work:

### Quick Fix:

```bash
# Set Google DNS for your system
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4

# Flush DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

### Verify It Works:

```bash
# Should now work
ping -c 2 www.instagram.com
```

## Using Brave Cookies for Instagram

Brave can export cookies for Instagram authentication. Here's how:

### Step 1: Install Cookie Exporter Extension

1. Open Brave browser
2. Go to: `brave://extensions/`
3. Search for "Get cookies.txt LOCALLY" or "Cookie-Editor"
4. Install the extension

### Step 2: Export Instagram Cookies

1. **Login to Instagram** in Brave: https://www.instagram.com
2. **Open the cookie extension**
3. **Export cookies** for `instagram.com`
4. **Save as**: `~/.config/gallery-dl/cookies.txt`

### Step 3: ZeroRot Will Auto-Use Cookies

I've already updated the code to automatically use cookies if they exist at:
```
~/.config/gallery-dl/cookies.txt
```

No code changes needed - just export and save!

## Alternative: Manual Cookie Export

If you prefer manual method:

1. Login to Instagram in Brave
2. Open Developer Tools (F12)
3. Go to Application/Storage → Cookies
4. Copy relevant cookies
5. Create `~/.config/gallery-dl/cookies.txt` in Netscape format

## What ZeroRot Needs

1. ✅ **gallery-dl installed** - DONE
2. ❌ **System DNS working** - Need to fix (see above)
3. ⚠️ **Instagram cookies** (optional) - Helps with authentication

## After Setup

Once both are done:
1. Restart ZeroRot backend server
2. Try "Discover Content"
3. Should see real Instagram posts!

## Current Status

- ✅ Brave browser works (uses its own DNS)
- ✅ gallery-dl installed
- ❌ System DNS broken (affects gallery-dl)
- ⚠️ Cookies not set up yet (optional but recommended)

Fix system DNS first, then optionally set up cookies for better Instagram access!
