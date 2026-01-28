# Installing gallery-dl (Simple Guide)

## Check if Python is Installed

First, check if you have Python:

```bash
python3 --version
```

Or:
```bash
python --version
```

## Install gallery-dl

### If you have Python 3:

```bash
pip3 install gallery-dl
```

If that doesn't work, try:
```bash
python3 -m pip install gallery-dl
```

### If you have Python 2 (older):

```bash
pip install gallery-dl
```

### If you get "permission denied":

Install for your user only (recommended):
```bash
pip3 install --user gallery-dl
```

Or use sudo (not recommended):
```bash
sudo pip3 install gallery-dl
```

## Verify Installation

After installing, check if it works:

```bash
gallery-dl --version
```

You should see a version number like `1.27.x`.

## If gallery-dl Command Not Found

If `gallery-dl --version` says "command not found" after installing:

1. **Find where it was installed:**
   ```bash
   python3 -m pip show gallery-dl
   ```
   Look for "Location" - it will show where packages are installed.

2. **Add to PATH** (if needed):
   ```bash
   # Usually it's in ~/.local/bin
   export PATH="$HOME/.local/bin:$PATH"
   
   # Add to ~/.zshrc to make it permanent:
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

## Test It

Try downloading a post to test:

```bash
gallery-dl --dump-json "https://www.instagram.com/explore/tags/cyberpunk/" | head -1
```

This should output JSON metadata for a post.

## Alternative: Install Homebrew First

If you want to use Homebrew (optional):

1. Install Homebrew:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Then install gallery-dl:
   ```bash
   brew install gallery-dl
   ```

But using pip is simpler if you already have Python!

## After Installation

1. Restart your ZeroRot backend server
2. Try "Discover Content" in the dashboard
3. Check server logs - you should see: "✅ gallery-dl is installed and ready to use"
