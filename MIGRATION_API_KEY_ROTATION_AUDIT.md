# Migration Guide: API Key Rotation & Audit Logging

## ⚠️ Database Migration Required

This implementation adds new fields to the `ApiKey` model and creates a new `AuditLog` model. You **must** run a database migration.

## 📋 Migration Steps

### 1. Generate Migration

```bash
npx prisma migrate dev --name add_api_key_rotation_and_audit_logging
```

This will:
- Add rotation fields to `ApiKey` table
- Create new `AuditLog` table
- Add indexes for performance

### 2. Review Migration (Optional)

Check the generated migration file in `prisma/migrations/` to review the SQL changes.

### 3. Apply Migration

**Development:**
```bash
npx prisma migrate dev
```

**Production:**
```bash
npx prisma migrate deploy
```

### 4. Regenerate Prisma Client

```bash
npx prisma generate
```

## 🔄 What Changes

### ApiKey Model
New fields added:
- `expiresAt` (DateTime, nullable)
- `rotationDate` (DateTime, nullable)
- `previousKeyHash` (String, nullable)
- `rotationReminderSent` (Boolean, default: false)
- `nextRotationDate` (DateTime, nullable)

**Existing keys:**
- Will have `null` values for rotation fields
- Will automatically get rotation dates on next update
- No data loss

### New AuditLog Model
- Completely new table
- No impact on existing data

## ✅ Verification

After migration, verify:

1. **Check ApiKey table:**
```sql
SELECT id, platform, expiresAt, nextRotationDate 
FROM "ApiKey" 
LIMIT 5;
```

2. **Check AuditLog table exists:**
```sql
SELECT COUNT(*) FROM "AuditLog";
```

3. **Test API endpoints:**
- `GET /api/user/api-keys` - Should return rotation status
- `GET /api/user/api-keys/status` - Should work
- `GET /api/admin/audit-logs` - Should return empty array initially

## 🚨 Rollback (If Needed)

If you need to rollback:

```bash
# Find the migration name
npx prisma migrate status

# Rollback to previous migration
npx prisma migrate resolve --rolled-back <migration_name>
```

Then manually remove the new fields from `schema.prisma` and regenerate.

## 📝 Notes

- Migration is **non-destructive** - existing data is preserved
- New fields are nullable, so existing keys continue to work
- Audit logs start empty - no historical data
- Rotation dates are set automatically on next key update

