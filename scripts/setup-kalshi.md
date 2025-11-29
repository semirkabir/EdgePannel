# Kalshi API Setup Guide

## Step-by-Step Instructions

### 1. Create Kalshi Account
- Visit: https://kalshi.com
- Sign up and complete verification

### 2. Generate API Keys
1. Log in to Kalshi
2. Navigate to: **Account Settings** → **API** or **Developer Settings**
3. Click **"Create API Key"** or **"Generate New Key"**
4. You'll receive:
   - **Access Key ID**: (e.g., `AK1234567890ABCDEF`)
   - **Private Key**: (PEM format, starts with `-----BEGIN PRIVATE KEY-----`)

⚠️ **CRITICAL**: Save the Private Key immediately - it's only shown once!

### 3. Add Keys to Application
1. Start the app: `npm run dev`
2. Log in to the application
3. Go to **Settings** (top right corner)
4. Scroll to **"Kalshi API Keys"** section
5. Enter:
   - **Access Key ID**: Paste your Access Key ID
   - **Private Key**: Paste the full private key (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
6. Click **"Save Kalshi API Keys"**

### 4. Verify It Works
1. Go back to Dashboard
2. You should see Kalshi markets appearing on the map
3. If you see markets, the API keys are working! ✅

## Troubleshooting

### "API keys not configured"
- Make sure you saved both Access Key ID and Private Key
- Check that Private Key includes the BEGIN/END markers

### "Invalid signature" error
- Verify Private Key is in correct PEM format
- Make sure there are no extra spaces or line breaks
- The key should start with `-----BEGIN PRIVATE KEY-----`

### "Unauthorized" error
- Verify your Access Key ID is correct
- Check that your Kalshi account is active
- Make sure you're using the correct environment (demo vs production)

## Demo vs Production

Kalshi offers a demo environment for testing:
- Demo API URL: `https://demo-api.kalshi.com`
- Production API URL: `https://trade-api.kalshi.com`

The application uses production by default. If you want to use demo, you can modify `lib/api/kalshi.ts` to set `useDemo: true` in the KalshiClient constructor.

