# Google OAuth Login Issue - Troubleshooting Guide

## Problem
Google login keeps redirecting back to the login screen with error: `OAuthCallback`
URL: `https://edgepannel.com/login?callbackUrl=https%3A%2F%2Fedgepannel.com%2Fedge&error=OAuthCallback`

## Root Cause
The `error=OAuthCallback` indicates that something is failing during the OAuth callback process. Based on your environment configuration, the most likely cause is:

### **Invalid Google Client Secret** ❌
Your `.env` file shows:
```
GOOGLE_CLIENT_SECRET=AIzaSyAnLaFL1oeZLVO8XCXpVqCmEhXZNh0qvCA
```

This appears to be a **Google API Key** (starts with `AIza...`), NOT an OAuth Client Secret.

**OAuth Client Secrets** should look like: `GOCSPX-xxxxxxxxxxxxxxxxxxxxx`

## How to Fix

### Step 1: Get the Correct OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Find your existing OAuth 2.0 Client ID or create a new one:
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `EdgePannel Production`

5. **Configure Authorized redirect URIs** (CRITICAL):
   ```
   https://edgepannel.com/api/auth/callback/google
   ```
   
   Also add for local development:
   ```
   http://localhost:3000/api/auth/callback/google
   ```

6. **Configure Authorized JavaScript origins**:
   ```
   https://edgepannel.com
   http://localhost:3000
   ```

7. Click **Create** and copy both:
   - **Client ID** (starts with something like `1041034668446-...`)
   - **Client Secret** (should start with `GOCSPX-`)

### Step 2: Update Your Environment Variables

Update your `.env` file with the **correct** credentials:

```env
# Google OAuth (CORRECTED)
GOOGLE_CLIENT_ID=1041034668446-tfdb3iur1qsdd3rqnac1cb9h2726ncs1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-YOUR_ACTUAL_SECRET_HERE  # ← REPLACE THIS!

# NextAuth
NEXTAUTH_URL=https://edgepannel.com
NEXTAUTH_SECRET=/Wt0c99yHOikOTn83+72eFiJI4320bqBYL2jIajAxWg=
```

### Step 3: If Using Docker/Dokploy, Update Environment

If your app is deployed:
1. Update environment variables in your Dokploy dashboard
2. Restart the application

If using Docker locally:
```powershell
docker-compose down
docker-compose up -d --build
```

### Step 4: Verify OAuth Consent Screen

1. In Google Cloud Console, go to **APIs & Services** → **OAuth consent screen**
2. Make sure:
   - Publishing status is set appropriately (Test or Production)
   - If in "Testing" mode, add your email as a test user
   - Required scopes include: `email`, `profile`, `openid`

### Step 5: Test the Fix

1. Clear your browser cookies for `edgepannel.com`
2. Try logging in with Google again
3. Check the server logs for detailed error messages (if issue persists)

## Other Possible Causes

If the above doesn't fix it, check these:

### 2. Database Connection Issues
The OAuth callback needs to create/update user records. Verify:
```env
DATABASE_URL="postgresql://postgres:pwoikjyikvcl3afa@edgepannel-db-f9ebm5:5432/edgepannel"
```

Test database connection:
```powershell
# If using Prisma
npx prisma db pull
```

### 3. Redirect URI Mismatch
The redirect URI in Google Console **must exactly match**:
```
https://edgepannel.com/api/auth/callback/google
```

Common mistakes:
- ❌ Missing `/api/auth/callback/google`
- ❌ Using `http://` instead of `https://`
- ❌ Trailing slash: `https://edgepannel.com/api/auth/callback/google/`
- ✅ Correct: `https://edgepannel.com/api/auth/callback/google`

### 4. Session/Cookie Issues
Make sure `NEXTAUTH_URL` matches your actual domain:
```env
NEXTAUTH_URL=https://edgepannel.com  # NOT http, NOT localhost
```

## Debugging

### Check Server Logs
The code now includes enhanced logging. Look for:
```
[Auth] OAuth sign-in attempt: { provider: 'google', email: '...', userId: '...' }
[Auth] Error during OAuth sign-in callback: { ... }
```

### Enable NextAuth Debug Mode
Add to `.env`:
```env
NEXTAUTH_DEBUG=true
```

This will log detailed OAuth flow information.

### Test Locally First
Before testing in production:
1. Use development credentials
2. Set `NEXTAUTH_URL=http://localhost:3000`
3. Add `http://localhost:3000/api/auth/callback/google` to Google Console
4. Test locally to isolate the issue

## Quick Checklist

- [ ] Replace `GOOGLE_CLIENT_SECRET` with actual OAuth Client Secret (starts with `GOCSPX-`)
- [ ] Verify redirect URI in Google Console: `https://edgepannel.com/api/auth/callback/google`
- [ ] Confirm `NEXTAUTH_URL=https://edgepannel.com` in production
- [ ] Restart application after updating environment variables
- [ ] Clear browser cookies and try again
- [ ] Check server logs for specific error messages
- [ ] Verify database connection is working

## Expected Result

After fixing, you should:
1. Click "Continue with Google"
2. Be redirected to Google's sign-in page
3. Sign in with your Google account
4. Be redirected back to `https://edgepannel.com/edge` (successfully logged in)

## Need More Help?

If the issue persists:
1. Check the application server logs
2. Look for the `[Auth]` prefixed log messages
3. The error message will indicate the specific issue
4. Common errors:
   - `invalid_client` → Wrong Client ID/Secret
   - `redirect_uri_mismatch` → Redirect URI not configured correctly
   - Database errors → Connection or schema issues
