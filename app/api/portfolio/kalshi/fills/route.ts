import { NextRequest, NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get('ticker') || undefined
    const orderId = searchParams.get('orderId') || undefined
    const minTs = searchParams.get('minTs') ? parseInt(searchParams.get('minTs')!) : undefined
    const maxTs = searchParams.get('maxTs') ? parseInt(searchParams.get('maxTs')!) : undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const cursor = searchParams.get('cursor') || undefined

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

    const data = await kalshi.getFills({
      ticker,
      orderId,
      minTs,
      maxTs,
      limit,
      cursor,
    })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API] Error fetching Kalshi fills:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fills' },
      { status: 500 }
    )
  }
}
