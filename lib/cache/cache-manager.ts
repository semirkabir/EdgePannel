/**
 * Cache Manager
 *
 * Abstraction layer for caching with:
 * - Redis-backed storage (when available)
 * - In-memory fallback (when Redis unavailable)
 * - TTL support
 * - Type-safe operations
 * - Automatic serialization/deserialization
 * - Performance metrics tracking
 */

import { getRedisClient, isRedisAvailable } from './redis-client'

// In-memory fallback cache
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const memoryCache = new Map<string, CacheEntry<any>>()

// Metrics tracking
interface CacheMetrics {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  totalLatencyMs: number
  operationCount: number
}

// Global metrics per cache prefix
const metricsStore = new Map<string, CacheMetrics>()

// Cleanup interval for memory cache (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

// Start cleanup interval
if (typeof window === 'undefined') {
  // Only run on server-side
  setInterval(() => {
    const now = Date.now()
    memoryCache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        memoryCache.delete(key)
      }
    })
  }, CLEANUP_INTERVAL_MS)
}

/**
 * Cache Manager Class
 */
export class CacheManager {
  private prefix: string

  constructor(prefix = 'cache') {
    this.prefix = prefix
    this.initializeMetrics()
  }

  /**
   * Initialize metrics for this cache instance
   */
  private initializeMetrics(): void {
    if (!metricsStore.has(this.prefix)) {
      metricsStore.set(this.prefix, {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        totalLatencyMs: 0,
        operationCount: 0,
      })
    }
  }

  /**
   * Get metrics for this cache instance
   */
  private getMetrics(): CacheMetrics {
    return metricsStore.get(this.prefix)!
  }

  /**
   * Record a cache hit
   */
  private recordHit(latencyMs: number): void {
    const metrics = this.getMetrics()
    metrics.hits++
    metrics.totalLatencyMs += latencyMs
    metrics.operationCount++
  }

  /**
   * Record a cache miss
   */
  private recordMiss(latencyMs: number): void {
    const metrics = this.getMetrics()
    metrics.misses++
    metrics.totalLatencyMs += latencyMs
    metrics.operationCount++
  }

  /**
   * Record a cache set
   */
  private recordSet(latencyMs: number): void {
    const metrics = this.getMetrics()
    metrics.sets++
    metrics.totalLatencyMs += latencyMs
    metrics.operationCount++
  }

  /**
   * Record a cache delete
   */
  private recordDelete(latencyMs: number): void {
    const metrics = this.getMetrics()
    metrics.deletes++
    metrics.totalLatencyMs += latencyMs
    metrics.operationCount++
  }

  /**
   * Record an error
   */
  private recordError(): void {
    const metrics = this.getMetrics()
    metrics.errors++
  }

  /**
   * Generate cache key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now()
    const fullKey = this.getKey(key)

    try {
      // Try Redis first
      if (isRedisAvailable()) {
        try {
          const redis = getRedisClient()
          if (!redis) throw new Error('Redis client not available')

          const value = await redis.get(fullKey)
          const latency = Date.now() - startTime

          if (value !== null) {
            this.recordHit(latency)
            return JSON.parse(value) as T
          }
        } catch (error) {
          this.recordError()
          console.error('[Cache] Redis get error:', error)
          // Fall through to memory cache
        }
      }

      // Fallback to memory cache
      const cached = memoryCache.get(fullKey)
      const latency = Date.now() - startTime

      if (!cached) {
        this.recordMiss(latency)
        return null
      }

      const now = Date.now()
      if (now - cached.timestamp > cached.ttl) {
        memoryCache.delete(fullKey)
        this.recordMiss(latency)
        return null
      }

      this.recordHit(latency)
      return cached.data as T
    } catch (error) {
      this.recordError()
      throw error
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlMs = 30000): Promise<void> {
    const startTime = Date.now()
    const fullKey = this.getKey(key)
    const ttlSeconds = Math.ceil(ttlMs / 1000)

    try {
      // Try Redis first
      if (isRedisAvailable()) {
        try {
          const redis = getRedisClient()
          if (!redis) throw new Error('Redis client not available')

          const serialized = JSON.stringify(value)
          await redis.setex(fullKey, ttlSeconds, serialized)
          const latency = Date.now() - startTime
          this.recordSet(latency)
          return
        } catch (error) {
          this.recordError()
          console.error('[Cache] Redis set error:', error)
          // Fall through to memory cache
        }
      }

      // Fallback to memory cache
      memoryCache.set(fullKey, {
        data: value,
        timestamp: Date.now(),
        ttl: ttlMs
      })
      const latency = Date.now() - startTime
      this.recordSet(latency)
    } catch (error) {
      this.recordError()
      throw error
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const startTime = Date.now()
    const fullKey = this.getKey(key)

    try {
      // Try Redis first
      if (isRedisAvailable()) {
        try {
          const redis = getRedisClient()
          if (!redis) throw new Error('Redis client not available')

          await redis.del(fullKey)
        } catch (error) {
          this.recordError()
          console.error('[Cache] Redis delete error:', error)
        }
      }

      // Also delete from memory cache
      memoryCache.delete(fullKey)
      const latency = Date.now() - startTime
      this.recordDelete(latency)
    } catch (error) {
      this.recordError()
      throw error
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.getKey(key)

    // Try Redis first
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient()
        if (!redis) throw new Error('Redis client not available')

        const exists = await redis.exists(fullKey)
        return exists === 1
      } catch (error) {
        console.error('[Cache] Redis exists error:', error)
      }
    }

    // Fallback to memory cache
    const cached = memoryCache.get(fullKey)
    if (!cached) return false

    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      memoryCache.delete(fullKey)
      return false
    }

    return true
  }

  /**
   * Clear all cache entries with this prefix
   */
  async clear(): Promise<void> {
    // Clear Redis keys with prefix
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient()
        if (!redis) throw new Error('Redis client not available')

        const pattern = `${this.prefix}:*`
        const keys = await redis.keys(pattern)

        if (keys.length > 0) {
          await redis.del(...keys)
        }
      } catch (error) {
        console.error('[Cache] Redis clear error:', error)
      }
    }

    // Clear memory cache
    const prefix = `${this.prefix}:`
    const keysToDelete: string[] = []
    memoryCache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => memoryCache.delete(key))
  }

  /**
   * Get or set pattern: fetch from cache, or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs = 30000
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Fetch fresh data
    const data = await fetchFn()

    // Cache if data is valid
    if (data !== null && data !== undefined) {
      await this.set(key, data, ttlMs)
    }

    return data
  }

  /**
   * Get multiple keys at once (batch operation)
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const fullKeys = keys.map(k => this.getKey(k))

    // Try Redis first for batch operation
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient()
        if (!redis) throw new Error('Redis client not available')

        const values = await redis.mget(...fullKeys)
        return values.map(v => (v !== null ? JSON.parse(v) as T : null))
      } catch (error) {
        console.error('[Cache] Redis mget error:', error)
      }
    }

    // Fallback to individual memory cache lookups
    return Promise.all(keys.map(key => this.get<T>(key)))
  }

  /**
   * Set multiple keys at once (batch operation)
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    // Try Redis first for batch operation
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient()
        if (!redis) throw new Error('Redis client not available')

        // Use pipeline for efficiency
        const pipeline = redis.pipeline()

        for (const entry of entries) {
          const fullKey = this.getKey(entry.key)
          const ttlSeconds = Math.ceil((entry.ttl || 30000) / 1000)
          const serialized = JSON.stringify(entry.value)
          pipeline.setex(fullKey, ttlSeconds, serialized)
        }

        await pipeline.exec()
        return
      } catch (error) {
        console.error('[Cache] Redis mset error:', error)
      }
    }

    // Fallback to individual memory cache sets
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl)
    }
  }

  /**
   * Increment a numeric value (atomic operation)
   */
  async increment(key: string, amount = 1, ttlMs?: number): Promise<number> {
    const fullKey = this.getKey(key)

    // Try Redis first for atomic increment
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient()
        if (!redis) throw new Error('Redis client not available')

        const value = await redis.incrby(fullKey, amount)

        // Set TTL if provided and key is new
        if (ttlMs && value === amount) {
          const ttlSeconds = Math.ceil(ttlMs / 1000)
          await redis.expire(fullKey, ttlSeconds)
        }

        return value
      } catch (error) {
        console.error('[Cache] Redis increment error:', error)
      }
    }

    // Fallback to memory cache (non-atomic)
    const cached = memoryCache.get(fullKey)
    const currentValue = cached ? (cached.data as number) : 0
    const newValue = currentValue + amount

    memoryCache.set(fullKey, {
      data: newValue,
      timestamp: Date.now(),
      ttl: ttlMs || 30000
    })

    return newValue
  }

  /**
   * Get TTL for a key (time until expiration in milliseconds)
   */
  async getTTL(key: string): Promise<number | null> {
    const fullKey = this.getKey(key)

    // Try Redis first
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient()
        if (!redis) throw new Error('Redis client not available')

        const ttl = await redis.ttl(fullKey)
        if (ttl === -2) return null // Key doesn't exist
        if (ttl === -1) return Infinity // No expiration
        return ttl * 1000 // Convert to milliseconds
      } catch (error) {
        console.error('[Cache] Redis TTL error:', error)
      }
    }

    // Fallback to memory cache
    const cached = memoryCache.get(fullKey)
    if (!cached) return null

    const remaining = cached.ttl - (Date.now() - cached.timestamp)
    return remaining > 0 ? remaining : null
  }

  /**
   * Get metrics for this cache instance
   */
  getMetricsSnapshot(): {
    prefix: string
    hits: number
    misses: number
    sets: number
    deletes: number
    errors: number
    hitRate: number
    avgLatencyMs: number
    totalRequests: number
  } {
    const metrics = this.getMetrics()
    const totalRequests = metrics.hits + metrics.misses
    const hitRate = totalRequests > 0 ? metrics.hits / totalRequests : 0
    const avgLatencyMs = metrics.operationCount > 0 ? metrics.totalLatencyMs / metrics.operationCount : 0

    return {
      prefix: this.prefix,
      hits: metrics.hits,
      misses: metrics.misses,
      sets: metrics.sets,
      deletes: metrics.deletes,
      errors: metrics.errors,
      hitRate: parseFloat(hitRate.toFixed(4)),
      avgLatencyMs: parseFloat(avgLatencyMs.toFixed(2)),
      totalRequests,
    }
  }

  /**
   * Reset metrics for this cache instance
   */
  resetMetrics(): void {
    const metrics = this.getMetrics()
    metrics.hits = 0
    metrics.misses = 0
    metrics.sets = 0
    metrics.deletes = 0
    metrics.errors = 0
    metrics.totalLatencyMs = 0
    metrics.operationCount = 0
  }
}

/**
 * Get all cache metrics across all instances
 */
export function getAllCacheMetrics() {
  const allMetrics: Record<string, ReturnType<CacheManager['getMetricsSnapshot']>> = {}

  // Collect metrics from all cache instances
  const instances = [cache, marketCache, apiCache, sessionCache]

  for (const instance of instances) {
    const snapshot = instance.getMetricsSnapshot()
    allMetrics[snapshot.prefix] = snapshot
  }

  // Add Redis-specific metrics if available
  let redisMetrics = null
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient()
      if (redis) {
        redisMetrics = {
          available: true,
          connected: redis.status === 'ready',
        }
      }
    } catch (error) {
      redisMetrics = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return {
    caches: allMetrics,
    redis: redisMetrics,
    timestamp: new Date().toISOString(),
  }
}

// Export default instance
export const cache = new CacheManager('cache')

// Export specialized instances for different use cases
export const marketCache = new CacheManager('market')
export const apiCache = new CacheManager('api')
export const sessionCache = new CacheManager('session')
