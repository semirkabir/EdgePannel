# Kalshi Private Key Format Issue

## The Problem

Your private key is in **RSA format** (`-----BEGIN RSA PRIVATE KEY-----`), but Kalshi API typically expects **PKCS#8 format** (`-----BEGIN PRIVATE KEY-----`).

## Solution: Convert RSA to PKCS#8

### Option 1: Using OpenSSL (Recommended)

If you have OpenSSL installed:

```bash
# Convert RSA private key to PKCS#8 format
openssl pkcs8 -topk8 -inform PEM -in rsa_key.pem -outform PEM -nocrypt -out pkcs8_key.pem
```

Or if you have the key in a file:

1. Save your RSA key to a file (e.g., `kalshi_rsa_key.pem`)
2. Run:
   ```bash
   openssl pkcs8 -topk8 -inform PEM -in kalshi_rsa_key.pem -outform PEM -nocrypt -out kalshi_pkcs8_key.pem
   ```
3. Use the converted key in the Settings page

### Option 2: Using Node.js Script

I can create a script to convert it, but **first regenerate your keys** since you've exposed them.

### Option 3: Regenerate Keys from Kalshi

**This is the safest option:**

1. Go to your Kalshi account
2. Delete the old API key (the one you just shared)
3. Generate a new API key pair
4. Kalshi should provide it in the correct format
5. Use the new keys in the Settings page

## How to Check Key Format

Your key should look like this:

**RSA Format (what you have):**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
```

**PKCS#8 Format (what Kalshi expects):**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

## After Converting/Regenerating

1. Go to Settings in the app
2. Delete your existing Kalshi API keys
3. Enter your new Access Key ID
4. Enter your new Private Key (in PKCS#8 format)
5. Make sure to include the full key with BEGIN/END markers
6. Save and check if markets appear

## Security Reminder

⚠️ **NEVER share your private keys publicly!**

- Private keys are like passwords - keep them secret
- If exposed, regenerate them immediately
- Don't commit them to version control
- Don't share them in chat/email unless encrypted

