/**
 * Redis Monitoring Stats API
 *
 * Provides comprehensive Redis metrics:
 * - Connection status and health
 * - Memory usage and fragmentation
 * - Performance metrics (ops/sec, hit rate, latency)
 * - Key statistics by namespace
 * - Slow queries log
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getRedisClient, isRedisAvailable } from '@/lib/cache/redis-client'

interface RedisStats {
  connection: {
    available: boolean
    connected: boolean
    uptime: number | null
    connectedClients: number | null
  }
  memory: {
    usedMemory: number | null
    usedMemoryHuman: string | null
    usedMemoryPeak: number | null
    usedMemoryPeakHuman: string | null
    maxMemory: number | null
    maxMemoryHuman: string | null
    fragmentation: number | null
  }
  performance: {
    commandsProcessed: number | null
    instantaneousOpsPerSec: number | null
    latencyMs: number | null
    hitRate: number | null
    keyspaceHits: number | null
    keyspaceMisses: number | null
  }
  keyspace: {
    totalKeys: number
    namespaces: Array<{
      namespace: string
      keys: number
      expires: number
    }>
  }
  slowLog: Array<{
    id: number
    timestamp: number
    duration: number
    command: string[]
  }>
}

/**
 * Parse Redis INFO command output
 */
function parseRedisInfo(info: string): Record<string, any> {
  const parsed: Record<string, any> = {}
  const lines = info.split('\r\n')

  let section = ''
  for (const line of lines) {
    if (line.startsWith('#')) {
      section = line.substring(2).trim().toLowerCase()
      continue
    }

    if (line.includes(':')) {
      const [key, value] = line.split(':')
      const sectionKey = section ? `${section}_${key}` : key

      // Try to parse as number
      const numValue = parseFloat(value)
      parsed[sectionKey] = isNaN(numValue) ? value : numValue
    }
  }

  return parsed
}

/**
 * Get namespace statistics
 */
async function getNamespaceStats(redis: any): Promise<Array<{
  namespace: string
  keys: number
  expires: number
}>> {
  try {
    // Get all keys with prefixes
    const prefixes = ['cache:', 'market:', 'api:', 'session:', 'rate_limit:']
    const namespaceStats: Array<{ namespace: string; keys: number; expires: number }> = []

    for (const prefix of prefixes) {
      const pattern = `${prefix}*`
      const keys = await redis.keys(pattern)

      if (keys.length === 0) {
        namespaceStats.push({
          namespace: prefix.replace(':', ''),
          keys: 0,
          expires: 0
        })
        continue
      }

      // Count keys with TTL
      let expiresCount = 0
      const sampleSize = Math.min(keys.length, 100) // Sample to avoid blocking

      for (let i = 0; i < sampleSize; i++) {
        const ttl = await redis.ttl(keys[i])
        if (ttl > 0) expiresCount++
      }

      // Extrapolate if sampled
      const expiresEstimate = keys.length > sampleSize
        ? Math.round((expiresCount / sampleSize) * keys.length)
        : expiresCount

      namespaceStats.push({
        namespace: prefix.replace(':', ''),
        keys: keys.length,
        expires: expiresEstimate
      })
    }

    return namespaceStats
  } catch (error) {
    console.error('[Redis Stats] Error getting namespace stats:', error)
    return []
  }
}

/**
 * Get slow log entries
 */
async function getSlowLog(redis: any, count = 10): Promise<Array<{
  id: number
  timestamp: number
  duration: number
  command: string[]
}>> {
  try {
    const slowLog = await redis.slowlog('GET', count)

    return slowLog.map((entry: any[]) => ({
      id: entry[0],
      timestamp: entry[1],
      duration: entry[2],
      command: entry[3]
    }))
  } catch (error) {
    console.error('[Redis Stats] Error getting slow log:', error)
    return []
  }
}

/**
 * GET /api/admin/redis/stats
 * Get comprehensive Redis statistics
 */
export async function GET(req: NextRequest) {
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
      return NextResponse.json<RedisStats>({
        connection: {
          available: false,
          connected: false,
          uptime: null,
          connectedClients: null
        },
        memory: {
          usedMemory: null,
          usedMemoryHuman: null,
          usedMemoryPeak: null,
          usedMemoryPeakHuman: null,
          maxMemory: null,
          maxMemoryHuman: null,
          fragmentation: null
        },
        performance: {
          commandsProcessed: null,
          instantaneousOpsPerSec: null,
          latencyMs: null,
          hitRate: null,
          keyspaceHits: null,
          keyspaceMisses: null
        },
        keyspace: {
          totalKeys: 0,
          namespaces: []
        },
        slowLog: []
      })
    }

    const redis = getRedisClient()
    if (!redis) {
      throw new Error('Redis client not available')
    }

    // Measure latency
    const latencyStart = Date.now()
    await redis.ping()
    const latencyMs = Date.now() - latencyStart

    // Get INFO output
    const info = await redis.info()
    const parsed = parseRedisInfo(info)

    // Get namespace statistics
    const namespaces = await getNamespaceStats(redis)
    const totalKeys = namespaces.reduce((sum, ns) => sum + ns.keys, 0)

    // Get slow log
    const slowLog = await getSlowLog(redis, 20)

    // Calculate hit rate
    const keyspaceHits = parsed.stats_keyspace_hits || 0
    const keyspaceMisses = parsed.stats_keyspace_misses || 0
    const totalAccess = keyspaceHits + keyspaceMisses
    const hitRate = totalAccess > 0 ? keyspaceHits / totalAccess : 0

    // Build response
    const stats: RedisStats = {
      connection: {
        available: true,
        connected: true,
        uptime: parsed.server_uptime_in_seconds || null,
        connectedClients: parsed.clients_connected_clients || null
      },
      memory: {
        usedMemory: parsed.memory_used_memory || null,
        usedMemoryHuman: parsed.memory_used_memory_human || null,
        usedMemoryPeak: parsed.memory_used_memory_peak || null,
        usedMemoryPeakHuman: parsed.memory_used_memory_peak_human || null,
        maxMemory: parsed.memory_maxmemory || null,
        maxMemoryHuman: parsed.memory_maxmemory_human || null,
        fragmentation: parsed.memory_mem_fragmentation_ratio || null
      },
      performance: {
        commandsProcessed: parsed.stats_total_commands_processed || null,
        instantaneousOpsPerSec: parsed.stats_instantaneous_ops_per_sec || null,
        latencyMs,
        hitRate,
        keyspaceHits,
        keyspaceMisses
      },
      keyspace: {
        totalKeys,
        namespaces
      },
      slowLog
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[Redis Stats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Redis statistics' },
      { status: 500 }
    )
  }
}
