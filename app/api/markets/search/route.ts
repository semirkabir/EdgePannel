import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { MarketAggregator } from '@/lib/api/market-aggregator'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'
import { enrichMarkets, EnrichedMarket } from '@/lib/markets/enrich'

interface SearchParams {
  q?: string
  platform?: 'kalshi' | 'polymarket' | 'all'
  category?: string
  minProbability?: string
  maxProbability?: string
  limit?: string
  cursor?: string
  offset?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const params: SearchParams = {
      q: searchParams.get('q') || undefined,
      platform: (searchParams.get('platform') as any) || 'all',
      category: searchParams.get('category') || undefined,
      minProbability: searchParams.get('minProbability') || undefined,
      maxProbability: searchParams.get('maxProbability') || undefined,
      limit: searchParams.get('limit') || '50',
      cursor: searchParams.get('cursor') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    console.log('[Search API] Search params:', params)

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

    // Get API keys for both platforms
    let kalshiClient: KalshiClient | undefined
    let polymarketClient: PolymarketClient | undefined

    // Try to get Kalshi credentials
    if (params.platform === 'all' || params.platform === 'kalshi') {
      const kalshiKeyRecord = await prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: userId,
            platform: 'kalshi',
          },
        },
      })

      if (kalshiKeyRecord?.encryptedKeyData) {
        try {
          const accessKeyId = decrypt(kalshiKeyRecord.encryptedKey)
          const privateKey = decrypt(kalshiKeyRecord.encryptedKeyData)
          kalshiClient = new KalshiClient({ accessKeyId, privateKey })
        } catch (error: any) {
          console.error('[Search API] Error setting up Kalshi client:', error.message || error)
        }
      }
    }

    // Try to get Polymarket credentials (optional for market reading)
    if (params.platform === 'all' || params.platform === 'polymarket') {
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
    }

    // Create aggregator
    const aggregator = new MarketAggregator(kalshiClient, polymarketClient)

    // Parse limit
    const limit = parseInt(params.limit || '50', 10)
    const minProb = params.minProbability ? parseFloat(params.minProbability) : undefined
    const maxProb = params.maxProbability ? parseFloat(params.maxProbability) : undefined

    // Search markets
    const searchResults = await aggregator.searchMarkets({
      query: params.q,
      platform: params.platform === 'all' ? undefined : params.platform,
      category: params.category,
      minProbability: minProb,
      maxProbability: maxProb,
      limit,
      cursor: params.cursor,
      offset: params.offset ? parseInt(params.offset, 10) : undefined,
    })

    // Enrich results
    const enrichedResults = enrichMarkets(searchResults.markets)

    console.log(`[Search API] Found ${enrichedResults.length} markets (hasMore: ${searchResults.hasMore})`)

    return NextResponse.json({
      markets: enrichedResults,
      pagination: {
        hasMore: searchResults.hasMore,
        nextCursor: searchResults.nextCursor,
        nextOffset: searchResults.nextOffset,
        total: enrichedResults.length,
      },
    })
  } catch (error: any) {
    console.error('[Search API] Error searching markets:', error)
    return NextResponse.json(
      { 
        error: 'Failed to search markets',
        markets: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
          nextOffset: null,
          total: 0,
        },
      },
      { status: 500 }
    )
  }
}

