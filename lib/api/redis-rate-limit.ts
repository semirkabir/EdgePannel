/**
 * Redis-based rate limiting for production
 * 
 * This is a placeholder for Redis implementation.
 * To use, install: npm install ioredis
 * 
 * Usage:
 * import { RedisRateLimiter } from '@/lib/api/redis-rate-limit'
 * const rateLimiter = new RedisRateLimiter(redisClient)
 */

interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: string, duration: number): Promise<string | null>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  del(key: string): Promise<number>
}

export class RedisRateLimiter {
  private redis: RedisClient | null = null

  constructor(redisClient?: RedisClient) {
    if (redisClient) {
      this.redis = redisClient
    } else if (process.env.REDIS_URL) {
      // Try to initialize Redis if URL is provided
      try {
        // Dynamic import to avoid breaking if Redis not installed
        import('ioredis').then((Redis) => {
          this.redis = new Redis.default(process.env.REDIS_URL as string) as unknown as RedisClient
        }).catch(() => {
          // Redis not installed, use in-memory fallback
        })
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Check if rate limit is exceeded
   */
  async checkLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    if (!this.redis) {
      // Fallback to in-memory (from middleware)
      const { rateLimit } = await import('./middleware')
      const allowed = rateLimit(identifier, maxRequests, windowMs)
      return {
        allowed,
        remaining: allowed ? maxRequests - 1 : 0,
        resetAt: Date.now() + windowMs,
      }
    }

    const key = `rate_limit:${identifier}`
    const windowSeconds = Math.ceil(windowMs / 1000)

    try {
      const current = await this.redis.incr(key)

      if (current === 1) {
        // First request, set expiration
        await this.redis.expire(key, windowSeconds)
      }

      const ttl = await this.redis.get(`ttl:${key}`)
      const resetAt = ttl ? Date.now() + (parseInt(ttl) * 1000) : Date.now() + windowMs

      return {
        allowed: current <= maxRequests,
        remaining: Math.max(0, maxRequests - current),
        resetAt,
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
    if (!this.redis) return

    const key = `rate_limit:${identifier}`
    await this.redis.del(key)
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

