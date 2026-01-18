/**
 * Redis-based rate limiting (Legacy)
 *
 * NOTE: This file is now deprecated in favor of the new rate limiting
 * implementation in lib/middleware/rate-limit.ts which uses Redis sorted sets
 * for sliding window algorithm.
 *
 * This file is kept for backward compatibility.
 *
 * @deprecated Use lib/middleware/rate-limit.ts instead
 */

import { getRedisClient, isRedisAvailable } from '@/lib/cache/redis-client'

export class RedisRateLimiter {
  /**
   * Check if rate limit is exceeded using sliding window
   */
  async checkLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    if (!isRedisAvailable()) {
      // Fallback: Allow request if Redis unavailable
      console.warn('[Redis Rate Limit] Redis unavailable, allowing request')
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: Date.now() + windowMs,
      }
    }

    const redis = getRedisClient()
    if (!redis) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: Date.now() + windowMs,
      }
    }

    const key = `rate_limit:${identifier}`
    const now = Date.now()
    const windowStart = now - windowMs

    try {
      // Use Redis sorted set for sliding window
      const multi = redis.multi()

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart)

      // Count requests in current window
      multi.zcard(key)

      // Add current request
      const requestId = `${now}-${Math.random()}`
      multi.zadd(key, now, requestId)

      // Set expiration to window + buffer
      multi.expire(key, Math.ceil(windowMs / 1000) + 10)

      const results = await multi.exec()

      if (!results) {
        throw new Error('Redis transaction failed')
      }

      // Get count from ZCARD result (index 1)
      const count = (results[1]?.[1] as number) || 0

      return {
        allowed: count < maxRequests,
        remaining: Math.max(0, maxRequests - count - 1),
        resetAt: now + windowMs,
      }
    } catch (error) {
      // Redis error, fallback to allowing request
      console.error('[Redis Rate Limit] Error:', error)
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: Date.now() + windowMs,
      }
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async resetLimit(identifier: string): Promise<void> {
    if (!isRedisAvailable()) return

    const redis = getRedisClient()
    if (!redis) return

    const key = `rate_limit:${identifier}`
    await redis.del(key)
  }
}

/**
 * Get Redis rate limiter instance (singleton)
 */
let redisRateLimiter: RedisRateLimiter | null = null

export function getRedisRateLimiter(): RedisRateLimiter {
  if (!redisRateLimiter) {
    redisRateLimiter = new RedisRateLimiter()
  }
  return redisRateLimiter
}

