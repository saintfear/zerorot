# Quick Start - Installing Node.js

## Current Issue
Node.js is not installed on your system. You need it to run ZeroRot.

## Installation Options

### Option 1: Direct Download (Easiest - No Terminal Required)

1. **Visit**: https://nodejs.org/
2. **Download**: Click the green "LTS" button (recommended version)
3. **Install**: Open the downloaded `.pkg` file and follow the installer
4. **Restart**: Close and reopen your terminal
5. **Verify**: Run `node --version` and `npm --version`

### Option 2: Using Homebrew (If you have internet access)

If the network connection works, you can install Homebrew first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install Node.js:
```bash
brew install node
```

### Option 3: Check if Node.js is already installed elsewhere

Sometimes Node.js might be installed but not in your PATH. Try:

```bash
# Check common locations
ls /usr/local/bin/node
ls /opt/homebrew/bin/node
ls ~/.nvm/versions/node/*/bin/node

# If found, add to PATH in ~/.zshrc:
export PATH="/path/to/node/bin:$PATH"
```

## After Installing Node.js

Once Node.js is installed, continue with ZeroRot setup:

```bash
# Navigate to project
cd /Users/chesterposey/zerorot

# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Set up database (requires PostgreSQL)
npx prisma migrate dev
npx prisma generate

# Run the app
npm run dev:server  # In one terminal
cd client && npm run dev  # In another terminal
```

## Troubleshooting

**"command not found: npm" after installation:**
- Restart your terminal
- Check PATH: `echo $PATH`
- Verify installation: `which node` and `which npm`

**Network issues:**
- Use Option 1 (direct download) instead
- Check your internet connection
- Try using a VPN if GitHub is blocked
