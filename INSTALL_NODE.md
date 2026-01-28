# Installing Node.js for ZeroRot

You need Node.js (which includes npm) to run ZeroRot. Here are the easiest ways to install it on macOS:

## Option 1: Install Homebrew + Node.js (Recommended)

### Step 1: Install Homebrew
Run this command in your terminal:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the prompts. This may take a few minutes.

### Step 2: Install Node.js
After Homebrew is installed, run:
```bash
brew install node
```

### Step 3: Verify Installation
```bash
node --version
npm --version
```

You should see version numbers for both.

## Option 2: Direct Download (No Homebrew)

1. Visit https://nodejs.org/
2. Download the LTS (Long Term Support) version for macOS
3. Run the installer
4. Follow the installation wizard
5. Restart your terminal

Then verify:
```bash
node --version
npm --version
```

## Option 3: Using nvm (Node Version Manager)

If you want to manage multiple Node.js versions:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or run:
source ~/.zshrc

# Install latest LTS Node.js
nvm install --lts
nvm use --lts
```

## After Installation

Once Node.js is installed, you can proceed with ZeroRot setup:

```bash
cd /Users/chesterposey/zerorot
npm install
cd client && npm install && cd ..
```

Then follow the setup instructions in SETUP.md
