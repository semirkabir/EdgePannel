import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { MarketAggregator } from '@/lib/api/market-aggregator'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'
import { getBreakingNews, getLivePredictions, getCategories, enrichMarkets, EnrichedMarket } from '@/lib/markets/enrich'

export async function GET(request: Request) {
  try {
    // Parse query parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50
    const cursor = searchParams.get('cursor') || undefined
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined

    // Get user ID - use mock if auth is disabled (to match api-keys route)
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
    
    console.log('[Markets API] Using user ID:', userId, '(AUTH_ENABLED:', AUTH_ENABLED, ')')

    // Get API keys for both platforms
    let kalshiClient: KalshiClient | undefined
    let polymarketClient: PolymarketClient | undefined

    // Try to get Kalshi credentials
    console.log('[Markets API] Checking for Kalshi API keys for user:', userId)
    const kalshiKeyRecord = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: userId,
          platform: 'kalshi',
        },
      },
    })

    console.log('[Markets API] Kalshi key record:', {
      found: !!kalshiKeyRecord,
      hasEncryptedKey: !!kalshiKeyRecord?.encryptedKey,
      hasEncryptedKeyData: !!kalshiKeyRecord?.encryptedKeyData,
      isActive: kalshiKeyRecord?.isActive,
    })

    if (kalshiKeyRecord?.encryptedKeyData) {
      try {
        console.log('[Markets API] Kalshi API keys found, decrypting...')
        const accessKeyId = decrypt(kalshiKeyRecord.encryptedKey)
        const privateKey = decrypt(kalshiKeyRecord.encryptedKeyData)
        console.log('[Markets API] Keys decrypted successfully, creating Kalshi client...')
        kalshiClient = new KalshiClient({ accessKeyId, privateKey })
        console.log('[Markets API] Kalshi client created successfully')
      } catch (error: any) {
        console.error('[Markets API] Error setting up Kalshi client:', error.message || error)
        console.error('[Markets API] Error stack:', error.stack)
      }
      } else {
        if (kalshiKeyRecord) {
          console.log('[Markets API] Kalshi key record exists but missing encryptedKeyData (private key)')
          console.log('[Markets API] This usually means only the Access Key ID was saved, not the Private Key')
        } else {
          console.log('[Markets API] No Kalshi API keys found for user:', userId)
        }
      }

    // Try to get Polymarket credentials (optional for market reading)
    const polymarketKeyRecord = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: userId,
          platform: 'polymarket',
        },
      },
    })

    if (polymarketKeyRecord) {
      try {
        const apiKey = decrypt(polymarketKeyRecord.encryptedKey)
        polymarketClient = new PolymarketClient({ apiKey })
      } catch (error) {
        // Polymarket can work without API key for reading markets
        polymarketClient = new PolymarketClient({ apiKey: '' })
      }
    } else {
      // Polymarket public API doesn't require auth
      polymarketClient = new PolymarketClient({ apiKey: '' })
    }

    // Create aggregator and get enriched markets
    const aggregator = new MarketAggregator(kalshiClient, polymarketClient)
    
    console.log(`[Markets API] Fetching markets - Kalshi: ${kalshiClient ? 'enabled' : 'disabled'}, Polymarket: ${polymarketClient ? 'enabled' : 'disabled'}`)
    console.log(`[Markets API] Pagination params - limit: ${limit}, cursor: ${cursor || 'none'}, offset: ${offset || 'none'}`)
    
    // Get markets from both platforms with pagination (errors are handled internally)
    const markets = await aggregator.getAllMarkets({ limit, cursor, offset })
    const enrichedMarkets = enrichMarkets(markets)
    
    // Get pagination info for next page
    let nextCursor: string | undefined
    let nextOffset: number | undefined
    let hasMore = false
    
    if (kalshiClient && markets.length > 0) {
      try {
        const kalshiResult = await kalshiClient.getMarkets({ limit: 1, cursor })
        if (kalshiResult.nextCursor) {
          hasMore = true
          nextCursor = kalshiResult.nextCursor
        }
      } catch (error) {
        // Ignore errors when checking for next page
      }
    }
    
    if (polymarketClient && markets.length > 0) {
      try {
        const polymarketResult = await polymarketClient.getMarkets({ limit: 1, offset })
        if (polymarketResult.hasMore) {
          hasMore = true
          nextOffset = polymarketResult.nextOffset
        }
      } catch (error) {
        // Ignore errors when checking for next page
      }
    }
    
    const kalshiCount = enrichedMarkets.filter(m => m.platform === 'kalshi').length
    const polymarketCount = enrichedMarkets.filter(m => m.platform === 'polymarket').length
    
    console.log(`[Markets API] Total enriched markets: ${enrichedMarkets.length} (Kalshi: ${kalshiCount}, Polymarket: ${polymarketCount})`)

    // Extract breaking news and live predictions
    const breakingNews = getBreakingNews(enrichedMarkets)
    const livePredictions = getLivePredictions(enrichedMarkets)
    const categories = getCategories(enrichedMarkets)
    
    console.log(`[Markets API] Breaking news: ${breakingNews.length}, Live predictions: ${livePredictions.length}, Categories: ${categories.length}`)

    return NextResponse.json({
      markets: enrichedMarkets,
      breakingNews,
      livePredictions,
      categories,
      pagination: {
        hasMore,
        nextCursor,
        nextOffset,
        limit,
      },
      stats: {
        total: enrichedMarkets.length,
        byPlatform: {
          polymarket: enrichedMarkets.filter(m => m.platform === 'polymarket').length,
          kalshi: enrichedMarkets.filter(m => m.platform === 'kalshi').length,
        },
        byCategory: categories.reduce((acc, cat) => {
          acc[cat] = enrichedMarkets.filter(m => m.normalizedCategory === cat).length
          return acc
        }, {} as Record<string, number>),
      },
    })
  } catch (error: any) {
    console.error('Error fetching all markets:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch markets',
        markets: [],
        breakingNews: [],
        livePredictions: [],
        categories: [],
        stats: { total: 0, byPlatform: {}, byCategory: {} },
      },
      { status: 500 }
    )
  }
}

