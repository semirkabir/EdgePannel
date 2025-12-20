export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'kalshi'
    const seriesTicker = searchParams.get('seriesTicker')
    const eventTicker = searchParams.get('eventTicker')
    const marketSlugs = searchParams.get('marketSlugs') // Comma-separated slugs for Polymarket
    const interval = searchParams.get('interval') || '1h'

    // Polymarket: fetch candlesticks for multiple markets
    if (platform === 'polymarket' && marketSlugs) {
      const slugArray = marketSlugs.split(',').map(s => s.trim())
      const client = new PolymarketClient()

      try {
        const candlesticksMap = await client.getCandlesticksForMarkets(slugArray, interval)
        return NextResponse.json({ candlesticks: candlesticksMap })
      } catch (error: any) {
        console.error('[Polymarket Candlesticks] Error:', error.message || error)
        return NextResponse.json({ candlesticks: {} })
      }
    }

    // Kalshi: fetch candlesticks for single market
    if (!eventTicker) {
      return NextResponse.json({ error: 'eventTicker (Kalshi) or marketSlugs (Polymarket) is required' }, { status: 400 })
    }

    // Get user's Kalshi API keys
    let apiKeyRecord
    try {
      apiKeyRecord = await prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: session.user.id,
            platform: 'kalshi',
          },
        },
      })
    } catch (dbError: any) {
      console.error('Database error:', dbError)
      return NextResponse.json({ candlesticks: [] })
    }

    if (!apiKeyRecord || !apiKeyRecord.encryptedKeyData) {
      console.log('[Kalshi Candlesticks] No API keys found for user:', session.user.id)
      return NextResponse.json({ candlesticks: [] })
    }

    let accessKeyId: string
    let privateKey: string

    try {
      accessKeyId = decrypt(apiKeyRecord.encryptedKey)
      privateKey = decrypt(apiKeyRecord.encryptedKeyData)
    } catch (decryptError: any) {
      console.error('Error decrypting API keys:', decryptError)
      return NextResponse.json({ candlesticks: [] })
    }

    try {
      const client = new KalshiClient({ accessKeyId, privateKey })

      console.log(`[Kalshi Candlesticks] Fetching candlesticks for ${eventTicker} with interval ${interval}`)
      const candlesticks = await client.getCandlesticks(eventTicker, interval)
      console.log(`[Kalshi Candlesticks] Successfully fetched ${candlesticks.length} candlesticks`)

      return NextResponse.json({ candlesticks })
    } catch (apiError: any) {
      console.error('[Kalshi Candlesticks] Error calling API:', apiError.message || apiError)
      return NextResponse.json({ candlesticks: [] })
    }
  } catch (error: any) {
    console.error('Error fetching Kalshi candlesticks:', error)
    return NextResponse.json({ candlesticks: [] })
  }
}
