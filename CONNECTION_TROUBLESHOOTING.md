# Connection Troubleshooting - Can't Reach Database Server

## Current Error
```
Error: P1001: Can't reach database server at `db.onwkzqbrmrskazfitshr.supabase.co:5432`
```

## Possible Causes & Solutions

### 1. Password Not Replaced or Incorrect ⚠️ (Most Common)

**Check:**
- Open your `.env` file
- Look for `DATABASE_URL`
- Make sure `[YOUR-PASSWORD]` is replaced with your actual password
- Make sure there are NO brackets `[]` around the password

**Fix:**
```bash
node scripts/fix-database-url.js
```

### 2. Password Has Special Characters

If your password contains `@`, `#`, `%`, `&`, etc., they need to be URL-encoded.

**Example:**
- Password: `MyP@ss#123`
- Should be: `MyP%40ss%23123` in the connection string

**Fix:**
```bash
node scripts/fix-database-url.js
```
This automatically encodes special characters.

### 3. Supabase Project Paused or Inactive

**Check:**
1. Go to https://supabase.com/dashboard
2. Check if your project `onwkzqbrmrskazfitshr` shows as:
   - ✅ **Active** (green)
   - ❌ **Paused** (gray) - Click "Restore" to reactivate

**Fix:**
- If paused, click "Restore project" in Supabase dashboard
- Wait 1-2 minutes for it to become active

### 4. Wrong Connection String Format

**Correct format:**
```
postgresql://postgres:password@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
```

**Common mistakes:**
- ❌ Missing `postgresql://` prefix
- ❌ Wrong hostname (should be `db.onwkzqbrmrskazfitshr.supabase.co`)
- ❌ Wrong port (should be `5432`)
- ❌ Wrong database name (should be `postgres`)

### 5. Network/Firewall Issues

**Check:**
- Your internet connection
- Firewall settings
- Corporate VPN (might block connections)

**Test:**
```bash
# Test if you can reach Supabase
ping db.onwkzqbrmrskazfitshr.supabase.co
```

### 6. IP Restrictions (Less Common)

Some Supabase projects have IP restrictions.

**Check:**
1. Supabase Dashboard → Settings → Database
2. Look for "Connection Pooling" or "IP Restrictions"
3. If enabled, either:
   - Disable IP restrictions (for development)
   - Add your current IP address

## Step-by-Step Fix

### Step 1: Verify Supabase Project Status
1. Go to https://supabase.com/dashboard
2. Check project status
3. If paused, restore it

### Step 2: Get Fresh Connection String
1. Supabase Dashboard → Settings → Database
2. Scroll to "Connection string"
3. Select **"Transaction"** mode
4. Copy the connection string

### Step 3: Use Helper Script
```bash
node scripts/fix-database-url.js
```

This will:
- Ask for your project reference: `onwkzqbrmrskazfitshr`
- Ask for your password
- Automatically URL-encode special characters
- Generate correct connection string
- Optionally update your `.env` file

### Step 4: Test Connection
```bash
node scripts/verify-db-connection.js
```

### Step 5: Run Migration
```bash
npx prisma db push
```

## Quick Diagnostic Commands

### Check connection string format:
```bash
node scripts/check-connection-type.js
```

### Test connection:
```bash
node scripts/verify-db-connection.js
```

### Generate correct connection string:
```bash
node scripts/fix-database-url.js
```

## Still Not Working?

### Option 1: Reset Database Password
1. Supabase Dashboard → Settings → Database
2. Click "Reset database password"
3. Save the new password
4. Update your `.env` file with new password

### Option 2: Check Supabase Status
Visit: https://status.supabase.com
- Check if there are any outages
- Check your region's status

### Option 3: Try Connection Pooler (Temporary)
If direct connection doesn't work, you can try the pooler for testing:
1. Supabase Dashboard → Settings → Database
2. Select **"Session"** mode
3. Copy connection string
3. Update `.env`
4. Note: This might not work for migrations, but can test connectivity

## Most Likely Solution

Based on the error, the most common issue is:
1. **Password not replaced** - Make sure `[YOUR-PASSWORD]` is gone
2. **Special characters** - Use the helper script to auto-encode
3. **Project paused** - Check Supabase dashboard

Run this to fix automatically:
```bash
node scripts/fix-database-url.js
```


