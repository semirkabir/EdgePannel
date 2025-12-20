import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/cron/snapshot-prices
 * Cron job to periodically snapshot market prices for historical tracking
 * Should be called every 15-30 minutes for accurate trend tracking
 *
 * Set up in Vercel:
 * - Add a cron job in vercel.json with schedule every 15 minutes
 * - Or use external cron service like cron-job.org to hit this endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Always verify authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

    if (!cronSecret) {
      console.error('[Price Snapshot Cron] CRON_SECRET or VERCEL_CRON_SECRET environment variable not set')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Price Snapshot Cron] Unauthorized: Invalid or missing authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Price Snapshot Cron] Starting scheduled price snapshot...')
    const startTime = Date.now()

    // Fetch current markets from Polymarket
    const polymarketUrl = 'https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false'
    const response = await fetch(polymarketUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('[Price Snapshot Cron] Polymarket API error:', response.status)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch markets from Polymarket',
          statusCode: response.status
        },
        { status: 500 }
      )
    }

    const markets = await response.json()
    console.log(`[Price Snapshot Cron] Fetched ${markets.length} markets from Polymarket`)

    // Create price snapshots
    const snapshots = []
    const timestamp = new Date()

    for (const market of markets) {
      // Parse outcome prices
      let price = 0.5
      try {
        const prices =
          typeof market.outcomePrices === 'string'
            ? JSON.parse(market.outcomePrices)
            : market.outcomePrices
        if (Array.isArray(prices) && prices.length > 0) {
          price = parseFloat(prices[0].toString())
        }
      } catch (e) {
        // Skip markets with invalid price data
        continue
      }

      snapshots.push({
        marketId: market.conditionId,
        platform: 'polymarket',
        price,
        volume24h: parseFloat(market.volume24hr || 0),
        liquidity: market.liquidityNum ? parseFloat(market.liquidityNum) : null,
        timestamp,
        metadata: {
          title: market.question,
          slug: market.slug,
          category: market.category || market.tags?.[0] || null,
        },
      })
    }

    // Batch insert into database
    const result = await prisma.marketPriceHistory.createMany({
      data: snapshots,
      skipDuplicates: true,
    })

    const duration = Date.now() - startTime
    console.log(`[Price Snapshot Cron] Completed in ${duration}ms - Created ${result.count} snapshots`)

    return NextResponse.json({
      success: true,
      snapshotsCreated: result.count,
      marketsProcessed: markets.length,
      timestamp,
      durationMs: duration,
      platform: 'polymarket',
    })
  } catch (error: any) {
    console.error('[Price Snapshot Cron] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create price snapshot',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggers
export const POST = GET
