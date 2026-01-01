import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/db/client'
import { PolymarketOptimizedClient } from '@/lib/api/polymarket-optimized'
import { KalshiClient } from '@/lib/api/kalshi'
import { enrichMarkets } from '@/lib/markets/enrich'
import { batchExtractLocationsSmart } from '@/lib/utils/location-extractor-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface IndexStats {
  polymarket: { fetched: number; indexed: number; skipped: number; errors: number }
  kalshi: { fetched: number; indexed: number; skipped: number; errors: number }
  total: number
  duration: number
}

/**
 * Optimized market processing using Prisma createMany
 */
async function processMarketsBatch(
  markets: any[],
  platform: 'polymarket' | 'kalshi'
): Promise<number> {
  if (markets.length === 0) return 0

  const marketsToCreate = markets.map(market => ({
    marketId: `${platform}-${market.id}`,
    platform,
    externalId: String(market.id),
    title: market.title,
    description: market.description || '',
    category: market.category || market.normalizedCategory || null,
    probability: market.price || null,
    volume24h: market.volume24h || 0,
    liquidity: typeof market.liquidity === 'string' ? parseFloat(market.liquidity) : (market.liquidity || 0),
    endDate: market.endDate ? new Date(market.endDate) : null,
    slug: market.slug || null,
    ticker: market.ticker || null,
    country: market.location?.country || null,
    region: market.location?.region || null,
    city: market.location?.city || null,
    latitude: market.location?.coordinates?.lat || null,
    longitude: market.location?.coordinates?.lng || null,
    confidence: 'medium',
    rawData: market.rawData || {}
  }))

  const result = await prisma.geotaggedMarket.createMany({
    data: marketsToCreate,
    skipDuplicates: true
  })

  return result.count
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
  }

  const startTime = Date.now()
  const stats: IndexStats = {
    polymarket: { fetched: 0, indexed: 0, skipped: 0, errors: 0 },
    kalshi: { fetched: 0, indexed: 0, skipped: 0, errors: 0 },
    total: 0,
    duration: 0
  }

  // Set default structure for stats properly (fix TypeScript inference if needed)
  stats.polymarket = { fetched: 0, indexed: 0, skipped: 0, errors: 0 }
  stats.kalshi = { fetched: 0, indexed: 0, skipped: 0, errors: 0 }

  try {
    const body = await request.json().catch(() => ({}))
    const platforms = body.platforms || ['polymarket', 'kalshi']
    const batchSize = body.batchSize || 100 // Smaller default batch size for better stability
    const isFullReset = body.fullReset !== false // Default to true

    console.log(`[Index All] Starting indexing for: ${platforms.join(', ')} (Reset: ${isFullReset})`)

    // Index Polymarket
    if (platforms.includes('polymarket')) {
      if (isFullReset) {
        console.log('[Index All] Clearing existing Polymarket data...')
        await prisma.geotaggedMarket.deleteMany({ where: { platform: 'polymarket' } })
      }

      const polyClient = new PolymarketOptimizedClient()
      try {
        for await (const batch of polyClient.indexAllMarkets(batchSize)) {
          stats.polymarket.fetched += batch.length
          const enriched = enrichMarkets(batch)

          // Location extraction
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
                coordinates: loc.coordinates,
                country: loc.country,
                region: loc.region,
                city: loc.city
              }
            }
          })

          const indexedCount = await processMarketsBatch(enriched, 'polymarket')
          stats.polymarket.indexed += indexedCount
          console.log(`[Index All] Polymarket Batch: ${indexedCount} indexed. Total: ${stats.polymarket.indexed}`)
        }
      } catch (error) {
        console.error('[Index All] Polymarket fatal error:', error)
      }
    }

    // Index Kalshi
    if (platforms.includes('kalshi')) {
      if (isFullReset) {
        console.log('[Index All] Clearing existing Kalshi data...')
        await prisma.geotaggedMarket.deleteMany({ where: { platform: 'kalshi' } })
      }

      const accessKeyId = process.env.KALSHI_SYSTEM_API_KEY_ID || process.env.KALSHI_API_KEY_ID
      const privateKey = process.env.KALSHI_SYSTEM_PRIVATE_KEY || process.env.KALSHI_PRIVATE_KEY

      if (accessKeyId && privateKey) {
        try {
          const kalshiClient = new KalshiClient({ accessKeyId, privateKey })
          let cursor: string | undefined
          let hasMore = true

          while (hasMore) {
            const result = await kalshiClient.getMarkets({ limit: batchSize, cursor })
            if (!result.markets || result.markets.length === 0) break

            stats.kalshi.fetched += result.markets.length
            const enriched = enrichMarkets(result.markets)

            const batchLocations = await batchExtractLocationsSmart(
              enriched.map((m, i) => ({ id: String(i), title: m.title, description: m.description }))
            )

            enriched.forEach((m, i) => {
              const loc = batchLocations.get(i)
              if (loc && loc.coordinates) {
                // @ts-ignore
                m.location = {
                  coordinates: loc.coordinates,
                  country: loc.country,
                  region: loc.region,
                  city: loc.city
                }
              }
            })

            const indexedCount = await processMarketsBatch(enriched, 'kalshi')
            stats.kalshi.indexed += indexedCount
            console.log(`[Index All] Kalshi Batch: ${indexedCount} indexed. Total: ${stats.kalshi.indexed}`)

            cursor = result.nextCursor
            hasMore = !!cursor && result.markets.length === batchSize
          }
        } catch (error) {
          console.error('[Index All] Kalshi fatal error:', error)
        }
      }
    }

    stats.total = stats.polymarket.indexed + stats.kalshi.indexed
    stats.duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      stats,
      message: `Successfully indexed ${stats.total} markets in ${(stats.duration / 1000).toFixed(1)}s`
    })
  } catch (error: any) {
    console.error('[Index All] Critical indexing error:', error)
    return NextResponse.json(
      { error: 'Failed to complete indexing', details: error.message, stats },
      { status: 500 }
    )
  }
}
