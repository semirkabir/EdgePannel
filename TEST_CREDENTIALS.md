# Test Credentials

## Test User Account

I've created a test user account in your database for testing purposes.

### Login Credentials

**Email:** `test@example.com`  
**Password:** `testpassword123`

⚠️ **Note:** The password hash has been updated. If login fails, make sure your `DATABASE_URL` is set in `.env` file.

### How to Use

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to: http://localhost:3000/login

3. Enter the credentials above

4. You'll be logged in and redirected to the dashboard

## Alternative: Create Your Own Test Account

You can also register a new account through the app:

1. Go to: http://localhost:3000/register
2. Fill in:
   - Name: Your name
   - Email: Any email (e.g., `yourname@test.com`)
   - Password: Any password (minimum 8 characters)
   - Confirm Password: Same password
3. Click "Create Account"
4. You'll be automatically logged in

## Test User Details

- **User ID:** `test-user-001`
- **Email:** `test@example.com`
- **Name:** Test User
- **Status:** Active

## Security Note

⚠️ **For Development Only**: These are test credentials. Never use these in production!

For production:
- Use strong, unique passwords
- Enable email verification
- Use OAuth providers (Google, GitHub) for better security

## Creating Additional Test Users

You can create more test users by:

1. **Through the app UI:**
   - Register at `/register` page

2. **Directly in database (using Supabase MCP):**
   - I can help create additional test users if needed

## Resetting Test User Password

If you need to reset the test user password, I can update it in the database. Just let me know what password you'd like to use.

