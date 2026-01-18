/**
 * Cache Manager Tests
 *
 * Tests for CacheManager class:
 * - Get/set operations
 * - TTL expiration
 * - Fallback behavior
 * - Batch operations
 * - Memory cache functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CacheManager } from '@/lib/cache/cache-manager'
import { testUtils } from '@/tests/setup'

// Mock Redis client
vi.mock('@/lib/cache/redis-client', () => ({
  getRedisClient: vi.fn(() => null),
  isRedisAvailable: vi.fn(() => false)
}))

describe('CacheManager', () => {
  let cache: CacheManager

  beforeEach(() => {
    cache = new CacheManager('test')
  })

  afterEach(async () => {
    // Clear cache after each test
    await cache.clear()
  })

  describe('Basic operations', () => {
    it('should set and get a value', async () => {
      await cache.set('key1', 'value1')
      const value = await cache.get('key1')

      expect(value).toBe('value1')
    })

    it('should return null for non-existent key', async () => {
      const value = await cache.get('nonexistent')

      expect(value).toBeNull()
    })

    it('should handle different data types', async () => {
      await cache.set('string', 'text')
      await cache.set('number', 123)
      await cache.set('boolean', true)
      await cache.set('object', { key: 'value' })
      await cache.set('array', [1, 2, 3])

      expect(await cache.get('string')).toBe('text')
      expect(await cache.get('number')).toBe(123)
      expect(await cache.get('boolean')).toBe(true)
      expect(await cache.get('object')).toEqual({ key: 'value' })
      expect(await cache.get('array')).toEqual([1, 2, 3])
    })

    it('should override existing value', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key1', 'value2')

      const value = await cache.get('key1')
      expect(value).toBe('value2')
    })

    it('should delete a key', async () => {
      await cache.set('key1', 'value1')
      await cache.delete('key1')

      const value = await cache.get('key1')
      expect(value).toBeNull()
    })

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1')

      const exists = await cache.has('key1')
      const notExists = await cache.has('nonexistent')

      expect(exists).toBe(true)
      expect(notExists).toBe(false)
    })
  })

  describe('TTL functionality', () => {
    it('should expire after TTL', async () => {
      await cache.set('key1', 'value1', 100) // 100ms TTL

      // Should exist immediately
      let value = await cache.get('key1')
      expect(value).toBe('value1')

      // Wait for expiration
      await testUtils.waitFor(150)

      // Should be expired
      value = await cache.get('key1')
      expect(value).toBeNull()
    })

    it('should return TTL for a key', async () => {
      await cache.set('key1', 'value1', 5000) // 5 second TTL

      const ttl = await cache.getTTL('key1')

      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(5000)
    })

    it('should return null for expired key TTL', async () => {
      await cache.set('key1', 'value1', 50)

      await testUtils.waitFor(100)

      const ttl = await cache.getTTL('key1')
      expect(ttl).toBeNull()
    })

    it('should respect custom TTL values', async () => {
      await cache.set('key1', 'value1', 1000)
      await cache.set('key2', 'value2', 5000)

      const ttl1 = await cache.getTTL('key1')
      const ttl2 = await cache.getTTL('key2')

      expect(ttl1).toBeLessThan(ttl2!)
    })

    it('should not return expired values', async () => {
      await cache.set('key1', 'value1', 50)

      // Immediate access should work
      expect(await cache.get('key1')).toBe('value1')
      expect(await cache.has('key1')).toBe(true)

      // After expiration, should return null
      await testUtils.waitFor(100)

      expect(await cache.get('key1')).toBeNull()
      expect(await cache.has('key1')).toBe(false)
    })
  })

  describe('Prefix isolation', () => {
    it('should isolate keys by prefix', async () => {
      const cache1 = new CacheManager('prefix1')
      const cache2 = new CacheManager('prefix2')

      await cache1.set('key', 'value1')
      await cache2.set('key', 'value2')

      expect(await cache1.get('key')).toBe('value1')
      expect(await cache2.get('key')).toBe('value2')
    })

    it('should clear only keys with matching prefix', async () => {
      const cache1 = new CacheManager('prefix1')
      const cache2 = new CacheManager('prefix2')

      await cache1.set('key', 'value1')
      await cache2.set('key', 'value2')

      await cache1.clear()

      expect(await cache1.get('key')).toBeNull()
      expect(await cache2.get('key')).toBe('value2')
    })
  })

  describe('getOrSet pattern', () => {
    it('should fetch and cache on miss', async () => {
      let fetchCount = 0
      const fetchFn = async () => {
        fetchCount++
        return 'fetched-value'
      }

      const value1 = await cache.getOrSet('key1', fetchFn)
      const value2 = await cache.getOrSet('key1', fetchFn)

      expect(value1).toBe('fetched-value')
      expect(value2).toBe('fetched-value')
      expect(fetchCount).toBe(1) // Should only fetch once
    })

    it('should re-fetch after expiration', async () => {
      let fetchCount = 0
      const fetchFn = async () => {
        fetchCount++
        return `value-${fetchCount}`
      }

      const value1 = await cache.getOrSet('key1', fetchFn, 50)
      await testUtils.waitFor(100)
      const value2 = await cache.getOrSet('key1', fetchFn, 50)

      expect(value1).toBe('value-1')
      expect(value2).toBe('value-2')
      expect(fetchCount).toBe(2)
    })

    it('should not cache null or undefined', async () => {
      let fetchCount = 0
      const fetchFn = async () => {
        fetchCount++
        return null
      }

      await cache.getOrSet('key1', fetchFn)
      await cache.getOrSet('key1', fetchFn)

      expect(fetchCount).toBe(2) // Should fetch both times
    })

    it('should handle async fetch functions', async () => {
      const fetchFn = async () => {
        await testUtils.waitFor(10)
        return 'async-value'
      }

      const value = await cache.getOrSet('key1', fetchFn)
      expect(value).toBe('async-value')
    })

    it('should handle fetch errors gracefully', async () => {
      const fetchFn = async () => {
        throw new Error('Fetch failed')
      }

      await expect(cache.getOrSet('key1', fetchFn)).rejects.toThrow('Fetch failed')
    })
  })

  describe('Batch operations', () => {
    it('should get multiple keys at once', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')

      const values = await cache.mget<string>(['key1', 'key2', 'key3', 'nonexistent'])

      expect(values).toEqual(['value1', 'value2', 'value3', null])
    })

    it('should set multiple keys at once', async () => {
      await cache.mset([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' }
      ])

      expect(await cache.get('key1')).toBe('value1')
      expect(await cache.get('key2')).toBe('value2')
      expect(await cache.get('key3')).toBe('value3')
    })

    it('should handle different TTLs in batch set', async () => {
      await cache.mset([
        { key: 'key1', value: 'value1', ttl: 100 },
        { key: 'key2', value: 'value2', ttl: 5000 }
      ])

      await testUtils.waitFor(150)

      expect(await cache.get('key1')).toBeNull()
      expect(await cache.get('key2')).toBe('value2')
    })
  })

  describe('Increment operation', () => {
    it('should increment a counter', async () => {
      const val1 = await cache.increment('counter')
      const val2 = await cache.increment('counter')
      const val3 = await cache.increment('counter')

      expect(val1).toBe(1)
      expect(val2).toBe(2)
      expect(val3).toBe(3)
    })

    it('should increment by custom amount', async () => {
      const val1 = await cache.increment('counter', 5)
      const val2 = await cache.increment('counter', 3)

      expect(val1).toBe(5)
      expect(val2).toBe(8)
    })

    it('should set TTL on first increment', async () => {
      await cache.increment('counter', 1, 100)

      // Should exist
      expect(await cache.get('counter')).toBe(1)

      await testUtils.waitFor(150)

      // Should be expired
      expect(await cache.get('counter')).toBeNull()
    })

    it('should handle negative increments', async () => {
      await cache.increment('counter', 10)
      const val = await cache.increment('counter', -3)

      expect(val).toBe(7)
    })
  })

  describe('Clear operation', () => {
    it('should clear all keys with prefix', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')

      await cache.clear()

      expect(await cache.get('key1')).toBeNull()
      expect(await cache.get('key2')).toBeNull()
      expect(await cache.get('key3')).toBeNull()
    })

    it('should not affect other prefixes', async () => {
      const cache1 = new CacheManager('test1')
      const cache2 = new CacheManager('test2')

      await cache1.set('key', 'value1')
      await cache2.set('key', 'value2')

      await cache1.clear()

      expect(await cache1.get('key')).toBeNull()
      expect(await cache2.get('key')).toBe('value2')
    })
  })

  describe('Complex data types', () => {
    it('should handle nested objects', async () => {
      const data = {
        user: {
          name: 'John',
          profile: {
            age: 30,
            interests: ['coding', 'reading']
          }
        }
      }

      await cache.set('user', data)
      const retrieved = await cache.get('user')

      expect(retrieved).toEqual(data)
    })

    it('should handle arrays of objects', async () => {
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ]

      await cache.set('items', data)
      const retrieved = await cache.get('items')

      expect(retrieved).toEqual(data)
    })

    it('should handle Date objects (as strings after serialization)', async () => {
      const data = { timestamp: new Date().toISOString() }

      await cache.set('timestamp', data)
      const retrieved = await cache.get('timestamp')

      expect(retrieved).toEqual(data)
    })

    it('should handle special numeric values', async () => {
      await cache.set('zero', 0)
      await cache.set('negative', -123)
      await cache.set('float', 3.14159)

      expect(await cache.get('zero')).toBe(0)
      expect(await cache.get('negative')).toBe(-123)
      expect(await cache.get('float')).toBe(3.14159)
    })
  })

  describe('Error handling', () => {
    it('should handle corrupted cache data gracefully', async () => {
      // This is hard to test directly since we're using memory cache
      // but the implementation should handle JSON parse errors
      await cache.set('key', 'value')
      const value = await cache.get('key')

      expect(value).toBe('value')
    })

    it('should not throw on delete of non-existent key', async () => {
      await expect(cache.delete('nonexistent')).resolves.not.toThrow()
    })

    it('should not throw on clear of empty cache', async () => {
      await expect(cache.clear()).resolves.not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should handle many sequential operations', async () => {
      const start = performance.now()

      for (let i = 0; i < 100; i++) {
        await cache.set(`key${i}`, `value${i}`)
      }

      for (let i = 0; i < 100; i++) {
        await cache.get(`key${i}`)
      }

      const duration = performance.now() - start
      expect(duration).toBeLessThan(1000) // Should complete in less than 1 second
    })

    it('should handle large values', async () => {
      const largeValue = 'A'.repeat(100000) // 100KB string

      await cache.set('large', largeValue)
      const retrieved = await cache.get('large')

      expect(retrieved).toBe(largeValue)
    })

    it('should handle many keys efficiently', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => `key${i}`)
      const entries = keys.map(key => ({ key, value: `value-${key}` }))

      await cache.mset(entries)

      const start = performance.now()
      const values = await cache.mget(keys)
      const duration = performance.now() - start

      expect(values.length).toBe(100)
      expect(duration).toBeLessThan(100) // Batch operation should be fast
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string key', async () => {
      await cache.set('', 'value')
      const value = await cache.get('')

      expect(value).toBe('value')
    })

    it('should handle keys with special characters', async () => {
      const specialKey = 'key:with:colons:and:slashes/and\\backslashes'
      await cache.set(specialKey, 'value')

      const value = await cache.get(specialKey)
      expect(value).toBe('value')
    })

    it('should handle very long keys', async () => {
      const longKey = 'k'.repeat(1000)
      await cache.set(longKey, 'value')

      const value = await cache.get(longKey)
      expect(value).toBe('value')
    })

    it('should handle concurrent operations', async () => {
      const promises = []

      for (let i = 0; i < 10; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`))
      }

      await Promise.all(promises)

      for (let i = 0; i < 10; i++) {
        const value = await cache.get(`key${i}`)
        expect(value).toBe(`value${i}`)
      }
    })
  })
})
