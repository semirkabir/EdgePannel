import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// Key versioning system for rotation support
const ENCRYPTION_KEYS = {
  v1: process.env.ENCRYPTION_KEY_V1 || process.env.ENCRYPTION_KEY,
  v2: process.env.ENCRYPTION_KEY_V2,
  v3: process.env.ENCRYPTION_KEY_V3,
} as const

// Current key version (defaults to v1 for backward compatibility)
const CURRENT_KEY_VERSION = (process.env.ENCRYPTION_KEY_CURRENT || 'v1') as keyof typeof ENCRYPTION_KEYS

// Validate that at least v1 key exists
if (!ENCRYPTION_KEYS.v1) {
  throw new Error('FATAL: ENCRYPTION_KEY or ENCRYPTION_KEY_V1 environment variable must be set')
}

// Validate that current version key exists
if (!ENCRYPTION_KEYS[CURRENT_KEY_VERSION]) {
  throw new Error(`FATAL: Encryption key for version ${CURRENT_KEY_VERSION} is not set`)
}

// Derive a 32-byte key from the encryption key using scrypt
// This ensures consistent key length and adds key strengthening
const deriveKey = (key: string, version: string = 'v1'): Buffer => {
  const salt = `polymarket-edge-salt-${version}` // Version-specific salt
  return scryptSync(key, salt, 32)
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // AES block size
const AUTH_TAG_LENGTH = 16

/**
 * Get encryption key for a specific version
 */
const getKeyForVersion = (version: string): string => {
  const key = ENCRYPTION_KEYS[version as keyof typeof ENCRYPTION_KEYS]
  if (!key) {
    throw new Error(`Encryption key for version ${version} not found`)
  }
  return key
}

/**
 * Encrypts text using AES-256-GCM with a random IV
 * Returns base64-encoded string in format: v{version}:iv:authTag:ciphertext
 */
export function encrypt(text: string): string {
  try {
    const version = CURRENT_KEY_VERSION
    const keyString = getKeyForVersion(version)
    const key = deriveKey(keyString, version)
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    // Combine version, iv, authTag, and encrypted data
    return `${version}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypts text encrypted with the encrypt function
 * Supports versioned format: v{version}:iv:authTag:ciphertext
 * Also supports legacy formats for backward compatibility
 */
export function decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':')

    // Versioned format: v{version}:iv:authTag:ciphertext (4 parts)
    if (parts.length === 4 && parts[0].startsWith('v')) {
      const [version, ivBase64, authTagBase64, encryptedData] = parts

      const keyString = getKeyForVersion(version)
      const key = deriveKey(keyString, version)
      const iv = Buffer.from(ivBase64, 'base64')
      const authTag = Buffer.from(authTagBase64, 'base64')

      const decipher = createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    }

    // Legacy format without version: iv:authTag:ciphertext (3 parts)
    if (parts.length === 3) {
      const [ivBase64, authTagBase64, encryptedData] = parts

      // Try v1 key first (most common legacy case)
      const keyString = ENCRYPTION_KEYS.v1
      if (!keyString) {
        throw new Error('Legacy encryption key (v1) not available')
      }

      const key = deriveKey(keyString, 'v1')
      const iv = Buffer.from(ivBase64, 'base64')
      const authTag = Buffer.from(authTagBase64, 'base64')

      const decipher = createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
      decrypted += decipher.final('utf8')

      console.warn('[Encryption] Decrypted legacy format without version prefix. Consider re-encrypting this data.')
      return decrypted
    }

    throw new Error('Invalid encrypted text format')
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Re-encrypts data with the current key version
 * Useful for migrating data to a new key
 */
export function reencrypt(encryptedText: string): string {
  const decrypted = decrypt(encryptedText)
  return encrypt(decrypted)
}

/**
 * Get the version of an encrypted string
 */
export function getEncryptionVersion(encryptedText: string): string {
  const parts = encryptedText.split(':')

  if (parts.length === 4 && parts[0].startsWith('v')) {
    return parts[0]
  }

  if (parts.length === 3) {
    return 'v1-legacy'
  }

  if (parts.length === 1) {
    return 'cryptojs-legacy'
  }

  return 'unknown'
}

/**
 * Check if encrypted text needs re-encryption
 */
export function needsReencryption(encryptedText: string): boolean {
  const version = getEncryptionVersion(encryptedText)
  return version !== CURRENT_KEY_VERSION
}
