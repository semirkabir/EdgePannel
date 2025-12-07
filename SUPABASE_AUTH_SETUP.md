# Supabase Auth Setup Guide

## Overview

Your application now uses **Supabase Auth** for user authentication. All user registrations and logins go through Supabase Auth, and users will appear in your Supabase Dashboard under **Authentication > Users**.

## What Changed

1. **Registration**: New users are created in Supabase Auth (not just the database)
2. **Login**: User authentication is verified through Supabase Auth
3. **User Management**: All users are visible in Supabase Dashboard → Authentication → Users

## Required Environment Variables

Add these to your `.env` file:

```env
# Supabase Auth (Required)
NEXT_PUBLIC_SUPABASE_URL=https://onwkzqbrmrskazfitshr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## How to Get Your Supabase Keys

### Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard
2. Select your project (or create a new one)

### Step 2: Navigate to API Settings

1. Click on **Settings** (gear icon in the left sidebar)
2. Click on **API** in the settings menu

### Step 3: Copy Your Keys

You'll see three important values:

1. **Project URL**
   - Copy this value → `NEXT_PUBLIC_SUPABASE_URL`
   - Example: `https://onwkzqbrmrskazfitshr.supabase.co`

2. **anon public key**
   - Copy this value → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - This is safe to use in client-side code

3. **service_role key** ⚠️
   - Copy this value → `SUPABASE_SERVICE_ROLE_KEY`
   - **IMPORTANT**: This key has admin privileges!
   - **NEVER** expose this in client-side code
   - **NEVER** commit this to version control
   - Only use it in server-side code (API routes)

### Step 4: Add to .env File

Add all three values to your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://onwkzqbrmrskazfitshr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Verify Setup

### 1. Check Environment Variables

Make sure all three Supabase variables are set in your `.env` file.

### 2. Test Registration

1. Start your dev server: `npm run dev`
2. Go to: http://localhost:3000/register
3. Create a new account
4. Check Supabase Dashboard → **Authentication** → **Users**
5. You should see your new user listed there! ✅

### 3. Test Login

1. Go to: http://localhost:3000/login
2. Log in with the account you just created
3. You should be able to log in successfully ✅

## How It Works

### User Registration Flow

1. User submits registration form
2. Server creates user in **Supabase Auth** (appears in Dashboard)
3. Server also creates user record in Prisma database (for compatibility)
4. User can now log in

### User Login Flow

1. User submits login credentials
2. Server authenticates with **Supabase Auth**
3. If successful, NextAuth creates a session
4. User is logged in

## Viewing Users in Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Authentication** in the left sidebar
4. Click **Users**
5. You'll see all registered users with:
   - Email address
   - User ID (UUID)
   - Created date
   - Last sign in
   - Email verification status

## Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY is not set"

- Make sure you've added `SUPABASE_SERVICE_ROLE_KEY` to your `.env` file
- Restart your dev server after adding the variable
- Check that the key is correct (no extra spaces or quotes)

### Users not appearing in Supabase Dashboard

- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Verify the registration API route is working (check server logs)
- Make sure you're looking in the correct Supabase project

### Login not working

- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
- Check that the user exists in Supabase Auth (Dashboard → Authentication → Users)
- Check server logs for authentication errors

## Security Notes

- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to use in client-side code
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` must **ONLY** be used in server-side code
- 🔒 Never commit `.env` file to version control
- 🔒 The service role key bypasses Row Level Security (RLS) - use carefully

## Benefits

✅ **Centralized User Management**: All users in one place (Supabase Dashboard)  
✅ **Built-in Security**: Supabase handles password hashing, email verification, etc.  
✅ **Scalable**: Supabase Auth is production-ready and handles millions of users  
✅ **Easy Management**: View, edit, and manage users directly in the dashboard  
✅ **Email Verification**: Built-in email verification support  
✅ **Password Reset**: Built-in password reset functionality  

## Next Steps

- [ ] Add email verification flow
- [ ] Add password reset functionality
- [ ] Configure OAuth providers (Google, GitHub) in Supabase
- [ ] Set up Row Level Security (RLS) policies if needed

