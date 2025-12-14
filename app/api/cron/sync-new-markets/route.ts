import { NextResponse } from 'next/server'
import { PolymarketClient } from '@/lib/api/polymarket'
import { extractLocation, enrichLocationData } from '@/lib/utils/location-extractor-v2'
import { prisma } from '@/lib/db/client'

/**
 * Incremental New Market Sync (Runs every 60 seconds)
 *
 * Efficiently fetches only NEW markets by tracking the last seen market ID.
 * This replaces the wasteful hourly bulk reindex.
 *
 * Process:
 * 1. Get lastSeenId from MarketSyncState
 * 2. Fetch markets with id > lastSeenId (typically 0-20 markets)
 * 3. Geocode and index new markets
 * 4. Update lastSeenId
 *
 * Rate Limits:
 * - Polymarket /events: 100 requests/10s (we use ~1 request/60s)
 * - Well within limits!
 */
export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    // Verify authorization (Vercel Cron Secret)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[NewMarketSync] Unauthorized: Invalid or missing authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[NewMarketSync] Starting incremental sync...')

    const results = {
      platform: 'polymarket',
      newMarkets: 0,
      indexed: 0,
      failed: 0,
      skipped: 0,
      lastSeenId: null as string | null,
      duration: 0
    }

    // Get or initialize sync state for Polymarket
    let syncState = await prisma.marketSyncState.findUnique({
      where: { platform: 'polymarket' }
    })

    if (!syncState) {
      // First run - initialize with a recent market ID
      // We'll start from "now" and catch new markets going forward
      console.log('[NewMarketSync] First run - initializing sync state')

      const client = new PolymarketClient()
      const { markets } = await client.getMarkets({
        limit: 1,
        order: 'id',
        ascending: false // Get the most recent market
      })

      const initialId = markets[0]?.id || '0'

      syncState = await prisma.marketSyncState.create({
        data: {
          platform: 'polymarket',
          lastSeenId: initialId,
          lastSeenTimestamp: new Date(),
          marketsProcessed: 0
        }
      })

      console.log(`[NewMarketSync] Initialized with lastSeenId: ${initialId}`)
      results.lastSeenId = initialId

      return NextResponse.json({
        success: true,
        message: 'Initialized sync state',
        results,
        duration: Date.now() - startTime
      })
    }

    console.log(`[NewMarketSync] Last seen ID: ${syncState.lastSeenId}`)

    // Fetch markets with id > lastSeenId
    const client = new PolymarketClient()

    // Polymarket IDs are sortable strings, fetch in ascending order
    // and filter for IDs greater than lastSeenId
    const { markets: allMarkets } = await client.getMarkets({
      limit: 100, // Max new markets to fetch (typically 0-20 per minute)
      order: 'id',
      ascending: false, // Newest first
      closed: false // Only active markets
    })

    // Filter for markets with ID > lastSeenId
    const newMarkets = allMarkets.filter(m => m.id > syncState!.lastSeenId)

    console.log(`[NewMarketSync] Found ${newMarkets.length} new markets`)
    results.newMarkets = newMarkets.length

    if (newMarkets.length === 0) {
      // No new markets, just update lastSync timestamp
      await prisma.marketSyncState.update({
        where: { platform: 'polymarket' },
        data: {
          lastSync: new Date(),
          updatedAt: new Date()
        }
      })

      results.duration = Date.now() - startTime
      return NextResponse.json({
        success: true,
        message: 'No new markets found',
        results
      })
    }

    // Process new markets
    let highestId = syncState.lastSeenId
    let highestTimestamp = syncState.lastSeenTimestamp

    for (const market of newMarkets) {
      try {
        // Extract location from market data
        const location = extractLocation(market.title, market.description)

        if (!location) {
          // No location found, skip
          results.skipped++
          continue
        }

        // Enrich location with market context
        const enrichedLocation = enrichLocationData(location, {
          category: market.category,
          tags: market.rawData?.tags
        })

        // Store in database
        const marketId = `polymarket-${market.id}`

        await prisma.geotaggedMarket.upsert({
          where: { marketId },
          create: {
            marketId,
            platform: 'polymarket',
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
            active: true, // New markets are active by default
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
            active: true,
            updatedAt: new Date(),
          }
        })

        results.indexed++

        // Track highest ID and timestamp
        if (market.id > highestId) {
          highestId = market.id
        }

        // Track timestamp if available
        const marketTimestamp = market.createdAt || market.rawData?.created_at
        if (marketTimestamp) {
          const ts = new Date(marketTimestamp)
          if (!highestTimestamp || ts > highestTimestamp) {
            highestTimestamp = ts
          }
        }

      } catch (error) {
        console.error(`[NewMarketSync] Failed to index market ${market.id}:`, error)
        results.failed++
      }
    }

    // Update sync state with new lastSeenId
    await prisma.marketSyncState.update({
      where: { platform: 'polymarket' },
      data: {
        lastSeenId: highestId,
        lastSeenTimestamp: highestTimestamp,
        lastSync: new Date(),
        marketsProcessed: {
          increment: results.indexed
        },
        updatedAt: new Date()
      }
    })

    results.lastSeenId = highestId
    results.duration = Date.now() - startTime

    console.log('[NewMarketSync] Complete:', results)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })
  } catch (error: any) {
    console.error('[NewMarketSync] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync new markets',
        details: error.message,
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}
