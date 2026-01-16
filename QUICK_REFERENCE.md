# 🚀 Quick Reference - Development Workflow

## Daily Commands

### Start Local Development
```powershell
# Option 1: Use the automated script
.\dev-start.ps1

# Option 2: Manual commands
docker-compose up -d && npm run dev

# Option 3: First time setup
npm run dev:setup && npm run dev
```

### Stop Local Development
```powershell
.\dev-stop.ps1
# OR
docker-compose down
```

---

## Git Workflow (After Setup)

### Daily Development (No Deployment)
```powershell
# Work on main branch
git add .
git commit -m "Your changes"
git push origin main
# ✅ Code pushed, but NOT deployed to production
```

### Deploy to Production
```powershell
# Option 1: Use the automated script
.\deploy-production.ps1

# Option 2: Manual deployment
git checkout production
git merge main
git push origin production  # ← Triggers Dokploy deployment
git checkout main
```

---

## NPM Scripts Reference

```powershell
npm run dev              # Start dev server
npm run dev:setup        # Setup database + dev server
npm run dev:reset        # Reset database completely
npm run db:studio        # Open Prisma Studio (database GUI)
npm run db:status        # Check migration status
npm run build            # Build for production
npm run lint             # Run linter
```

---

## Docker Commands

```powershell
docker-compose up -d     # Start database in background
docker-compose down      # Stop database
docker-compose down -v   # Stop and delete database data
docker-compose logs      # View database logs
docker ps               # List running containers
```

---

## Database Commands

```powershell
npx prisma migrate dev   # Create and run migrations
npx prisma migrate reset # Reset database completely
npx prisma studio        # Open database GUI
npx prisma db push       # Push schema changes without migration
npx prisma generate      # Generate Prisma Client
```

---

## Initial Setup (Do Once)

### 1. Configure Dokploy to Use Production Branch
1. Go to Dokploy dashboard
2. Select EdgePannel app
3. Git Settings → Branch → Change to `production`
4. Save

### 2. Create Production Branch
```powershell
git checkout -b production
git push -u origin production
git checkout main
```

### 3. Setup Local OAuth Redirects

**Google Cloud Console:**
- Add: `http://localhost:3000/api/auth/callback/google`

**X Developer Portal:**
- Add: `http://localhost:3000/api/auth/callback/twitter`

### 4. Update Local .env
Make sure these are set for local dev:
```env
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:password@localhost:5432/webapp"
```

---

## Branch Strategy

| Branch | Purpose | Auto-Deploy? |
|--------|---------|--------------|
| `main` | Daily development | ❌ No |
| `production` | Live site | ✅ Yes → edgepannel.com |
| `feature/*` | Feature branches | ❌ No |

---

## Common Tasks

### Test a feature locally
```powershell
.\dev-start.ps1
# Test at http://localhost:3000
# Ctrl+C to stop
```

### Push code without deploying
```powershell
git add .
git commit -m "WIP: Testing feature"
git push origin main  # Safe, won't deploy
```

### Deploy to production
```powershell
# Make sure you've tested locally first!
.\deploy-production.ps1
```

### Reset local database
```powershell
npm run dev:reset
```

### View local database
```powershell
npm run db:studio
# Opens at http://localhost:5555
```

### Check which branch deploys
```powershell
# Should see "production" branch in Dokploy settings
```

---

## Troubleshooting

### "Can't connect to database"
```powershell
docker-compose down
docker-compose up -d
npm run dev:setup
```

### "OAuth not working locally"
- Check redirect URIs are added to Google/X console
- Verify NEXTAUTH_URL=http://localhost:3000 in .env

### "Accidentally deployed to production"
```powershell
# Roll back in Dokploy or:
git checkout production
git reset --hard HEAD~1
git push --force origin production
```

### "Lost on which branch"
```powershell
git status
git branch -a
```

---

## File URLs

- **Local:** http://localhost:3000
- **Production:** https://edgepannel.com
- **Database GUI:** http://localhost:5555 (when running `npm run db:studio`)

---

## Tips

💡 Always test locally before deploying
💡 Keep `main` branch clean and working
💡 Deploy to production only when fully tested
💡 Use feature branches for experimental work
💡 Commit often, deploy deliberately

---

## Need More Info?

See `DEV_WORKFLOW_GUIDE.md` for complete documentation.
