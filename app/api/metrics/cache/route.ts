/**
 * Cache Metrics API Endpoint
 *
 * Provides real-time cache performance metrics including:
 * - Hit/miss rates
 * - Average latency
 * - Operation counts
 * - Redis connection status
 *
 * GET /api/metrics/cache
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllCacheMetrics } from '@/lib/cache/cache-manager'
import { getRedisClient, isRedisAvailable } from '@/lib/cache/redis-client'

/**
 * Get cache metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Get basic cache metrics
    const metrics = getAllCacheMetrics()

    // Get detailed Redis metrics if available
    let redisInfo = null
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient()
        if (redis) {
          // Get Redis INFO stats
          const info = await redis.info('stats')
          const memory = await redis.info('memory')

          // Parse Redis INFO response
          const parseInfo = (infoStr: string): Record<string, string> => {
            const result: Record<string, string> = {}
            const lines = infoStr.split('\r\n')
            for (const line of lines) {
              if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':')
                if (key && value) {
                  result[key] = value
                }
              }
            }
            return result
          }

          const statsData = parseInfo(info)
          const memoryData = parseInfo(memory)

          redisInfo = {
            connected: redis.status === 'ready',
            totalCommandsProcessed: parseInt(statsData.total_commands_processed || '0'),
            instantaneousOpsPerSec: parseInt(statsData.instantaneous_ops_per_sec || '0'),
            totalConnectionsReceived: parseInt(statsData.total_connections_received || '0'),
            rejectedConnections: parseInt(statsData.rejected_connections || '0'),
            keyspaceHits: parseInt(statsData.keyspace_hits || '0'),
            keyspaceMisses: parseInt(statsData.keyspace_misses || '0'),
            keyspaceHitRate:
              parseInt(statsData.keyspace_hits || '0') + parseInt(statsData.keyspace_misses || '0') > 0
                ? (
                    parseInt(statsData.keyspace_hits || '0') /
                    (parseInt(statsData.keyspace_hits || '0') + parseInt(statsData.keyspace_misses || '0'))
                  ).toFixed(4)
                : '0.0000',
            usedMemory: memoryData.used_memory_human,
            usedMemoryPeak: memoryData.used_memory_peak_human,
            memFragmentationRatio: parseFloat(memoryData.mem_fragmentation_ratio || '0'),
          }
        }
      } catch (error) {
        console.error('[Metrics] Failed to get Redis info:', error)
        redisInfo = {
          error: error instanceof Error ? error.message : 'Failed to fetch Redis metrics',
        }
      }
    }

    // Calculate aggregate metrics
    const cacheEntries = Object.values(metrics.caches)
    const totalHits = cacheEntries.reduce((sum, cache) => sum + cache.hits, 0)
    const totalMisses = cacheEntries.reduce((sum, cache) => sum + cache.misses, 0)
    const totalRequests = totalHits + totalMisses
    const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0

    return NextResponse.json({
      success: true,
      metrics: {
        ...metrics,
        redis: redisInfo || metrics.redis,
      },
      aggregate: {
        totalHits,
        totalMisses,
        totalRequests,
        overallHitRate: parseFloat(overallHitRate.toFixed(4)),
      },
    })
  } catch (error) {
    console.error('[Metrics] Cache metrics error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve cache metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Reset cache metrics (for testing/debugging)
 * Requires authentication in production
 */
export async function DELETE(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    // const session = await getServerSession()
    // if (!session?.user?.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { cache, marketCache, apiCache, sessionCache } = await import('@/lib/cache/cache-manager')

    cache.resetMetrics()
    marketCache.resetMetrics()
    apiCache.resetMetrics()
    sessionCache.resetMetrics()

    return NextResponse.json({
      success: true,
      message: 'Cache metrics reset successfully',
    })
  } catch (error) {
    console.error('[Metrics] Cache metrics reset error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset cache metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
