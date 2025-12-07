# Kalshi API Update Guide

Based on the latest Kalshi documentation: https://docs.kalshi.com/sdks/overview

## Changes Made

### 1. Updated API Endpoint

**Old:** `https://api.elections.kalshi.com/trade-api/v2`  
**New:** `https://api.kalshi.com/trade-api/v2`

The production API endpoint has been updated to match the official documentation.

### 2. Improved Error Handling

- Added detailed logging for debugging
- Better error messages for authentication failures
- Logs show private key format (RSA vs PKCS#8)
- More specific error information in console

### 3. Enhanced Market Transformation

- Handles different field name variations from API
- Better price handling (supports both `last_price` and `lastPrice`)
- Improved date parsing for expiration times
- More robust field mapping

### 4. Private Key Format Support

The SDK should handle both RSA and PKCS#8 formats, but:
- **Recommended:** PKCS#8 format (`-----BEGIN PRIVATE KEY-----`)
- **Also supported:** RSA format (`-----BEGIN RSA PRIVATE KEY-----`)

## Testing Your Setup

### 1. Check Server Logs

When you start the app and markets are fetched, you should see:

```
[Kalshi Client] Initializing with: { basePath: '...', hasApiKey: true, hasPrivateKey: true, privateKeyFormat: '...' }
[Kalshi Client] Fetching markets with params: { limit: 100 }
[Kalshi Client] Received X raw markets from API
[Kalshi Client] Transformed to Y valid markets
```

### 2. Verify API Keys

1. Go to Settings
2. Make sure you see: **"✓ Kalshi API keys are configured"**
3. If not, re-enter your keys:
   - Access Key ID
   - Private Key (full PEM format with BEGIN/END markers)

### 3. Check for Errors

If markets still don't appear, check server logs for:

- **401 Unauthorized:** Authentication failed - check your API key ID and private key
- **403 Forbidden:** API key doesn't have required permissions
- **Network errors:** Connection issues to Kalshi API

## Private Key Format

Your private key should be in PEM format. Both formats are supported:

**PKCS#8 (Recommended):**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

**RSA (Also supported):**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
```

**Important:**
- Include the full key with BEGIN/END markers
- Preserve all line breaks
- Don't add extra spaces
- Copy the entire key from Kalshi

## Demo Environment

To test in the demo environment, you would need to modify the code to set `useDemo: true`, but you'll need separate demo credentials from Kalshi.

## Rate Limits

Be aware of Kalshi's rate limits:
- **Basic:** 20 reads/sec, 10 writes/sec
- **Advanced:** 30 reads/sec, 30 writes/sec
- **Premier:** 100 reads/sec, 100 writes/sec
- **Prime:** 400 reads/sec, 400 writes/sec

## Next Steps

1. **Restart your dev server** to load the updated code
2. **Check server logs** for initialization messages
3. **Verify API keys** are saved correctly in Settings
4. **Check browser console** for any client-side errors
5. **Test the API directly:** Visit `/api/markets/all` while logged in

If issues persist, check the server logs for specific error messages and share them for further debugging.

