# Setting Up OpenAI API Key

## Step 1: Get Your OpenAI API Key

1. **Go to OpenAI Platform**: https://platform.openai.com/
2. **Sign up or log in** to your account
3. **Navigate to API Keys**: 
   - Click on your profile (top right)
   - Select "API keys" from the menu
   - Or go directly to: https://platform.openai.com/api-keys
4. **Create a new API key**:
   - Click "Create new secret key"
   - Give it a name (e.g., "ZeroRot")
   - Copy the key immediately (you won't be able to see it again!)

## Step 2: Add the Key to Your .env File

1. **Open the `.env` file** in the root of your ZeroRot project:
   ```bash
   cd /Users/chesterposey/zerorot
   # Edit .env file
   ```

2. **Find this line**:
   ```
   OPENAI_API_KEY="your-openai-api-key-here"
   ```

3. **Replace it with your actual key**:
   ```
   OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

   **Important**: Keep the quotes around the key!

## Step 3: Restart the Server

After adding the key, restart your backend server:

```bash
# Stop the current server (Ctrl+C if running)
cd /Users/chesterposey/zerorot
node server/index.js
```

## What the API Key is Used For

The OpenAI API key is used to:
- **Score and rank content** based on how well it matches your preferences
- **Generate personalized newsletter content** with AI-written descriptions
- **Improve content discovery** by understanding context and style

## Cost Information

- OpenAI charges based on usage (per token)
- The app uses `gpt-4o-mini` which is very affordable
- Typical usage: ~$0.01-0.10 per newsletter depending on content volume
- You can set usage limits in your OpenAI account settings

## Testing Without API Key

If you don't have an API key yet, the app will still work but will:
- Use simpler keyword-based scoring (less accurate)
- Generate basic newsletter templates (less personalized)

The app will work, but AI-powered features will be limited.

## Security Note

⚠️ **Never commit your `.env` file to git!** It's already in `.gitignore`, but double-check that your API key stays private.
