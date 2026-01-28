# Network Troubleshooting for ZeroRot Setup

## Current Issue
Your system cannot reach the npm registry (`registry.npmjs.org`). This prevents installing dependencies.

## Possible Causes & Solutions

### 1. Check Internet Connection
```bash
# Test basic connectivity
ping -c 3 google.com
curl -I https://www.google.com
```

If these fail, you may not have internet access.

### 2. DNS Issues
If ping to google.com works but npm registry doesn't, it's likely a DNS problem.

**Try using a different DNS:**
```bash
# Use Google DNS
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4

# Or Cloudflare DNS
sudo networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1
```

Then try again:
```bash
npm install
```

### 3. Proxy/Firewall
If you're behind a corporate firewall or proxy:

**Set npm proxy:**
```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

**Or use environment variables:**
```bash
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
npm install
```

### 4. Use Alternative Registry (Temporary)
Try using a different npm registry mirror:

```bash
# Use Taobao mirror (China)
npm config set registry https://registry.npmmirror.com

# Or use Yarn's registry
npm config set registry https://registry.yarnpkg.com

# Then install
npm install

# Reset to default after
npm config set registry https://registry.npmjs.org
```

### 5. Manual Package Installation
If network issues persist, you could:
1. Download packages on a machine with internet
2. Copy `node_modules` folder
3. Or use `npm pack` to create tarballs

### 6. Check Network Settings
```bash
# Check DNS servers
scutil --dns | grep nameserver

# Check network interfaces
ifconfig

# Flush DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

## Alternative: Use Yarn Instead
If npm continues to have issues, try Yarn:

```bash
# Install Yarn (if you can reach the internet)
npm install -g yarn

# Or download from: https://yarnpkg.com/getting-started/install

# Then use Yarn instead
yarn install
cd client && yarn install
```

## Once Network is Fixed

After resolving network issues, run:

```bash
cd /Users/chesterposey/zerorot
npm install
cd client && npm install && cd ..
```

Then continue with setup as described in `SETUP.md`.
