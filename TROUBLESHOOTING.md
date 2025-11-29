# Database Connection Troubleshooting

## Common Supabase Connection Issues

### Issue: "Can't reach database server"

This usually means one of these problems:

#### 1. **Connection String Format Issue**

Your `DATABASE_URL` should look like this:
```
postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

**Common mistakes:**
- ❌ Forgot to replace `[YOUR-PASSWORD]` with actual password
- ❌ Using wrong connection string (should be "Transaction" mode)
- ❌ Missing `postgresql://` prefix
- ❌ Wrong port (should be `5432`)

#### 2. **Password with Special Characters**

If your password has special characters like `@`, `#`, `%`, etc., you need to URL-encode them:

- `@` becomes `%40`
- `#` becomes `%23`
- `%` becomes `%25`
- `&` becomes `%26`
- `+` becomes `%2B`
- `/` becomes `%2F`
- `=` becomes `%3D`

**Example:**
If your password is `MyP@ss#123`, the connection string should be:
```
postgresql://postgres:MyP%40ss%23123@db.xxxxx.supabase.co:5432/postgres
```

#### 3. **Using Wrong Connection String Type**

In Supabase, you have two connection string options:

**Direct Connection** (for migrations):
```
postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

**Connection Pooling** (for applications):
```
postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**For Prisma migrations, use the DIRECT connection** (port 5432)

#### 4. **IP Whitelisting**

Supabase may block connections from unknown IPs. Check:
1. Go to Supabase Dashboard → Settings → Database
2. Check "Connection Pooling" settings
3. See if there are IP restrictions

#### 5. **Project Not Active**

Make sure your Supabase project is:
- ✅ Fully created (wait 2-3 minutes after creation)
- ✅ Not paused (free tier projects pause after inactivity)
- ✅ In the correct region

## Step-by-Step Fix

### Step 1: Get the Correct Connection String

1. Go to Supabase Dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection string** section
5. Under **Connection pooling**, select **"Transaction"** mode
6. Copy the connection string
7. It should look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```

### Step 2: Replace Password

1. Replace `[YOUR-PASSWORD]` with your actual database password
2. If password has special characters, URL-encode them
3. The final string should NOT have brackets `[]`

### Step 3: Test Connection

Run:
```bash
node scripts/verify-db-connection.js
```

Or test with Prisma:
```bash
npx prisma db push
```

### Step 4: Alternative - Use Connection Pooling URL

If direct connection doesn't work, try the pooling URL:

1. In Supabase Dashboard → Settings → Database
2. Under **Connection string**, select **"Session"** mode
3. Copy that connection string
4. Update your `.env` file
5. Note: Pooling URL uses port `6543` or `5432` depending on mode

## Quick Fix Script

If you have special characters in your password, use this Node.js script:

```javascript
const password = "Your@Password#123";
const encoded = encodeURIComponent(password);
console.log("Encoded password:", encoded);
```

Then use the encoded password in your connection string.

## Still Not Working?

1. **Reset Database Password**:
   - Supabase Dashboard → Settings → Database
   - Click "Reset database password"
   - Use the new password

2. **Check Supabase Status**:
   - Visit https://status.supabase.com
   - Check if there are any outages

3. **Try Different Connection Method**:
   - Use Supabase's connection pooler
   - Or try connecting via Supabase Studio

4. **Verify Project Reference**:
   - Make sure `onwkzqbrmrskazfitshr` is your correct project reference
   - Check in Supabase Dashboard URL

## Example .env File

```env
# Correct format
DATABASE_URL=postgresql://postgres:your_actual_password@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres

# If password has special characters, URL encode them
# Password: MyP@ss#123
# DATABASE_URL=postgresql://postgres:MyP%40ss%23123@db.onwkzqbrmrskazfitshr.supabase.co:5432/postgres
```

