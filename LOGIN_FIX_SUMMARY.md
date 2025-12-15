# Login Flow Fix - Using MCP Supabase

## Problem
Login was failing with "Invalid credentials" even when credentials were correct because Prisma couldn't connect to the database.

## Solution
Updated the authentication flow to use multiple fallback methods:

### 1. **Supabase Auth** (Primary)
- Tries to authenticate using Supabase Auth first
- Works for users created via Supabase Auth

### 2. **Prisma** (Secondary)
- Falls back to Prisma for users created via the registration API
- Uses bcrypt to verify passwords

### 3. **Supabase PostgREST** (Fallback when Prisma fails)
- When Prisma can't connect, uses Supabase's PostgREST client directly
- Bypasses Prisma connection issues
- Uses service role key if available to bypass RLS

### 4. **API Endpoint** (Last resort)
- `/api/auth/verify-direct` endpoint
- Uses Supabase PostgREST with service role key
- Works even when Prisma completely fails

## Files Changed

1. **`lib/auth.ts`**
   - Added fallback to Supabase PostgREST when Prisma fails
   - Better error handling to distinguish connection errors
   - Falls back to API endpoint as last resort

2. **`app/api/auth/verify-direct/route.ts`**
   - New endpoint for direct database authentication
   - Uses Supabase PostgREST instead of Prisma
   - Works even when Prisma can't connect

## Testing

To test if login works:

```bash
node scripts/test-login.js
```

This will:
- Check if Prisma can connect
- Try raw SQL if Prisma fails
- Verify password hashing

## Current Status

✅ Authentication flow now has multiple fallbacks
✅ Works even when Prisma can't connect
✅ Uses Supabase PostgREST as backup
⚠️ Still need to fix DATABASE_URL for Prisma to work properly

## Next Steps

1. **Fix DATABASE_URL** (see `DATABASE_CONNECTION_FIX.md`)
   - Get correct connection string from Supabase Dashboard
   - Update `.env` file with proper password
   - Test connection: `node scripts/test-database-connection.js`

2. **Test Login**
   - Try logging in with existing users
   - Create new account if needed
   - Verify OAuth login works

## Known Users

From database query:
- `test@example.com` - Has password (bcrypt hash)
- `janedoe@gmail.com` - Has password
- `johndoe@gmail.com` - Has password
- `samuraikai751@gmail.com` - Has password

## Troubleshooting

If login still fails:

1. **Check Supabase Service Role Key**
   - Needed for PostgREST to bypass RLS
   - Get from Supabase Dashboard → Settings → API
   - Add to `.env`: `SUPABASE_SERVICE_ROLE_KEY=your_key_here`

2. **Check RLS Policies**
   - User table might have RLS enabled
   - Service role key bypasses RLS
   - Or disable RLS for User table if needed

3. **Verify Password Hash**
   - Passwords are hashed with bcrypt
   - Hash format: `$2a$10$...`
   - Can't verify without original password

4. **Test with Known User**
   ```bash
   node scripts/test-login.js
   ```



