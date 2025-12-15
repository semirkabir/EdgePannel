import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/markets/analytics
 * Get market analytics including biggest winners, losers, and movers
 * Uses live data from Polymarket API
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

    console.log('[Analytics API] Fetching analytics:', { timeframe, limit, platform, category });

    // For now, we'll focus on Polymarket as it has the best API
    if (platform === 'polymarket' || platform === 'all') {
      try {
        // Fetch markets from Polymarket API
        const polymarketUrl = `https://gamma-api.polymarket.com/markets?limit=200&active=true&closed=false`;
        console.log('[Analytics API] Fetching from Polymarket:', polymarketUrl);

        const response = await fetch(polymarketUrl, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });

        if (!response.ok) {
          console.error('[Analytics API] Polymarket API error:', response.status);
          return NextResponse.json(
            { error: 'Failed to fetch from Polymarket' },
            { status: response.status }
          );
        }

        const markets = await response.json();
        console.log(`[Analytics API] Received ${markets.length} markets from Polymarket`);

        // Transform and calculate analytics
        interface MarketWithChange {
          id: string;
          title: string;
          slug: string | null;
          ticker: string | null;
          platform: string;
          category: string | null;
          currentPrice: number;
          volume24h: number;
          liquidity: number | null;
          endDate: Date | null;
          volumeChange?: number;
        }

        const marketsWithData: MarketWithChange[] = markets
          .map((market: any) => {
            // Parse outcome prices
            let currentPrice = 0.5;
            try {
              const prices = typeof market.outcomePrices === 'string'
                ? JSON.parse(market.outcomePrices)
                : market.outcomePrices;
              if (Array.isArray(prices) && prices.length > 0) {
                currentPrice = parseFloat(prices[0].toString());
              }
            } catch (e) {
              console.warn('[Analytics API] Failed to parse outcomePrices for market:', market.conditionId);
            }

            // Get proper category
            let marketCategory = market.category;
            if (market.tags && Array.isArray(market.tags) && market.tags.length > 0) {
              marketCategory = market.tags[0];
            }
            if (!marketCategory && market.groupItemTitle) {
              marketCategory = market.groupItemTitle;
            }

            // Filter by category if specified
            if (category && marketCategory?.toLowerCase() !== category.toLowerCase()) {
              return null;
            }

            return {
              id: market.conditionId,
              title: market.question,
              slug: market.slug,
              ticker: null,
              platform: 'polymarket',
              category: marketCategory,
              currentPrice,
              volume24h: parseFloat(market.volume24hr || 0),
              liquidity: market.liquidityNum ? parseFloat(market.liquidityNum) : null,
              endDate: market.endDateIso ? new Date(market.endDateIso) : null,
            };
          })
          .filter((m: MarketWithChange | null): m is MarketWithChange => m !== null);

        console.log(`[Analytics API] Processed ${marketsWithData.length} markets`);

        // Sort by different criteria
        const sortedByVolume = [...marketsWithData].sort((a, b) => b.volume24h - a.volume24h);
        const sortedByHighProb = [...marketsWithData].sort((a, b) => b.currentPrice - a.currentPrice);
        const sortedByLowProb = [...marketsWithData].sort((a, b) => a.currentPrice - b.currentPrice);

        // For "gainers" and "losers", we'll use markets near extremes that have high volume
        const topGainers = sortedByHighProb
          .filter((m) => m.currentPrice >= 0.6 && m.volume24h > 1000)
          .slice(0, limit);

        const topLosers = sortedByLowProb
          .filter((m) => m.currentPrice <= 0.4 && m.volume24h > 1000)
          .slice(0, limit);

        // Biggest movers - markets with extreme prices (far from 0.5) and high volume
        const biggestMovers = [...marketsWithData]
          .map((m) => ({
            ...m,
            deviation: Math.abs(m.currentPrice - 0.5),
          }))
          .sort((a, b) => b.deviation * b.volume24h - a.deviation * a.volume24h)
          .slice(0, limit);

        const highestVolume = sortedByVolume.slice(0, limit);

        // Calculate summary statistics
        const totalMarkets = marketsWithData.length;
        const gainers = marketsWithData.filter((m) => m.currentPrice > 0.5).length;
        const losers = marketsWithData.filter((m) => m.currentPrice < 0.5).length;
        const unchanged = totalMarkets - gainers - losers;
        const totalVolume = marketsWithData.reduce((sum, m) => sum + m.volume24h, 0);
        const averagePrice = marketsWithData.reduce((sum, m) => sum + m.currentPrice, 0) / totalMarkets;

        // Convert to format expected by frontend (add synthetic price changes for display)
        const addPriceChange = (markets: MarketWithChange[]) => {
          return markets.map((m) => ({
            ...m,
            startPrice: 0.5, // Baseline
            priceChange: m.currentPrice - 0.5,
            priceChangePercent: ((m.currentPrice - 0.5) / 0.5) * 100,
          }));
        };

        return NextResponse.json({
          timeframe,
          summary: {
            totalMarkets,
            gainers,
            losers,
            unchanged,
            averageChange: (((averagePrice - 0.5) / 0.5) * 100).toFixed(2),
            totalVolume,
          },
          topGainers: addPriceChange(topGainers),
          topLosers: addPriceChange(topLosers),
          biggestMovers: addPriceChange(biggestMovers),
          highestVolume: addPriceChange(highestVolume),
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
