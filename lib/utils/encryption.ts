import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// Encryption key must be set in environment variables
const ENCRYPTION_KEY_RAW = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY_RAW) {
  throw new Error('FATAL: ENCRYPTION_KEY environment variable must be set')
}

// TypeScript now knows this is a string
const ENCRYPTION_KEY: string = ENCRYPTION_KEY_RAW

// Derive a 32-byte key from the encryption key using scrypt
// This ensures consistent key length and adds key strengthening
const deriveKey = (key: string): Buffer => {
  const salt = 'polymarket-edge-salt-v1' // Static salt for key derivation
  return scryptSync(key, salt, 32)
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // AES block size
const AUTH_TAG_LENGTH = 16

/**
 * Encrypts text using AES-256-GCM with a random IV
 * Returns base64-encoded string in format: iv:authTag:ciphertext
 */
export function encrypt(text: string): string {
  try {
    const key = deriveKey(ENCRYPTION_KEY)
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    // Combine iv, authTag, and encrypted data
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypts text encrypted with the encrypt function
 * Expects base64-encoded string in format: iv:authTag:ciphertext
 * Also supports legacy CryptoJS format for backward compatibility
 */
export function decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':')

    // New format: iv:authTag:ciphertext (3 parts)
    if (parts.length === 3) {
      const [ivBase64, authTagBase64, encryptedData] = parts

      const key = deriveKey(ENCRYPTION_KEY)
      const iv = Buffer.from(ivBase64, 'base64')
      const authTag = Buffer.from(authTagBase64, 'base64')

      const decipher = createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    }

    // Legacy CryptoJS format (no colons) - attempt decryption with fallback
    // WARNING: This is kept for backward compatibility only
    // All new encryptions use the native crypto format
    if (parts.length === 1) {
      try {
        // Attempt to import and use CryptoJS for legacy data
        const CryptoJS = require('crypto-js')
        const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
        const decrypted = bytes.toString(CryptoJS.enc.Utf8)

        if (!decrypted) {
          throw new Error('Legacy decryption returned empty string')
        }

        console.warn('[Encryption] Decrypted legacy CryptoJS format. Consider re-encrypting this data.')
        return decrypted
      } catch (legacyError) {
        throw new Error('Failed to decrypt legacy format')
      }
    }

    throw new Error('Invalid encrypted text format')
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
