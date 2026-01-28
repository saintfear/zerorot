# Connect Instagram for Real Posts

ZeroRot uses **gallery-dl** to fetch real Instagram posts. When you're not logged in, Instagram often returns little or no content. By connecting your Instagram session (via cookies), ZeroRot can fetch real posts for Discover and newsletters.

## How It Works

1. You log into [instagram.com](https://www.instagram.com) in your browser (Chrome, Brave, Firefox, etc.).
2. You export your cookies in **Netscape format** (a `cookies.txt` file).
3. You paste that content into the **Connect Instagram** section on your ZeroRot dashboard.
4. ZeroRot stores it securely and uses it only when running Discover or sending your newsletter.

Your cookies are stored in the app database and never sent to the frontend. Only a “connected / not connected” flag is shown in the UI.

## How to Export Cookies (step-by-step)

### Chrome or Brave: “Get cookies.txt LOCALLY”

1. **Install the extension**
   - Open: [Get cookies.txt LOCALLY – Chrome Web Store](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)  
     (same link works in Brave: Brave Web Store or paste the URL).
   - Click **“Add to Chrome”** (or **“Add to Brave”**), then confirm.

2. **Open Instagram and stay on it**
   - Go to [https://www.instagram.com](https://www.instagram.com).
   - Log in if needed. Stay on the Instagram tab.

3. **Export cookies for Instagram**
   - Click the **extension icon** (puzzle piece → “Get cookies.txt LOCALLY”, or the cookie icon in the toolbar).
   - In the popup:
     - **Format:** choose **“Netscape”** (or “cookies.txt” if that’s the only option).
     - **Scope:** choose **“Current host”** or **“Current site”** so you only export instagram.com cookies.
   - Click **Export** or **Download**. A file like `www.instagram.com_cookies.txt` will download.

4. **Paste into ZeroRot**
   - Open that file in a text editor (TextEdit, Notepad, VS Code, etc.).
   - Select **all** (Cmd+A / Ctrl+A), copy (Cmd+C / Ctrl+C).
   - In the ZeroRot dashboard, go to **Connect Instagram**, paste into the big text box, and click **Save Instagram session**.

The file should start with a line like `# Netscape HTTP Cookie File` and then lines with domain, path, and cookie values. That’s the Netscape format ZeroRot (and gallery-dl) need.

### Firefox

1. Install [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/) from the Firefox Add-ons site.
2. Go to [instagram.com](https://www.instagram.com) and log in.
3. Click the extension icon and export cookies for the current site. Save or open the file.
4. Copy the entire file contents and paste into **Connect Instagram** in the ZeroRot dashboard, then **Save Instagram session**.

### Option B: gallery-dl config (advanced)

If you already use gallery-dl and have a `cookies.txt` at  
`~/.config/gallery-dl/cookies.txt`,  
ZeroRot’s backend will use that when no per-user cookies are set. For per-user, use the dashboard so your account is used for your discoveries and newsletters.

## Requirements

- **gallery-dl** must be installed (`pip install gallery-dl` or `brew install gallery-dl`).
- Your system must be able to reach Instagram (DNS and network). If you see “Failed to resolve” errors, fix system DNS (e.g. use 8.8.8.8 / 8.8.4.4) or see `FIX_INSTAGRAM_ACCESS.md`.

## Database Change

The `User` model now has an `instagramCookies` field. If you haven’t applied it yet, run:

```bash
cd /Users/chesterposey/zerorot && npx prisma db push
```

Then restart the backend.
