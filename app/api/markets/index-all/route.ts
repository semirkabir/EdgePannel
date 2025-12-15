import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { PolymarketOptimizedClient } from '@/lib/api/polymarket-optimized'
import { KalshiClient } from '@/lib/api/kalshi'
import { enrichMarkets } from '@/lib/markets/enrich'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface IndexStats {
  polymarket: { fetched: number; indexed: number; errors: number }
  kalshi: { fetched: number; indexed: number; errors: number }
  total: number
  duration: number
}

// Helper to process markets sequentially to avoid Prisma prepared statement issues
async function processMarketsInChunks(
  markets: any[],
  platform: 'polymarket' | 'kalshi',
  stats: IndexStats['polymarket'] | IndexStats['kalshi']
) {
  const marketsWithLocation = markets.filter(m => m.location?.coordinates)
  
  // Process sequentially to avoid prepared statement cache issues with PgBouncer/Supabase
  for (const market of marketsWithLocation) {
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
          liquidity: market.liquidity,
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
          liquidity: market.liquidity,
          updatedAt: new Date()
        }
      })
      stats.indexed++
    } catch (e) {
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
      polymarket: { fetched: 0, indexed: 0, errors: 0 },
      kalshi: { fetched: 0, indexed: 0, errors: 0 },
      total: 0,
      duration: 0
    }

    const body = await request.json().catch(() => ({}))
    const platforms = body.platforms || ['polymarket', 'kalshi']
    const batchSize = body.batchSize || 500

    console.log('[Index All] Starting indexing for:', platforms)

    // Index Polymarket
    if (platforms.includes('polymarket')) {
      const polyClient = new PolymarketOptimizedClient()
      
      try {
        for await (const batch of polyClient.indexAllMarkets(batchSize)) {
          stats.polymarket.fetched += batch.length
          const enriched = enrichMarkets(batch)
          await processMarketsInChunks(enriched, 'polymarket', stats.polymarket)
        }
      } catch (error) {
        console.error('[Index All] Polymarket error:', error)
      }
    }

    // Index Kalshi
    if (platforms.includes('kalshi')) {
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
