# Quick Fix for Database Connection Error

## The Problem
```
Error: P1001: Can't reach database server at `db.onwkzqbrmrskazfitshr.supabase.co:5432`
```

## Most Common Causes

### 1. Password Not Replaced ⚠️ (Most Common)

Your connection string probably still has `[YOUR-PASSWORD]` in it. You need to replace it with your actual Supabase database password.

**Wrong:**
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
```

**Correct:**
```env
DATABASE_URL=postgresql://postgres:your_actual_password@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
```

### 2. Special Characters in Password

If your password has `@`, `#`, `%`, etc., you need to URL-encode them.

**Example:**
- Password: `MyP@ss#123`
- Encoded: `MyP%40ss%23123`

**Use this tool to encode:**
```bash
node scripts/fix-database-url.js
```

## Quick Fix Steps

### Option 1: Use the Helper Script (Easiest)

```bash
node scripts/fix-database-url.js
```

This will:
1. Ask for your project reference (you already have: `onwkzqbrmrskazfitshr`)
2. Ask for your password
3. Generate the correct connection string
4. Optionally update your .env file

### Option 2: Manual Fix

1. **Get your password:**
   - Go to Supabase Dashboard
   - Settings → Database
   - If you forgot it, click "Reset database password"

2. **Get connection string:**
   - Still in Settings → Database
   - Scroll to "Connection string"
   - Select "Transaction" mode
   - Copy the string

3. **Replace password:**
   - Replace `[YOUR-PASSWORD]` with your actual password
   - If password has special chars, URL-encode them

4. **Update .env:**
   ```env
   DATABASE_URL=postgresql://postgres:your_password@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
   ```

5. **Test:**
   ```bash
   npx prisma db push
   ```

## Verify Your Supabase Project

1. Go to https://supabase.com/dashboard
2. Check if project `onwkzqbrmrskazfitshr` is:
   - ✅ Active (not paused)
   - ✅ Fully created (green status)
   - ✅ In the correct region

## Still Not Working?

Try the connection pooling URL instead:

1. Supabase Dashboard → Settings → Database
2. Under "Connection string", select **"Session"** mode
3. Copy that URL (uses port 6543)
4. Update your .env file

## Test Connection

After updating, test with:
```bash
node scripts/verify-db-connection.js
```

Or:
```bash
npx prisma db push
```



