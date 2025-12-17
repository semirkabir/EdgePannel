import { NextResponse } from 'next/server'
import { PolymarketSubgraphClient } from '@/lib/api/polymarket-subgraph'

/**
 * Get recent activity across all markets
 * Useful for activity feeds and whale tracking
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')
    const minAmount = searchParams.get('minAmount') || undefined

    const client = new PolymarketSubgraphClient()

    const activities = await client.getRecentActivity({
      limit,
      skip,
      minAmount,
    })

    return NextResponse.json({
      success: true,
      activities: activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        market: activity.market,
        user: activity.user,
        amount: parseFloat(activity.amount),
        price: parseFloat(activity.price),
        timestamp: activity.timestamp,
        txHash: activity.txHash,
      })),
      count: activities.length,
    })
  } catch (error: any) {
    console.error('[Recent Activity] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch recent activity' },
      { status: 500 }
    )
  }
}

