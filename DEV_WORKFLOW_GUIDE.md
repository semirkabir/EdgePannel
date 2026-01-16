# Development Workflow Guide - EdgePannel

## Problem
Every time you push to `main`, Dokploy automatically deploys to production. This creates issues when you want to test features before they go live.

## Solution: Branch-Based Workflow + Local Dev Environment

We'll set up a **3-environment workflow**:
1. **Local Development** - Full-featured local environment
2. **Staging** (Optional) - Pre-production environment in Dokploy
3. **Production** - Live site (edgepannel.com)

---

## Option 1: Local Development Only (Quickest Setup)

### Setup Local Environment with Production Features

#### 1. Configure Local Database (Already Done!)
Your `docker-compose.yml` provides a local PostgreSQL database.

#### 2. Create Local Environment File
Your `.env` file should already have local settings. Make sure it has:

```env
# Local Development
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000

# Database (Local)
DATABASE_URL="postgresql://postgres:password@localhost:5432/webapp"

# All other API keys stay the same
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
# ... etc
```

#### 3. Update Google OAuth for Local Dev
In [Google Cloud Console](https://console.cloud.google.com/):
- Add redirect URI: `http://localhost:3000/api/auth/callback/google`
- Add authorized origin: `http://localhost:3000`

#### 4. Update Twitter OAuth for Local Dev
In [X Developer Portal](https://developer.twitter.com/):
- Add callback URL: `http://localhost:3000/api/auth/callback/twitter`

#### 5. Start Local Development

```powershell
# 1. Start local database
docker-compose up -d

# 2. Run migrations
npx prisma migrate dev

# 3. Start dev server
npm run dev
```

**Now you have a full production-like environment at `http://localhost:3000`!**

### Development Workflow

```bash
# 1. Create a feature branch
git checkout -b feature/my-new-feature

# 2. Make your changes and test locally
npm run dev

# 3. Test thoroughly on localhost:3000

# 4. When ready, merge to main
git checkout main
git merge feature/my-new-feature

# 5. Push to production
git push origin main
# ↑ This auto-deploys to Dokploy
```

---

## Option 2: Branch-Based Workflow (Recommended)

This prevents accidental production deployments.

### Setup Protected Branches in Dokploy

#### Step 1: Configure Dokploy to Only Deploy from `production` Branch

1. Go to Dokploy dashboard
2. Select your EdgePannel application
3. Go to **Git** settings
4. Change **Branch** from `main` → `production`
5. Save

Now Dokploy will ONLY deploy when you push to the `production` branch!

#### Step 2: Create Branch Structure

```powershell
# Create and push production branch
git checkout -b production
git push -u origin production

# Switch back to main for development
git checkout main
```

### New Workflow

```bash
# Daily development on main branch
git checkout main

# Make changes, test locally
npm run dev

# Commit changes
git add .
git commit -m "Add new feature"
git push origin main  # ← Does NOT deploy to production!

# When ready to deploy to production:
git checkout production
git merge main
git push origin production  # ← THIS deploys to Dokploy
git checkout main  # Back to dev
```

---

## Option 3: Full Staging Environment (Advanced)

Create a separate staging deployment in Dokploy.

### Setup Staging in Dokploy

1. **Create New Application** in Dokploy:
   - Name: `edgepannel-staging`
   - Repository: Same as production
   - Branch: `staging`
   - Domain: `staging.edgepannel.com` (or a subdomain)

2. **Copy Environment Variables** from production to staging

3. **Create Staging Branch**:
```powershell
git checkout -b staging
git push -u origin staging
```

### Three-Environment Workflow

```bash
# 1. Develop on feature branches
git checkout -b feature/new-thing
# ... make changes ...
git push origin feature/new-thing

# 2. Merge to staging for testing
git checkout staging
git merge feature/new-thing
git push origin staging  # ← Deploys to staging.edgepannel.com

# 3. Test on staging environment
# Visit staging.edgepannel.com

# 4. When tested, merge to production
git checkout production
git merge staging
git push origin production  # ← Deploys to production

# 5. Keep main in sync
git checkout main
git merge production
git push origin main
```

---

## Recommended: Quick Setup Guide

Here's what I recommend for your use case:

### Step-by-Step Setup (15 minutes)

#### 1. Update Dokploy to Use `production` Branch

```
Dokploy Dashboard → EdgePannel → Git Settings → Branch: "production"
```

#### 2. Create Production Branch Locally

```powershell
cd c:\Users\skabir\Edgepannel
git checkout -b production
git push -u origin production
git checkout main
```

#### 3. Set Up Local Development

```powershell
# Ensure local database is running
docker-compose up -d

# Create local .env if not exists (you already have this)
# Make sure it has: NEXTAUTH_URL=http://localhost:3000

# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

#### 4. Add OAuth Redirect URLs for Local

**Google Cloud Console:**
- Add: `http://localhost:3000/api/auth/callback/google`

**X Developer Portal:**
- Add: `http://localhost:3000/api/auth/callback/twitter`

#### 5. Your New Daily Workflow

```powershell
# Start dev server
npm run dev

# Make changes, test at localhost:3000

# Commit to main (DOES NOT DEPLOY)
git add .
git commit -m "Your changes"
git push origin main

# When ready for production:
git checkout production
git merge main
git push origin production  # ← Deploys!
git checkout main
```

---

## Quick Reference Commands

### Local Development
```powershell
# Start everything
docker-compose up -d && npm run dev

# Stop database
docker-compose down

# Reset database
docker-compose down -v
npx prisma migrate reset
```

### Git Workflow
```powershell
# Daily work (no deployment)
git checkout main
git add .
git commit -m "Changes"
git push

# Deploy to production
git checkout production
git merge main
git push
git checkout main
```

### Troubleshooting
```powershell
# Check which branch deploys to Dokploy
# (Should be "production")

# View current branch
git branch

# View all branches
git branch -a

# Reset to production if needed
git checkout production
git reset --hard origin/main
git push --force
```

---

## Environment Variables Reference

### Local (.env)
```env
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:password@localhost:5432/webapp"
```

### Production (Dokploy)
```env
NODE_ENV=production
NEXTAUTH_URL=https://edgepannel.com
DATABASE_URL="postgresql://postgres:password@edgepannel-db:5432/edgepannel"
```

---

## Benefits of This Workflow

✅ **No more accidental production deploys**
- `main` branch is for development only
- Only `production` branch deploys

✅ **Full local testing**
- Test auth, database, APIs locally
- No need to push to see if it works

✅ **Fast iteration**
- Make changes, test immediately
- Commit to main whenever you want

✅ **Safe deployments**
- Deliberate production deployments
- Easy to rollback if needed

---

## Optional: Git Aliases for Speed

Add to `~/.gitconfig`:

```ini
[alias]
    # Quick deploy to production
    deploy = "!f() { \
        git checkout production && \
        git merge main && \
        git push origin production && \
        git checkout main; \
    }; f"
    
    # Sync main with production
    sync = "!f() { \
        git checkout main && \
        git pull origin production && \
        git push origin main; \
    }; f"
```

Then just run:
```powershell
git deploy  # Deploys main to production
```

---

## Need Help?

**Local dev not working?**
```powershell
docker-compose down -v
docker-compose up -d
npx prisma migrate dev
npm run dev
```

**Want to undo a deployment?**
```powershell
git checkout production
git reset --hard HEAD~1
git push --force
```

**Lost on which branch you're on?**
```powershell
git status
git branch
```

This workflow will save you SO much time and stress! 🚀
