# Fix: 401 Unauthorized - Database Connection Issue

## The Problem

You're getting `401 (Unauthorized)` because the database connection is failing. NextAuth can't verify user credentials without a working database connection.

## Current Issue

The connection to your Supabase database is failing:
```
Can't reach database server at `db.onwkzqbrmrskazfitshr.supabase.co:5432`
```

## Solutions

### Option 1: Verify Supabase Project Status

1. Go to https://supabase.com/dashboard
2. Check if your project `onwkzqbrmrskazfitshr` is **active** (not paused)
3. If paused, click "Restore" to activate it

### Option 2: Use Connection Pooler (Recommended)

Supabase projects often use a connection pooler. Try updating your `DATABASE_URL` to use the pooler:

**Direct connection (current):**
```
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

**Connection pooler (try this):**
```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

Or for transaction mode:
```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

To get your pooler URL:
1. Go to Supabase Dashboard → Settings → Database
2. Look for "Connection string" or "Connection pooling"
3. Copy the pooler connection string

### Option 3: Reset Database Password

If the password might be incorrect:

1. Go to Supabase Dashboard → Settings → Database
2. Click "Reset database password"
3. Copy the new password
4. Run: `node scripts/update-database-password.js`
5. Enter the new password when prompted

### Option 4: Check Network/Firewall

- Make sure your firewall allows connections to Supabase
- Try connecting from a different network
- Check if your ISP blocks database connections

## After Fixing

Once the database connection works:

1. **Restart your dev server:**
   ```powershell
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Test login with:**
   - Email: `test@example.com`
   - Password: `testpassword123`

3. **If test user doesn't exist**, register a new account at `/register`

## Quick Test

Run this to test the connection:
```powershell
node scripts/test-login.js
```

If it shows "✅ Database connected", the connection is working!

