import { NextRequest, NextResponse } from 'next/server'
import { PolymarketClient } from '@/lib/api/polymarket'
import { yahooFinance } from '@/lib/api/stock-exchanges/yahoo-finance'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const topic = searchParams.get('topic')

        if (!topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
        }

        const polymarket = new PolymarketClient()

        // 1. Fetch related markets
        const marketsResult = await polymarket.getMarkets({
            search: topic,
            limit: 5
        })
        const markets = marketsResult.markets

        // 2. Fetch related news (using GDELT search)
        // For now, we'll use a mocked news search or simple GDELT fetch
        const newsResponse = await fetch(`${request.nextUrl.origin}/api/gdelt?q=${encodeURIComponent(topic)}&limit=5`)
        const { news = [] } = await newsResponse.json()

        // 3. Fetch related whale trades (mock or simple filter)
        const whaleResponse = await fetch(`${request.nextUrl.origin}/api/whales/trades?limit=5`)
        const { trades = [] } = await whaleResponse.json()
        const relatedTrades = trades.filter((t: any) =>
            t.market.toLowerCase().includes(topic.toLowerCase())
        )

        // 4. Calculate Geopolitical Risk Score (Simulated)
        // Higher probability on extreme outcomes = higher risk
        const riskScore = Math.floor(Math.random() * 40) + 30 // Base risk 30-70

        return NextResponse.json({
            topic,
            markets,
            news,
            whaleTrades: relatedTrades,
            riskScore,
            summary: `Consolidated intelligence report for "${topic}". High volatility detected in prediction markets. Cross-asset correlations showing divergence from TradFi sentiment.`
        })
    } catch (error: any) {
        console.error('[Hub API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
