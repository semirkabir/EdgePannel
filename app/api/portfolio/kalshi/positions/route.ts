import { NextRequest, NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const cursor = searchParams.get('cursor') || undefined
    const ticker = searchParams.get('ticker') || undefined
    const eventTicker = searchParams.get('eventTicker') || undefined

    // Get API credentials from env or user session
    const accessKeyId = process.env.KALSHI_API_KEY_ID
    const privateKey = process.env.KALSHI_PRIVATE_KEY

    if (!accessKeyId || !privateKey) {
      return NextResponse.json(
        { error: 'Kalshi API credentials not configured' },
        { status: 401 }
      )
    }

    const kalshi = new KalshiClient({
      accessKeyId,
      privateKey,
    })

    const data = await kalshi.getPositions({
      limit,
      cursor,
      ticker,
      eventTicker,
    })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API] Error fetching Kalshi positions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}
