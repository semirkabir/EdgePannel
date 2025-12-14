import { NextRequest, NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get('ticker')
    const platform = searchParams.get('platform') || 'kalshi'
    const limit = parseInt(searchParams.get('limit') || '100')
    const cursor = searchParams.get('cursor') || undefined

    if (platform === 'kalshi') {
      const accessKeyId = process.env.KALSHI_API_KEY_ID
      const privateKey = process.env.KALSHI_PRIVATE_KEY

      if (!accessKeyId || !privateKey) {
        return NextResponse.json(
          { error: 'Kalshi API credentials not configured' },
          { status: 401 }
        )
      }

      const kalshi = new KalshiClient({ accessKeyId, privateKey })
      const { trades, cursor: nextCursor } = await kalshi.getTrades({
        ticker: ticker || undefined,
        limit,
        cursor,
      })

      // Calculate volume and trade stats
      const totalVolume = trades.reduce((sum, t) => sum + (t.yesPrice * t.count), 0)
      const avgTradeSize = trades.length > 0 ? totalVolume / trades.length : 0

      return NextResponse.json({
        platform,
        ticker,
        trades,
        cursor: nextCursor,
        stats: {
          totalTrades: trades.length,
          totalVolume,
          avgTradeSize,
          buyVolume: trades
            .filter(t => t.takerSide === 'yes')
            .reduce((sum, t) => sum + (t.yesPrice * t.count), 0),
          sellVolume: trades
            .filter(t => t.takerSide === 'no')
            .reduce((sum, t) => sum + (t.noPrice * t.count), 0),
        }
      })
    }

    return NextResponse.json(
      { error: 'Platform not supported' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[API] Error fetching trades:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trades' },
      { status: 500 }
    )
  }
}
