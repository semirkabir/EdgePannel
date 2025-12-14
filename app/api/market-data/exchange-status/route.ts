import { NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'

export async function GET() {
  try {
    const accessKeyId = process.env.KALSHI_API_KEY_ID
    const privateKey = process.env.KALSHI_PRIVATE_KEY

    if (!accessKeyId || !privateKey) {
      return NextResponse.json(
        { error: 'Kalshi API credentials not configured' },
        { status: 401 }
      )
    }

    const kalshi = new KalshiClient({ accessKeyId, privateKey })
    const status = await kalshi.getExchangeStatus()

    return NextResponse.json({
      ...status,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[API] Error fetching exchange status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch exchange status' },
      { status: 500 }
    )
  }
}
