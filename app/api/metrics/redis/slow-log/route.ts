/**
 * Redis Slow Log API
 *
 * GET /api/metrics/redis/slow-log - Get Redis slow query log
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getRedisClient, isRedisAvailable } from '@/lib/cache/redis-client'

/**
 * GET /api/metrics/redis/slow-log
 * Get Redis slow query log
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

    if (!isRedisAvailable()) {
      return NextResponse.json(
        { available: false, slowLog: [] }
      )
    }

    const redis = getRedisClient()
    if (!redis) {
      throw new Error('Redis client not available')
    }

    // Get slow log entries
    const count = parseInt(req.nextUrl.searchParams.get('count') || '50', 10)
    const slowLog = await redis.slowlog('GET', count)

    const formatted = slowLog.map((entry: any[]) => ({
      id: entry[0],
      timestamp: entry[1],
      duration: entry[2], // microseconds
      durationMs: (entry[2] / 1000).toFixed(2),
      command: entry[3].join(' '),
      clientAddress: entry[4] || 'N/A',
      clientName: entry[5] || 'N/A'
    }))

    return NextResponse.json({
      available: true,
      slowLog: formatted,
      count: formatted.length
    })
  } catch (error) {
    console.error('[Redis Slow Log] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch slow log' },
      { status: 500 }
    )
  }
}
