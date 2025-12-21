export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'
import { enrichMarkets } from '@/lib/markets/enrich'

/**
 * Fetch a single market by URL
 * Supports Polymarket and Kalshi URLs
 */
export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    console.log(`[Fetch URL API] Processing URL: ${url}`)

    // Get user ID - use mock if auth is disabled
    let userId: string
    const { AUTH_ENABLED, MOCK_USER_ID } = await import('@/lib/auth-config')

    if (AUTH_ENABLED) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = session.user.id
    } else {
      userId = MOCK_USER_ID
    }

    // Determine platform from URL
    let market = null

    if (url.includes('polymarket.com')) {
      console.log('[Fetch URL API] Detected Polymarket URL')

      // Try to get API key if available, but Polymarket works without auth
      let polymarketKeyRecord = null
      try {
        polymarketKeyRecord = await prisma.apiKey.findUnique({
          where: {
            userId_platform: {
              userId: userId,
              platform: 'polymarket',
            },
          },
        })
      } catch (dbError) {
        console.warn('[Fetch URL API] Database error, continuing without auth')
      }

      const apiKey = polymarketKeyRecord ? decrypt(polymarketKeyRecord.encryptedKey) : ''
      const client = new PolymarketClient({ apiKey })
      market = await client.getMarketByUrl(url)

    } else if (url.includes('kalshi.com')) {
      console.log('[Fetch URL API] Detected Kalshi URL')

      // Kalshi requires auth
      let kalshiKeyRecord = null
      try {
        kalshiKeyRecord = await prisma.apiKey.findUnique({
          where: {
            userId_platform: {
              userId: userId,
              platform: 'kalshi',
            },
          },
        })
      } catch (dbError) {
        console.error('[Fetch URL API] Database error fetching Kalshi keys')
        return NextResponse.json(
          { error: 'Database error. Please configure your Kalshi API keys.' },
          { status: 500 }
        )
      }

      if (!kalshiKeyRecord?.encryptedKeyData) {
        return NextResponse.json(
          { error: 'Kalshi API keys not configured. Please add them in settings.' },
          { status: 401 }
        )
      }

      const accessKeyId = decrypt(kalshiKeyRecord.encryptedKey)
      const privateKey = decrypt(kalshiKeyRecord.encryptedKeyData)
      const client = new KalshiClient({ accessKeyId, privateKey })
      market = await client.getMarketByUrl(url)

    } else {
      return NextResponse.json(
        { error: 'Unsupported URL. Only Polymarket and Kalshi URLs are supported.' },
        { status: 400 }
      )
    }

    if (!market) {
      return NextResponse.json(
        { error: 'Market not found or invalid URL' },
        { status: 404 }
      )
    }

    // Enrich the market
    const enrichedMarkets = enrichMarkets([market])
    const enrichedMarket = enrichedMarkets[0]

    console.log(`[Fetch URL API] Successfully fetched market: ${enrichedMarket.title}`)

    return NextResponse.json({
      market: enrichedMarket,
      success: true,
    })
  } catch (error: any) {
    console.error('[Fetch URL API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch market' },
      { status: 500 }
    )
  }
}
