# Diagnosing Why Real Instagram Posts Aren't Working

## Current Status Check

Run these commands to see what's happening:

### 1. Check if DNS is Working

```bash
ping -c 2 www.instagram.com
```

**If you see**: `cannot resolve host` → DNS is broken (this is your issue)
**If you see**: Responses with IP addresses → DNS is working

### 2. Check if gallery-dl Can Access Instagram

```bash
python3 -m gallery_dl --dump-json "https://www.instagram.com/explore/tags/art/" 2>&1 | head -5
```

**If you see**: `NameResolutionError` → DNS issue
**If you see**: JSON data → gallery-dl is working!
**If you see**: `LoginRequired` → Need cookies

### 3. Check Server Logs

When you click "Discover Content", look at your server terminal. You should see:

**If DNS is broken:**
```
✅ Using gallery-dl to fetch real Instagram posts...
⚠️ gallery-dl failed: DNS_ERROR: Cannot resolve Instagram
💡 DNS issue detected. Instagram cannot be reached.
📝 Falling back to web scraping or mock data...
📝 Generating mock Instagram posts...
```

**If DNS works but needs cookies:**
```
✅ Using gallery-dl to fetch real Instagram posts...
⚠️ No posts found for "cyberpunk" - Instagram may require login
```

**If everything works:**
```
✅ Using gallery-dl to fetch real Instagram posts...
📥 Fetching posts for hashtag "cyberpunk" using gallery-dl...
✅ Successfully fetched 10 posts for "cyberpunk"
✅ Found 10 real Instagram posts via gallery-dl!
```

## The Root Problem

Based on tests, your system **cannot resolve Instagram's domain name**. This is a DNS configuration issue.

## Why This Happens

- Brave browser uses its own DNS (Secure DNS) → Works
- System DNS (used by gallery-dl) → Broken
- Command-line tools need system DNS → Don't work

## Solutions

### Solution 1: Fix System DNS (Recommended)

```bash
# Set Google DNS
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4

# Flush cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Test
ping -c 2 www.instagram.com
```

### Solution 2: Use System Settings (GUI)

1. System Settings → Network
2. Select Wi-Fi → Details → DNS
3. Remove existing DNS servers
4. Add: `8.8.8.8` and `8.8.4.4`
5. Click OK and Apply

### Solution 3: Check Network Restrictions

If you're on:
- Corporate network → May block Instagram
- School network → May block Instagram  
- VPN → May need different DNS
- Firewall → May block Instagram

Try a different network (mobile hotspot) to test.

## After Fixing DNS

1. **Verify DNS works**:
   ```bash
   ping -c 2 www.instagram.com
   ```

2. **Restart ZeroRot server**

3. **Try "Discover Content"**

4. **Check server logs** - should see real posts being fetched

## If DNS Still Doesn't Work

The issue might be:
- Network-level blocking (firewall, corporate policy)
- VPN interfering
- System-level restrictions

In that case, you'd need to:
- Use a different network
- Configure VPN differently
- Contact network administrator

## Current Workaround

ZeroRot is using **mock data** which:
- ✅ Works perfectly
- ✅ Based on your preferences  
- ✅ Lets you test all features
- ❌ Not real Instagram posts

You can continue using ZeroRot with mock data until DNS/network issues are resolved.

## What to Check

1. **Run the diagnostic commands above**
2. **Check your server logs** when clicking "Discover Content"
3. **Share the error messages** you see
4. **Try fixing DNS** using the commands above

Let me know what the diagnostic commands show and I can help further!
