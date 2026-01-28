# Troubleshooting gallery-dl Not Found

## Issue: gallery-dl is installed but ZeroRot can't find it

This usually happens when gallery-dl is installed but not in your PATH.

## Quick Fix: Add to PATH

### Option 1: Find where gallery-dl was installed

```bash
# Check common locations
ls -la ~/.local/bin/gallery-dl
ls -la ~/Library/Python/*/bin/gallery-dl

# Or find it
find ~ -name "gallery-dl" -type f 2>/dev/null
```

### Option 2: Add to PATH

Once you find the location (e.g., `~/.local/bin/gallery-dl`), add it to PATH:

```bash
# Add to ~/.zshrc
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Or if it's in a different location:
echo 'export PATH="$HOME/Library/Python/3.9/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Option 3: Reinstall gallery-dl

```bash
# Uninstall first
pip3 uninstall gallery-dl

# Reinstall with --user flag (installs to ~/.local/bin)
pip3 install --user gallery-dl

# Add to PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify
gallery-dl --version
```

## Verify Installation

After adding to PATH, verify:

```bash
which gallery-dl
gallery-dl --version
```

You should see a version number.

## Test gallery-dl Works

```bash
gallery-dl --dump-json "https://www.instagram.com/explore/tags/test/" | head -1
```

This should output JSON for a post.

## After Fixing PATH

1. **Restart your terminal** (or run `source ~/.zshrc`)
2. **Restart your ZeroRot backend server**
3. **Check server logs** - you should see: "✅ Found gallery-dl at: ..."
4. **Try "Discover Content"** - should now get real posts!

## Alternative: Use Python Module

If gallery-dl is installed but the command isn't found, you can use it as a Python module:

```bash
python3 -m gallery_dl --version
```

If this works, the code will automatically detect and use it.

## Check Server Logs

When you start the server, look for:
- `✅ gallery-dl is installed and ready to use` - Success!
- `⚠️ gallery-dl not found` - Need to fix PATH
- `✅ Found gallery-dl at: ...` - Shows where it was found

## Still Not Working?

1. Check if gallery-dl is actually installed:
   ```bash
   pip3 list | grep gallery
   ```

2. Try reinstalling:
   ```bash
   pip3 install --user --upgrade gallery-dl
   ```

3. Check your Python version:
   ```bash
   python3 --version
   ```

4. Make sure you're using the same Python that has gallery-dl installed
