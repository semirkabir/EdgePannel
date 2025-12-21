export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/markets/snapshot-prices
 * Takes a snapshot of current market prices for historical tracking
 * This enables accurate calculation of price changes over time
 */
export async function POST() {
  try {
    console.log('[Price Snapshot] Starting price snapshot...')

    // Fetch current markets from Polymarket
    const polymarketUrl = 'https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false'
    const response = await fetch(polymarketUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('[Price Snapshot] Polymarket API error:', response.status)
      return NextResponse.json(
        { error: 'Failed to fetch markets from Polymarket' },
        { status: response.status }
      )
    }

    const markets = await response.json()
    console.log(`[Price Snapshot] Fetched ${markets.length} markets from Polymarket`)

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
        console.warn('[Price Snapshot] Failed to parse outcomePrices for:', market.conditionId)
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

    console.log(`[Price Snapshot] Created ${result.count} price snapshots`)

    return NextResponse.json({
      success: true,
      snapshotsCreated: result.count,
      timestamp,
      platform: 'polymarket',
      marketsProcessed: markets.length,
    })
  } catch (error: any) {
    console.error('[Price Snapshot] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create price snapshot' },
      { status: 500 }
    )
  }
}
