# OAuth Authentication Setup Guide

## Overview

Your application supports OAuth authentication with:
- ✅ **Google** - Sign in with Google account
- ✅ **X (Twitter)** - Sign in with X/Twitter account
- ✅ **GitHub** - Sign in with GitHub account (already configured)

## Setup Instructions

### 1. Google OAuth Setup

#### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in app name, support email, developer contact
   - Add scopes: `email`, `profile`
   - Add test users (for development)
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: `EdgePannel`
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://edgepannel.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - `https://edgepannel.com/api/auth/callback/google` (production)
7. Copy the **Client ID** and **Client Secret**

#### Step 2: Add to Environment Variables

Add to your `.env` file:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### 2. X (Twitter) OAuth Setup

#### Step 1: Create X Developer App

1. Go to [X Developer Portal](https://developer.twitter.com/)
2. Sign in with your X/Twitter account
3. Navigate to **Developer Portal** → **Projects & Apps**
4. Create a new **Project** (if you don't have one)
5. Create a new **App** within your project
6. Go to **App Settings** → **User authentication settings**
7. Enable **OAuth 2.0**
8. Configure:
   - **App permissions**: Read users (or Read and write if needed)
   - **Type of App**: Web App
   - **Callback URI / Redirect URL**:
     - `http://localhost:3000/api/auth/callback/twitter` (development)
     - `https://edgepannel.com/api/auth/callback/twitter` (production)
   - **Website URL**: `https://edgepannel.com`
9. Save settings
10. Go to **Keys and tokens** tab
11. Copy:
     - **Client ID** (OAuth 2.0 Client ID)
     - **Client Secret** (OAuth 2.0 Client Secret)

#### Step 2: Add to Environment Variables

Add to your `.env` file:

```env
TWITTER_CLIENT_ID=your_twitter_client_id_here
TWITTER_CLIENT_SECRET=your_twitter_client_secret_here
```

### 3. Verify Configuration

After adding credentials, restart your development server:

```bash
npm run dev
```

## Testing OAuth

### Test Google Sign-In

1. Go to `/login` or `/register`
2. Click the **Google** button
3. You should be redirected to Google's sign-in page
4. After signing in, you'll be redirected back to `/polyglobe`

### Test X Sign-In

1. Go to `/login` or `/register`
2. Click the **X** button
3. You should be redirected to X's authorization page
4. After authorizing, you'll be redirected back to `/polyglobe`

## Troubleshooting

### Google OAuth Issues

**Error: "redirect_uri_mismatch"**
- ✅ Check that redirect URI in Google Console matches exactly: `http://localhost:3000/api/auth/callback/google`
- ✅ Make sure you're using the correct environment (dev vs production)

**Error: "access_denied"**
- ✅ Check OAuth consent screen is configured
- ✅ For development, add your email as a test user

**Error: "invalid_client"**
- ✅ Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- ✅ Check for extra spaces or quotes in `.env` file

### X (Twitter) OAuth Issues

**Error: "Invalid redirect URI"**
- ✅ Check callback URI in X Developer Portal matches: `http://localhost:3000/api/auth/callback/twitter`
- ✅ Make sure OAuth 2.0 is enabled (not OAuth 1.0a)

**Error: "Forbidden"**
- ✅ Check app permissions are set correctly
- ✅ Verify your X Developer account has access

**Error: "Client authentication failed"**
- ✅ Verify `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are correct
- ✅ Make sure you're using OAuth 2.0 credentials (not API keys)

### General Issues

**OAuth buttons don't appear or are disabled**
- ✅ Check environment variables are set
- ✅ Restart dev server after adding credentials
- ✅ Check browser console for errors

**Redirect loop after OAuth**
- ✅ Verify `NEXTAUTH_URL` is set correctly in `.env`
- ✅ Check callback URLs match exactly

**Database connection errors during OAuth**
- ✅ Verify `DATABASE_URL` is correct
- ✅ Check database is accessible
- ✅ See `DATABASE_CONNECTION_FIX.md` for help

## Security Notes

1. **Never commit credentials** - Keep `.env` in `.gitignore`
2. **Use different credentials** for development and production
3. **Rotate secrets** if they're ever exposed
4. **Limit redirect URIs** - Only add the exact URLs you need
5. **Review OAuth scopes** - Only request permissions you need

## Account Linking

The system is configured to automatically link OAuth accounts with the same email address. This means:
- If you register with email/password using `user@example.com`
- Then sign in with Google using the same `user@example.com`
- Both accounts will be linked to the same user record

This is controlled by `allowDangerousEmailAccountLinking: true` in the provider configuration.

## Production Checklist

Before deploying to production:

- [ ] Create production OAuth apps (separate from development)
- [ ] Add production redirect URIs to OAuth providers
- [ ] Update `.env` with production credentials
- [ ] Set `NEXTAUTH_URL` to your production domain
- [ ] Test OAuth flow in production environment
- [ ] Configure OAuth consent screen for production
- [ ] Review and approve OAuth consent screen (Google)
- [ ] Verify domain ownership if required

## Environment Variables Summary

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# X (Twitter) OAuth
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# GitHub OAuth (if using)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000  # Use https://edgepannel.com for production
NEXTAUTH_SECRET=your_nextauth_secret
```

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a fresh browser session (clear cookies)
4. Check OAuth provider dashboards for any restrictions
5. Review NextAuth.js documentation: https://next-auth.js.org/
