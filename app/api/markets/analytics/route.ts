import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/markets/analytics
 * Get market analytics including biggest winners, losers, and movers
 * Uses historical price data to calculate accurate price changes
 *
 * Query params:
 * - timeframe: '1h' | '24h' | '7d' | '30d' (default: '24h')
 * - limit: number of results per category (default: 10)
 * - platform: 'polymarket' | 'kalshi' | 'all' (default: 'polymarket')
 * - category: filter by category (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const platform = searchParams.get('platform') || 'polymarket';
    const category = searchParams.get('category');

    console.log('[Analytics API] Fetching analytics:', { timeframe, limit, platform, category })

    // Calculate timeframe start
    const now = new Date()
    let hoursAgo = 24
    if (timeframe === '1h') hoursAgo = 1
    else if (timeframe === '7d') hoursAgo = 168
    else if (timeframe === '30d') hoursAgo = 720

    const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)

    // For now, we'll focus on Polymarket as it has the best API
    if (platform === 'polymarket' || platform === 'all') {
      try {
        // Fetch current markets from Polymarket API
        const polymarketUrl = `https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false`
        console.log('[Analytics API] Fetching from Polymarket:', polymarketUrl)

        const response = await fetch(polymarketUrl, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })

        if (!response.ok) {
          console.error('[Analytics API] Polymarket API error:', response.status)
          return NextResponse.json(
            { error: 'Failed to fetch from Polymarket' },
            { status: response.status }
          )
        }

        const markets = await response.json()
        console.log(`[Analytics API] Received ${markets.length} markets from Polymarket`)

        // Get market IDs to fetch historical prices
        const marketIds = markets.map((m: any) => m.conditionId)

        // Fetch historical prices for these markets within the timeframe
        const historicalPrices = await prisma.marketPriceHistory.findMany({
          where: {
            marketId: { in: marketIds },
            platform: 'polymarket',
            timestamp: { gte: startTime },
          },
          orderBy: { timestamp: 'asc' },
        })

        console.log(`[Analytics API] Found ${historicalPrices.length} historical price records`)

        // Group historical prices by market
        const pricesByMarket = new Map<string, typeof historicalPrices>()
        for (const price of historicalPrices) {
          if (!pricesByMarket.has(price.marketId)) {
            pricesByMarket.set(price.marketId, [])
          }
          pricesByMarket.get(price.marketId)!.push(price)
        }

        // Transform and calculate analytics
        interface MarketWithChange {
          id: string
          title: string
          slug: string | null
          ticker: string | null
          platform: string
          category: string | null
          currentPrice: number
          startPrice: number
          priceChange: number
          priceChangePercent: number
          volume24h: number
          liquidity: number | null
          endDate: Date | null
        }

        const marketsWithData: MarketWithChange[] = markets
          .map((market: any) => {
            // Parse current outcome prices
            let currentPrice = 0.5
            try {
              const prices =
                typeof market.outcomePrices === 'string'
                  ? JSON.parse(market.outcomePrices)
                  : market.outcomePrices
              if (Array.isArray(prices) && prices.length > 0) {
                currentPrice = parseFloat(prices[0].toString())
              }
            } catch (e) {
              console.warn('[Analytics API] Failed to parse outcomePrices for market:', market.conditionId)
            }

            // Get historical price (earliest in timeframe) or use current as baseline
            const marketHistory = pricesByMarket.get(market.conditionId) || []
            const startPrice = marketHistory.length > 0 ? marketHistory[0].price : currentPrice

            // Calculate price change
            const priceChange = currentPrice - startPrice
            const priceChangePercent = startPrice !== 0 ? (priceChange / startPrice) * 100 : 0

            // Get proper category
            let marketCategory = market.category
            if (market.tags && Array.isArray(market.tags) && market.tags.length > 0) {
              marketCategory = market.tags[0]
            }
            if (!marketCategory && market.groupItemTitle) {
              marketCategory = market.groupItemTitle
            }

            // Filter by category if specified
            if (category && marketCategory?.toLowerCase() !== category.toLowerCase()) {
              return null
            }

            return {
              id: market.conditionId,
              title: market.question,
              slug: market.slug,
              ticker: null,
              platform: 'polymarket',
              category: marketCategory,
              currentPrice,
              startPrice,
              priceChange,
              priceChangePercent,
              volume24h: parseFloat(market.volume24hr || 0),
              liquidity: market.liquidityNum ? parseFloat(market.liquidityNum) : null,
              endDate: market.endDateIso ? new Date(market.endDateIso) : null,
            }
          })
          .filter((m: MarketWithChange | null): m is MarketWithChange => m !== null)

        console.log(`[Analytics API] Processed ${marketsWithData.length} markets with price history`)

        // Sort by actual price changes
        const sortedByPriceChange = [...marketsWithData].sort((a, b) => b.priceChangePercent - a.priceChangePercent)

        // Top gainers: biggest positive price changes with decent volume
        const topGainers = sortedByPriceChange
          .filter((m) => m.priceChange > 0 && m.volume24h > 100)
          .slice(0, limit)

        // Top losers: biggest negative price changes with decent volume
        const topLosers = sortedByPriceChange
          .filter((m) => m.priceChange < 0 && m.volume24h > 100)
          .reverse()
          .slice(0, limit)

        // Biggest movers: largest absolute price changes regardless of direction
        const biggestMovers = [...marketsWithData]
          .filter((m) => m.volume24h > 100)
          .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
          .slice(0, limit)

        // Highest volume
        const highestVolume = [...marketsWithData].sort((a, b) => b.volume24h - a.volume24h).slice(0, limit)

        // Calculate summary statistics
        const totalMarkets = marketsWithData.length
        const gainers = marketsWithData.filter((m) => m.priceChange > 0).length
        const losers = marketsWithData.filter((m) => m.priceChange < 0).length
        const unchanged = totalMarkets - gainers - losers
        const totalVolume = marketsWithData.reduce((sum, m) => sum + m.volume24h, 0)
        const averageChange =
          marketsWithData.reduce((sum, m) => sum + m.priceChangePercent, 0) / (totalMarkets || 1)

        return NextResponse.json({
          timeframe,
          summary: {
            totalMarkets,
            gainers,
            losers,
            unchanged,
            averageChange: averageChange.toFixed(2),
            totalVolume,
          },
          topGainers,
          topLosers,
          biggestMovers,
          highestVolume,
        });
      } catch (error: any) {
        console.error('[Analytics API] Error:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to fetch analytics' },
          { status: 500 }
        );
      }
    }

    // If platform is Kalshi only, return empty data for now
    return NextResponse.json({
      timeframe,
      summary: {
        totalMarkets: 0,
        gainers: 0,
        losers: 0,
        unchanged: 0,
        averageChange: '0.00',
        totalVolume: 0,
      },
      topGainers: [],
      topLosers: [],
      biggestMovers: [],
      highestVolume: [],
      note: 'Kalshi analytics coming soon',
    });
  } catch (error: any) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
