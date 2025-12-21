export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { inferLocation } from '@/lib/markets/enrich'
import { prisma } from '@/lib/db/client'
import { decrypt } from '@/lib/utils/encryption'

/**
 * Index all markets with geolocation data
 * This endpoint processes markets in batches and extracts/stores their locations
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'all' // 'kalshi', 'polymarket', or 'all'
    const limit = parseInt(searchParams.get('limit') || '1000')
    const forceReindex = searchParams.get('force') === 'true'

    console.log(`[Market Indexer] Starting indexing for platform: ${platform}, limit: ${limit}`)

    const results = {
      total: 0,
      indexed: 0,
      failed: 0,
      skipped: 0,
      platforms: {} as Record<string, { indexed: number; failed: number; skipped: number }>
    }

    // Index Kalshi markets
    if (platform === 'kalshi' || platform === 'all') {
      try {
        // Get user's Kalshi API keys
        const apiKeyRecord = await prisma.apiKey.findUnique({
          where: {
            userId_platform: {
              userId: session.user.id,
              platform: 'kalshi',
            },
          },
        })

        if (apiKeyRecord && apiKeyRecord.encryptedKeyData) {
          const accessKeyId = decrypt(apiKeyRecord.encryptedKey)
          const privateKey = decrypt(apiKeyRecord.encryptedKeyData)
          const client = new KalshiClient({ accessKeyId, privateKey })

          console.log('[Market Indexer] Fetching ALL Kalshi markets with pagination...')

          let cursor: string | undefined
          let totalFetched = 0
          let pageCount = 0
          const batchSize = 100

          // Loop until no more pages or until we reach the global limit if it was very small (optional)
          // But since the user wants to index everything usually, we loop properly.
          // Note: The 'limit' param from URL acts as a batch size or total limit? 
          // Usually 'limit' in this context meant "how many to fetch". 
          // If the user said limit=2000, we should stop after 2000.

          let remainingLimit = limit;

          do {
            pageCount++
            const fetchSize = Math.min(batchSize, remainingLimit)

            console.log(`[Market Indexer] Fetching Kalshi page ${pageCount} (cursor: ${cursor || 'start'})...`)

            const response = await client.getMarkets({
              limit: fetchSize,
              cursor: cursor
            })

            const markets = response.markets || []

            if (markets.length === 0) {
              break
            }

            // Index this batch
            const batchResults = await indexMarkets(markets, 'kalshi', forceReindex)

            // Accumulate results
            if (!results.platforms.kalshi) {
              results.platforms.kalshi = { indexed: 0, failed: 0, skipped: 0 }
            }
            results.platforms.kalshi.indexed += batchResults.indexed
            results.platforms.kalshi.failed += batchResults.failed
            results.platforms.kalshi.skipped += batchResults.skipped

            results.total += markets.length
            results.indexed += batchResults.indexed
            results.failed += batchResults.failed
            results.skipped += batchResults.skipped

            totalFetched += markets.length
            remainingLimit -= markets.length

            console.log(`[Market Indexer] Kalshi Page ${pageCount}: Got ${markets.length} markets. Results: ${batchResults.indexed} indexed, ${batchResults.skipped} skipped. Total: ${totalFetched}`)

            cursor = response.nextCursor

            if (remainingLimit <= 0) break;

          } while (cursor)

        } else {
          console.log('[Market Indexer] No Kalshi API keys found')
        }
      } catch (error) {
        console.error('[Market Indexer] Error indexing Kalshi markets:', error)
        if (!results.platforms.kalshi) results.platforms.kalshi = { indexed: 0, failed: 0, skipped: 0 }
      }
    }

    // Index Polymarket markets
    if (platform === 'polymarket' || platform === 'all') {
      try {
        const client = new PolymarketClient()

        console.log('[Market Indexer] Fetching Polymarket markets...')
        // Polymarket client helper usually handles some pagination, but let's trust it respects 'limit'
        // or effectively fetches until limit
        const { markets } = await client.getMarkets({ limit })
        console.log(`[Market Indexer] Fetched ${markets.length} Polymarket markets`)

        const polyResults = await indexMarkets(markets, 'polymarket', forceReindex)
        results.platforms.polymarket = polyResults
        results.total += markets.length
        results.indexed += polyResults.indexed
        results.failed += polyResults.failed
        results.skipped += polyResults.skipped
      } catch (error) {
        console.error('[Market Indexer] Error indexing Polymarket markets:', error)
        results.platforms.polymarket = { indexed: 0, failed: 0, skipped: 0 }
      }
    }

    console.log('[Market Indexer] Indexing complete:', results)

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error: any) {
    console.error('[Market Indexer] Error:', error)
    return NextResponse.json(
      { error: 'Failed to index markets', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Fetch tags for a Polymarket market
 */
async function fetchPolymarketTags(marketId: string): Promise<string[]> {
  try {
    const response = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return []
    }

    const tags = await response.json()
    if (Array.isArray(tags)) {
      // Extract tag labels (e.g., "Politics", "Sports", "Crypto")
      return tags.map((tag: any) => tag.label).filter(Boolean)
    }
    return []
  } catch (error) {
    console.warn(`[Indexer] Error fetching tags for market ${marketId}:`, error)
    return []
  }
}

/**
 * Index a batch of markets with geolocation and tags
 */
async function indexMarkets(
  markets: any[],
  platform: string,
  forceReindex: boolean
): Promise<{ indexed: number; failed: number; skipped: number }> {
  let indexed = 0
  let failed = 0
  let skipped = 0

  for (const market of markets) {
    try {
      // Extract location from market data using improved inference
      const locationResult = inferLocation(market)

      if (!locationResult) {
        // No location found, skip
        skipped++
        continue
      }

      // Fetch tags for Polymarket markets
      let tags: string[] = []
      let primaryCategory: string | undefined = market.category

      if (platform === 'polymarket') {
        // Get the numeric ID for tag fetching
        const numericId = market.rawData?.numericId || market.id
        tags = await fetchPolymarketTags(numericId)

        // Use first tag as primary category if no category exists
        if (!primaryCategory && tags.length > 0) {
          primaryCategory = tags[0]
        }

        console.log(`[Indexer] Market "${market.title.substring(0, 50)}..." - Tags: ${tags.join(', ') || 'none'}`)
      }

      // Map the location result to the enriched format
      const enrichedLocation = {
        country: locationResult.name,
        region: null,
        city: null,
        coordinates: locationResult.coordinates,
        confidence: 'high', // New algorithm is more reliable
        extractedFrom: 'improved-context-detection'
      }

      // Store or update in database
      const marketId = `${platform}-${market.id}`
      const existing = await prisma.geotaggedMarket.findUnique({
        where: { marketId }
      })

      // Smart Update Logic:
      // 1. If forceReindex: Update it.
      // 2. If not exists: Create it.
      // 3. If exists AND has NO location but we found one now: Update it.
      // 4. If exists AND has location but we found a BETTER one (higher confidence): Update it.

      let shouldUpdate = false
      if (forceReindex || !existing) {
        shouldUpdate = true
      } else {
        // Exists. Check if we can improve it.
        if (existing.latitude === null && enrichedLocation.coordinates) {
          shouldUpdate = true // Found location for previously unlocated market
        } else if (existing.confidence !== 'high' && enrichedLocation.confidence === 'high') {
          shouldUpdate = true // Found high confidence location for previously low confidence market
        }
      }

      if (existing && !shouldUpdate) {
        skipped++
        continue
      }

      // Upsert geotagged market with tags
      await prisma.geotaggedMarket.upsert({
        where: { marketId },
        create: {
          marketId,
          platform,
          externalId: market.id,
          title: market.title,
          description: market.description || '',
          category: primaryCategory,
          tags: tags,
          probability: market.price || market.probability,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
          endDate: market.endDate,
          slug: market.slug,
          ticker: market.ticker,
          country: enrichedLocation.country,
          region: enrichedLocation.region,
          city: enrichedLocation.city,
          latitude: enrichedLocation.coordinates?.lat,
          longitude: enrichedLocation.coordinates?.lng,
          confidence: enrichedLocation.confidence,
          extractedFrom: enrichedLocation.extractedFrom,
          rawData: market.rawData || {},
        },
        update: {
          title: market.title,
          description: market.description || '',
          category: primaryCategory,
          tags: tags,
          probability: market.price || market.probability,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
          endDate: market.endDate,
          country: enrichedLocation.country,
          region: enrichedLocation.region,
          city: enrichedLocation.city,
          latitude: enrichedLocation.coordinates?.lat,
          longitude: enrichedLocation.coordinates?.lng,
          confidence: enrichedLocation.confidence,
          extractedFrom: enrichedLocation.extractedFrom,
          updatedAt: new Date(),
        }
      })

      indexed++

      // Log progress every 100 markets
      if (indexed % 100 === 0) {
        console.log(`[Market Indexer] Indexed ${indexed} markets...`)
      }
    } catch (error) {
      console.error(`[Market Indexer] Failed to index market ${market.id}:`, error)
      failed++
    }
  }

  return { indexed, failed, skipped }
}

/**
 * Get indexing status
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get count of indexed markets by platform
    const kalshiCount = await prisma.geotaggedMarket.count({
      where: { platform: 'kalshi' }
    })

    const polymarketCount = await prisma.geotaggedMarket.count({
      where: { platform: 'polymarket' }
    })

    // Get count by confidence level
    const highConfidence = await prisma.geotaggedMarket.count({
      where: { confidence: 'high' }
    })

    const mediumConfidence = await prisma.geotaggedMarket.count({
      where: { confidence: 'medium' }
    })

    const lowConfidence = await prisma.geotaggedMarket.count({
      where: { confidence: 'low' }
    })

    // Get top countries
    const topCountries = await prisma.geotaggedMarket.groupBy({
      by: ['country'],
      _count: true,
      orderBy: {
        _count: {
          country: 'desc'
        }
      },
      take: 10
    })

    return NextResponse.json({
      total: kalshiCount + polymarketCount,
      byPlatform: {
        kalshi: kalshiCount,
        polymarket: polymarketCount
      },
      byConfidence: {
        high: highConfidence,
        medium: mediumConfidence,
        low: lowConfidence
      },
      topCountries: topCountries.map(c => ({
        country: c.country,
        count: c._count
      }))
    })
  } catch (error: any) {
    console.error('[Market Indexer] Error getting status:', error)
    return NextResponse.json(
      { error: 'Failed to get indexing status', details: error.message },
      { status: 500 }
    )
  }
}
