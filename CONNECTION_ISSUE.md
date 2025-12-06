# Connection Issue - Can't Reach Database Server

## Current Situation

✅ **Supabase MCP works** - Database is accessible via MCP  
✅ **.env file is set** - DATABASE_URL is configured  
❌ **Prisma can't connect** - Getting "Can't reach database server"

## Possible Causes

### 1. Password Issue (Most Likely)

The password in your connection string might be:
- Incorrect
- Not properly URL-encoded
- Has special characters that need encoding

### 2. Supabase Project Status

Check if your Supabase project is:
- ✅ **Active** (not paused)
- ✅ **Fully provisioned**
- ✅ **In the correct region**

### 3. Network/Firewall

Your local network might be blocking the connection to Supabase.

## Solutions

### Solution 1: Fix Password Encoding (Try This First)

Run this script to properly encode your password:

```bash
node scripts/fix-password-encoding.js
```

This will:
1. Ask for your password
2. Properly URL-encode it
3. Update your .env file
4. Test the connection

### Solution 2: Reset Database Password

If the password might be wrong:

1. Go to Supabase Dashboard
2. Settings → Database
3. Click **"Reset database password"**
4. Save the new password
5. Run: `node scripts/fix-password-encoding.js`
6. Enter the new password

### Solution 3: Check Supabase Project Status

1. Go to https://supabase.com/dashboard
2. Check if project `onwkzqbrmrskazfitshr` is:
   - **Active** (green status)
   - **Not paused** (if paused, click "Restore")

### Solution 4: Try Connection Pooler

If direct connection doesn't work, try the pooler:

1. Supabase Dashboard → Settings → Database
2. Under "Connection string", select **"Session"** mode
3. Copy that connection string (uses port 6543)
4. Update your .env file

**Note:** Pooler might not work for Prisma migrations, but can work for app connections.

### Solution 5: Check Network

Test if you can reach Supabase:

```bash
ping db.onwkzqbrmrskazfitshr.supabase.co
```

If ping fails, there might be network/firewall issues.

## Quick Test

Run this to test with properly encoded password:

```bash
node scripts/fix-password-encoding.js
```

This will encode your password correctly and test the connection.

## Why MCP Works But Prisma Doesn't

Supabase MCP uses a different authentication method (API keys) that doesn't require the database password. Prisma needs the direct database connection string with the password.

## Next Steps

1. **Try Solution 1 first** - Fix password encoding
2. If that doesn't work, **reset the database password** in Supabase
3. If still failing, check **Supabase project status**
4. As last resort, try **connection pooler**

The most common issue is password encoding, so start with Solution 1!


