# Production Configuration for edgepannel.com

## Domain Configuration

Your production domain: **edgepannel.com**

## Environment Variables for Production

Update your production `.env` file with:

```env
# App URL
NEXTAUTH_URL=https://edgepannel.com

# Email Configuration
EMAIL_FROM=noreply@edgepannel.com
EMAIL_FROM_NAME=EdgePannel

# OAuth Callback URLs (already configured in OAuth providers)
# Google: https://edgepannel.com/api/auth/callback/google
# X (Twitter): https://edgepannel.com/api/auth/callback/twitter
# GitHub: https://edgepannel.com/api/auth/callback/github
```

## OAuth Provider Configuration

### Google OAuth
- **Authorized JavaScript origins**: `https://edgepannel.com`
- **Authorized redirect URIs**: `https://edgepannel.com/api/auth/callback/google`

### X (Twitter) OAuth
- **Callback URI**: `https://edgepannel.com/api/auth/callback/twitter`
- **Website URL**: `https://edgepannel.com`

### GitHub OAuth
- **Authorization callback URL**: `https://edgepannel.com/api/auth/callback/github`

## Email Domain Setup

### Resend Domain Verification

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add domain: `edgepannel.com`
3. Add the provided DNS records to your domain:
   - **SPF Record**: `v=spf1 include:_spf.resend.com ~all`
   - **DKIM Records**: (provided by Resend)
   - **DMARC Record**: (optional but recommended)
4. Wait for verification (usually 5-15 minutes)
5. Once verified, use: `EMAIL_FROM=noreply@edgepannel.com`

### DNS Records Needed

Add these to your DNS provider (wherever edgepannel.com is hosted):

```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

Type: CNAME
Name: resend._domainkey
Value: (provided by Resend)

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@edgepannel.com
```

## SSL/HTTPS

Ensure your production server has SSL certificates configured:
- Let's Encrypt (free)
- Cloudflare SSL
- Your hosting provider's SSL

## Database

Make sure your production `DATABASE_URL` points to your production database (not localhost).

## Security Checklist

- [ ] All environment variables set in production
- [ ] `NEXTAUTH_SECRET` is unique for production
- [ ] `ENCRYPTION_KEY` is unique for production
- [ ] OAuth credentials are production credentials (not dev)
- [ ] Database connection is secure (SSL required)
- [ ] Email domain verified in Resend
- [ ] SSL certificate installed and working
- [ ] All OAuth callback URLs configured correctly
- [ ] Rate limiting enabled
- [ ] CORS configured correctly (if needed)

## Testing Production

After deployment:

1. Test OAuth sign-in:
   - Google: https://edgepannel.com/login → Click Google button
   - X: https://edgepannel.com/login → Click X button

2. Test email verification:
   - Register new account
   - Check email for verification link
   - Verify link works

3. Test password reset:
   - Use "Forgot Password" on login page
   - Check email for reset link
   - Verify reset works

## Monitoring

Set up monitoring for:
- OAuth callback errors
- Email delivery failures
- Database connection issues
- Rate limiting triggers

## Support

If you encounter issues in production:
1. Check server logs
2. Verify all environment variables are set
3. Test OAuth callbacks manually
4. Check Resend dashboard for email delivery status
5. Verify DNS records are correct
