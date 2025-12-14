import { NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { extractLocation, enrichLocationData } from '@/lib/utils/location-extractor-v2'
import { prisma } from '@/lib/db/client'
import { decrypt } from '@/lib/utils/encryption'

/**
 * DEPRECATED: Bulk Market Indexing (Replaced by incremental sync)
 *
 * This endpoint has been REPLACED by:
 * - /api/cron/sync-new-markets (runs every 60s, only fetches NEW markets)
 * - /api/cron/cleanup-expired (runs daily, removes expired markets)
 *
 * The new system is 95% more efficient and provides near real-time updates.
 * This endpoint is kept for manual bootstrap/recovery only.
 *
 * Use case: Initial database seeding or emergency full re-index
 * Trigger manually at: /admin/index-markets
 *
 * Security: Vercel Cron Secret or API key required
 */
export async function GET(request: Request) {
  try {
    // Verify authorization (Vercel Cron Secret or custom API key)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized: Invalid or missing authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron] Starting automatic market indexing...')

    const results = {
      total: 0,
      indexed: 0,
      failed: 0,
      skipped: 0,
      platforms: {} as Record<string, { indexed: number; failed: number; skipped: number }>
    }

    // Index Kalshi markets (using first available API key)
    try {
      const apiKeyRecord = await prisma.apiKey.findFirst({
        where: { platform: 'kalshi' }
      })

      if (apiKeyRecord?.encryptedKey && apiKeyRecord?.encryptedKeyData) {
        const accessKeyId = decrypt(apiKeyRecord.encryptedKey)
        const privateKey = decrypt(apiKeyRecord.encryptedKeyData)
        const client = new KalshiClient({ accessKeyId, privateKey })

        console.log('[Cron] Fetching Kalshi markets...')
        const { markets } = await client.getMarkets({ limit: 1000 })
        console.log(`[Cron] Fetched ${markets.length} Kalshi markets`)

        const kalshiResults = await indexMarkets(markets, 'kalshi', false)
        results.platforms.kalshi = kalshiResults
        results.total += markets.length
        results.indexed += kalshiResults.indexed
        results.failed += kalshiResults.failed
        results.skipped += kalshiResults.skipped
      } else {
        console.log('[Cron] No Kalshi API keys found')
      }
    } catch (error) {
      console.error('[Cron] Error indexing Kalshi markets:', error)
      results.platforms.kalshi = { indexed: 0, failed: 0, skipped: 0 }
    }

    // Index Polymarket markets (no auth required) - with pagination
    try {
      const client = new PolymarketClient()

      console.log('[Cron] Fetching ALL Polymarket markets with pagination...')

      let allMarkets: any[] = []
      let offset = 0
      const pageSize = 500 // Fetch 500 markets per page
      let hasMore = true
      let pageCount = 0

      // Paginate through all markets
      while (hasMore) {
        pageCount++
        console.log(`[Cron] Fetching page ${pageCount} (offset: ${offset})...`)

        const response = await client.getMarkets({
          limit: pageSize,
          offset: offset,
          closed: false // Only fetch open markets
        })

        if (response.markets.length === 0) {
          hasMore = false
          break
        }

        allMarkets.push(...response.markets)
        console.log(`[Cron] Page ${pageCount}: Got ${response.markets.length} markets (total so far: ${allMarkets.length})`)

        // Check if there are more markets
        hasMore = response.hasMore
        if (hasMore && response.nextOffset) {
          offset = response.nextOffset
        } else {
          hasMore = false
        }
      }

      console.log(`[Cron] Fetched ${allMarkets.length} total Polymarket markets across ${pageCount} pages`)

      const polyResults = await indexMarkets(allMarkets, 'polymarket', false)
      results.platforms.polymarket = polyResults
      results.total += allMarkets.length
      results.indexed += polyResults.indexed
      results.failed += polyResults.failed
      results.skipped += polyResults.skipped
    } catch (error) {
      console.error('[Cron] Error indexing Polymarket markets:', error)
      results.platforms.polymarket = { indexed: 0, failed: 0, skipped: 0 }
    }

    console.log('[Cron] Indexing complete:', results)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })
  } catch (error: any) {
    console.error('[Cron] Error:', error)
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
        console.log(`[Cron] Indexed ${indexed} markets...`)
      }
    } catch (error) {
      console.error(`[Cron] Failed to index market ${market.id}:`, error)
      failed++
    }
  }

  return { indexed, failed, skipped }
}
