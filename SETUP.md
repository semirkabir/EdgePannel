# Setup Guide

## Generating Secrets

You need two important secrets for the application:

### Option 1: Use the provided script (Recommended)

Run the following command to generate both secrets:

```bash
npm run generate-secrets
```

This will generate:
- `NEXTAUTH_SECRET` - Used by NextAuth.js for session encryption
- `ENCRYPTION_KEY` - Used to encrypt user API keys in the database

### Option 2: Generate manually

You can also generate these secrets manually using Node.js:

**For NEXTAUTH_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**For ENCRYPTION_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Option 3: Use OpenSSL (if available)

**For NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

**For ENCRYPTION_KEY:**
```bash
openssl rand -base64 32
```

## Environment Variables

Create a `.env` file in the root directory with the following:

```env
# Database (Supabase)
DATABASE_URL=your_postgresql_connection_string

# Supabase Auth (Required for user authentication)
NEXT_PUBLIC_SUPABASE_URL=https://onwkzqbrmrskazfitshr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# NextAuth
NEXTAUTH_SECRET=your_generated_secret_here
NEXTAUTH_URL=http://localhost:3000

# Encryption (for API key encryption)
ENCRYPTION_KEY=your_generated_secret_here

# Polymarket (optional - for server-side proxy if needed)
POLYMARKET_API_KEY=

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### Getting Supabase Auth Keys

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. You'll find:
   - **Project URL**: This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key**: This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key**: This is your `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

**Important**: The service role key has admin privileges. Never expose it in client-side code or commit it to version control.

## Important Notes

1. **Never commit your `.env` file** - It's already in `.gitignore`
2. **Use different secrets for production** - Generate new secrets for production environments
3. **Keep secrets secure** - These are used to encrypt sensitive data
4. **NEXTAUTH_SECRET** - Must be at least 32 characters (base64 encoded)
5. **ENCRYPTION_KEY** - Must be at least 32 characters (base64 encoded)

## Quick Start

1. Generate secrets:
   ```bash
   npm run generate-secrets
   ```

2. Copy the generated secrets to your `.env` file

3. Add your `DATABASE_URL` to the `.env` file

4. Run database migrations:
   ```bash
   npx prisma db push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```



