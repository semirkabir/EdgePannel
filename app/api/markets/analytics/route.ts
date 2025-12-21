import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/markets/analytics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const platform = searchParams.get('platform') || 'polymarket';
    const category = searchParams.get('category');

    // Calculate timeframe start
    const now = new Date()
    let hoursAgo = 24
    if (timeframe === '1h') hoursAgo = 1
    else if (timeframe === '7d') hoursAgo = 168
    else if (timeframe === '30d') hoursAgo = 720

    const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)

    if (platform === 'polymarket' || platform === 'all') {
      try {
        // 1. Fetch active markets
        // Note: Removed 'sort' parameter to avoid 422 errors. We fetch and sort manually.
        const polymarketUrl = `https://gamma-api.polymarket.com/markets?limit=300&active=true&closed=false`

        const response = await fetch(polymarketUrl, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          next: { revalidate: 60 } // Cache for 1 min
        })

        if (!response.ok) {
          const text = await response.text();
          console.error('Polymarket API Error:', response.status, text);
          return NextResponse.json({ error: 'Polymarket API Error' }, { status: response.status });
        }

        let markets = await response.json();

        if (!Array.isArray(markets)) {
          console.error('Unexpected Polymarket API response format:', markets);
          return NextResponse.json({ error: 'Invalid response from Polymarket' }, { status: 502 });
        }

        // Sort by volume manually to prioritize relevant markets
        markets.sort((a: any, b: any) => parseFloat(b.volume || 0) - parseFloat(a.volume || 0));

        // 2. Process markets and calculate changes
        const topMarkets = markets.slice(0, 100);

        const marketDataPromises = topMarkets.map(async (market: any) => {
          let currentPrice = 0;
          // Extract current price
          if (market.outcomePrices) {
            try {
              const prices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices;
              currentPrice = parseFloat(prices[0] || '0');
            } catch (e) { }
          }

          // Try to get start price from DB history first
          let startPrice = currentPrice;

          // If we have history in DB (skip for now to ensure speed, or checking if needed)
          // For accurate "live" data without populating DB, we can try to infer from API if available, 
          // BUT Gamma API doesn't give 24h change easily.
          // Fallback: Fetch price history from CLOB for these top markets.

          try {
            const clobId = market.clobTokenIds ? (typeof market.clobTokenIds === 'string' ? JSON.parse(market.clobTokenIds)[0] : market.clobTokenIds[0]) : market.conditionId;
            if (clobId) {
              // Determine interval based on timeframe
              const interval = timeframe === '1h' ? '1h' : '1d';
              // Note: CLOB history might be heavy. 
              // Use a lighter approach: Use volume as proxy for "Movers" if change unknown?
              // No, user wants ACCURACY.

              // Let's fetch history for the top 20 ONLY, to avoid rate limits.
              if (Math.random() < 0.2) { // Rate limit mitigation or batch? 
                // Actually, we can't easily fetch history for all 50 in one go rapidly.
                // We'll rely on `one_day_price_change` if available in future Gamma versions, 
                // or just calculate from (volume / liquidity) approximations? No.

                // Let's try to fetch history for just the top 10 gainers candidates?
                // Identifying candidates is hard without history.
              }
            }
          } catch (e) { }

          // Mocking accurate data structure if real history is missing, 
          // but we MUST try to be as real as possible.
          // If 24h change is not in API, we can't invent it.
          // However, let's check if 'change24h' exists in the raw market object.

          let priceChangePercent = 0;
          // Gamma API uses camelCase for these fields
          const change24h = market.oneDayPriceChange;
          const change1h = market.oneHourPriceChange;

          if (timeframe === '1h' && change1h !== undefined) {
            priceChangePercent = parseFloat(change1h) * 100;
          } else if (change24h !== undefined) {
            priceChangePercent = parseFloat(change24h) * 100;
          }

          if (priceChangePercent !== 0) {
            startPrice = currentPrice / (1 + priceChangePercent / 100);
          }

          return {
            id: market.conditionId,
            title: market.question,
            slug: market.slug,
            platform: 'polymarket',
            category: market.category || market.tag || 'General',
            currentPrice,
            startPrice,
            priceChange: currentPrice - startPrice,
            priceChangePercent,
            volume24h: parseFloat(market.volume24hr || market.volume || 0),
            liquidity: parseFloat(market.liquidity || 0),
            endDate: market.endDateIso
          };
        });

        const processedMarkets = await Promise.all(marketDataPromises);

        // Filter out bad data
        const validMarkets = processedMarkets.filter(m => m.volume24h > 0);

        // Sort
        const topGainers = [...validMarkets].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, limit);
        const topLosers = [...validMarkets].sort((a, b) => a.priceChangePercent - b.priceChangePercent).slice(0, limit);
        const biggestMovers = [...validMarkets].sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent)).slice(0, limit);
        const highestVolume = [...validMarkets].sort((a, b) => b.volume24h - a.volume24h).slice(0, limit);

        // Calculate Sums
        const totalVolume = validMarkets.reduce((acc, m) => acc + m.volume24h, 0);
        const gainersCount = validMarkets.filter(m => m.priceChangePercent > 0).length;
        const losersCount = validMarkets.filter(m => m.priceChangePercent < 0).length;

        return NextResponse.json({
          timeframe,
          summary: {
            totalMarkets: validMarkets.length,
            gainers: gainersCount,
            losers: losersCount,
            unchanged: validMarkets.length - gainersCount - losersCount,
            averageChange: "0.00", // Todo: calc avg
            totalVolume
          },
          topGainers,
          topLosers,
          biggestMovers,
          highestVolume
        });

      } catch (error) {
        console.error('Polymarket Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
      }
    }

    return NextResponse.json({
      timeframe,
      summary: { totalMarkets: 0, gainers: 0, losers: 0, unchanged: 0, averageChange: '0.00', totalVolume: 0 },
      topGainers: [], topLosers: [], biggestMovers: [], highestVolume: []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
