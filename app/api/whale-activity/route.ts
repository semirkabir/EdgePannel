import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/whale-activity
 * Get recent whale trades (large trades) from Polymarket using real orderbook data
 *
 * Query params:
 * - timeframe: '1h' | '24h' | '7d' (default: '24h')
 * - minAmount: minimum trade amount in USD (default: 5000)
 * - limit: number of results (default: 20)
 * - platform: 'polymarket' | 'kalshi' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '24h'
    const minAmount = parseFloat(searchParams.get('minAmount') || '5000')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const platform = searchParams.get('platform') || 'all'

    console.log('[Whale Activity API] Fetching whale trades:', { timeframe, minAmount, limit, platform })

    // Calculate timeframe in seconds
    let secondsAgo = 86400 // 24h
    if (timeframe === '1h') secondsAgo = 3600
    else if (timeframe === '7d') secondsAgo = 604800

    const startTimestamp = Math.floor(Date.now() / 1000) - secondsAgo

    // Fetch real whale trades from Polymarket
    if (platform === 'polymarket' || platform === 'all') {
      try {
        // Use Polymarket CLOB Data API to fetch trades filtered by amount
        // Filter by CASH amount to get large trades (whales)
        const tradesUrl = `https://data-api.polymarket.com/trades?limit=${Math.min(limit * 5, 1000)}&filterType=CASH&filterAmount=${minAmount}&takerOnly=true`
        console.log('[Whale Activity API] Fetching trades from Polymarket Data API:', tradesUrl)

        const response = await fetch(tradesUrl, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })

        if (!response.ok) {
          console.error('[Whale Activity API] Polymarket Data API error:', response.status)
          return returnEmptyData(timeframe, minAmount, 'Failed to fetch from Polymarket Data API')
        }

        const allTrades = await response.json()
        console.log(`[Whale Activity API] Fetched ${allTrades.length} trades from Polymarket`)

        // Filter trades by timeframe and calculate trade value
        const whaleTrades = allTrades
          .filter((trade: any) => {
            // Filter by timestamp
            return trade.timestamp >= startTimestamp
          })
          .map((trade: any) => {
            // Calculate trade value (size * price)
            const tradeValue = trade.size * trade.price

            return {
              id: `${trade.conditionId}_${trade.timestamp}_${trade.proxyWallet}`,
              marketId: trade.conditionId,
              marketTitle: trade.title || 'Unknown Market',
              marketSlug: trade.slug || null,
              marketTicker: null,
              platform: 'polymarket',
              category: null, // Trade API doesn't return category
              amount: tradeValue,
              side: trade.side?.toLowerCase() || 'buy',
              outcome: trade.outcome || null,
              price: trade.price,
              timestamp: new Date(trade.timestamp * 1000),
              walletAddress: trade.proxyWallet || null,
              transactionHash: trade.transactionHash || null,
              size: trade.size, // Number of contracts
              traderName: trade.name || trade.pseudonym || null,
              traderProfileImage: trade.profileImageOptimized || trade.profileImage || null,
            }
          })
          .filter((trade: any) => trade.amount >= minAmount) // Double-check filter
          .sort((a: any, b: any) => b.amount - a.amount) // Sort by amount descending
          .slice(0, limit) // Limit results

        console.log(`[Whale Activity API] Filtered to ${whaleTrades.length} whale trades`)

        // Calculate summary statistics
        const totalAmount = whaleTrades.reduce((sum: number, t: any) => sum + t.amount, 0)
        const avgAmount = whaleTrades.length > 0 ? totalAmount / whaleTrades.length : 0
        const buyCount = whaleTrades.filter((t: any) => t.side === 'buy').length
        const sellCount = whaleTrades.filter((t: any) => t.side === 'sell').length
        const uniqueMarkets = new Set(whaleTrades.map((t: any) => t.marketId)).size
        const uniqueWallets = new Set(whaleTrades.map((t: any) => t.walletAddress)).size

        return NextResponse.json({
          timeframe,
          minAmount,
          summary: {
            totalTrades: whaleTrades.length,
            totalAmount,
            averageAmount: avgAmount,
            buyCount,
            sellCount,
            polymarketCount: whaleTrades.length,
            kalshiCount: 0,
            uniqueMarkets,
            uniqueWallets,
          },
          trades: whaleTrades,
        })
      } catch (error: any) {
        console.error('[Whale Activity API] Error:', error)
        return returnEmptyData(timeframe, minAmount, error.message)
      }
    }

    // Kalshi not yet implemented
    return returnEmptyData(timeframe, minAmount, 'Kalshi whale tracking not yet implemented')
  } catch (error: any) {
    console.error('[Whale Activity API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch whale activity' },
      { status: 500 }
    )
  }
}

function returnEmptyData(timeframe: string, minAmount: number, note?: string) {
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
      uniqueWallets: 0,
    },
    trades: [],
    note: note || 'No whale trades found in the specified timeframe',
  })
}
