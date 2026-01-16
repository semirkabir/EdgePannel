# 🚨 CRITICAL: Remove .env from Git History

## Problem Discovered

Your `.env` file is currently tracked by git and may have been pushed to GitHub with all your API keys, passwords, and secrets!

## Immediate Actions Required

### Step 1: Remove .env from Git (But Keep Local Copy)

Run this command to remove `.env` from git tracking **without deleting your local file**:

```powershell
git rm --cached .env
```

This removes it from git but keeps your local `.env` file intact.

### Step 2: Commit the Removal

```powershell
git add .gitignore
git commit -m "Security fix: Remove .env from git tracking"
```

### Step 3: Push the Changes

```powershell
git push origin main
git push origin production  # If you created this branch
```

### Step 4: Verify .env is Ignored

```powershell
# Make a test change to .env
echo "# test" >> .env

# Check git status - .env should NOT appear
git status

# Remove test change
# (Just delete the last line in .env)
```

## ⚠️ Security Implications

If `.env` was already pushed to GitHub:

### Your Exposed Secrets May Include:
- ✅ Database password
- ✅ Google OAuth Client Secret
- ✅ Twitter OAuth Client Secret  
- ✅ NextAuth Secret
- ✅ Encryption keys
- ✅ API keys (Alpaca, FRED, Census, etc.)
- ✅ Kalshi private key

### What You MUST Do:

#### 1. Rotate ALL Credentials (URGENT!)

**Database:**
- Change database password in Dokploy
- Update `DATABASE_URL` with new password

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Delete the exposed OAuth credentials
3. Create new OAuth 2.0 Client ID
4. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` everywhere

**Twitter/X OAuth:**
1. Go to [X Developer Portal](https://developer.twitter.com/)
2. Regenerate your OAuth 2.0 credentials
3. Update `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`

**NextAuth:**
```powershell
# Generate new secret
npm run generate-secrets
# Copy the new NEXTAUTH_SECRET to .env
```

**All API Keys:**
- Alpaca: Regenerate keys at https://alpaca.markets/
- FRED: Get new key at https://fred.stlouisfed.org/
- Census: Regenerate at https://api.census.gov/
- Congress: Get new at https://api.congress.gov/
- Kalshi: Generate new API keys

#### 2. Check GitHub for .env History

```powershell
# Check if .env exists in git history
git log --all --full-history -- .env
```

If it shows commits, your secrets are in GitHub's history.

#### 3. Remove from Git History (Nuclear Option)

⚠️ **Warning:** This rewrites git history. Coordinate with any team members!

```powershell
# Remove .env from entire git history
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch .env" `
  --prune-empty --tag-name-filter cat -- --all

# Force push to update GitHub
git push origin --force --all
```

**Alternative (Safer):** Just rotate all secrets and move forward. Old commits will have old (now-invalid) secrets.

## Going Forward - Correct Setup

### Local Development (.env - NOT in git)
```env
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:password@localhost:5432/webapp"
GOOGLE_CLIENT_ID=your_local_dev_google_id
GOOGLE_CLIENT_SECRET=your_local_dev_google_secret
# ... all other local secrets
```

### Production (Dokploy Dashboard)
All environment variables are set in **Dokploy's Environment section**, NOT in git:
- `NODE_ENV=production`
- `NEXTAUTH_URL=https://edgepannel.com`
- `DATABASE_URL=your_production_db_url`
- All production API keys

### How It Should Work

```
Local Machine:
  └── .env (NEVER in git)
  └── .env.example (IN git - no secrets, just template)

GitHub Repository:
  └── .env.example ✅ (safe to commit)
  └── .env ❌ (NEVER committed)

Dokploy Production:
  └── Environment Variables (set in dashboard)
```

## Quick Fix Script

I'll create a script to automate this:

```powershell
# Save this as: fix-env-security.ps1

Write-Host "🚨 Fixing .env Security Issue..." -ForegroundColor Red
Write-Host ""

# Remove from git tracking
Write-Host "→ Removing .env from git..." -ForegroundColor Yellow
git rm --cached .env

# Commit the change
Write-Host "→ Committing .gitignore update..." -ForegroundColor Yellow
git add .gitignore
git commit -m "Security fix: Remove .env from git tracking"

# Push to main
Write-Host "→ Pushing to main..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "✅ .env removed from git tracking" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  NEXT STEPS (CRITICAL):" -ForegroundColor Yellow
Write-Host "1. Check if .env was in git history: git log --all -- .env" -ForegroundColor Red
Write-Host "2. If yes, ROTATE ALL SECRETS immediately!" -ForegroundColor Red
Write-Host "3. Update credentials in:" -ForegroundColor Red
Write-Host "   - Google Cloud Console" -ForegroundColor Red
Write-Host "   - X Developer Portal" -ForegroundColor Red
Write-Host "   - All API key providers" -ForegroundColor Red
Write-Host "   - Dokploy environment variables" -ForegroundColor Red
Write-Host ""
```

## Prevention Checklist

- [x] `.env` in `.gitignore` (FIXED)
- [ ] Remove `.env` from git tracking (`git rm --cached .env`)
- [ ] Verify with `git status` (should not show .env)
- [ ] Check git history (`git log --all -- .env`)
- [ ] Rotate ALL secrets if .env was in history
- [ ] Update Dokploy environment variables
- [ ] Test that .env changes don't appear in `git status`

## Testing Your Fix

```powershell
# 1. Make a change to .env
echo "# test" >> .env

# 2. Check git status
git status

# Expected result: .env should NOT appear in the list
# If it appears, the fix didn't work

# 3. Clean up test
# Remove the "# test" line from .env
```

## Summary

**Immediate Actions:**
1. ✅ Run `git rm --cached .env`
2. ✅ Commit and push .gitignore update
3. ⚠️  Check if .env was in history
4. 🔴 Rotate ALL credentials if compromised
5. ✅ Update Dokploy with new credentials

**Going Forward:**
- Local `.env` stays on your machine only
- `.env.example` is the only env file in git (no secrets)
- Production uses Dokploy environment variables
- Never commit secrets!

---

**Your .env file should NEVER leave your local machine!**
