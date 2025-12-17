import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

interface SnapshotData {
  userId: string
  platform: 'kalshi' | 'polymarket' | 'combined'
  totalValue: number
  totalPnl: number
  totalExposure?: number
  positionCount: number
  positions?: Array<{
    ticker?: string
    marketId: string
    marketTitle?: string
    size: number
    entryPrice?: number
    currentPrice?: number
    realizedPnl?: number
    unrealizedPnl?: number
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body: SnapshotData = await request.json()

    const {
      userId,
      platform,
      totalValue,
      totalPnl,
      totalExposure = 0,
      positionCount,
      positions = []
    } = body

    // Validation
    if (!userId || !platform) {
      return NextResponse.json(
        { error: 'userId and platform are required' },
        { status: 400 }
      )
    }

    if (typeof totalValue !== 'number' || typeof totalPnl !== 'number') {
      return NextResponse.json(
        { error: 'totalValue and totalPnl must be numbers' },
        { status: 400 }
      )
    }

    // Portfolio snapshots are calculated from trades, so we just return success
    // The portfolio history endpoint calculates snapshots from Trade records
    return NextResponse.json({
      success: true,
      message: 'Portfolio data is calculated from trades. No snapshot storage needed.',
      snapshot: {
        userId,
        platform,
        totalValue,
        totalPnl,
        positionCount,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error: any) {
    console.error('[Save Snapshot] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check if snapshots exist for a user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Check if user has any trades (which are used to calculate portfolio)
    const tradeCount = await prisma.trade.count({
      where: { userId }
    })

    return NextResponse.json({
      hasSnapshots: tradeCount > 0,
      snapshotCount: tradeCount,
      latestSnapshot: tradeCount > 0 ? {
        message: 'Portfolio calculated from trades',
        tradeCount
      } : null
    })
  } catch (error: any) {
    console.error('[Save Snapshot] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
