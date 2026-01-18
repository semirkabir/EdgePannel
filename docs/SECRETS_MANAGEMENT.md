# Secrets Management Guide

This guide explains how to migrate from environment variables to a secrets management service for production deployments.

## Overview

The application supports multiple secrets management providers:

- **Local** (default for development): Uses `.env` files
- **AWS Secrets Manager**: For AWS deployments
- **HashiCorp Vault**: For self-hosted or Vault-based infrastructure
- **Azure Key Vault**: For Azure deployments

## Configuration

### Provider Selection

Set the `SECRETS_PROVIDER` environment variable to choose your provider:

```bash
SECRETS_PROVIDER=aws     # Use AWS Secrets Manager
SECRETS_PROVIDER=vault   # Use HashiCorp Vault
SECRETS_PROVIDER=azure   # Use Azure Key Vault
SECRETS_PROVIDER=local   # Use local .env (default for development)
```

### Development

In development, secrets are automatically loaded from `.env` files. No additional configuration needed.

## AWS Secrets Manager Setup

### 1. Install AWS SDK

```bash
npm install @aws-sdk/client-secrets-manager
```

### 2. Configure AWS Credentials

Set up AWS credentials via IAM role (recommended for EC2/ECS) or environment variables:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### 3. Create Secrets in AWS

```bash
# Create individual secrets
aws secretsmanager create-secret \
  --name ENCRYPTION_KEY \
  --secret-string "your-32-character-encryption-key"

aws secretsmanager create-secret \
  --name NEXTAUTH_SECRET \
  --secret-string "your-nextauth-secret"

# Or create a JSON secret with multiple values
aws secretsmanager create-secret \
  --name production/app-secrets \
  --secret-string '{"ENCRYPTION_KEY":"...","NEXTAUTH_SECRET":"..."}'
```

### 4. Set Environment Variables

```bash
SECRETS_PROVIDER=aws
AWS_REGION=us-east-1
```

### 5. Update IAM Policy

Grant your application access to secrets:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:*"
    }
  ]
}
```

## HashiCorp Vault Setup

### 1. Configure Vault Connection

```bash
SECRETS_PROVIDER=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=your-vault-token
```

### 2. Store Secrets in Vault

```bash
# Using KV v2 secrets engine
vault kv put secret/production/encryption ENCRYPTION_KEY="your-key"
vault kv put secret/production/nextauth NEXTAUTH_SECRET="your-secret"
vault kv put secret/production/database DATABASE_URL="postgresql://..."
```

### 3. Secret Path Format

Access secrets using paths like:

```
secret/data/production/encryption  -> Returns ENCRYPTION_KEY
secret/data/production/nextauth    -> Returns NEXTAUTH_SECRET
```

## Azure Key Vault Setup

### 1. Install Azure SDK

```bash
npm install @azure/keyvault-secrets @azure/identity
```

### 2. Configure Azure Credentials

```bash
SECRETS_PROVIDER=azure
AZURE_VAULT_NAME=your-vault-name
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

### 3. Create Secrets in Azure

```bash
# Using Azure CLI
az keyvault secret set \
  --vault-name your-vault-name \
  --name ENCRYPTION-KEY \
  --value "your-32-character-encryption-key"

az keyvault secret set \
  --vault-name your-vault-name \
  --name NEXTAUTH-SECRET \
  --value "your-nextauth-secret"
```

### 4. Grant Access

```bash
# Grant your application service principal access
az keyvault set-policy \
  --name your-vault-name \
  --spn <service-principal-id> \
  --secret-permissions get list
```

## Migration Checklist

### Pre-Migration

- [ ] Choose secrets provider (AWS/Vault/Azure)
- [ ] Install required SDK dependencies
- [ ] Set up provider credentials
- [ ] Test provider connectivity

### Secrets to Migrate

#### Required Secrets

- [ ] `ENCRYPTION_KEY` - 32-character encryption key
- [ ] `NEXTAUTH_SECRET` - NextAuth.js secret
- [ ] `DATABASE_URL` - PostgreSQL connection string

#### Optional API Keys

- [ ] `REDIS_URL` - Redis connection string
- [ ] `POLYMARKET_API_KEY` - Polymarket API key
- [ ] `KALSHI_API_KEY` - Kalshi API key
- [ ] `KALSHI_PRIVATE_KEY` - Kalshi private key
- [ ] `ALPACA_API_KEY` - Alpaca API key
- [ ] `ALPACA_SECRET_KEY` - Alpaca secret key

### Migration Steps

1. **Backup Current Secrets**
   ```bash
   # Save current .env to a secure location
   cp .env .env.backup
   ```

2. **Create Secrets in Provider**
   - Follow provider-specific instructions above
   - Verify secrets are created correctly

3. **Update Environment Configuration**
   ```bash
   # Add provider configuration
   SECRETS_PROVIDER=aws  # or vault, azure
   # Add provider-specific variables (see above)
   ```

4. **Test Secret Retrieval**
   ```bash
   # Run application in staging
   npm run build
   npm start

   # Check logs for "[Secrets] Application secrets loaded successfully"
   ```

5. **Deploy to Production**
   - Deploy with new environment variables
   - Monitor application logs
   - Verify all features work correctly

6. **Clean Up**
   - Remove secrets from old `.env` files
   - Store `.env.backup` securely offline
   - Update documentation

## Usage in Code

### Basic Usage

```typescript
import { getSecret } from '@/lib/secrets/manager'

// Get a single secret
const apiKey = await getSecret('POLYMARKET_API_KEY')

// Get a required secret (throws if not found)
const encryptionKey = await getSecret('ENCRYPTION_KEY', { required: true })

// Get multiple secrets
import { getSecrets } from '@/lib/secrets/manager'

const secrets = await getSecrets([
  'ENCRYPTION_KEY',
  'NEXTAUTH_SECRET',
  'DATABASE_URL'
])
```

### Application Startup

Secrets are automatically loaded at application startup:

```typescript
import { loadApplicationSecrets } from '@/lib/secrets/manager'

// Called automatically during app initialization
await loadApplicationSecrets()
```

### Cache Management

Secrets are cached for 5 minutes to reduce API calls:

```typescript
import { clearSecretsCache } from '@/lib/secrets/manager'

// Clear cache after rotation
clearSecretsCache()
```

## Secret Rotation

### Rotation Strategy

1. **Update Secret in Provider**
   - AWS: Use AWS Console or CLI
   - Vault: Use `vault kv put`
   - Azure: Use Azure CLI or Portal

2. **Clear Application Cache**
   ```typescript
   import { clearSecretsCache } from '@/lib/secrets/manager'
   clearSecretsCache()
   ```

3. **Restart Application** (if needed)
   - Most secrets are cached for 5 minutes
   - Critical secrets may require restart

### Rotation Schedule

| Secret | Frequency | Notes |
|--------|-----------|-------|
| ENCRYPTION_KEY | Annually | Requires re-encryption of existing data |
| NEXTAUTH_SECRET | Annually | Invalidates all sessions |
| DATABASE_URL | As needed | Coordinate with database password rotation |
| API Keys | Quarterly | Check provider recommendations |

## Monitoring

### Health Check

```typescript
import { checkSecretsHealth } from '@/lib/secrets/manager'

const health = await checkSecretsHealth()
console.log(health)
// { provider: 'aws', available: true }
```

### Add to Health Endpoint

```typescript
// app/api/health/route.ts
import { checkSecretsHealth } from '@/lib/secrets/manager'

export async function GET() {
  const secretsHealth = await checkSecretsHealth()

  return Response.json({
    status: 'ok',
    secrets: secretsHealth
  })
}
```

## Troubleshooting

### AWS Issues

**Error: "Unable to locate credentials"**
- Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
- Verify IAM role is attached (for EC2/ECS)
- Check IAM permissions

**Error: "AccessDeniedException"**
- Update IAM policy to grant `secretsmanager:GetSecretValue`
- Verify secret ARN in policy matches your secrets

### Vault Issues

**Error: "connection refused"**
- Check VAULT_ADDR is correct and accessible
- Verify network connectivity to Vault server
- Check Vault is running

**Error: "permission denied"**
- Check VAULT_TOKEN is valid
- Verify token has read permissions on secret path
- Check Vault policy

### Azure Issues

**Error: "DefaultAzureCredential failed"**
- Check AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
- Verify service principal exists
- Check Azure AD permissions

**Error: "Secret not found"**
- Verify secret name (Azure uses hyphens, not underscores)
- Check AZURE_VAULT_NAME is correct
- Verify Key Vault access policies

## Best Practices

1. **Never Commit Secrets**
   - Keep `.env` in `.gitignore`
   - Use `.env.example` for reference
   - Never log secret values

2. **Use IAM Roles (AWS)**
   - Prefer IAM roles over access keys
   - Use EC2 instance profiles or ECS task roles

3. **Rotate Regularly**
   - Set up automated rotation where possible
   - Document rotation procedures
   - Test rotation in staging first

4. **Monitor Access**
   - Enable CloudTrail (AWS)
   - Enable audit logging (Vault)
   - Monitor Key Vault access logs (Azure)

5. **Principle of Least Privilege**
   - Grant minimum required permissions
   - Use separate secrets for different environments
   - Limit secret access by application/service

## Cost Considerations

### AWS Secrets Manager
- $0.40 per secret per month
- $0.05 per 10,000 API calls
- Free tier: 30 days for first secret

### HashiCorp Vault
- Self-hosted: Infrastructure costs
- Vault Enterprise: Contact HashiCorp

### Azure Key Vault
- Standard tier: $0.03 per 10,000 operations
- Premium tier (HSM): $1.00 + $0.10 per 10,000 operations

## Security Notes

- Secrets are cached in memory for 5 minutes
- Cache is cleared on application restart
- Provider SDKs use secure connections (HTTPS/TLS)
- Secrets are never written to disk
- Failed secret fetches fall back gracefully

## Support

For issues or questions:
1. Check provider-specific documentation
2. Review application logs
3. Test with `checkSecretsHealth()`
4. Verify IAM/access permissions
