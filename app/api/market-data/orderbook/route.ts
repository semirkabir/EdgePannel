import { NextRequest, NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get('ticker')
    const platform = searchParams.get('platform') || 'kalshi'

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker is required' },
        { status: 400 }
      )
    }

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
      const { bids, asks } = await kalshi.getOrderBook(ticker)

      // Calculate spread and depth metrics
      const spread = asks.length > 0 && bids.length > 0
        ? asks[0].price - bids[0].price
        : 0

      const bidDepth = bids.reduce((sum, level) => sum + (level.price * level.quantity), 0)
      const askDepth = asks.reduce((sum, level) => sum + (level.price * level.quantity), 0)
      const totalDepth = bidDepth + askDepth
      const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0

      return NextResponse.json({
        ticker,
        platform,
        bids,
        asks,
        metrics: {
          spread,
          spreadPercent: bids.length > 0 ? (spread / bids[0].price) * 100 : 0,
          bidDepth,
          askDepth,
          totalDepth,
          imbalance,
          bidLevels: bids.length,
          askLevels: asks.length,
        }
      })
    }

    return NextResponse.json(
      { error: 'Platform not supported' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[API] Error fetching orderbook:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orderbook' },
      { status: 500 }
    )
  }
}
