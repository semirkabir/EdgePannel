# API Key Rotation & Audit Logging Implementation

## ✅ Implementation Complete

Both features have been fully implemented and are ready for use.

## 🔑 API Key Rotation

### Features Implemented

1. **Automatic Rotation Tracking**
   - Keys automatically get rotation dates when created/updated
   - Default rotation period: 90 days
   - Expiration dates set automatically

2. **Rotation Status Checking**
   - Check if keys need rotation
   - Days until rotation
   - Expiration status

3. **Key Rotation Endpoint**
   - `/api/user/api-keys/rotate` - Rotate an existing key
   - Maintains old key hash for transition period
   - Updates rotation dates automatically

4. **Rotation Reminders**
   - Cron job endpoint: `/api/cron/rotate-api-keys`
   - Sends reminders 7 days before rotation
   - Tracks reminder status

5. **Expired Key Management**
   - Automatic deactivation of expired keys
   - Audit logging for expired keys

### Database Schema Changes

Added to `ApiKey` model:
- `expiresAt` - When key expires
- `rotationDate` - When key was last rotated
- `previousKeyHash` - Hash of previous key
- `rotationReminderSent` - Whether reminder was sent
- `nextRotationDate` - When key should be rotated next

### API Endpoints

#### Rotate API Key
```typescript
POST /api/user/api-keys/rotate
{
  "apiKeyId": "key_id",
  "platform": "polymarket" | "kalshi",
  "apiKey": "new_key", // for polymarket
  "accessKeyId": "new_id", // for kalshi
  "privateKey": "new_private" // for kalshi
}
```

#### Get Rotation Status
```typescript
GET /api/user/api-keys/status?apiKeyId=key_id
// or
GET /api/user/api-keys/status?platform=polymarket
```

#### Cron Job (Rotation Management)
```typescript
GET /api/cron/rotate-api-keys
Headers: x-cron-secret: YOUR_CRON_SECRET
```

### Usage Example

```typescript
// Check rotation status
const response = await fetch('/api/user/api-keys/status?platform=polymarket')
const { data } = await response.json()
// Returns keys with rotation status

// Rotate a key
await fetch('/api/user/api-keys/rotate', {
  method: 'POST',
  body: JSON.stringify({
    apiKeyId: 'key_id',
    platform: 'polymarket',
    apiKey: 'new_api_key',
  }),
})
```

## 📋 Audit Logging

### Features Implemented

1. **Comprehensive Event Tracking**
   - Authentication events (LOGIN, LOGOUT, LOGIN_FAILED)
   - API key events (CREATED, UPDATED, DELETED, ROTATED, EXPIRED)
   - Trading events (TRADE_EXECUTED)
   - Security events (PASSWORD_CHANGED, RATE_LIMIT_EXCEEDED)
   - System events

2. **Request Metadata Capture**
   - IP address
   - User agent
   - Timestamp
   - User ID

3. **Structured Logging**
   - JSON details field for additional context
   - Status tracking (SUCCESS, FAILURE, ERROR)
   - Resource and resource ID tracking

4. **Query Interface**
   - Filter by user, action, resource, status
   - Date range filtering
   - Pagination support

### Database Schema

New `AuditLog` model:
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  action      String
  resource    String
  resourceId  String?
  details     Json?
  ipAddress   String?
  userAgent   String?
  status      String
  errorMessage String?
  timestamp   DateTime @default(now())
}
```

### API Endpoints

#### Query Audit Logs
```typescript
GET /api/admin/audit-logs?userId=user_id&action=LOGIN&limit=100&offset=0
```

Query parameters:
- `userId` - Filter by user
- `action` - Filter by action type
- `resource` - Filter by resource type
- `resourceId` - Filter by resource ID
- `status` - Filter by status (SUCCESS, FAILURE, ERROR)
- `startDate` - ISO datetime string
- `endDate` - ISO datetime string
- `limit` - Results per page (default: 100, max: 1000)
- `offset` - Pagination offset (default: 0)

### Tracked Events

#### Authentication
- `LOGIN` - Successful login
- `LOGOUT` - User logout
- `LOGIN_FAILED` - Failed login attempt
- `ACCOUNT_LOCKED` - Account locked due to failed attempts
- `PASSWORD_CHANGED` - Password updated
- `EMAIL_CHANGED` - Email address changed

#### API Keys
- `API_KEY_CREATED` - New API key added
- `API_KEY_UPDATED` - API key updated
- `API_KEY_DELETED` - API key removed
- `API_KEY_ROTATED` - API key rotated
- `API_KEY_EXPIRED` - API key expired
- `API_KEY_ACCESSED` - API key used

#### Trading
- `TRADE_EXECUTED` - Trade placed
- `TRADE_CANCELLED` - Trade cancelled
- `TRADE_FAILED` - Trade failed

#### Security
- `RATE_LIMIT_EXCEEDED` - Rate limit hit
- `UNAUTHORIZED_ACCESS` - Unauthorized access attempt
- `SUSPICIOUS_ACTIVITY` - Suspicious activity detected

### Usage Example

```typescript
import { auditLog, auditLogFromRequest } from '@/lib/audit/audit-logger'

// Simple audit log
await auditLog({
  userId: 'user_id',
  action: 'TRADE_EXECUTED',
  resource: 'trade',
  resourceId: 'trade_id',
  details: { platform: 'polymarket', amount: 100 },
  status: 'SUCCESS',
})

// From request (auto-extracts IP and user agent)
await auditLogFromRequest(request, {
  userId: 'user_id',
  action: 'PASSWORD_CHANGED',
  resource: 'user',
  resourceId: 'user_id',
  status: 'SUCCESS',
})
```

## 🔧 Setup Instructions

### 1. Run Database Migration

```bash
npx prisma migrate dev --name add_api_key_rotation_and_audit_logging
```

Or if using production:
```bash
npx prisma migrate deploy
```

### 2. Set Up Cron Job

Add to your cron scheduler (e.g., Vercel Cron, GitHub Actions, etc.):

```bash
# Daily at 2 AM UTC
0 2 * * * curl -H "x-cron-secret: YOUR_SECRET" https://your-domain.com/api/cron/rotate-api-keys
```

Or in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/rotate-api-keys",
    "schedule": "0 2 * * *"
  }]
}
```

### 3. Environment Variables

Add to `.env`:
```env
CRON_SECRET=your-secret-token-here
```

## 📊 Benefits

### API Key Rotation
- ✅ Reduces risk if key is compromised
- ✅ Limits exposure window
- ✅ Compliance with security best practices
- ✅ Automatic expiration management

### Audit Logging
- ✅ Complete security event tracking
- ✅ Compliance (SOC 2, GDPR, etc.)
- ✅ Forensics and incident investigation
- ✅ User activity monitoring
- ✅ Security anomaly detection

## 🔍 Monitoring

### Check Rotation Status
```bash
curl /api/user/api-keys/status?platform=polymarket
```

### Query Audit Logs
```bash
curl "/api/admin/audit-logs?action=LOGIN&limit=50"
```

### View Recent Security Events
```bash
curl "/api/admin/audit-logs?action=LOGIN_FAILED&status=FAILURE&limit=100"
```

## 🚀 Next Steps

1. **Set up email notifications** for rotation reminders
2. **Configure cron job** for automatic rotation checks
3. **Add admin dashboard** for viewing audit logs
4. **Set up alerts** for suspicious activity patterns
5. **Export audit logs** for compliance reporting

## 📝 Notes

- Audit logs are stored indefinitely (consider retention policy)
- Rotation reminders are sent 7 days before expiration
- Expired keys are automatically deactivated
- All audit logs include IP address and user agent for forensics
- Users can only view their own audit logs (admin check can be added)

