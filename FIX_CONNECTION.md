# Fix: Prisma Migration Stuck

## The Problem

Your `npx prisma db push` is stuck because you're using the **connection pooler URL** (port 6543), but Prisma migrations need the **direct connection** (port 5432).

## Quick Fix

### Step 1: Cancel the Stuck Command
Press `Ctrl+C` in your terminal to cancel the stuck command.

### Step 2: Get the Direct Connection String

1. Go to **Supabase Dashboard** → Your Project → **Settings** → **Database**
2. Scroll to **"Connection string"** section
3. **IMPORTANT**: Select **"Transaction"** mode (NOT "Session" mode)
4. Copy the connection string - it should look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
   ```
   Notice it uses port **5432** (direct connection), not 6543 (pooler)

### Step 3: Update Your .env File

Replace your current `DATABASE_URL` with the direct connection string:

**Current (WRONG - using pooler):**
```env
DATABASE_URL=postgresql://postgres:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```

**Correct (direct connection):**
```env
DATABASE_URL=postgresql://postgres:your_password@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
```

**Key differences:**
- ✅ Uses `db.onwkzqbrmrskazfitshr.supabase.co` (not `pooler.supabase.com`)
- ✅ Uses port `5432` (not `6543`)
- ✅ Make sure `[YOUR-PASSWORD]` is replaced with your actual password

### Step 4: URL Encode Password (if needed)

If your password has special characters, use the helper script:

```bash
node scripts/fix-database-url.js
```

Or manually encode:
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- etc.

### Step 5: Run Migration Again

```bash
npx prisma db push
```

This should work now! ✅

## Connection Types Explained

### Direct Connection (Port 5432) - For Migrations
- ✅ Use for: Prisma migrations, database schema changes
- ✅ URL format: `db.PROJECT_REF.supabase.co:5432`
- ✅ Mode: "Transaction" in Supabase dashboard

### Connection Pooler (Port 6543) - For Applications
- ✅ Use for: Application runtime connections
- ✅ URL format: `aws-X-REGION.pooler.supabase.com:6543`
- ✅ Mode: "Session" in Supabase dashboard
- ❌ **NOT for migrations**

## Summary

1. **Cancel** the stuck command (Ctrl+C)
2. **Get direct connection** from Supabase (Transaction mode, port 5432)
3. **Update** `.env` with direct connection string
4. **Run** `npx prisma db push` again

