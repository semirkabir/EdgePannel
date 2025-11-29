# Fix: 401 Unauthorized Error

## The Problem

You're getting `401 (Unauthorized)` when trying to log in because:
- **DATABASE_URL is not set or incorrect** in your `.env` file
- NextAuth can't connect to the database to verify credentials
- The authentication check fails before it can validate your password

## The Solution

### Step 1: Set DATABASE_URL

Run this command to update your database password:

```bash
node scripts/update-database-password.js
```

This will:
1. Ask for your Supabase database password
2. Automatically URL-encode special characters
3. Update your `.env` file with the correct DATABASE_URL

### Step 2: Verify NEXTAUTH_SECRET is Set

Make sure your `.env` file has:

```env
NEXTAUTH_SECRET=your_secret_here
```

If missing, run:
```bash
node scripts/setup-env-with-supabase.js
```

### Step 3: Restart Your Dev Server

After updating `.env`:

1. Stop your current dev server (Ctrl+C)
2. Restart it:
   ```bash
   npm run dev
   ```

### Step 4: Test Login Again

Go to http://localhost:3000/login and try:
- Email: `test@example.com`
- Password: `testpassword123`

## Quick Diagnostic

Run this to check your setup:

```bash
node scripts/test-login.js
```

This will tell you:
- ✅ If database connection works
- ✅ If test user exists
- ✅ If password is correct

## Common Issues

### Issue 1: DATABASE_URL has [YOUR-PASSWORD]
**Fix:** Replace `[YOUR-PASSWORD]` with your actual password

### Issue 2: Password has special characters
**Fix:** Use the script - it auto-encodes them:
```bash
node scripts/update-database-password.js
```

### Issue 3: NEXTAUTH_SECRET missing
**Fix:** Run:
```bash
node scripts/setup-env-with-supabase.js
```

## After Fixing

Once DATABASE_URL is correct:
1. ✅ NextAuth can connect to database
2. ✅ User lookup will work
3. ✅ Password verification will work
4. ✅ Login will succeed

The 401 error will disappear once the database connection is working!

