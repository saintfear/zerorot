# Exporting Instagram Cookies from Brave Browser

## Quick Method: Using Extension

### Step 1: Install Cookie Exporter

1. Open Brave
2. Go to: `brave://extensions/`
3. Click "Open Chrome Web Store" (or search for extensions)
4. Search for: **"Get cookies.txt LOCALLY"** or **"Cookie-Editor"**
5. Install the extension

### Step 2: Export Cookies

1. **Login to Instagram** in Brave: https://www.instagram.com
2. **Click the cookie extension icon** in your toolbar
3. **Select "Export"** or "Save as cookies.txt"
4. **Choose format**: Netscape cookies.txt format
5. **Save to**: `~/.config/gallery-dl/cookies.txt`

   Or save to Desktop, then move it:
   ```bash
   mv ~/Desktop/cookies.txt ~/.config/gallery-dl/cookies.txt
   ```

### Step 3: Verify

```bash
# Check if file exists
ls -la ~/.config/gallery-dl/cookies.txt

# Should show the file with cookies
```

## Alternative: Manual Export

If extensions don't work:

1. Login to Instagram in Brave
2. Press `F12` (or Cmd+Option+I on Mac)
3. Go to **Application** tab (or **Storage**)
4. Click **Cookies** → `https://www.instagram.com`
5. Copy the important cookies:
   - `sessionid`
   - `csrftoken`
   - `ds_user_id`
6. Create `~/.config/gallery-dl/cookies.txt` in this format:

```
# Netscape HTTP Cookie File
.instagram.com	TRUE	/	TRUE	0	sessionid	YOUR_SESSION_ID_HERE
.instagram.com	TRUE	/	TRUE	0	csrftoken	YOUR_CSRF_TOKEN_HERE
```

## What ZeroRot Does

Once cookies are saved to `~/.config/gallery-dl/cookies.txt`:
- ✅ ZeroRot automatically detects them
- ✅ Uses them for Instagram authentication
- ✅ Gets better access to Instagram content
- ✅ No code changes needed!

## Test It

After exporting cookies and fixing DNS:

```bash
# Test gallery-dl with cookies
python3 -m gallery_dl --cookies ~/.config/gallery-dl/cookies.txt --dump-json "https://www.instagram.com/explore/tags/art/" | head -5
```

Should return Instagram post data!

## Important Notes

- **Cookies expire**: You'll need to re-export them periodically (usually every few weeks)
- **Keep cookies private**: Don't share your cookies file
- **Login required**: You must be logged into Instagram in Brave first

## After Setup

1. Fix system DNS (see BRAVE_BROWSER_SETUP.md)
2. Export cookies (this guide)
3. Restart ZeroRot server
4. Try "Discover Content" - should work!
