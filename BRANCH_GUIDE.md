# Git Branches Guide - EdgePannel

## 📊 Your Current Branch Setup

### Current Branches

**Local Branches:**
- ✅ `main` ← You are here!

**Remote Branches (on GitHub):**
- `origin/main` - Your main development branch
- `origin/cursor/mobile-layout-correction-bc95` - Old feature branch
- `origin/cursor/nixpacks-build-errors-a3e8` - Old feature branch

## 🎯 Recommended Branch Strategy

### What We Need to Set Up

```
main branch (local & remote)
  ↓ Daily development
  ↓ Does NOT auto-deploy
  ↓
production branch (to be created)
  ↓ Only this deploys to Dokploy
  ↓ edgepannel.com
```

## 🔧 How to Create and Switch Branches

### Method 1: Command Line (PowerShell)

#### View All Branches
```powershell
# Show local branches
git branch

# Show all branches (local + remote)
git branch -a

# Show current branch
git branch --show-current
```

#### Create New Branch
```powershell
# Create and switch to new branch
git checkout -b production

# Or in two steps:
git branch production     # Create
git checkout production   # Switch to it
```

#### Switch Between Branches
```powershell
# Switch to main
git checkout main

# Switch to production
git checkout production

# Switch to any branch
git checkout branch-name
```

#### Create Production Branch (Do This!)
```powershell
# 1. Make sure you're on main and up-to-date
git checkout main
git pull origin main

# 2. Create production branch from main
git checkout -b production

# 3. Push it to GitHub
git push -u origin production

# 4. Go back to main for daily work
git checkout main
```

### Method 2: VS Code / Cursor IDE

#### Visual Branch Switching in Your IDE

**Bottom Left Corner:**
1. Look for the branch name in the **bottom-left status bar**
2. It should show: `main` (your current branch)
3. **Click on it** to open branch menu

**Quick Actions:**
```
Click "main" in bottom-left
  ↓
+ Create new branch...
  ↓ or
Switch to existing branch
  ↓
Select branch from list
```

#### Create Production Branch (IDE Method)

**Option A: Command Palette**
```
1. Press: Ctrl+Shift+P (or Cmd+Shift+P on Mac)
2. Type: "Git: Create Branch"
3. Enter name: "production"
4. Press Enter
5. Click "Publish Branch" when prompted
```

**Option B: Status Bar**
```
1. Click "main" in bottom-left corner
2. Click "+ Create new branch..."
3. Type: "production"
4. Press Enter
5. Branch created and switched automatically
```

**Option C: Source Control Panel**
```
1. Click Source Control icon (left sidebar)
2. Click the "..." menu (three dots)
3. Select "Branch" → "Create Branch..."
4. Type: "production"
5. Press Enter
```

### Method 3: GitHub Desktop (If Installed)

```
1. Click "Current Branch" dropdown (top)
2. Click "New Branch"
3. Name it "production"
4. Click "Create Branch"
5. Click "Publish branch" to push to GitHub
```

## 📋 Your Workflow After Setup

### Daily Development

**1. Start on Main Branch**
```powershell
# Check current branch
git branch --show-current
# Should show: main

# If not on main, switch to it
git checkout main
```

**In IDE:** Look at bottom-left corner - should say `main`

**2. Make Changes**
```
Edit code → Test locally → Commit → Push
```

**3. Push to GitHub (No Deployment)**
```powershell
git push origin main
# ✅ Saved to GitHub
# ❌ NOT deployed to production (perfect!)
```

### Deploy to Production

**1. Switch to Production Branch**
```powershell
# Command line
git checkout production

# Or click "main" in bottom-left → Select "production"
```

**2. Merge Main into Production**
```powershell
git merge main
```

**3. Push (This Deploys!)**
```powershell
git push origin production
# ✅ Triggers Dokploy deployment
```

**4. Switch Back to Main**
```powershell
git checkout main
```

## 🎨 Visual Guide: IDE Branch Switcher

### Where to Look

```
┌─────────────────────────────────────────────────────┐
│ Your IDE Window                                     │
│                                                     │
│  [File] [Edit] [View] ...                          │
│  ┌──────────────────────────────────────────────┐  │
│  │  Code editor area                            │  │
│  │                                              │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Terminal / Debug Console                     │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  👈 main  | ⚠ 0 ▲0 ▼0                    Ln 1, Col 1│
│     ^^^^                                            │
│     Click here to switch branches!                 │
└─────────────────────────────────────────────────────┘
```

### What You'll See When You Click

```
┌──────────────────────────────────────┐
│  Select a ref to checkout            │
├──────────────────────────────────────┤
│  + Create new branch...               │
│  + Create new branch from...          │
├──────────────────────────────────────┤
│  ✓ main                               │ ← Currently on main
│    production                         │ ← Switch to this
│    other-branch                       │
└──────────────────────────────────────┘
```

## 🚀 Quick Setup: Create Production Branch

### Step-by-Step (Easiest Method)

**Using the IDE (Cursor/VS Code):**

1. **Click** `main` in the bottom-left corner
2. **Click** `+ Create new branch...`
3. **Type** `production`
4. **Press** Enter
5. **Click** "Publish Branch" (or push when prompted)

**You're done!** ✅

Now configure Dokploy:
6. Open Dokploy dashboard
7. Go to EdgePannel app settings
8. Change **Branch** from `main` to `production`
9. Save

### Verify It Worked

```powershell
# Check all branches
git branch -a

# You should see:
#   main
# * production  ← Asterisk means you're here
#   remotes/origin/main
#   remotes/origin/production
```

## 📝 Cheat Sheet

### Quick Commands

| Task | Command | IDE Shortcut |
|------|---------|--------------|
| View current branch | `git branch --show-current` | Look at bottom-left |
| List all branches | `git branch -a` | Click bottom-left |
| Create branch | `git checkout -b name` | Bottom-left → Create |
| Switch branch | `git checkout name` | Bottom-left → Select |
| Delete branch | `git branch -d name` | Right-click in source control |

### Branch Name Meanings

| Branch | Purpose | Deploys? |
|--------|---------|----------|
| `main` | Daily development | ❌ No |
| `production` | Live deployment | ✅ Yes (to edgepannel.com) |
| `feature/*` | Specific features | ❌ No |
| `cursor/*` | AI cursor auto-branches | ❌ No |

## 🎯 Daily Workflow Visual

```
Morning:
┌──────────┐
│   main   │  ← Click bottom-left, select "main"
└──────────┘
     ↓
Make changes, commit, push
     ↓
git push origin main  ✅ Saved, not deployed


Ready to deploy:
┌──────────────┐
│  production  │  ← Click bottom-left, select "production"
└──────────────┘
     ↓
git merge main
     ↓
git push origin production  🚀 Deploys!
     ↓
┌──────────┐
│   main   │  ← Switch back for more work
└──────────┘
```

## ✅ Your Next Steps

1. **Create production branch**
   ```powershell
   git checkout -b production
   git push -u origin production
   git checkout main
   ```
   
   **Or in IDE:** Click `main` → Create branch → Name it `production`

2. **Configure Dokploy**
   - Dashboard → EdgePannel → Settings
   - Change Branch: `main` → `production`
   - Save

3. **Test the workflow**
   - Make a small change on `main`
   - Push it (won't deploy)
   - Switch to `production`
   - Merge `main`
   - Push (will deploy!)

## 💡 Pro Tips

### Always Know Your Branch
Before making changes, check which branch you're on:
- **IDE:** Look at bottom-left corner
- **Terminal:** `git branch --show-current`

### Clean Branch Names
Use descriptive names:
- ✅ `feature/new-map-layer`
- ✅ `fix/oauth-redirect`
- ✅ `production`
- ❌ `temp`
- ❌ `asdf`
- ❌ `test123`

### Don't Work on Production
- Do all development on `main` or feature branches
- Only switch to `production` to deploy
- Never make commits directly on `production`

### Can't Switch Branches?
If you get "uncommitted changes" error:
```powershell
# Option 1: Commit your changes
git add .
git commit -m "Work in progress"

# Option 2: Stash changes temporarily
git stash
git checkout other-branch
git stash pop  # Get your changes back
```

## 🎓 Understanding Branches

### Simple Explanation

Think of branches like parallel universes:

```
main branch:
  A → B → C → D → E
                ↓
                New feature added
                
production branch:
  A → B → C
          ↑
          Stable, deployed version
```

### When You Merge

```
main:        A → B → C → D → E
                           ↓
production:  A → B → C ————→ E
                           (merged)
```

Now production has everything from main!

---

**You now have full control over your branches!** 🎉

Click `main` in the bottom-left corner of your IDE and explore the branch menu!
