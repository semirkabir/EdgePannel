import { NextResponse } from 'next/server'
import { PolymarketSubgraphClient } from '@/lib/api/polymarket-subgraph'

/**
 * Get market activity from Activity subgraph
 * Provides detailed activity history for markets
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = parseInt(searchParams.get('skip') || '0')
    const type = searchParams.get('type') as 'trade' | 'order' | 'all' | null
    const minAmount = searchParams.get('minAmount') || undefined

    if (!marketId) {
      return NextResponse.json(
        { error: 'marketId query parameter is required' },
        { status: 400 }
      )
    }

    const client = new PolymarketSubgraphClient()

    const activities = await client.getMarketActivity(marketId, {
      limit,
      skip,
      type: type || 'all',
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
    console.error('[Market Activity] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch market activity' },
      { status: 500 }
    )
  }
}

