/**
 * Cache Module Exports
 *
 * Centralized exports for cache functionality
 */

// Redis client
export {
  getRedisClient,
  isRedisAvailable,
  closeRedisConnection,
  resetRedisConnection,
  pingRedis,
  getRedisInfo,
  redis
} from './redis-client'

// Cache manager
export {
  CacheManager,
  cache,
  marketCache,
  apiCache,
  sessionCache
} from './cache-manager'

// Re-export Redis types for convenience
export type { Redis, RedisOptions } from 'ioredis'
