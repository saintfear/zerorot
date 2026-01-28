# How to Commit ZeroRot to Git

## Step 1: Initialize Git Repository

Open Terminal and run:

```bash
cd /Users/chesterposey/zerorot
git init
```

## Step 2: Check What Will Be Committed

```bash
git status
```

This shows all files. Make sure `.env` is NOT listed (it should be ignored).

## Step 3: Add Files

```bash
# Add all files (respects .gitignore)
git add .
```

## Step 4: Create Initial Commit

```bash
git commit -m "Initial commit: ZeroRot - AI-powered Instagram content discovery and newsletter service"
```

Or a shorter message:

```bash
git commit -m "Initial commit: ZeroRot app"
```

## Step 5: (Optional) Add Remote Repository

If you want to push to GitHub/GitLab:

```bash
# Create repository on GitHub first, then:
git remote add origin https://github.com/yourusername/zerorot.git
git branch -M main
git push -u origin main
```

## Important: Files That Are Ignored

The `.gitignore` file ensures these are NOT committed:
- ✅ `.env` - Your API keys and secrets (NEVER commit this!)
- ✅ `node_modules/` - Dependencies
- ✅ `*.db` - Database files
- ✅ `temp/` - Temporary files
- ✅ `.cursor/` - Cursor IDE files

## Verify Before Committing

Check that sensitive files are NOT being committed:

```bash
git status
```

You should NOT see:
- ❌ `.env`
- ❌ `node_modules/`
- ❌ `prisma/dev.db`
- ❌ Any files with API keys

## If You See .env in git status

If `.env` shows up, it means it was already tracked. Remove it:

```bash
git rm --cached .env
git commit -m "Remove .env from tracking"
```

## Commit Message Examples

```bash
# Initial commit
git commit -m "Initial commit: ZeroRot - AI-powered Instagram content discovery"

# Feature commit
git commit -m "Add Instagram scraping with gallery-dl integration"

# Bug fix
git commit -m "Fix DNS error handling in Instagram scraper"

# Update
git commit -m "Update theme to antique typewriter style"
```

## Quick Commands Summary

```bash
cd /Users/chesterposey/zerorot
git init
git add .
git commit -m "Initial commit: ZeroRot"
```

That's it! Your code is now committed to git.
