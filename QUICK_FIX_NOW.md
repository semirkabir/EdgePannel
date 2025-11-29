# Quick Fix - Connection Error

## Your Current Error
```
Error: P1001: Can't reach database server at `db.onwkzqbrmrskazfitshr.supabase.co:5432`
```

## Most Likely Causes (in order)

### 1. Password Not Replaced ⚠️ (90% of cases)

Your `.env` file probably still has `[YOUR-PASSWORD]` or the password is incorrect.

**Check your .env file:**
- Open `.env` in your editor
- Look for `DATABASE_URL=`
- Make sure there are NO brackets `[]` around the password
- Make sure the password is your actual Supabase database password

### 2. Special Characters in Password

If your password has `@`, `#`, `%`, `&`, `+`, `/`, `=` - they need URL encoding.

**Example:**
- Password: `MyP@ss#123`
- In connection string: `MyP%40ss%23123`

### 3. Supabase Project Paused

1. Go to https://supabase.com/dashboard
2. Check if project `onwkzqbrmrskazfitshr` is **Active** (green) or **Paused** (gray)
3. If paused, click "Restore project"

## EASIEST FIX - Use the Helper Script

Run this command:

```bash
node scripts/fix-database-url.js
```

It will:
1. Ask for your Supabase project reference (you have: `onwkzqbrmrskazfitshr`)
2. Ask for your database password
3. Automatically URL-encode special characters
4. Generate the correct connection string
5. Optionally update your `.env` file automatically

## Manual Fix Steps

### Step 1: Get Your Password
- Go to Supabase Dashboard → Settings → Database
- If you forgot it, click "Reset database password"
- Save the new password

### Step 2: Get Connection String
- Still in Settings → Database
- Scroll to "Connection string"
- Select **"Transaction"** mode
- Copy the string

### Step 3: Replace Password
- The string will have `[YOUR-PASSWORD]`
- Replace it with your actual password
- If password has special chars, URL-encode them:
  - `@` → `%40`
  - `#` → `%23`
  - `%` → `%25`
  - `&` → `%26`
  - `+` → `%2B`
  - `/` → `%2F`
  - `=` → `%3D`

### Step 4: Update .env
```env
DATABASE_URL=postgresql://postgres:your_encoded_password@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
```

### Step 5: Test
```bash
npx prisma db push
```

## Still Not Working?

1. **Verify Supabase project is active** - Check dashboard
2. **Reset database password** - Get a fresh password
3. **Check Supabase status** - https://status.supabase.com
4. **Try ping test** - `ping db.onwkzqbrmrskazfitshr.supabase.co`

## Recommended: Use the Script

Just run:
```bash
node scripts/fix-database-url.js
```

It handles everything automatically! 🚀

