# Setting Up Email for Newsletters

## Quick Setup (Optional)

Email is **optional** - newsletters will still be created and saved even without email configured. You can view them in the dashboard.

## If You Want to Send Emails:

### For Gmail:

1. **Enable 2-Factor Authentication** on your Google account
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Click "Generate"
   - Copy the 16-character password

3. **Update `.env` file**:
   ```env
   EMAIL_USER="your-email@gmail.com"
   EMAIL_PASS="xxxx xxxx xxxx xxxx"  # The app password (remove spaces)
   ```

### For Other Email Providers:

Update these in `.env`:
```env
EMAIL_HOST="smtp.your-provider.com"
EMAIL_PORT=587  # or 465 for SSL
EMAIL_USER="your-email@domain.com"
EMAIL_PASS="your-password"
```

Common providers:
- **Outlook/Hotmail**: `smtp-mail.outlook.com`, port 587
- **Yahoo**: `smtp.mail.yahoo.com`, port 587
- **Custom SMTP**: Check your provider's documentation

## Testing

After configuring email, restart your server and try "Send Test Newsletter" again.

## Without Email

If you don't configure email:
- ✅ Newsletters are still created and saved
- ✅ You can view them in the dashboard
- ❌ Emails won't be sent
- ℹ️ The app will log: "Email not configured - newsletter saved but not sent"

## Troubleshooting

**"Email authentication failed"**:
- Make sure you're using an App Password (Gmail), not your regular password
- Check that EMAIL_USER and EMAIL_PASS are correct

**"Could not connect to email server"**:
- Check EMAIL_HOST and EMAIL_PORT
- Make sure your firewall isn't blocking the connection

**Check server logs** for detailed error messages when sending fails.
