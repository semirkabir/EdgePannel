import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { PolymarketOptimizedClient } from '@/lib/api/polymarket-optimized'
import { KalshiClient } from '@/lib/api/kalshi'
import { enrichMarkets } from '@/lib/markets/enrich'
import { extractLocation, batchExtractLocationsSmart } from '@/lib/utils/location-extractor-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface IndexStats {
  polymarket: { fetched: number; indexed: number; skipped: number; errors: number }
  kalshi: { fetched: number; indexed: number; skipped: number; errors: number }
  total: number
  duration: number
}

// Helper to process markets sequentially to avoid Prisma prepared statement issues
async function processMarketsInChunks(
  markets: any[],
  platform: 'polymarket' | 'kalshi',
  stats: IndexStats['polymarket'] | IndexStats['kalshi']
) {
  // Process all markets, even those without location (for search)
  // const marketsWithLocation = markets.filter(m => m.location?.coordinates)
  const marketsToProcess = markets

  const marketsWithoutLocation = markets.filter(m => !m.location?.coordinates).length
  if (marketsWithoutLocation > 0) {
    console.log(`[Index All] Indexing ${marketsWithoutLocation} markets without location data (search only)`)
  }

  // Process sequentially to avoid prepared statement cache issues with PgBouncer/Supabase
  for (const market of marketsToProcess) {
    try {
      const marketId = `${platform}-${market.id}`
      await prisma.geotaggedMarket.upsert({
        where: { marketId },
        create: {
          marketId,
          platform,
          externalId: market.id,
          title: market.title,
          description: market.description || '',
          category: market.category || market.normalizedCategory || null,
          probability: market.price,
          volume24h: market.volume24h,
          liquidity: typeof market.liquidity === 'string' ? parseFloat(market.liquidity) : (market.liquidity || 0),
          endDate: market.endDate,
          slug: market.slug,
          ticker: market.ticker,
          country: market.location?.country,
          region: market.location?.region,
          city: market.location?.city,
          latitude: market.location?.coordinates?.lat,
          longitude: market.location?.coordinates?.lng,
          confidence: 'medium',
          rawData: market.rawData || {}
        },
        update: {
          title: market.title,
          probability: market.price,
          volume24h: market.volume24h,
          liquidity: typeof market.liquidity === 'string' ? parseFloat(market.liquidity) : (market.liquidity || 0),
          updatedAt: new Date()
        }
      })
      stats.indexed++
    } catch (e: any) {
      console.error(`[Index All] Error indexing market ${market.id}:`, e.message)
      stats.errors++
    }
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    const stats: IndexStats = {
      polymarket: { fetched: 0, indexed: 0, skipped: 0, errors: 0 },
      kalshi: { fetched: 0, indexed: 0, skipped: 0, errors: 0 },
      total: 0,
      duration: 0
    }

    const body = await request.json().catch(() => ({}))
    const platforms = body.platforms || ['polymarket', 'kalshi']
    const batchSize = body.batchSize || 500

    console.log('[Index All] Starting indexing for:', platforms)

    // Index Polymarket
    if (platforms.includes('polymarket')) {
      console.log('[Index All] Clearing existing Polymarket data (Full Reset)...')
      await prisma.geotaggedMarket.deleteMany({
        where: { platform: 'polymarket' }
      })

      const polyClient = new PolymarketOptimizedClient()

      try {
        for await (const batch of polyClient.indexAllMarkets(batchSize)) {
          stats.polymarket.fetched += batch.length
          const enriched = enrichMarkets(batch)

          // Enhance with v2 location extraction (LLM/Regex)
          // Uses batched smart extraction to respect rate limits
          const batchLocations = await batchExtractLocationsSmart(
            enriched.map((m, i) => ({
              id: String(i),
              title: (m.rawData as any)?.eventTitle || m.title,
              description: m.description
            }))
          )

          enriched.forEach((m, i) => {
            const loc = batchLocations.get(i)
            if (loc && loc.coordinates) {
              // @ts-ignore
              m.location = {
                // name: loc.city || loc.country || loc.region || 'Unknown',
                coordinates: loc.coordinates,
                country: loc.country,
                region: loc.region,
                city: loc.city
              }
            }
          })

          await processMarketsInChunks(enriched, 'polymarket', stats.polymarket)
        }
      } catch (error) {
        console.error('[Index All] Polymarket error:', error)
      }
    }

    // Index Kalshi
    if (platforms.includes('kalshi')) {
      console.log('[Index All] Clearing existing Kalshi data (Full Reset)...')
      await prisma.geotaggedMarket.deleteMany({
        where: { platform: 'kalshi' }
      })
      const accessKeyId = process.env.KALSHI_API_KEY_ID
      const privateKey = process.env.KALSHI_PRIVATE_KEY

      if (accessKeyId && privateKey) {
        try {
          const kalshiClient = new KalshiClient({ accessKeyId, privateKey })
          let cursor: string | undefined
          let hasMore = true

          while (hasMore) {
            const result = await kalshiClient.getMarkets({ limit: batchSize, cursor })
            stats.kalshi.fetched += result.markets.length
            const enriched = enrichMarkets(result.markets)

            // Enhance with v2 location extraction (LLM/Regex)
            // Uses batched smart extraction to respect rate limits
            const batchLocations = await batchExtractLocationsSmart(
              enriched.map((m, i) => ({ id: String(i), title: m.title, description: m.description }))
            )

            enriched.forEach((m, i) => {
              const loc = batchLocations.get(i)
              if (loc && loc.coordinates) {
                // @ts-ignore
                m.location = {
                  // name: loc.city || loc.country || loc.region || 'Unknown',
                  coordinates: loc.coordinates,
                  country: loc.country,
                  region: loc.region,
                  city: loc.city
                }
              }
            })

            await processMarketsInChunks(enriched, 'kalshi', stats.kalshi)

            cursor = result.nextCursor
            hasMore = !!cursor && result.markets.length === batchSize
          }
        } catch (error) {
          console.error('[Index All] Kalshi error:', error)
        }
      }
    }

    stats.total = stats.polymarket.indexed + stats.kalshi.indexed
    stats.duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      stats,
      message: `Indexed ${stats.total} markets in ${(stats.duration / 1000).toFixed(1)}s`
    })
  } catch (error: any) {
    console.error('[Index All] Error:', error)
    return NextResponse.json(
      { error: 'Failed to index markets', details: error.message },
      { status: 500 }
    )
  }
}
