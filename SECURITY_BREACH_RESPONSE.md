# 🚨 SECURITY BREACH DETECTED - IMMEDIATE ACTION REQUIRED

## ⚠️ SITUATION

Your `.env` file with ALL your secrets was committed to git and pushed to GitHub.

**Commits containing .env:**
- `9f426a6` - Google credentials added
- `2bee479` - Polyglot/Polymarket credentials added
- (Possibly more)

## 🔴 EXPOSED CREDENTIALS

The following secrets are now PUBLIC on GitHub:

### Authentication & Session
- ✅ `NEXTAUTH_SECRET` - Session encryption key
- ✅ `ENCRYPTION_KEY` - API key encryption
- ✅ `CRON_SECRET` - Cron job authentication

### Database
- ✅ `DATABASE_URL` - Database password: `pwoikjyikvcl3afa`

### OAuth Providers
- ✅ `GOOGLE_CLIENT_ID` - Google OAuth
- ✅ `GOOGLE_CLIENT_SECRET` - (API key, but still exposed)
- ✅ `TWITTER_CLIENT_ID` - X OAuth
- ✅ `TWITTER_CLIENT_SECRET` - X OAuth secret

### API Keys
- ✅ `ALPACA_KEY_ID` - Financial data
- ✅ `ALPACA_SECRET_KEY` - Financial data secret
- ✅ `FRED_API_KEY` - Economic data
- ✅ `CENSUS_API_KEY` - US Census
- ✅ `CONGRESS_API_KEY` - Congress.gov
- ✅ `KALSHI_SYSTEM_API_KEY_ID` - Prediction markets
- ✅ `KALSHI_SYSTEM_PRIVATE_KEY` - **FULL RSA PRIVATE KEY**

### Other
- ✅ `NEXT_PUBLIC_MAPTILER_KEY` - Map tiles

## 🔥 IMMEDIATE ACTIONS (DO NOW)

### Step 1: Rotate Database Password (CRITICAL - 5 min)

**In Dokploy:**
1. Go to your database service
2. Change the password from `pwoikjyikvcl3afa` to a new strong password
3. Update `DATABASE_URL` in your app's environment variables
4. Restart the application

**Local:**
```env
# In your .env file
DATABASE_URL="postgresql://postgres:NEW_PASSWORD_HERE@localhost:5432/webapp"
```

### Step 2: Regenerate Google OAuth (10 min)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials
3. **DELETE** the exposed OAuth Client ID
4. **CREATE NEW** OAuth 2.0 Client ID
   - Add redirect URIs:
     - `https://edgepannel.com/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`
5. Copy new Client ID and Secret

**Update in Dokploy:**
- `GOOGLE_CLIENT_ID`: new_value
- `GOOGLE_CLIENT_SECRET`: new_value (starts with GOCSPX-)

**Update locally (.env):**
```env
GOOGLE_CLIENT_ID=new_client_id
GOOGLE_CLIENT_SECRET=GOCSPX-new_secret
```

### Step 3: Regenerate Twitter/X OAuth (10 min)

1. Go to [X Developer Portal](https://developer.twitter.com/)
2. Your app → Settings → Keys and tokens
3. **Regenerate** OAuth 2.0 Client ID and Secret
4. Copy new credentials

**Update in Dokploy:**
- `TWITTER_CLIENT_ID`: new_value
- `TWITTER_CLIENT_SECRET`: new_value

**Update locally (.env):**
```env
TWITTER_CLIENT_ID=new_client_id
TWITTER_CLIENT_SECRET=new_secret
```

### Step 4: Regenerate Kalshi Credentials (CRITICAL - 15 min)

The **entire RSA private key** was exposed! This is the most critical.

1. Go to https://kalshi.com/
2. Account → API Settings
3. **Revoke** all existing API keys
4. **Generate new** API key pair
5. Download the new private key

**Update in Dokploy:**
```
KALSHI_SYSTEM_API_KEY_ID=new_key_id
KALSHI_SYSTEM_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
<new private key>
-----END RSA PRIVATE KEY-----"
```

**Update locally (.env):**
Same as above

### Step 5: Regenerate All Other API Keys (20 min)

**Alpaca (Financial Data):**
1. Go to https://alpaca.markets/
2. Dashboard → API Keys
3. Delete exposed keys
4. Generate new keys
5. Update `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` everywhere

**FRED:**
1. Go to https://fred.stlouisfed.org/docs/api/api_key.html
2. Request new API key
3. Update `FRED_API_KEY`

**Census.gov:**
1. Go to https://api.census.gov/data/key_signup.html
2. Sign up for new key
3. Update `CENSUS_API_KEY`

**Congress.gov:**
1. Go to https://api.congress.gov/sign-up/
2. Sign up for new key
3. Update `CONGRESS_API_KEY`

**MapTiler:**
1. Go to https://maptiler.com/
2. Account → API keys
3. Delete exposed key
4. Create new key
5. Update `NEXT_PUBLIC_MAPTILER_KEY`

### Step 6: Generate New NextAuth Secrets (2 min)

```powershell
npm run generate-secrets
```

Copy the generated values and update:

**In Dokploy:**
- `NEXTAUTH_SECRET`: new_value
- `ENCRYPTION_KEY`: new_value
- `CRON_SECRET`: new_random_string

**In .env:**
```env
NEXTAUTH_SECRET=new_nextauth_secret
ENCRYPTION_KEY=new_encryption_key
CRON_SECRET=new_cron_secret
```

### Step 7: Restart Everything (2 min)

**Dokploy:**
1. After updating all environment variables
2. Restart the application

**Local:**
```powershell
.\dev-stop.ps1
.\dev-start.ps1
```

## 📋 Checklist

Use this to track your progress:

- [ ] ✅ .env removed from git (DONE)
- [ ] Change database password (Dokploy + local)
- [ ] Regenerate Google OAuth credentials
- [ ] Regenerate Twitter/X OAuth credentials
- [ ] Regenerate Kalshi API keys (CRITICAL - private key exposed!)
- [ ] Regenerate Alpaca API keys
- [ ] Get new FRED API key
- [ ] Get new Census API key
- [ ] Get new Congress API key
- [ ] Regenerate MapTiler key
- [ ] Generate new NEXTAUTH_SECRET
- [ ] Generate new ENCRYPTION_KEY
- [ ] Generate new CRON_SECRET
- [ ] Update all secrets in Dokploy
- [ ] Update all secrets in local .env
- [ ] Restart Dokploy application
- [ ] Test local development
- [ ] Test production login (Google & X)
- [ ] Verify all data sources work

## 🧹 Cleanup Git History (Optional Advanced)

If you want to remove .env from git history completely:

```powershell
# WARNING: This rewrites git history!
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch .env" `
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: Destructive!)
git push origin --force --all
```

**Only do this if:**
- You're the only developer
- OR you've coordinated with all team members
- AND you've rotated all secrets first

## ✅ Verify Fix is Complete

### Test 1: Git Ignoring .env
```powershell
# Make a change to .env
echo "# test" >> .env

# Check status
git status
# .env should NOT appear

# Remove test line
```

### Test 2: All Services Work
- [ ] Can log in with Google
- [ ] Can log in with X/Twitter
- [ ] Database connects
- [ ] Map tiles load
- [ ] Financial data loads
- [ ] Prediction markets data loads

## 🎓 Lessons Learned

### What Went Wrong
- `.env` was commented out in `.gitignore`
- Secrets were committed and pushed to GitHub
- Anyone with access to the repo can see them

### Fixed For Future
- ✅ `.env` now properly ignored
- ✅ `.env.example` template created (no secrets)
- ✅ All future changes to .env won't be tracked

### Best Practices Going Forward
1. **NEVER** commit `.env` files
2. Always check `git status` before pushing
3. Use `.env.example` for templates
4. Keep secrets in:
   - Local: `.env` file (not in git)
   - Production: Dokploy environment variables
5. Rotate secrets if ever exposed

## ⏰ Timeline

| Task | Time | Priority |
|------|------|----------|
| Database password | 5 min | 🔴 CRITICAL |
| Google OAuth | 10 min | 🔴 CRITICAL |
| Twitter OAuth | 10 min | 🔴 CRITICAL |
| Kalshi keys | 15 min | 🔴 CRITICAL (Private key!) |
| Alpaca keys | 5 min | 🟡 HIGH |
| Other API keys | 20 min | 🟡 HIGH |
| NextAuth secrets | 2 min | 🟡 HIGH |
| Test everything | 10 min | 🟢 Required |

**Total time:** ~90 minutes

## 💪 You Got This!

I know this is stressful, but follow the checklist and you'll be secure again.

**Start with the CRITICAL items** (database, OAuth, Kalshi) and work your way down.

## 📞 Need Help?

If you get stuck on any step:
1. Check the provider's documentation
2. Each service has a "regenerate keys" or "security" section
3. It's better to take time and do it right than rush

---

**Remember:** This is a learning experience. Everyone makes this mistake once. The important thing is you caught it and are fixing it! 🛡️
