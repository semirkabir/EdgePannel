# Complete Setup Guide

This guide will walk you through setting up Supabase, Polymarket, and Kalshi for the Prediction Markets Map Platform.

## 1. Supabase Setup (Database)

### Step 1: Create a Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign up"
3. Sign up with GitHub, Google, or email

### Step 2: Create a New Project
1. Click "New Project" in your dashboard
2. Fill in the project details:
   - **Name**: prediction-markets-platform (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest region to you
   - **Pricing Plan**: Free tier is fine for development
3. Click "Create new project"
4. Wait 2-3 minutes for the project to be created

### Step 3: Get Your Database URL
1. Once your project is ready, go to **Settings** → **Database**
2. Scroll down to **Connection string** section
3. Under **Connection pooling**, select **Transaction** mode
4. Copy the **Connection string** (URI) - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the database password you created
6. This is your `DATABASE_URL`

### Step 4: Run Database Migrations
1. Add the `DATABASE_URL` to your `.env` file
2. Run the Prisma migration:
   ```bash
   npx prisma db push
   ```
3. This will create all the necessary tables in your Supabase database

---

## 2. Polymarket API Setup

### Step 1: Create a Polymarket Account
1. Go to [https://polymarket.com](https://polymarket.com)
2. Sign up for an account
3. Complete KYC (Know Your Customer) verification if required

### Step 2: Get API Access
**Note**: Polymarket's official API access may require approval. Here are the options:

#### Option A: Official API (If Available)
1. Contact Polymarket support or check their developer documentation
2. Request API access through their official channels
3. They may provide an API key or authentication token

#### Option B: Using Polymarket Subgraph (Current Implementation)
The current implementation uses Polymarket's public GraphQL Subgraph API, which doesn't require authentication for reading market data. However, for trading, you'll need official API access.

1. **For Market Data**: No API key needed - the app uses the public subgraph
2. **For Trading**: You'll need to contact Polymarket for trading API access

### Step 3: Configure in App
1. For now, you can leave `POLYMARKET_API_KEY` empty in `.env` (market data will still work)
2. When you get trading API access, add it to your `.env`:
   ```env
   POLYMARKET_API_KEY=your_polymarket_api_key_here
   ```
3. Users will also need to add their own Polymarket API keys in the Settings page for trading

---

## 3. Kalshi API Setup

### Step 1: Create a Kalshi Account
1. Go to [https://kalshi.com](https://kalshi.com)
2. Sign up for an account
3. Complete account verification

### Step 2: Generate API Keys
1. Log in to your Kalshi account
2. Go to **Account Settings** → **API Keys** (or similar section)
3. Click **"Create API Key"** or **"Generate New Key"**
4. You'll receive:
   - **Access Key ID**: A string identifier (e.g., `AK1234567890`)
   - **Private Key**: A PEM-formatted RSA private key (starts with `-----BEGIN PRIVATE KEY-----`)

### Step 3: Save Your Keys Securely
⚠️ **IMPORTANT**: The private key is only shown once. Save it immediately!

1. Copy both the **Access Key ID** and **Private Key**
2. Store them securely (password manager recommended)
3. You cannot retrieve the private key later if lost

### Step 4: Configure in App
1. Log in to the application
2. Navigate to **Settings** (top right → Settings)
3. In the **Kalshi API Keys** section:
   - Paste your **Access Key ID** in the first field
   - Paste your **Private Key** (full PEM format) in the second field
4. Click **"Save Kalshi API Keys"**
5. Your keys will be encrypted and stored securely

### Step 5: Test API Connection
1. After saving, try accessing markets from the dashboard
2. If you see Kalshi markets loading, the API keys are working correctly

---

## 4. Complete .env File Example

Here's what your complete `.env` file should look like:

```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# NextAuth
NEXTAUTH_SECRET=/Wt0c99yHOikOTn83+72eFiJI4320bqBYL2jIajAxWg=
NEXTAUTH_URL=http://localhost:3000

# Encryption (for API key encryption)
ENCRYPTION_KEY=rLHPd/9P3XhzILWGDRgYBZNIVRAoV+VNmHXbJ+T60iU=

# Polymarket (optional - for server-side proxy if needed)
POLYMARKET_API_KEY=

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

---

## 5. Verification Steps

### Verify Supabase Connection
1. Run: `npx prisma db push`
2. Check Supabase dashboard → **Table Editor** - you should see tables created
3. If successful, you'll see: `✔ Generated Prisma Client`

### Verify Polymarket
1. Start the app: `npm run dev`
2. Log in and go to dashboard
3. You should see Polymarket markets loading (even without API key for read access)

### Verify Kalshi
1. Add your Kalshi API keys in Settings
2. Go to dashboard
3. You should see Kalshi markets appearing on the map

---

## 6. Troubleshooting

### Supabase Issues
- **Connection refused**: Check your `DATABASE_URL` format
- **Password incorrect**: Make sure you replaced `[YOUR-PASSWORD]` in the connection string
- **Tables not created**: Run `npx prisma generate` then `npx prisma db push`

### Polymarket Issues
- **No markets showing**: Check browser console for errors
- **Trading not working**: You need official API access for trading

### Kalshi Issues
- **"API keys not configured"**: Make sure you saved both Access Key ID and Private Key
- **"Invalid signature"**: Check that your Private Key is in correct PEM format
- **"Unauthorized"**: Verify your API keys are correct and account is active

---

## 7. Security Best Practices

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Use different secrets for production** - Generate new secrets for production
3. **Rotate API keys periodically** - Especially if compromised
4. **Use strong database passwords** - Supabase will enforce this
5. **Enable 2FA** on all accounts (Supabase, Polymarket, Kalshi)

---

## 8. Next Steps

After completing setup:
1. ✅ Database connected (Supabase)
2. ✅ Secrets generated and configured
3. ✅ API keys added (Polymarket & Kalshi)
4. ✅ Run `npm run dev` to start the application
5. ✅ Log in and configure your API keys in Settings
6. ✅ Start exploring prediction markets on the map!

---

## Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **Kalshi API Docs**: https://docs.kalshi.com
- **Polymarket Docs**: https://docs.polymarket.com


