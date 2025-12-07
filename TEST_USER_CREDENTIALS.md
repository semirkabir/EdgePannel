# Test User Account - Supabase Auth

## Test Credentials

I've set up scripts to create a test user account in Supabase Auth. The user will appear in your Supabase Dashboard under **Authentication > Users**.

### Login Credentials

- **Email:** `test@example.com`
- **Password:** `testpassword123`
- **Name:** Test User

## How to Create the Test User

### Method 1: Using the Script (Requires Service Role Key)

1. **Get your Supabase Service Role Key:**
   - Go to: https://supabase.com/dashboard
   - Select your project: `onwkzqbrmrskazfitshr`
   - Go to **Settings** → **API**
   - Copy the **service_role** key (⚠️ Keep this secret!)

2. **Add to your `.env` file:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. **Run the script:**
   ```bash
   npm run create-test-user
   ```
   
   Or directly:
   ```bash
   node scripts/create-test-user-supabase.js
   ```

### Method 2: Via Registration API (Server Must Be Running)

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **In another terminal, run:**
   ```bash
   node scripts/create-test-user-via-api.js
   ```

### Method 3: Manual Registration

1. Go to: http://localhost:3000/register
2. Enter:
   - Email: `test@example.com`
   - Password: `testpassword123`
   - Name: `Test User`
3. Click "Create Account"
4. The user will be created in Supabase Auth automatically!

## Verify in Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Authentication** → **Users**
4. You should see `test@example.com` listed there! ✅

## Login

1. Go to: http://localhost:3000/login
2. Enter:
   - Email: `test@example.com`
   - Password: `testpassword123`
3. Click "Sign In"
4. You should be logged in successfully! ✅

## Important Notes

- ⚠️ **For Development Only**: These are test credentials. Never use in production!
- 🔒 The user is created in **Supabase Auth** (not just the database)
- ✅ The user will appear in Supabase Dashboard → Authentication → Users
- 📝 The password is stored securely by Supabase Auth (not in your database)

## Troubleshooting

### "SUPABASE_SERVICE_ROLE_KEY is not set"
- Add the service role key to your `.env` file (see Method 1 above)
- Restart your terminal/IDE after adding it

### "User already exists"
- The test user already exists - you can use it to log in!
- If you want to reset it, delete the user in Supabase Dashboard first

### "Could not connect to server" (Method 2)
- Make sure `npm run dev` is running
- Wait for the server to fully start before running the script

## Security Reminder

- 🔒 Never commit `.env` file to version control
- 🔒 Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- 🔒 The service role key has admin privileges - keep it secret!

