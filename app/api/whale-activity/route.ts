import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/whale-activity
 * Get recent whale trades (large trades) across platforms
 * Currently returns simulated data based on high-volume markets
 *
 * Query params:
 * - timeframe: '1h' | '24h' | '7d' (default: '24h')
 * - minAmount: minimum trade amount in USD (default: 5000)
 * - limit: number of results (default: 20)
 * - platform: 'polymarket' | 'kalshi' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h';
    const minAmount = parseFloat(searchParams.get('minAmount') || '5000');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const platform = searchParams.get('platform') || 'all';

    console.log('[Whale Activity API] Fetching whale trades:', { timeframe, minAmount, limit, platform });

    // Fetch high-volume markets from Polymarket to simulate whale activity
    if (platform === 'polymarket' || platform === 'all') {
      try {
        const polymarketUrl = `https://gamma-api.polymarket.com/markets?limit=50&active=true&closed=false`;
        console.log('[Whale Activity API] Fetching markets from Polymarket');

        const response = await fetch(polymarketUrl, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });

        if (!response.ok) {
          console.warn('[Whale Activity API] Polymarket API error:', response.status);
          return returnEmptyData(timeframe, minAmount);
        }

        const markets = await response.json();

        // Filter high-volume markets and simulate whale trades
        const simulatedTrades: any[] = [];
        const now = new Date();

        markets
          .filter((m: any) => parseFloat(m.volume24hr || 0) > 50000)
          .slice(0, limit)
          .forEach((market: any, idx: number) => {
            const volume = parseFloat(market.volume24hr || 0);

            // Parse price
            let price = 0.5;
            try {
              const prices = typeof market.outcomePrices === 'string'
                ? JSON.parse(market.outcomePrices)
                : market.outcomePrices;
              if (Array.isArray(prices) && prices.length > 0) {
                price = parseFloat(prices[0].toString());
              }
            } catch (e) {
              // ignore
            }

            // Get proper category
            let category = market.category;
            if (market.tags && Array.isArray(market.tags) && market.tags.length > 0) {
              category = market.tags[0];
            }

            // Simulate 1-3 whale trades per high-volume market
            const numTrades = Math.min(3, Math.floor(volume / 100000));

            for (let i = 0; i < numTrades; i++) {
              const tradeAmount = minAmount + Math.random() * (volume * 0.1);
              const side = Math.random() > 0.5 ? 'buy' : 'sell';
              const outcome = Math.random() > 0.5 ? 'Yes' : 'No';

              // Simulate timestamp within timeframe
              let maxHoursAgo = 24;
              if (timeframe === '1h') maxHoursAgo = 1;
              else if (timeframe === '7d') maxHoursAgo = 168;

              const hoursAgo = Math.random() * maxHoursAgo;
              const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

              simulatedTrades.push({
                id: `sim_${market.conditionId}_${i}`,
                marketId: market.conditionId,
                marketTitle: market.question,
                marketSlug: market.slug,
                marketTicker: null,
                platform: 'polymarket',
                category,
                amount: tradeAmount,
                side,
                outcome,
                price,
                timestamp,
                walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
                transactionHash: null,
              });
            }
          });

        // Sort by amount descending and limit
        simulatedTrades.sort((a, b) => b.amount - a.amount);
        const limitedTrades = simulatedTrades.slice(0, limit);

        // Calculate summary statistics
        const totalAmount = limitedTrades.reduce((sum, t) => sum + t.amount, 0);
        const avgAmount = limitedTrades.length > 0 ? totalAmount / limitedTrades.length : 0;
        const buyCount = limitedTrades.filter((t) => t.side === 'buy').length;
        const sellCount = limitedTrades.filter((t) => t.side === 'sell').length;
        const uniqueMarkets = new Set(limitedTrades.map((t) => t.marketId)).size;

        return NextResponse.json({
          timeframe,
          minAmount,
          summary: {
            totalTrades: limitedTrades.length,
            totalAmount,
            averageAmount: avgAmount,
            buyCount,
            sellCount,
            polymarketCount: limitedTrades.length,
            kalshiCount: 0,
            uniqueMarkets,
          },
          trades: limitedTrades,
          note: 'Simulated whale trades based on high-volume markets. Real-time trade tracking coming soon.',
        });
      } catch (error: any) {
        console.error('[Whale Activity API] Error:', error);
        return returnEmptyData(timeframe, minAmount);
      }
    }

    return returnEmptyData(timeframe, minAmount);
  } catch (error: any) {
    console.error('[Whale Activity API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch whale activity' },
      { status: 500 }
    );
  }
}

function returnEmptyData(timeframe: string, minAmount: number) {
  return NextResponse.json({
    timeframe,
    minAmount,
    summary: {
      totalTrades: 0,
      totalAmount: 0,
      averageAmount: 0,
      buyCount: 0,
      sellCount: 0,
      polymarketCount: 0,
      kalshiCount: 0,
      uniqueMarkets: 0,
    },
    trades: [],
    note: 'Whale trade tracking not yet configured. Displaying simulated data based on volume.',
  });
}
