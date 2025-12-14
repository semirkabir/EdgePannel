import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { extractLocation, enrichLocationData } from '@/lib/utils/location-extractor-v2'
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

          console.log('[Market Indexer] Fetching Kalshi markets...')
          const { markets } = await client.getMarkets({ limit })
          console.log(`[Market Indexer] Fetched ${markets.length} Kalshi markets`)

          const kalshiResults = await indexMarkets(markets, 'kalshi', forceReindex)
          results.platforms.kalshi = kalshiResults
          results.total += markets.length
          results.indexed += kalshiResults.indexed
          results.failed += kalshiResults.failed
          results.skipped += kalshiResults.skipped
        } else {
          console.log('[Market Indexer] No Kalshi API keys found')
        }
      } catch (error) {
        console.error('[Market Indexer] Error indexing Kalshi markets:', error)
        results.platforms.kalshi = { indexed: 0, failed: 0, skipped: 0 }
      }
    }

    // Index Polymarket markets
    if (platform === 'polymarket' || platform === 'all') {
      try {
        const client = new PolymarketClient()

        console.log('[Market Indexer] Fetching Polymarket markets...')
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
 * Index a batch of markets with geolocation
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
      // Extract location from market data
      const location = extractLocation(market.title, market.description)

      if (!location) {
        // No location found, skip
        skipped++
        continue
      }

      // Enrich location with market context
      const enrichedLocation = enrichLocationData(location, {
        category: market.category,
        tags: market.rawData?.tags
      })

      // Store or update in database
      const marketId = `${platform}-${market.id}`

      // Check if already indexed (unless force reindex)
      if (!forceReindex) {
        const existing = await prisma.geotaggedMarket.findUnique({
          where: { marketId }
        })

        if (existing) {
          skipped++
          continue // Skip already indexed
        }
      }

      // Upsert geotagged market
      await prisma.geotaggedMarket.upsert({
        where: { marketId },
        create: {
          marketId,
          platform,
          externalId: market.id,
          title: market.title,
          description: market.description || '',
          category: market.category,
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
