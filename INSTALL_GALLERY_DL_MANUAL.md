# Installing gallery-dl - Manual Options

## Network Issue

Your system can't reach PyPI (Python package repository) right now. Here are your options:

## Option 1: Wait for Network Connection

Once your internet connection is stable, run:
```bash
pip3 install gallery-dl
```

## Option 2: Download and Install Manually

1. **Download gallery-dl from GitHub**:
   - Visit: https://github.com/mikf/gallery-dl/releases
   - Download the latest release (`.tar.gz` file)

2. **Extract and install**:
   ```bash
   tar -xzf gallery-dl-*.tar.gz
   cd gallery-dl-*
   python3 setup.py install --user
   ```

## Option 3: Use Alternative Network/DNS

If you're behind a firewall or have DNS issues:

1. **Try using a different DNS**:
   ```bash
   # Use Google DNS temporarily
   sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4
   pip3 install gallery-dl
   ```

2. **Or use a VPN/proxy** if available

## Option 4: Install on Another Machine

1. Install gallery-dl on a machine with internet
2. Copy the installed files to this machine
3. Add to PATH

## Option 5: Use ZeroRot Without gallery-dl (Current State)

ZeroRot will work fine without gallery-dl:
- It will use mock data based on your preferences
- All other features work normally
- You can add gallery-dl later when network is available

## Check Installation Later

Once you have network access, verify installation:
```bash
gallery-dl --version
```

## After Installing

1. Restart your ZeroRot backend server
2. The app will automatically detect gallery-dl
3. You'll see real Instagram posts instead of mock data

## Current Status

ZeroRot is fully functional right now with mock data. gallery-dl is optional - it just makes the posts more realistic. You can continue using the app and add gallery-dl later when your network connection is stable.
