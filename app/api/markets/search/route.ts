import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { MarketAggregator } from '@/lib/api/market-aggregator'
import { KalshiClient } from '@/lib/api/kalshi'
import { KalshiOptimizedClient } from '@/lib/api/kalshi-optimized'
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
  sort?: string
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
      sort: searchParams.get('sort') || undefined,
    }

    console.log('[Search API] Search params:', params)

    // Early validation
    if (params.limit) {
      const limitNum = parseInt(params.limit, 10)
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return NextResponse.json(
          { error: 'Invalid limit parameter', markets: [], pagination: { hasMore: false, nextCursor: null, nextOffset: null, total: 0 } },
          { status: 400 }
        )
      }
    }

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

    // Try to get Kalshi credentials - but use public API if not available
    if (params.platform === 'all' || params.platform === 'kalshi') {
      try {
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
            console.log('[Search API] Kalshi client initialized with credentials')
          } catch (error: any) {
            console.error('[Search API] Error setting up Kalshi client:', error.message || error)
            console.log('[Search API] Falling back to Kalshi public API')
          }
        } else {
          console.log('[Search API] No Kalshi API keys found, using public API')
        }
      } catch (error: any) {
        console.error('[Search API] Error querying Kalshi API keys:', error.message || error)
      }
    }

    // Try to get Polymarket credentials (optional for market reading)
    if (params.platform === 'all' || params.platform === 'polymarket') {
      try {
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
            console.log('[Search API] Polymarket client initialized with API key')
          } catch (error) {
            // Polymarket can work without API key for reading markets
            console.log('[Search API] Error decrypting Polymarket key, using public API')
            polymarketClient = new PolymarketClient({ apiKey: '' })
          }
        } else {
          // Polymarket public API doesn't require auth
          console.log('[Search API] No Polymarket API keys found, using public API')
          polymarketClient = new PolymarketClient({ apiKey: '' })
        }
      } catch (error: any) {
        console.error('[Search API] Error querying Polymarket API keys:', error.message || error)
        // Fall back to public API
        polymarketClient = new PolymarketClient({ apiKey: '' })
      }
    }

    // Create aggregator
    const aggregator = new MarketAggregator(kalshiClient, polymarketClient)

    // Parse limit
    const limit = parseInt(params.limit || '50', 10)
    const safeLimit = isNaN(limit) ? 50 : Math.min(limit, 500)
    const minProb = params.minProbability ? parseFloat(params.minProbability) : undefined
    const maxProb = params.maxProbability ? parseFloat(params.maxProbability) : undefined

    console.log('[Search API] Searching with aggregator:', {
      query: params.q,
      platform: params.platform,
      category: params.category,
      limit: safeLimit,
      sort: params.sort
    })

    // Fetch Kalshi markets directly using public API if no credentials
    let kalshiMarkets: any[] = []
    if ((params.platform === 'kalshi' || params.platform === 'all') && !kalshiClient) {
      try {
        console.log('[Search API] Fetching Kalshi markets from public API')
        const kalshiOptimized = new KalshiOptimizedClient()
        const result = await kalshiOptimized.getMarkets({ limit: safeLimit, status: 'open' })
        kalshiMarkets = result.markets
        console.log(`[Search API] Kalshi public API returned ${kalshiMarkets.length} markets`)
      } catch (kalshiError: any) {
        console.error('[Search API] Kalshi public API error:', kalshiError.message)
      }
    }

    // Search markets - combine Polymarket API + Kalshi API + indexed results
    let searchResults
    try {
      // If there's a query and we're searching polymarket or all platforms, use Polymarket API
      if (params.q && (params.platform === 'polymarket' || params.platform === 'all')) {
        console.log('[Search API] Searching Polymarket unified API')
        const searchUrl = `https://api.polymarket.com/search?query=${encodeURIComponent(params.q)}&limit=${safeLimit}`

        try {
          const response = await fetch(searchUrl, {
            headers: {
              'Accept': 'application/json'
            }
          })

          if (response.ok) {
            const data = await response.json()
            // Extract markets from search results
            const polymarkets = (data.markets || []).map((m: any) => {
              // Polymarket uses 'tags' array for categorization, with first tag being primary category
              // Also has 'category' field which might be different
              let category = m.category

              // Prefer tags over category field if available
              if (m.tags && Array.isArray(m.tags) && m.tags.length > 0) {
                category = m.tags[0]
              }

              // If still no category, try groupItemTitle (used in some Polymarket responses)
              if (!category && m.groupItemTitle) {
                category = m.groupItemTitle
              }

              return {
                id: m.condition_id || m.id,
                platform: 'polymarket',
                title: m.question || m.title,
                description: m.description || '',
                category: category,
                price: m.outcome_prices ? parseFloat(m.outcome_prices[0]) : undefined,
                probability: m.outcome_prices ? parseFloat(m.outcome_prices[0]) : undefined,
                volume24h: m.volume_24hr || m.volume,
                liquidity: m.liquidity,
                endDate: m.end_date_iso ? new Date(m.end_date_iso) : undefined,
                slug: m.slug,
                outcomes: m.outcomes,
                outcomePrices: m.outcome_prices ? m.outcome_prices.map((p: string) => parseFloat(p)) : undefined,
                rawData: m
              }
            })

            console.log(`[Search API] Polymarket API returned ${polymarkets.length} markets`)

            // If platform is 'polymarket' only, just return Polymarket results
            if (params.platform === 'polymarket') {
              searchResults = {
                markets: polymarkets,
                hasMore: false,
                nextCursor: null,
                nextOffset: null
              }
            } else {
              // For 'all' platforms, combine Polymarket + Kalshi + indexed markets
              // Apply search filter to Kalshi markets if we have a query
              let filteredKalshiMarkets = kalshiMarkets
              if (params.q && kalshiMarkets.length > 0) {
                const searchLower = params.q.toLowerCase()
                filteredKalshiMarkets = kalshiMarkets.filter(m =>
                  m.title?.toLowerCase().includes(searchLower) ||
                  m.description?.toLowerCase().includes(searchLower) ||
                  m.category?.toLowerCase().includes(searchLower)
                )
                console.log(`[Search API] Filtered Kalshi markets by "${params.q}": ${filteredKalshiMarkets.length} of ${kalshiMarkets.length}`)
              }

              // Combine and deduplicate (prefer Polymarket API results)
              const polymarketIds = new Set(polymarkets.map(m => m.id))
              const kalshiIds = new Set(filteredKalshiMarkets.map(m => m.id))

              // Combine all markets
              const combined = [
                ...polymarkets,
                ...filteredKalshiMarkets.filter(m => !polymarketIds.has(m.id))
              ]

              searchResults = {
                markets: combined.slice(0, safeLimit),
                hasMore: combined.length > safeLimit,
                nextCursor: null,
                nextOffset: null
              }

              console.log(`[Search API] Combined: ${polymarkets.length} Polymarket + ${filteredKalshiMarkets.length} Kalshi = ${searchResults.markets.length} total`)
            }
          } else {
            // Polymarket API failed, fallback to aggregator only
            console.warn('[Search API] Polymarket API failed, using aggregator only')
            searchResults = await aggregator.searchMarkets({
              query: params.q,
              platform: params.platform === 'all' ? undefined : params.platform,
              category: params.category,
              minProbability: minProb,
              maxProbability: maxProb,
              limit: safeLimit,
              cursor: params.cursor,
              offset: params.offset ? parseInt(params.offset, 10) : undefined,
              sort: params.sort as any,
            })
          }
        } catch (polyError: any) {
          console.error('[Search API] Polymarket API error:', polyError.message)
          // Fallback to aggregator
          searchResults = await aggregator.searchMarkets({
            query: params.q,
            platform: params.platform === 'all' ? undefined : params.platform,
            category: params.category,
            minProbability: minProb,
            maxProbability: maxProb,
            limit: safeLimit,
            cursor: params.cursor,
            offset: params.offset ? parseInt(params.offset, 10) : undefined,
            sort: params.sort as any,
          })
        }
      } else {
        // No query or Kalshi only
        if (params.platform === 'kalshi') {
          // Kalshi only - return Kalshi markets directly
          console.log('[Search API] Returning Kalshi markets only')
          searchResults = {
            markets: kalshiMarkets.slice(0, safeLimit),
            hasMore: kalshiMarkets.length > safeLimit,
            nextCursor: null,
            nextOffset: null
          }
        } else {
          // No query, all platforms - combine Polymarket (from aggregator) + Kalshi
          console.log('[Search API] No query - fetching from aggregator and combining with Kalshi')
          const indexedResults = await aggregator.searchMarkets({
            query: params.q,
            platform: params.platform === 'all' ? undefined : params.platform,
            category: params.category,
            minProbability: minProb,
            maxProbability: maxProb,
            limit: safeLimit,
            cursor: params.cursor,
            offset: params.offset ? parseInt(params.offset, 10) : undefined,
            sort: params.sort as any,
          })

          // Combine indexed results with Kalshi markets
          const combined = [...indexedResults.markets, ...kalshiMarkets]
          searchResults = {
            markets: combined.slice(0, safeLimit),
            hasMore: combined.length > safeLimit || indexedResults.hasMore,
            nextCursor: indexedResults.nextCursor,
            nextOffset: indexedResults.nextOffset
          }
          console.log(`[Search API] Combined: ${indexedResults.markets.length} indexed + ${kalshiMarkets.length} Kalshi = ${searchResults.markets.length} total`)
        }
      }
    } catch (error: any) {
      console.error('[Search API] Error in searchMarkets:', error.message || error)
      console.error('[Search API] Stack:', error.stack)
      // Return empty results instead of 500 error
      return NextResponse.json({
        markets: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
          nextOffset: null,
          total: 0,
        },
      })
    }

    // Enrich results
    let enrichedResults
    try {
      enrichedResults = enrichMarkets(searchResults.markets)
    } catch (error: any) {
      console.error('[Search API] Error enriching markets:', error.message || error)
      // Return raw markets if enrichment fails
      enrichedResults = searchResults.markets as any[]
    }

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
    console.error('[Search API] Stack:', error.stack)
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

