# Quick Supabase Setup

## Step-by-Step Instructions

### 1. Create Supabase Account
- Visit: https://supabase.com
- Sign up (free tier available)

### 2. Create New Project
1. Click "New Project"
2. Enter project name: `prediction-markets-platform`
3. Set a strong database password (save it!)
4. Choose region closest to you
5. Click "Create new project"
6. Wait 2-3 minutes for setup

### 3. Get Connection String
1. Go to: **Settings** → **Database**
2. Scroll to **Connection string** section
3. Select **Transaction** mode (under Connection pooling)
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your actual password

Example format:
```
postgresql://postgres:your_password_here@db.abcdefghijklmnop.supabase.co:5432/postgres
```

### 4. Add to .env
Add this line to your `.env` file:
```env
DATABASE_URL=postgresql://postgres:your_password_here@db.abcdefghijklmnop.supabase.co:5432/postgres
```

### 5. Run Migration
```bash
npx prisma db push
```

You should see:
```
✔ Generated Prisma Client
✔ Database synchronized
```

### 6. Verify in Supabase Dashboard
1. Go to **Table Editor** in Supabase
2. You should see tables: `User`, `Account`, `Session`, `ApiKey`, `Trade`, etc.

✅ Done! Your database is ready.



