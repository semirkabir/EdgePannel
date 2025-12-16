# Fix Database Connection for OAuth Login

## The Problem

OAuth login (Google/Twitter) is failing because Prisma cannot connect to your Supabase database. The error shows:
```
Can't reach database server at `db.onwkzqbrmrskazfitshr.supabase.co:5432`
```

## Why This Happens

The Supabase MCP can connect (which is why registration works), but Prisma from your local machine cannot. This is usually due to:

1. **Incorrect database password** in DATABASE_URL
2. **IP restrictions** enabled in Supabase
3. **Network/firewall** blocking the connection
4. **Supabase project paused** (though MCP would also fail)

## Quick Fix Steps

### Step 1: Verify Your Database Password

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: `onwkzqbrmrskazfitshr`
3. Go to **Settings** → **Database**
4. If you don't know your password, click **"Reset database password"**
5. **Save the new password** somewhere safe

### Step 2: Get the Correct Connection String

1. Still in **Settings** → **Database**
2. Scroll to **"Connection string"** section
3. Select **"Connection pooling"** tab (NOT "Direct connection")
4. Select **"Transaction"** mode
5. Copy the connection string

It should look like:
```
postgresql://postgres.onwkzqbrmrskazfitshr:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Step 3: Update Your .env File

1. Open your `.env` file
2. Find the `DATABASE_URL` line
3. Replace it with the connection string from Step 2
4. **Important**: Replace `[YOUR-PASSWORD]` with your actual password
5. If your password has special characters, URL-encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `%` → `%25`
   - `!` → `%21`

Example:
```env
DATABASE_URL=postgresql://postgres.onwkzqbrmrskazfitshr:MyP%40ssw0rd@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Step 4: Check IP Restrictions

1. In Supabase Dashboard → **Settings** → **Database**
2. Scroll to **"Connection pooling"** section
3. Check if **"IP allowlist"** is enabled
4. If enabled, either:
   - Add your current IP address, OR
   - Disable it temporarily for testing

### Step 5: Test the Connection

Run this command to test:
```bash
node scripts/test-database-connection.js
```

If it works, you'll see:
```
✅ Database connection successful!
✅ Found X user(s) in database
```

### Step 6: Restart Your Dev Server

1. Stop your current server (`Ctrl+C`)
2. Restart: `npm run dev`
3. Try OAuth login again

## Alternative: Use Email/Password Registration

If you can't fix the database connection right now, you can still use the app:

1. Go to **http://localhost:3000/register**
2. Create an account with email/password
3. This uses the fallback registration method (doesn't require Supabase Service Role Key)

## Still Not Working?

If the connection still fails after these steps:

1. **Verify Supabase project is active**: Check the dashboard - the project should not be paused
2. **Try resetting database password**: Supabase Dashboard → Settings → Database → Reset password
3. **Check network**: Make sure you're not behind a corporate firewall blocking port 6543
4. **Try direct connection**: Use port 5432 instead of 6543 (less reliable but sometimes works)

## Need Help?

The connection string format should be:
- **Pooler (recommended)**: `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`
- **Direct**: `postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require`

Replace:
- `PROJECT_REF` with `onwkzqbrmrskazfitshr`
- `PASSWORD` with your actual password (URL-encoded if needed)




