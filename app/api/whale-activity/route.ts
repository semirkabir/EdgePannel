import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/whale-activity
 * Fetches recent large trades from Polymarket using the Data API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '24h'
    const minAmount = parseFloat(searchParams.get('minAmount') || '5000')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Calculate start timestamp
    let secondsAgo = 86400 // 24h
    if (timeframe === '1h') secondsAgo = 3600
    else if (timeframe === '7d') secondsAgo = 604800
    const startTimestamp = Math.floor(Date.now() / 1000) - secondsAgo

    // Fetch trades from Data API (filtered by amount)
    const tradesUrl = `https://data-api.polymarket.com/trades?limit=100&filterType=CASH&filterAmount=${minAmount}&takerOnly=true`

    const response = await fetch(tradesUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('Data API Error:', response.status);
      return NextResponse.json({ error: 'Failed' }, { status: response.status });
    }

    const allTrades = await response.json();

    // Map to unified format and filter by timeframe
    const whaleTrades = allTrades
      .filter((trade: any) => trade.timestamp >= startTimestamp)
      .map((trade: any) => ({
        id: `${trade.conditionId}_${trade.timestamp}_${trade.proxyWallet || Math.random()}`,
        marketId: trade.conditionId,
        marketTitle: trade.title || 'Unknown Market',
        platform: 'polymarket',
        amount: trade.size * trade.price,
        side: trade.side?.toLowerCase() || 'buy',
        outcome: trade.outcome || (trade.side === 'BUY' ? 'Yes' : 'No'),
        price: trade.price,
        timestamp: new Date(trade.timestamp * 1000),
        size: trade.size,
        traderName: trade.pseudonym || trade.name || null
      }))
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, limit);

    // Stats
    const totalAmount = whaleTrades.reduce((acc: number, t: any) => acc + t.amount, 0);
    const buyCount = whaleTrades.filter((t: any) => t.side === 'buy').length;

    return NextResponse.json({
      timeframe,
      minAmount,
      summary: {
        totalTrades: whaleTrades.length,
        totalAmount,
        averageAmount: whaleTrades.length ? totalAmount / whaleTrades.length : 0,
        buyCount,
        sellCount: whaleTrades.length - buyCount,
        uniqueMarkets: new Set(whaleTrades.map((t: any) => t.marketId)).size
      },
      trades: whaleTrades
    });

  } catch (error: any) {
    console.error('Whale Activity Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
