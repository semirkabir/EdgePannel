/**
 * Redis Management API
 *
 * Provides management operations:
 * - Clear cache by namespace
 * - Inspect key values
 * - Delete specific keys
 * - Get key TTL information
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getRedisClient, isRedisAvailable } from '@/lib/cache/redis-client'
import { z } from 'zod'

const clearCacheSchema = z.object({
  namespace: z.enum(['cache', 'market', 'api', 'session', 'rate_limit', 'all'])
})

const inspectKeySchema = z.object({
  key: z.string().min(1)
})

const deleteKeySchema = z.object({
  key: z.string().min(1)
})

/**
 * POST /api/admin/redis/manage
 * Perform management operations
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if Redis is available
    if (!isRedisAvailable()) {
      return NextResponse.json(
        { error: 'Redis is not available' },
        { status: 503 }
      )
    }

    const redis = getRedisClient()
    if (!redis) {
      throw new Error('Redis client not available')
    }

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'clear': {
        const { namespace } = clearCacheSchema.parse(body)

        let pattern: string
        if (namespace === 'all') {
          pattern = '*'
        } else {
          pattern = `${namespace}:*`
        }

        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
        }

        return NextResponse.json({
          success: true,
          cleared: keys.length,
          namespace
        })
      }

      case 'inspect': {
        const { key } = inspectKeySchema.parse(body)

        const exists = await redis.exists(key)
        if (exists === 0) {
          return NextResponse.json({
            exists: false
          })
        }

        const type = await redis.type(key)
        const ttl = await redis.ttl(key)
        let value: any

        switch (type) {
          case 'string':
            value = await redis.get(key)
            try {
              value = JSON.parse(value)
            } catch {
              // Keep as string if not JSON
            }
            break
          case 'hash':
            value = await redis.hgetall(key)
            break
          case 'list':
            value = await redis.lrange(key, 0, -1)
            break
          case 'set':
            value = await redis.smembers(key)
            break
          case 'zset':
            value = await redis.zrange(key, 0, -1, 'WITHSCORES')
            break
          default:
            value = null
        }

        return NextResponse.json({
          exists: true,
          key,
          type,
          ttl: ttl === -1 ? 'never' : ttl === -2 ? 'expired' : ttl,
          value
        })
      }

      case 'delete': {
        const { key } = deleteKeySchema.parse(body)

        const deleted = await redis.del(key)

        return NextResponse.json({
          success: deleted > 0,
          deleted
        })
      }

      case 'keys': {
        const { pattern = '*', limit = 100 } = body
        const keys = await redis.keys(pattern)

        // Limit results
        const limitedKeys = keys.slice(0, limit)

        // Get additional info for each key
        const keysWithInfo = await Promise.all(
          limitedKeys.map(async (key) => {
            const type = await redis.type(key)
            const ttl = await redis.ttl(key)
            let size = 0

            try {
              const value = await redis.get(key)
              size = value ? value.length : 0
            } catch {
              size = 0
            }

            return {
              key,
              type,
              ttl: ttl === -1 ? null : ttl,
              size
            }
          })
        )

        return NextResponse.json({
          keys: keysWithInfo,
          total: keys.length,
          showing: limitedKeys.length
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[Redis Manage] Error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to perform management operation' },
      { status: 500 }
    )
  }
}
