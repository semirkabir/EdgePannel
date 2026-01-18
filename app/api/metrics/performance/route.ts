/**
 * Performance Metrics API
 *
 * GET /api/metrics/performance - Get performance statistics
 * POST /api/metrics/performance - Clear metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  getPerformanceSummary,
  getEndpointStats,
  getSlowOperations,
  generateRecommendations,
  clearPerformanceMetrics
} from '@/lib/middleware/performance'

/**
 * GET /api/metrics/performance
 * Get comprehensive performance statistics
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

    const summary = getPerformanceSummary()
    const endpoints = getEndpointStats()
    const slowOps = getSlowOperations(20)
    const recommendations = generateRecommendations()

    return NextResponse.json({
      summary,
      endpoints,
      slowOperations: slowOps,
      recommendations
    })
  } catch (error) {
    console.error('[Performance Metrics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/metrics/performance
 * Clear performance metrics
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

    const body = await req.json()

    if (body.action === 'clear') {
      clearPerformanceMetrics()

      return NextResponse.json({
        success: true,
        message: 'Performance metrics cleared'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Performance Metrics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}
