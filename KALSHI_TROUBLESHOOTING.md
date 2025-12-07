# Kalshi API Troubleshooting Guide

## Issue: Kalshi Markets Not Showing Up

If you've connected your Kalshi API keys but markets aren't appearing, follow these steps:

## Step 1: Verify API Keys Are Saved

1. Go to: http://localhost:3000/dashboard/settings
2. Check if you see: **"✓ Kalshi API keys are configured"**
3. If not, make sure you:
   - Entered both **Access Key ID** and **Private Key**
   - Clicked **"Save Kalshi API Keys"**
   - Saw a success message

## Step 2: Check Server Logs

1. Open your terminal where `npm run dev` is running
2. Look for log messages like:
   - `[Markets API] Kalshi API keys found, decrypting...`
   - `[Markets API] Kalshi client created successfully`
   - `[MarketAggregator] Fetching Kalshi markets...`
   - `[MarketAggregator] Fetched X Kalshi markets`

3. If you see errors, note them down

## Step 3: Common Issues and Solutions

### Issue: "No API keys found"
**Solution:**
- Make sure you're logged in with the same account that saved the keys
- Go to Settings and re-save your Kalshi API keys
- Check that both Access Key ID and Private Key are entered

### Issue: "Error decrypting API keys"
**Solution:**
- Your `ENCRYPTION_KEY` in `.env` might have changed
- Re-save your API keys in Settings (this will re-encrypt them)

### Issue: "Error calling Kalshi API"
**Possible causes:**
1. **Invalid credentials** - Double-check your Access Key ID and Private Key
2. **Wrong Private Key format** - Must be in PEM format (starts with `-----BEGIN PRIVATE KEY-----`)
3. **Network issues** - Check your internet connection
4. **Kalshi API is down** - Check Kalshi status

### Issue: "Fetched 0 Kalshi markets"
**Possible causes:**
1. **Markets filtered out** - Kalshi client filters out:
   - Expired markets (older than 1 day)
   - Markets with invalid prices (resolved markets)
   - Markets with old years in title
2. **No active markets** - Kalshi might not have active markets right now
3. **API rate limiting** - Try again in a few minutes

## Step 4: Test API Connection

### Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Look for any errors related to `/api/markets/all`
4. Check the **Network** tab for the API request:
   - Status should be `200`
   - Response should contain markets data

### Check API Response Directly

1. While logged in, open: http://localhost:3000/api/markets/all
2. You should see JSON with a `markets` array
3. Look for markets with `"platform": "kalshi"`

## Step 5: Verify API Keys Format

### Access Key ID
- Should be a string (e.g., `AK1234567890`)
- No spaces or special characters (except dashes/underscores)

### Private Key
- Must be in **PEM format** (PKCS#8 format)
- Should start with: `-----BEGIN PRIVATE KEY-----` (NOT `-----BEGIN RSA PRIVATE KEY-----`)
- Should end with: `-----END PRIVATE KEY-----`
- Include all lines (don't remove line breaks)

**Important:** If your key starts with `-----BEGIN RSA PRIVATE KEY-----`, you need to convert it to PKCS#8 format. See `KALSHI_KEY_FORMAT_FIX.md` for instructions.

Example (correct format):
  ```
  -----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
  (more lines)
  -----END PRIVATE KEY-----
  ```

## Step 6: Re-save API Keys

If nothing else works:

1. Go to Settings
2. Delete your existing Kalshi API keys (click "Delete")
3. Re-enter your Access Key ID and Private Key
4. Make sure Private Key includes the full PEM format (all lines)
5. Click "Save Kalshi API Keys"
6. Wait a few seconds
7. Refresh the dashboard

## Step 7: Check Authentication

Make sure you're:
- Logged in with the correct account
- Your session is valid (not expired)
- Try logging out and back in

## Debug Information

When reporting issues, include:

1. **Server logs** - Copy any error messages from your terminal
2. **Browser console** - Any errors in the browser console
3. **Network tab** - Status code and response from `/api/markets/all`
4. **API key status** - Does Settings show "✓ Kalshi API keys are configured"?
5. **Market count** - How many total markets are showing? (check stats in response)

## Still Not Working?

If markets still don't appear after trying all steps:

1. **Check Kalshi API directly:**
   - Verify your credentials work on Kalshi's platform
   - Make sure your account has API access enabled

2. **Test with a simple script:**
   - I can help create a test script to verify your API keys work

3. **Check for updates:**
   - Make sure you're using the latest code
   - Check if there are any known issues

## Quick Checklist

- [ ] API keys saved in Settings
- [ ] See "✓ Kalshi API keys are configured" in Settings
- [ ] Logged in with correct account
- [ ] Private Key is in PEM format (full format with headers)
- [ ] Server logs show "Kalshi client created successfully"
- [ ] Server logs show "Fetched X Kalshi markets"
- [ ] Browser console has no errors
- [ ] `/api/markets/all` returns markets with `platform: "kalshi"`

