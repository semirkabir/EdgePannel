# Authentication Temporarily Disabled

## Status

✅ **Authentication has been temporarily disabled** to allow you to focus on the project without auth issues.

## What Was Changed

### 1. Middleware (`middleware.ts`)
- Added `AUTH_ENABLED` flag (currently set to `false`)
- When disabled, all routes are accessible without authentication

### 2. API Routes
- `/api/trading/route.ts` - Uses mock user ID when auth is disabled
- `/api/user/api-keys/route.ts` - Uses mock user ID when auth is disabled

### 3. Dashboard Page (`app/dashboard/page.tsx`)
- Bypasses session checks when auth is disabled
- Shows "Auth Disabled (Dev Mode)" instead of user email
- Hides sign out button when auth is disabled

### 4. Configuration File (`lib/auth-config.ts`)
- Central configuration file with `AUTH_ENABLED` flag
- Mock user ID: `test-user-001` (uses the test user from database)

## How to Re-enable Authentication

When you're ready to enable authentication again:

1. **Open `lib/auth-config.ts`**
2. **Change `AUTH_ENABLED` to `true`**:
   ```typescript
   export const AUTH_ENABLED = true
   ```

3. **Open `middleware.ts`**
4. **Change `AUTH_ENABLED` to `true`**:
   ```typescript
   const AUTH_ENABLED = true
   ```

5. **Restart your dev server**

## Current Behavior

- ✅ All routes are accessible without login
- ✅ Dashboard loads without authentication
- ✅ API routes use mock user ID (`test-user-001`)
- ✅ No redirects to login page
- ✅ All authentication code is preserved (just bypassed)

## Notes

- The authentication code is **not removed**, just bypassed
- You can re-enable it at any time by changing the flags
- The mock user ID corresponds to the test user in your database
- Login/register pages still exist but won't be required

