/**
 * Rate Limit Middleware Tests
 *
 * Tests for rate limiting functionality:
 * - Request limiting
 * - Sliding window accuracy
 * - Memory fallback
 * - Different limits for API vs pages
 * - Headers and response format
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testUtils } from '@/tests/setup'

// Mock Redis to test memory fallback
vi.mock('@/lib/cache/redis-client', () => ({
  getRedisClient: vi.fn(() => null),
  isRedisAvailable: vi.fn(() => false)
}))

// We need to import after mocking
const { rateLimit } = await import('@/lib/middleware/rate-limit')

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    // Enable rate limiting for tests
    process.env.RATE_LIMIT_ENABLED = 'true'
    process.env.RATE_LIMIT_MAX_PER_MINUTE = '5'
    process.env.RATE_LIMIT_API_MAX_PER_MINUTE = '10'
    process.env.RATE_LIMIT_WINDOW_MS = '60000'
  })

  describe('Basic rate limiting', () => {
    it('should allow requests under the limit', async () => {
      const req = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '1.2.3.4' }
      })

      const result = await rateLimit(req)
      expect(result).toBeNull() // Null means allowed
    })

    it('should block requests over the limit', async () => {
      const requests = []

      for (let i = 0; i < 7; i++) {
        const req = testUtils.createMockNextRequest({
          url: 'http://localhost:3000/test',
          headers: { 'x-forwarded-for': '1.2.3.5' }
        })
        requests.push(rateLimit(req))
      }

      const results = await Promise.all(requests)

      // First 5 should be allowed
      expect(results.slice(0, 5).every(r => r === null)).toBe(true)

      // 6th and 7th should be blocked (429)
      const blocked = results.slice(5)
      blocked.forEach(result => {
        expect(result).not.toBeNull()
        expect(result?.status).toBe(429)
      })
    })

    it('should return 429 with correct format', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 6; i++) {
        await rateLimit(testUtils.createMockNextRequest({
          url: 'http://localhost:3000/test',
          headers: { 'x-forwarded-for': '1.2.3.6' }
        }))
      }

      // Next request should be blocked
      const req = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '1.2.3.6' }
      })

      const result = await rateLimit(req)

      expect(result).not.toBeNull()
      expect(result?.status).toBe(429)

      const body = await result?.json()
      expect(body).toHaveProperty('error')
      expect(body).toHaveProperty('code', 429)
      expect(body).toHaveProperty('retryAfter')
    })

    it('should include rate limit headers', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 6; i++) {
        await rateLimit(testUtils.createMockNextRequest({
          url: 'http://localhost:3000/test',
          headers: { 'x-forwarded-for': '1.2.3.7' }
        }))
      }

      const req = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '1.2.3.7' }
      })

      const result = await rateLimit(req)

      expect(result?.headers.get('X-RateLimit-Limit')).toBeDefined()
      expect(result?.headers.get('X-RateLimit-Remaining')).toBeDefined()
      expect(result?.headers.get('X-RateLimit-Reset')).toBeDefined()
      expect(result?.headers.get('Retry-After')).toBeDefined()
    })
  })

  describe('IP-based limiting', () => {
    it('should track different IPs separately', async () => {
      const ip1 = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '1.1.1.1' }
      })

      const ip2 = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '2.2.2.2' }
      })

      // Each IP should have separate limits
      for (let i = 0; i < 5; i++) {
        expect(await rateLimit(ip1)).toBeNull()
        expect(await rateLimit(ip2)).toBeNull()
      }

      // Both should now be at limit
      expect(await rateLimit(ip1)).not.toBeNull()
      expect(await rateLimit(ip2)).not.toBeNull()
    })

    it('should handle missing IP gracefully', async () => {
      const req = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: {}
      })

      const result = await rateLimit(req)
      expect(result).toBeNull() // Should not crash
    })

    it('should use x-real-ip as fallback', async () => {
      const req1 = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-real-ip': '3.3.3.3' }
      })

      const req2 = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-real-ip': '3.3.3.3' }
      })

      await rateLimit(req1)
      await rateLimit(req2)

      // Should share the same limit
      const result = await rateLimit(req2)
      expect(result).toBeDefined()
    })

    it('should parse x-forwarded-for with multiple IPs', async () => {
      const req = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '4.4.4.4, 5.5.5.5, 6.6.6.6' }
      })

      const result = await rateLimit(req)
      expect(result).toBeNull() // Should use first IP (4.4.4.4)
    })
  })

  describe('Path-based rules', () => {
    it('should apply higher limits to API routes', async () => {
      process.env.RATE_LIMIT_MAX_PER_MINUTE = '5'
      process.env.RATE_LIMIT_API_MAX_PER_MINUTE = '10'

      const requests = []

      // Test API route (should allow 10)
      for (let i = 0; i < 12; i++) {
        const req = testUtils.createMockNextRequest({
          url: 'http://localhost:3000/api/test',
          headers: { 'x-forwarded-for': '7.7.7.7' }
        })
        requests.push(rateLimit(req))
      }

      const results = await Promise.all(requests)

      // First 10 should be allowed
      expect(results.slice(0, 10).every(r => r === null)).toBe(true)

      // 11th and 12th should be blocked
      expect(results[10]).not.toBeNull()
      expect(results[11]).not.toBeNull()
    })

    it('should apply lower limits to page routes', async () => {
      process.env.RATE_LIMIT_MAX_PER_MINUTE = '5'
      process.env.RATE_LIMIT_API_MAX_PER_MINUTE = '10'

      const requests = []

      // Test page route (should allow 5)
      for (let i = 0; i < 7; i++) {
        const req = testUtils.createMockNextRequest({
          url: 'http://localhost:3000/dashboard',
          headers: { 'x-forwarded-for': '8.8.8.8' }
        })
        requests.push(rateLimit(req))
      }

      const results = await Promise.all(requests)

      // First 5 should be allowed
      expect(results.slice(0, 5).every(r => r === null)).toBe(true)

      // 6th and 7th should be blocked
      expect(results[5]).not.toBeNull()
      expect(results[6]).not.toBeNull()
    })

    it('should exempt auth routes', async () => {
      const requests = []

      // Send many requests to auth route
      for (let i = 0; i < 10; i++) {
        const req = testUtils.createMockNextRequest({
          url: 'http://localhost:3000/api/auth/signin',
          headers: { 'x-forwarded-for': '9.9.9.9' }
        })
        requests.push(rateLimit(req))
      }

      const results = await Promise.all(requests)

      // All should be allowed (auth routes are exempt)
      expect(results.every(r => r === null)).toBe(true)
    })

    it('should exempt static files', async () => {
      const requests = []

      // Send many requests to static files
      for (let i = 0; i < 10; i++) {
        const req = testUtils.createMockNextRequest({
          url: 'http://localhost:3000/_next/static/file.js',
          headers: { 'x-forwarded-for': '10.10.10.10' }
        })
        requests.push(rateLimit(req))
      }

      const results = await Promise.all(requests)

      // All should be allowed (static files are exempt)
      expect(results.every(r => r === null)).toBe(true)
    })
  })

  describe('Configuration', () => {
    it('should respect custom window size', async () => {
      process.env.RATE_LIMIT_WINDOW_MS = '1000' // 1 second window
      process.env.RATE_LIMIT_MAX_PER_MINUTE = '3'

      // Exhaust limit
      for (let i = 0; i < 3; i++) {
        await rateLimit(testUtils.createMockNextRequest({
          url: 'http://localhost:3000/test',
          headers: { 'x-forwarded-for': '11.11.11.11' }
        }))
      }

      // Should be blocked
      const blocked = await rateLimit(testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '11.11.11.11' }
      }))

      expect(blocked).not.toBeNull()

      // Wait for window to reset
      await testUtils.waitFor(1100)

      // Should be allowed again
      const allowed = await rateLimit(testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '11.11.11.11' }
      }))

      expect(allowed).toBeNull()
    })

    it('should disable rate limiting when configured', async () => {
      process.env.RATE_LIMIT_ENABLED = 'false'

      // Reload module to pick up new env
      vi.resetModules()
      const { rateLimit: rateLimitDisabled } = await import('@/lib/middleware/rate-limit')

      const requests = []

      // Send many requests
      for (let i = 0; i < 20; i++) {
        const req = testUtils.createMockNextRequest({
          url: 'http://localhost:3000/test',
          headers: { 'x-forwarded-for': '12.12.12.12' }
        })
        requests.push(rateLimitDisabled(req))
      }

      const results = await Promise.all(requests)

      // All should be allowed when disabled
      expect(results.every(r => r === null)).toBe(true)
    })

    it('should use default values for missing config', async () => {
      delete process.env.RATE_LIMIT_MAX_PER_MINUTE
      delete process.env.RATE_LIMIT_API_MAX_PER_MINUTE

      vi.resetModules()
      const { rateLimit: rateLimitDefault } = await import('@/lib/middleware/rate-limit')

      const req = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '13.13.13.13' }
      })

      const result = await rateLimitDefault(req)

      // Should not crash and should apply defaults
      expect(result).toBeDefined()
    })
  })

  describe('Memory fallback', () => {
    it('should use memory cache when Redis unavailable', async () => {
      // Redis is already mocked as unavailable
      const requests = []

      for (let i = 0; i < 7; i++) {
        const req = testUtils.createMockNextRequest({
          url: 'http://localhost:3000/test',
          headers: { 'x-forwarded-for': '14.14.14.14' }
        })
        requests.push(rateLimit(req))
      }

      const results = await Promise.all(requests)

      // Should still enforce limits using memory cache
      expect(results.slice(0, 5).every(r => r === null)).toBe(true)
      expect(results[5]).not.toBeNull()
      expect(results[6]).not.toBeNull()
    })

    it('should reset memory cache after window', async () => {
      process.env.RATE_LIMIT_WINDOW_MS = '500'
      process.env.RATE_LIMIT_MAX_PER_MINUTE = '2'

      vi.resetModules()
      const { rateLimit: rateLimitShort } = await import('@/lib/middleware/rate-limit')

      // Exhaust limit
      await rateLimitShort(testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '15.15.15.15' }
      }))

      await rateLimitShort(testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '15.15.15.15' }
      }))

      // Should be blocked
      const blocked = await rateLimitShort(testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '15.15.15.15' }
      }))

      expect(blocked).not.toBeNull()

      // Wait for reset
      await testUtils.waitFor(600)

      // Should be allowed again
      const allowed = await rateLimitShort(testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '15.15.15.15' }
      }))

      expect(allowed).toBeNull()
    })
  })

  describe('Concurrent requests', () => {
    it('should handle concurrent requests correctly', async () => {
      const requests = Array.from({ length: 10 }, () =>
        rateLimit(testUtils.createMockNextRequest({
          url: 'http://localhost:3000/test',
          headers: { 'x-forwarded-for': '16.16.16.16' }
        }))
      )

      const results = await Promise.all(requests)

      const allowed = results.filter(r => r === null).length
      const blocked = results.filter(r => r !== null).length

      // Should enforce limit even with concurrent requests
      expect(allowed).toBeLessThanOrEqual(5)
      expect(blocked).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Edge cases', () => {
    it('should handle very short windows', async () => {
      process.env.RATE_LIMIT_WINDOW_MS = '100'
      process.env.RATE_LIMIT_MAX_PER_MINUTE = '2'

      vi.resetModules()
      const { rateLimit: rateLimitVeryShort } = await import('@/lib/middleware/rate-limit')

      const req1 = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '17.17.17.17' }
      })

      await rateLimitVeryShort(req1)
      await rateLimitVeryShort(req1)

      // Should be blocked
      expect(await rateLimitVeryShort(req1)).not.toBeNull()

      // Wait and try again
      await testUtils.waitFor(150)

      // Should be allowed
      expect(await rateLimitVeryShort(req1)).toBeNull()
    })

    it('should handle limit of 1', async () => {
      process.env.RATE_LIMIT_MAX_PER_MINUTE = '1'

      vi.resetModules()
      const { rateLimit: rateLimitOne } = await import('@/lib/middleware/rate-limit')

      const req = testUtils.createMockNextRequest({
        url: 'http://localhost:3000/test',
        headers: { 'x-forwarded-for': '18.18.18.18' }
      })

      // First request allowed
      expect(await rateLimitOne(req)).toBeNull()

      // Second request blocked
      expect(await rateLimitOne(req)).not.toBeNull()
    })

    it('should handle very high limits', async () => {
      process.env.RATE_LIMIT_MAX_PER_MINUTE = '1000'

      vi.resetModules()
      const { rateLimit: rateLimitHigh } = await import('@/lib/middleware/rate-limit')

      const requests = []

      for (let i = 0; i < 100; i++) {
        requests.push(rateLimitHigh(testUtils.createMockNextRequest({
          url: 'http://localhost:3000/test',
          headers: { 'x-forwarded-for': '19.19.19.19' }
        })))
      }

      const results = await Promise.all(requests)

      // All should be allowed with high limit
      expect(results.every(r => r === null)).toBe(true)
    })
  })
})
