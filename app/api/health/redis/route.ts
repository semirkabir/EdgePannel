/**
 * Redis Health Check API
 *
 * Endpoint: GET /api/health/redis
 * Returns Redis connection status and metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRedisInfo } from '@/lib/cache/redis-client'

export async function GET(req: NextRequest) {
  try {
    const info = await getRedisInfo()

    const status = info.connected ? 200 : 503

    return NextResponse.json(
      {
        service: 'redis',
        status: info.connected ? 'healthy' : 'unavailable',
        timestamp: new Date().toISOString(),
        details: info
      },
      { status }
    )
  } catch (error) {
    return NextResponse.json(
      {
        service: 'redis',
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
