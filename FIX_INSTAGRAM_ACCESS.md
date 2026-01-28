# Fixing Instagram Access for ZeroRot

## Current Issue

Your system **cannot resolve Instagram's domain name** (`www.instagram.com`). This is a DNS (Domain Name System) issue, not an internet connectivity issue.

## Quick Fix: Change DNS Settings

### Option 1: Use Google DNS (Recommended)

```bash
# Set DNS for Wi-Fi
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4

# Or for Ethernet
sudo networksetup -setdnsservers Ethernet 8.8.8.8 8.8.4.4
```

### Option 2: Use Cloudflare DNS

```bash
sudo networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1
```

### Option 3: Reset to Automatic DNS

```bash
sudo networksetup -setdnsservers Wi-Fi "Empty"
```

## Verify DNS is Working

After changing DNS, test:

```bash
# Should return Instagram's IP address
nslookup www.instagram.com

# Or test with ping
ping -c 2 www.instagram.com
```

## Instagram Authentication Requirements

Even after fixing DNS, Instagram **requires authentication** to access most content:

### Method 1: Export Browser Cookies (Recommended)

1. **Install a cookie exporter extension**:
   - Firefox: "Export Cookies" addon
   - Chrome: "Get cookies.txt" extension

2. **Login to Instagram in your browser**

3. **Export cookies**:
   - Go to Instagram.com
   - Use the extension to export cookies
   - Save as `cookies.txt` in your home directory

4. **Configure gallery-dl to use cookies**:
   - Create config file: `~/.config/gallery-dl/config.json`
   - Or use `--cookies` flag when running

### Method 2: Configure gallery-dl Config File

Create `~/.config/gallery-dl/config.json`:

```json
{
  "extractor": {
    "instagram": {
      "cookies": "/path/to/cookies.txt"
    }
  }
}
```

### Method 3: Use gallery-dl with Cookies Flag

Update the scraper to use cookies (I can do this for you).

## Test After DNS Fix

Once DNS is fixed, test gallery-dl:

```bash
python3 -m gallery_dl --dump-json "https://www.instagram.com/explore/tags/art/" | head -5
```

If it works, you should see JSON data, not DNS errors.

## What ZeroRot Needs

1. ✅ **gallery-dl installed** - DONE
2. ❌ **DNS working** - Need to fix
3. ⚠️ **Instagram cookies** - May be needed for some content

## Next Steps

1. **Fix DNS** (commands above)
2. **Test Instagram access** (curl or ping)
3. **If still blocked, set up cookies** (for authentication)
4. **Restart ZeroRot server**
5. **Try "Discover Content"**

Let me know once DNS is fixed and I can help set up Instagram authentication if needed!
