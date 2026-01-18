export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { PolymarketClient } from '@/lib/api/polymarket'
import { withErrorHandler } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { WhaleTradesQuerySchema } from '@/lib/api/schemas/whales'

export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const { market, user, side, minSize, limit, offset } = validateQuery(WhaleTradesQuerySchema, searchParams)

    const polymarket = new PolymarketClient()
    const trades = await polymarket.getTrades({
      market,
      user,
      side,
      limit,
      offset,
      takerOnly: true, // Only taker trades (more significant)
    })

    // Filter for whale trades (configurable minimum size)
    const whaleTrades = trades.filter(t => {
      const tradeValue = t.size * t.price
      return tradeValue >= minSize
    })

    // Sort by trade value
    whaleTrades.sort((a, b) => {
      const aValue = a.size * a.price
      const bValue = b.size * b.price
      return bValue - aValue
    })

    // Add trade value to each trade
    const tradesWithValue = whaleTrades.map(t => ({
      ...t,
      value: t.size * t.price
    }))

    return NextResponse.json({
      trades: tradesWithValue,
      totalTrades: tradesWithValue.length,
      totalVolume: tradesWithValue.reduce((sum, t) => sum + t.value, 0),
      filters: { market, user, side, minSize }
    })
  } catch (error: any) {
    console.error('[API] Error fetching whale trades:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trades' },
      { status: 500 }
    )
  }
})
