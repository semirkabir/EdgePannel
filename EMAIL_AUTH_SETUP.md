# Email Authentication Setup Guide

## Overview

Your application now has a complete email authentication system with:
- ✅ Email verification on registration
- ✅ Password reset via email
- ✅ Resend verification email
- ✅ Secure token-based verification

## Setup Instructions

### 1. Get Resend API Key

1. Go to [Resend.com](https://resend.com) and sign up for a free account
2. Navigate to **API Keys** in the dashboard
3. Click **"Create API Key"**
4. Copy the API key (starts with `re_`)

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# Email Service (Resend)
RESEND_API_KEY=re_your_api_key_here

# Email Configuration
EMAIL_FROM=noreply@edgepannel.com
EMAIL_FROM_NAME=EdgePannel

# App URL (for email links)
NEXTAUTH_URL=http://localhost:3000
# Or for production:
# NEXTAUTH_URL=https://edgepannel.com
```

### 3. Verify Domain (Production Only)

For production, you should verify your domain in Resend:

1. Go to **Domains** in Resend dashboard
2. Add your domain: `edgepannel.com`
3. Add the DNS records provided by Resend
4. Wait for verification (usually takes a few minutes)
5. Update `EMAIL_FROM` to use your verified domain: `noreply@edgepannel.com`

**For development/testing**, you can use Resend's test domain:
- `EMAIL_FROM=onboarding@resend.dev` (works without verification)

### 4. Test Email Sending

After setting up, test the email functionality:

1. Register a new user at `/register`
2. Check your email for the verification link
3. Click the link to verify your email
4. Try the "Forgot Password" flow at `/login`

## API Endpoints

### Email Verification

**GET `/api/auth/verify-email?token={token}&email={email}`**
- Verifies user email address
- Redirects to login page with success message
- Token expires after 24 hours

**POST `/api/auth/resend-verification`**
- Resends verification email
- Body: `{ "email": "user@example.com" }`
- Rate limited: 3 requests per 15 minutes

### Password Reset

**POST `/api/auth/forgot-password`**
- Sends password reset email
- Body: `{ "email": "user@example.com" }`
- Rate limited: 3 requests per 15 minutes
- Token expires after 1 hour

**POST `/api/auth/reset-password`**
- Resets password using token
- Body: `{ "token": "...", "email": "...", "password": "..." }`
- Requires strong password (12+ chars, complexity)

## Frontend Integration

### Update Login Page

Add a "Forgot Password" link and verification status message:

```tsx
// In app/(auth)/login/page.tsx
const searchParams = useSearchParams()
const verified = searchParams.get('verified')
const message = searchParams.get('message')

{verified && (
  <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded">
    {message || 'Email verified successfully!'}
  </div>
)}

<Link href="/forgot-password" className="text-sm text-blue-400 hover:underline">
  Forgot password?
</Link>
```

### Create Forgot Password Page

Create `app/(auth)/forgot-password/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      
      if (data.success) {
        toast.success('Email sent', 'Check your inbox for password reset instructions')
      } else {
        toast.error('Error', data.message || 'Failed to send email')
      }
    } catch (error) {
      toast.error('Error', 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

### Create Reset Password Page

Create `app/(auth)/reset-password/page.tsx` that:
1. Reads `token` and `email` from query params
2. Shows password reset form
3. Calls `/api/auth/reset-password` on submit

## Security Features

✅ **Token Expiration**
- Verification tokens: 24 hours
- Reset tokens: 1 hour

✅ **Rate Limiting**
- Verification resend: 3 per 15 minutes
- Password reset: 3 per 15 minutes

✅ **User Enumeration Prevention**
- Always returns success message (even if user doesn't exist)
- Doesn't reveal if email is registered

✅ **Secure Token Generation**
- Uses crypto.randomBytes for secure tokens
- Tokens stored in database with expiration

## Troubleshooting

### Emails Not Sending

1. **Check API Key**: Verify `RESEND_API_KEY` is set correctly
2. **Check Logs**: Look for email errors in server logs
3. **Test in Development**: Use `onboarding@resend.dev` as sender
4. **Check Spam Folder**: Verification emails might be filtered

### Token Expired

- User can request a new verification email via `/api/auth/resend-verification`
- Password reset tokens can be requested again via `/api/auth/forgot-password`

### Domain Verification Issues

- For production, ensure domain is verified in Resend
- Check DNS records are correct
- Wait 24-48 hours for DNS propagation

## Next Steps

1. ✅ Set up Resend account and API key
2. ✅ Add environment variables
3. ✅ Test email sending
4. ⏳ Create forgot password page
5. ⏳ Create reset password page
6. ⏳ Update login page with verification status
7. ⏳ (Optional) Make email verification required for login

## Optional: Require Email Verification

To require email verification before login, update `lib/auth.ts`:

```typescript
// In authorize function, after password verification:
if (!user.emailVerified) {
  throw new ApiError(
    403,
    'Please verify your email address before logging in',
    ErrorCodes.EMAIL_NOT_VERIFIED
  )
}
```

Then create a custom error code in `lib/api/error-codes.ts`:
```typescript
export const ErrorCodes = {
  // ... existing codes
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
}
```
