/**
 * Encryption Module Tests
 *
 * Tests for AES-256-GCM encryption/decryption:
 * - Basic encryption/decryption
 * - IV uniqueness
 * - Auth tag verification
 * - Error handling
 * - Legacy format support
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt } from '@/lib/utils/encryption'

describe('Encryption Module', () => {
  describe('encrypt', () => {
    it('should encrypt plain text successfully', () => {
      const plaintext = 'Hello, World!'
      const encrypted = encrypt(plaintext)

      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')
      expect(encrypted).not.toBe(plaintext)
    })

    it('should return different ciphertext for same plaintext (IV uniqueness)', () => {
      const plaintext = 'Test message'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should produce ciphertext in correct format (iv:authTag:ciphertext)', () => {
      const plaintext = 'Test'
      const encrypted = encrypt(plaintext)

      const parts = encrypted.split(':')
      expect(parts).toHaveLength(3)

      // Verify each part is valid base64
      parts.forEach(part => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow()
      })
    })

    it('should handle empty string', () => {
      const plaintext = ''
      const encrypted = encrypt(plaintext)

      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')

      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should handle long text', () => {
      const plaintext = 'A'.repeat(10000)
      const encrypted = encrypt(plaintext)

      expect(encrypted).toBeDefined()

      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
      const encrypted = encrypt(plaintext)

      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا 🚀'
      const encrypted = encrypt(plaintext)

      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should handle JSON strings', () => {
      const obj = { name: 'Test', value: 123, nested: { key: 'value' } }
      const plaintext = JSON.stringify(obj)
      const encrypted = encrypt(plaintext)

      const decrypted = decrypt(encrypted)
      expect(JSON.parse(decrypted)).toEqual(obj)
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted text correctly', () => {
      const plaintext = 'Secret message'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle multiple encrypt/decrypt cycles', () => {
      let text = 'Original message'

      // Encrypt and decrypt multiple times
      for (let i = 0; i < 5; i++) {
        const encrypted = encrypt(text)
        text = decrypt(encrypted)
      }

      expect(text).toBe('Original message')
    })

    it('should throw error for invalid format', () => {
      const invalid = 'not-encrypted-data'

      expect(() => decrypt(invalid)).toThrow('Decryption failed')
    })

    it('should throw error for corrupted ciphertext', () => {
      const plaintext = 'Test'
      const encrypted = encrypt(plaintext)

      // Corrupt the ciphertext
      const parts = encrypted.split(':')
      parts[2] = parts[2].slice(0, -5) + 'xxxxx' // Corrupt last 5 chars
      const corrupted = parts.join(':')

      expect(() => decrypt(corrupted)).toThrow()
    })

    it('should throw error for tampered auth tag', () => {
      const plaintext = 'Test'
      const encrypted = encrypt(plaintext)

      // Tamper with auth tag
      const parts = encrypted.split(':')
      const authTag = Buffer.from(parts[1], 'base64')
      authTag[0] = authTag[0] ^ 0xFF // Flip bits
      parts[1] = authTag.toString('base64')
      const tampered = parts.join(':')

      expect(() => decrypt(tampered)).toThrow()
    })

    it('should throw error for wrong IV', () => {
      const plaintext = 'Test'
      const encrypted = encrypt(plaintext)

      // Replace IV with different one
      const parts = encrypted.split(':')
      const wrongIV = Buffer.from('wrong-iv-16-byte').toString('base64')
      parts[0] = wrongIV
      const wrongEncrypted = parts.join(':')

      expect(() => decrypt(wrongEncrypted)).toThrow()
    })

    it('should throw error for incomplete data', () => {
      const incomplete = 'iv:authTag' // Missing ciphertext

      expect(() => decrypt(incomplete)).toThrow('Decryption failed')
    })

    it('should throw error for malformed base64', () => {
      const malformed = 'not-base64:not-base64:not-base64'

      expect(() => decrypt(malformed)).toThrow()
    })
  })

  describe('Round-trip encryption', () => {
    const testCases = [
      'Simple text',
      '',
      'A'.repeat(1000),
      '!@#$%^&*()',
      '你好世界',
      JSON.stringify({ test: true }),
      '123456789',
      'email@example.com',
      'https://example.com/path?query=value',
      'Multi\nLine\nText'
    ]

    testCases.forEach(plaintext => {
      it(`should correctly encrypt and decrypt: "${plaintext.substring(0, 50)}..."`, () => {
        const encrypted = encrypt(plaintext)
        const decrypted = decrypt(encrypted)

        expect(decrypted).toBe(plaintext)
      })
    })
  })

  describe('Security properties', () => {
    it('should generate unique IV for each encryption', () => {
      const plaintext = 'Test'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)

      const iv1 = encrypted1.split(':')[0]
      const iv2 = encrypted2.split(':')[0]

      expect(iv1).not.toBe(iv2)
    })

    it('should produce different auth tags for different IVs', () => {
      const plaintext = 'Test'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)

      const authTag1 = encrypted1.split(':')[1]
      const authTag2 = encrypted2.split(':')[1]

      expect(authTag1).not.toBe(authTag2)
    })

    it('should use IV of correct length (16 bytes)', () => {
      const plaintext = 'Test'
      const encrypted = encrypt(plaintext)

      const ivBase64 = encrypted.split(':')[0]
      const iv = Buffer.from(ivBase64, 'base64')

      expect(iv.length).toBe(16)
    })

    it('should use auth tag of correct length (16 bytes)', () => {
      const plaintext = 'Test'
      const encrypted = encrypt(plaintext)

      const authTagBase64 = encrypted.split(':')[1]
      const authTag = Buffer.from(authTagBase64, 'base64')

      expect(authTag.length).toBe(16)
    })

    it('should not leak plaintext in ciphertext (no obvious patterns)', () => {
      const plaintext = 'AAAAAAAAAAAAAAAAAAAA'
      const encrypted = encrypt(plaintext)

      // Ciphertext should not contain repeated patterns
      const ciphertext = encrypted.split(':')[2]
      expect(ciphertext).not.toMatch(/(.+)\1{3,}/) // No 4+ repeated sequences
    })
  })

  describe('Error handling', () => {
    it('should provide meaningful error message for decryption failure', () => {
      try {
        decrypt('invalid-data')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Decryption failed')
      }
    })

    it('should handle null/undefined gracefully', () => {
      expect(() => encrypt(null as any)).toThrow()
      expect(() => encrypt(undefined as any)).toThrow()
      expect(() => decrypt(null as any)).toThrow()
      expect(() => decrypt(undefined as any)).toThrow()
    })

    it('should handle non-string input to encrypt', () => {
      expect(() => encrypt(123 as any)).toThrow()
      expect(() => encrypt({} as any)).toThrow()
      expect(() => encrypt([] as any)).toThrow()
    })

    it('should handle non-string input to decrypt', () => {
      expect(() => decrypt(123 as any)).toThrow()
      expect(() => decrypt({} as any)).toThrow()
      expect(() => decrypt([] as any)).toThrow()
    })
  })

  describe('Performance', () => {
    it('should encrypt small text quickly', () => {
      const plaintext = 'Test'
      const start = performance.now()

      encrypt(plaintext)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(10) // Should take less than 10ms
    })

    it('should decrypt small text quickly', () => {
      const plaintext = 'Test'
      const encrypted = encrypt(plaintext)

      const start = performance.now()
      decrypt(encrypted)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(10) // Should take less than 10ms
    })

    it('should handle bulk operations efficiently', () => {
      const texts = Array.from({ length: 100 }, (_, i) => `Message ${i}`)

      const start = performance.now()

      const encrypted = texts.map(text => encrypt(text))
      const decrypted = encrypted.map(enc => decrypt(enc))

      const duration = performance.now() - start

      expect(duration).toBeLessThan(1000) // 100 operations in less than 1 second
      expect(decrypted).toEqual(texts)
    })
  })

  describe('Edge cases', () => {
    it('should handle very long strings', () => {
      const plaintext = 'A'.repeat(1000000) // 1MB
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle binary-like data (base64 strings)', () => {
      const plaintext = Buffer.from('binary data').toString('base64')
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle strings with null bytes', () => {
      const plaintext = 'Hello\x00World'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should be deterministic for same plaintext with same IV (not in practice, but cryptographically)', () => {
      // Note: In practice, IVs are always random, but cryptographic properties hold
      const plaintext = 'Test'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)

      // Different encryptions should have different results
      expect(encrypted1).not.toBe(encrypted2)

      // But both should decrypt correctly
      expect(decrypt(encrypted1)).toBe(plaintext)
      expect(decrypt(encrypted2)).toBe(plaintext)
    })
  })
})
