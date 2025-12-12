# Quick Fix for 401 Unauthorized Error

## The Problem

You're getting `401 (Unauthorized)` because the database connection is failing. NextAuth can't verify user credentials without a working database connection.

## Immediate Solution

### Step 1: Check Your Supabase Project

1. Go to **https://supabase.com/dashboard**
2. Find your project: `onwkzqbrmrskazfitshr`
3. **Check if it's paused** - if so, click "Restore" to activate it

### Step 2: Get the Correct Connection String

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Scroll to **Connection string** section
3. Select **"URI"** or **"Connection pooling"** tab
4. Copy the connection string

### Step 3: Update Your .env File

Replace your `DATABASE_URL` with the connection string from Supabase. It should look like one of these:

**Direct connection:**
```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
```

**Connection pooler (recommended):**
```
DATABASE_URL=postgresql://postgres.onwkzqbrmrskazfitshr:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Important:** Replace `[YOUR-PASSWORD]` with your actual database password. If your password has special characters, they need to be URL-encoded.

### Step 4: Restart Your Dev Server

1. Stop the current server (`Ctrl+C`)
2. Restart: `npm run dev`
3. Try logging in again

## Alternative: Register a New Account

If you can't fix the database connection right now, you can:

1. Go to **http://localhost:3000/register**
2. Create a new account with any email/password
3. This will test if registration works (which also needs the database)

## Verify Connection

After updating DATABASE_URL, test it:

```powershell
node scripts/test-nextjs-db.js
```

If you see "✅ Database connected!", the connection is working!

## Common Issues

- **Project is paused**: Restore it in Supabase dashboard
- **Wrong password**: Reset it in Supabase → Settings → Database
- **Wrong connection string**: Use the one from Supabase dashboard, not a template
- **Network blocked**: Check firewall/network settings



