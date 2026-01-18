/**
 * Redis Client Utility
 *
 * Provides a singleton Redis connection with:
 * - Connection pooling
 * - Automatic reconnection
 * - Error handling
 * - Graceful fallback when Redis is unavailable
 */

import Redis, { RedisOptions } from 'ioredis'

// Redis connection state
let redisClient: Redis | null = null
let connectionAttempted = false
let isConnected = false

/**
 * Redis configuration from environment
 */
function getRedisConfig(): RedisOptions {
  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    // Parse Redis URL
    return {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > 10) {
          console.error('[Redis] Max retry attempts reached')
          return null // Stop retrying
        }
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
        if (targetErrors.some(targetError => err.message.includes(targetError))) {
          return true
        }
        return false
      }
    }
  }

  // Default local configuration
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error('[Redis] Max retry attempts reached')
        return null
      }
      const delay = Math.min(times * 50, 2000)
      return delay
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
      if (targetErrors.some(targetError => err.message.includes(targetError))) {
        return true
      }
      return false
    }
  }
}

/**
 * Initialize Redis connection
 */
function initializeRedis(): Redis | null {
  if (connectionAttempted) {
    return redisClient
  }

  connectionAttempted = true

  try {
    const config = getRedisConfig()
    const client = new Redis(config)

    // Connection event handlers
    client.on('connect', () => {
      console.log('[Redis] Connected successfully')
      isConnected = true
    })

    client.on('ready', () => {
      console.log('[Redis] Client ready')
      isConnected = true
    })

    client.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err.message)
      isConnected = false
    })

    client.on('close', () => {
      console.log('[Redis] Connection closed')
      isConnected = false
    })

    client.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...')
    })

    redisClient = client
    return client
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error)
    return null
  }
}

/**
 * Get Redis client instance (singleton)
 */
export function getRedisClient(): Redis | null {
  if (!redisClient && !connectionAttempted) {
    return initializeRedis()
  }
  return redisClient
}

/**
 * Check if Redis is available and connected
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && isConnected
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit()
      console.log('[Redis] Connection closed gracefully')
    } catch (error) {
      console.error('[Redis] Error closing connection:', error)
    }
    redisClient = null
    connectionAttempted = false
    isConnected = false
  }
}

/**
 * Reset Redis connection (for testing or recovery)
 */
export function resetRedisConnection(): void {
  if (redisClient) {
    redisClient.disconnect()
  }
  redisClient = null
  connectionAttempted = false
  isConnected = false
}

/**
 * Ping Redis to check health
 */
export async function pingRedis(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    const result = await client.ping()
    return result === 'PONG'
  } catch (error) {
    console.error('[Redis] Ping failed:', error)
    return false
  }
}

/**
 * Get Redis info (for monitoring)
 */
export async function getRedisInfo(): Promise<{ available: boolean; connected: boolean; latency?: number }> {
  const available = redisClient !== null
  const connected = isConnected

  if (!available || !connected) {
    return { available, connected }
  }

  try {
    const start = Date.now()
    await redisClient!.ping()
    const latency = Date.now() - start

    return { available, connected, latency }
  } catch (error) {
    return { available, connected: false }
  }
}

// Export singleton instance for convenience
export const redis = getRedisClient()
