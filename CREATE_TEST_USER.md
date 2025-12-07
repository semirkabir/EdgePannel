# Create Test User in Supabase Auth

## Quick Method: Using the Script

I've created a script that will create a test user in Supabase Auth. You have two options:

### Option 1: Direct Admin API (Recommended)

**Prerequisites:** You need the `SUPABASE_SERVICE_ROLE_KEY` in your `.env` file.

1. **Get your Service Role Key:**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Go to **Settings** → **API**
   - Copy the **service_role** key (⚠️ Keep this secret!)

2. **Add to .env file:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. **Run the script:**
   ```bash
   node scripts/create-test-user-supabase.js
   ```

### Option 2: Via Registration API

**Prerequisites:** Your dev server must be running.

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **In another terminal, run:**
   ```bash
   node scripts/create-test-user-via-api.js
   ```

## Test Account Credentials

Once created, you can use these credentials:

- **Email:** `test@example.com`
- **Password:** `testpassword123`
- **Name:** Test User

## Verify in Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Authentication** → **Users**
4. You should see the test user listed there! ✅

## Login

1. Go to: http://localhost:3000/login
2. Enter the test credentials above
3. You should be logged in successfully! ✅

## Notes

- The user will be created in **Supabase Auth** (appears in Dashboard)
- The user will also be created in your Prisma database on first login
- If the user already exists, the script will inform you
- The password is: `testpassword123` (for development only!)

