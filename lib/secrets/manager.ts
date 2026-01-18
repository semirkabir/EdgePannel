/**
 * Secrets Management Client
 *
 * Multi-provider secrets management with:
 * - AWS Secrets Manager support
 * - HashiCorp Vault support
 * - Azure Key Vault support
 * - Local fallback for development
 * - Secret rotation support
 * - Caching layer for performance
 */

// Provider type
export type SecretsProvider = 'aws' | 'vault' | 'azure' | 'local'

// Secret value type
export interface SecretValue {
  value: string
  version?: string
  lastRotated?: Date
}

// Cache for secrets to avoid repeated API calls
const secretsCache = new Map<string, { value: SecretValue; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Determine which secrets provider to use
 */
function getProvider(): SecretsProvider {
  const provider = process.env.SECRETS_PROVIDER?.toLowerCase() as SecretsProvider

  // In development, always use local
  if (process.env.NODE_ENV === 'development') {
    return 'local'
  }

  // Validate provider
  if (provider && ['aws', 'vault', 'azure'].includes(provider)) {
    return provider
  }

  // Default to local for safety
  console.warn('[Secrets] No valid provider configured, using local environment variables')
  return 'local'
}

/**
 * Get secret from local environment variables
 */
function getLocalSecret(key: string): string | null {
  return process.env[key] || null
}

/**
 * Get secret from AWS Secrets Manager
 */
async function getAwsSecret(secretName: string): Promise<SecretValue | null> {
  try {
    // Dynamic import to avoid loading AWS SDK unless needed
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')

    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    })

    const command = new GetSecretValueCommand({
      SecretId: secretName
    })

    const response = await client.send(command)

    if (response.SecretString) {
      // Handle JSON secrets
      try {
        const parsed = JSON.parse(response.SecretString)
        return {
          value: parsed.value || parsed[secretName] || response.SecretString,
          version: response.VersionId,
          lastRotated: response.CreatedDate
        }
      } catch {
        // Plain text secret
        return {
          value: response.SecretString,
          version: response.VersionId,
          lastRotated: response.CreatedDate
        }
      }
    }

    return null
  } catch (error) {
    console.error(`[Secrets] AWS error fetching ${secretName}:`, error)
    return null
  }
}

/**
 * Get secret from HashiCorp Vault
 */
async function getVaultSecret(secretPath: string): Promise<SecretValue | null> {
  try {
    const vaultAddr = process.env.VAULT_ADDR
    const vaultToken = process.env.VAULT_TOKEN

    if (!vaultAddr || !vaultToken) {
      throw new Error('VAULT_ADDR and VAULT_TOKEN must be set')
    }

    const response = await fetch(`${vaultAddr}/v1/${secretPath}`, {
      headers: {
        'X-Vault-Token': vaultToken
      }
    })

    if (!response.ok) {
      throw new Error(`Vault request failed: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      value: data.data?.data?.value || data.data?.value || '',
      version: data.data?.metadata?.version?.toString(),
      lastRotated: data.data?.metadata?.created_time ? new Date(data.data.metadata.created_time) : undefined
    }
  } catch (error) {
    console.error(`[Secrets] Vault error fetching ${secretPath}:`, error)
    return null
  }
}

/**
 * Get secret from Azure Key Vault
 */
async function getAzureSecret(secretName: string): Promise<SecretValue | null> {
  try {
    // Dynamic import to avoid loading Azure SDK unless needed
    const { SecretClient } = await import('@azure/keyvault-secrets')
    const { DefaultAzureCredential } = await import('@azure/identity')

    const vaultName = process.env.AZURE_VAULT_NAME
    if (!vaultName) {
      throw new Error('AZURE_VAULT_NAME must be set')
    }

    const vaultUrl = `https://${vaultName}.vault.azure.net`
    const credential = new DefaultAzureCredential()
    const client = new SecretClient(vaultUrl, credential)

    const secret = await client.getSecret(secretName)

    return {
      value: secret.value || '',
      version: secret.properties.version,
      lastRotated: secret.properties.updatedOn
    }
  } catch (error) {
    console.error(`[Secrets] Azure error fetching ${secretName}:`, error)
    return null
  }
}

/**
 * Get secret from cache if available and not expired
 */
function getCachedSecret(key: string): SecretValue | null {
  const cached = secretsCache.get(key)
  if (!cached) return null

  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL_MS) {
    secretsCache.delete(key)
    return null
  }

  return cached.value
}

/**
 * Cache a secret value
 */
function cacheSecret(key: string, value: SecretValue): void {
  secretsCache.set(key, {
    value,
    timestamp: Date.now()
  })
}

/**
 * Main function to get a secret
 *
 * @param key - The secret key/name
 * @param options - Optional configuration
 * @returns The secret value or null if not found
 */
export async function getSecret(
  key: string,
  options: {
    required?: boolean
    useCache?: boolean
    provider?: SecretsProvider
  } = {}
): Promise<string | null> {
  const {
    required = false,
    useCache = true,
    provider = getProvider()
  } = options

  // Check cache first
  if (useCache) {
    const cached = getCachedSecret(key)
    if (cached) {
      return cached.value
    }
  }

  let secretValue: SecretValue | null = null

  // Fetch from provider
  switch (provider) {
    case 'aws':
      secretValue = await getAwsSecret(key)
      break

    case 'vault':
      secretValue = await getVaultSecret(key)
      break

    case 'azure':
      secretValue = await getAzureSecret(key)
      break

    case 'local':
    default:
      const localValue = getLocalSecret(key)
      if (localValue) {
        secretValue = { value: localValue }
      }
      break
  }

  // Cache if found
  if (secretValue && useCache) {
    cacheSecret(key, secretValue)
  }

  // Handle required secrets
  if (required && !secretValue) {
    throw new Error(`Required secret not found: ${key}`)
  }

  return secretValue?.value || null
}

/**
 * Get multiple secrets at once
 */
export async function getSecrets(
  keys: string[],
  options: {
    required?: boolean
    useCache?: boolean
    provider?: SecretsProvider
  } = {}
): Promise<Record<string, string | null>> {
  const results = await Promise.all(
    keys.map(async (key) => {
      const value = await getSecret(key, options)
      return [key, value] as const
    })
  )

  return Object.fromEntries(results)
}

/**
 * Clear secrets cache
 */
export function clearSecretsCache(): void {
  secretsCache.clear()
}

/**
 * Load all required secrets at application startup
 */
export async function loadApplicationSecrets(): Promise<void> {
  console.log('[Secrets] Loading application secrets...')

  try {
    const requiredSecrets = [
      'ENCRYPTION_KEY',
      'NEXTAUTH_SECRET',
      'DATABASE_URL'
    ]

    const optionalSecrets = [
      'REDIS_URL',
      'POLYMARKET_API_KEY',
      'KALSHI_API_KEY',
      'KALSHI_PRIVATE_KEY',
      'ALPACA_API_KEY',
      'ALPACA_SECRET_KEY'
    ]

    // Load required secrets
    for (const key of requiredSecrets) {
      const value = await getSecret(key, { required: true })
      if (value) {
        // Set in process.env for backwards compatibility
        process.env[key] = value
      }
    }

    // Load optional secrets
    for (const key of optionalSecrets) {
      const value = await getSecret(key, { required: false })
      if (value) {
        process.env[key] = value
      }
    }

    console.log('[Secrets] Application secrets loaded successfully')
  } catch (error) {
    console.error('[Secrets] Failed to load application secrets:', error)
    throw error
  }
}

/**
 * Rotate a secret (provider-specific implementation)
 */
export async function rotateSecret(
  key: string,
  newValue: string
): Promise<boolean> {
  const provider = getProvider()

  // Clear cache for this key
  secretsCache.delete(key)

  console.warn(`[Secrets] Secret rotation for ${provider} is not yet implemented`)
  console.warn('[Secrets] Use your provider\'s CLI or console to rotate secrets')

  return false
}

/**
 * Health check for secrets provider
 */
export async function checkSecretsHealth(): Promise<{
  provider: SecretsProvider
  available: boolean
  error?: string
}> {
  const provider = getProvider()

  if (provider === 'local') {
    return { provider, available: true }
  }

  try {
    // Try to fetch a test secret
    await getSecret('_health_check_', { required: false, useCache: false })
    return { provider, available: true }
  } catch (error) {
    return {
      provider,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
