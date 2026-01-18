# Encryption Key Rotation Guide

## Overview

This system provides secure encryption key rotation without breaking existing encrypted data. It supports multiple key versions and backward compatibility with legacy encryption formats.

## Key Versioning System

### Environment Variables

```bash
# Legacy single key (automatically becomes v1)
ENCRYPTION_KEY=your-secret-key-here

# New versioned keys
ENCRYPTION_KEY_V1=your-old-key-here
ENCRYPTION_KEY_V2=your-new-key-here
ENCRYPTION_KEY_V3=your-future-key-here

# Current active version for new encryptions
ENCRYPTION_KEY_CURRENT=v2
```

### Encryption Format

**New Format (Versioned):**
```
v2:iv:authTag:ciphertext
└─ Version prefix enables multi-key support
```

**Legacy Formats (Still Supported):**
```
iv:authTag:ciphertext           # Native crypto format (v1)
U2FsdGVkX1...                   # CryptoJS legacy format
```

## Key Rotation Procedure

### Step 1: Preparation

1. **Backup your database:**
   ```bash
   pg_dump webapp > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Set up new key in .env:**
   ```bash
   # Keep old key as v1
   ENCRYPTION_KEY_V1=your-existing-key-here

   # Add new key as v2
   ENCRYPTION_KEY_V2=your-new-key-here

   # Set current to v2 for new encryptions
   ENCRYPTION_KEY_CURRENT=v2
   ```

3. **Verify configuration:**
   ```bash
   # Check that all keys are loaded
   node -e "require('dotenv').config(); console.log('V1:', !!process.env.ENCRYPTION_KEY_V1); console.log('V2:', !!process.env.ENCRYPTION_KEY_V2);"
   ```

### Step 2: Dry Run

Test the rotation without making changes:

```bash
npx tsx scripts/rotate-encryption-key.ts --dry-run
```

**Example Output:**
```
🔐 Encryption Key Rotation Tool

Mode: DRY-RUN
Verbose: false

⚠️  DRY RUN MODE - No changes will be made

📊 Scanning database for encrypted data...

Found 15 users with encrypted data

============================================================
📈 Rotation Summary
============================================================
Total encrypted fields:     45
Needs rotation:             38
Successfully rotated:       0
Skipped (already current):  7
Failed:                     0
============================================================

✅ Dry run completed successfully!
To execute rotation, run:
  CONFIRM_ROTATION=yes npx tsx scripts/rotate-encryption-key.ts --execute
```

### Step 3: Verbose Dry Run (Optional)

See detailed information about each field:

```bash
npx tsx scripts/rotate-encryption-key.ts --dry-run --verbose
```

**Example Output:**
```
Found 15 users with encrypted data

  User user@example.com: Polymarket API Key (v1-legacy → current)
  User user@example.com: Polymarket API Secret (v1-legacy → current)
  User admin@example.com: Kalshi API Key (v1-legacy → current)
  User admin@example.com: Kalshi API Secret (v1-legacy → current)
```

### Step 4: Execute Rotation

Run the actual rotation (requires confirmation):

```bash
CONFIRM_ROTATION=yes npx tsx scripts/rotate-encryption-key.ts --execute
```

**Safety Features:**
- Validates decryption with old key before re-encrypting
- Stops on first error (no partial updates)
- Provides detailed error reporting
- Transaction-safe updates per user

### Step 5: Verification

Verify all encrypted data can be decrypted:

```bash
npx tsx scripts/rotate-encryption-key.ts --verify
```

**Example Output:**
```
🔍 Verifying all encrypted data...

✅ All encrypted data is valid and can be decrypted!
```

With verbose mode:
```bash
npx tsx scripts/rotate-encryption-key.ts --verify --verbose
```

```
✅ User user@example.com: Polymarket API Key (v2)
✅ User user@example.com: Polymarket API Secret (v2)
✅ User admin@example.com: Kalshi API Key (v2)
✅ User admin@example.com: Kalshi API Secret (v2)
```

### Step 6: Cleanup (Optional)

After successful rotation and verification, you can remove the old key:

```bash
# In .env, remove or comment out old key
# ENCRYPTION_KEY_V1=...  # Can be removed after rotation

# Keep for rollback capability (recommended for 30 days)
ENCRYPTION_KEY_V1=your-old-key-here  # Keep for rollback
ENCRYPTION_KEY_V2=your-new-key-here
ENCRYPTION_KEY_CURRENT=v2
```

## Rollback Procedure

If issues are detected after rotation:

### Quick Rollback (Within Grace Period)

If old key is still in environment:

```bash
# 1. Change current version back to v1
ENCRYPTION_KEY_CURRENT=v1

# 2. Restart application
pm2 restart webapp

# 3. Re-rotate back to v1
CONFIRM_ROTATION=yes npx tsx scripts/rotate-encryption-key.ts --execute
```

### Database Restore

If old key is lost or corruption occurred:

```bash
# 1. Stop application
pm2 stop webapp

# 2. Restore database backup
psql webapp < backup_YYYYMMDD_HHMMSS.sql

# 3. Restore old .env configuration

# 4. Restart application
pm2 start webapp
```

## Advanced Usage

### Programmatic Re-encryption

Use in application code to gradually migrate data:

```typescript
import { needsReencryption, reencrypt } from '@/lib/utils/encryption'

// Check if data needs rotation
if (needsReencryption(encryptedApiKey)) {
  // Re-encrypt with current key
  const newEncrypted = reencrypt(encryptedApiKey)

  // Update in database
  await prisma.user.update({
    where: { id: userId },
    data: { encryptedPolymarketApiKey: newEncrypted }
  })
}
```

### Version Detection

```typescript
import { getEncryptionVersion } from '@/lib/utils/encryption'

const version = getEncryptionVersion(encryptedData)
// Returns: "v1", "v2", "v3", "v1-legacy", "cryptojs-legacy", or "unknown"
```

## Security Best Practices

### 1. Key Generation

Generate strong keys:

```bash
# Generate a 32-byte random key
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Key Storage

- Store keys in environment variables only
- Never commit keys to version control
- Use secrets management in production (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys regularly (every 90 days recommended)

### 3. Grace Period

- Keep old keys for at least 30 days after rotation
- Monitor logs for legacy format decryption warnings
- Verify no errors before removing old keys

### 4. Access Control

- Limit access to encryption keys
- Audit key access
- Use separate keys per environment (dev/staging/prod)

## Monitoring

### Application Logs

Watch for legacy format warnings:

```bash
# In application logs
[Encryption] Decrypted legacy format without version prefix. Consider re-encrypting this data.
[Encryption] Decrypted legacy CryptoJS format. Consider re-encrypting this data.
```

### Metrics to Track

1. **Legacy format usage:** Count of legacy decryptions
2. **Key version distribution:** Count of data encrypted with each version
3. **Decryption errors:** Alert on any decryption failures
4. **Rotation progress:** Percentage of data migrated to new key

### Monitoring Query

```sql
-- Check if any fields need rotation (requires application-level inspection)
SELECT
  COUNT(*) FILTER (WHERE "encryptedPolymarketApiKey" IS NOT NULL) as polymarket_keys,
  COUNT(*) FILTER (WHERE "encryptedKalshiApiKey" IS NOT NULL) as kalshi_keys
FROM "User";
```

## Troubleshooting

### Error: "Encryption key for version vX not found"

**Cause:** Missing environment variable for key version

**Solution:**
```bash
# Add missing key to .env
ENCRYPTION_KEY_V2=your-new-key-here
```

### Error: "Decryption failed"

**Cause:** Wrong key or corrupted data

**Solution:**
1. Verify correct key is set in environment
2. Check data format with `getEncryptionVersion()`
3. Restore from backup if data is corrupted

### Warning: "Decrypted legacy format"

**Cause:** Data encrypted with old format

**Solution:** Run key rotation script to migrate to versioned format

### High Rotation Failure Rate

**Causes:**
- Wrong old key configured
- Database corruption
- Interrupted previous rotation

**Solution:**
1. Stop rotation immediately
2. Verify keys with `--verify` command
3. Check error logs for specific failures
4. Restore from backup if necessary

## Migration from Legacy System

If upgrading from the old encryption system:

### 1. No Action Required (Automatic)

The new system automatically detects and decrypts legacy formats:
- Old `iv:authTag:ciphertext` format works automatically
- CryptoJS format works if crypto-js is installed

### 2. Gradual Migration (Recommended)

Set up versioning without immediate rotation:

```bash
# Keep existing key as v1
ENCRYPTION_KEY_V1=your-existing-key-here

# Use v1 for now (no changes)
ENCRYPTION_KEY_CURRENT=v1
```

Deploy this configuration first, then rotate later when ready.

### 3. Immediate Migration (New Key)

Follow full rotation procedure above to migrate to new key immediately.

## API Reference

### encrypt(text: string): string

Encrypts text with current key version.

```typescript
const encrypted = encrypt('sensitive-data')
// Returns: "v2:ivBase64:authTagBase64:ciphertextBase64"
```

### decrypt(encryptedText: string): string

Decrypts text, automatically detecting version.

```typescript
const decrypted = decrypt(encrypted)
// Works with all formats: v2:..., legacy, CryptoJS
```

### reencrypt(encryptedText: string): string

Re-encrypts with current key version.

```typescript
const newEncrypted = reencrypt(oldEncrypted)
// Decrypts with old key, encrypts with current
```

### getEncryptionVersion(encryptedText: string): string

Returns version identifier.

```typescript
const version = getEncryptionVersion(encrypted)
// Returns: "v1", "v2", "v1-legacy", "cryptojs-legacy", "unknown"
```

### needsReencryption(encryptedText: string): boolean

Checks if data needs rotation.

```typescript
if (needsReencryption(encrypted)) {
  const newEncrypted = reencrypt(encrypted)
  // Update in database
}
```

## Performance Impact

- **Encryption overhead:** < 1ms per operation
- **Decryption overhead:** < 1ms per operation
- **Version detection:** < 0.1ms per operation
- **Memory impact:** Minimal (keys cached at startup)

## Compliance

This system helps meet compliance requirements:

- **PCI DSS:** Regular key rotation
- **GDPR:** Encryption of personal data
- **SOC 2:** Key management controls
- **HIPAA:** Encryption key lifecycle management

## Support

For issues or questions:

1. Check application logs for encryption warnings
2. Run verification: `npx tsx scripts/rotate-encryption-key.ts --verify`
3. Review error messages in rotation output
4. Restore from backup if data integrity is compromised
