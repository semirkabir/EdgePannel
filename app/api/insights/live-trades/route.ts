import { NextRequest, NextResponse } from 'next/server';
import { LiveTradesQuerySchema } from '@/lib/api/schemas';
import { validateQuery } from '@/lib/api/validate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/insights/live-trades
 * Proxies requests to Polymarket Data API for live trades
 * This avoids CORS issues when fetching from the client
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const params = validateQuery(LiveTradesQuerySchema, searchParams);
        const limit = params.limit || 50;

        // Fetch from Polymarket Data API
        const response = await fetch(
            `https://data-api.polymarket.com/trades?limit=${limit}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            console.error('[Live Trades API] Data API error:', response.status);
            return NextResponse.json({ trades: [], error: 'Data API error' }, { status: response.status });
        }

        const trades = await response.json();

        if (!Array.isArray(trades)) {
            return NextResponse.json({ trades: [] });
        }

        // Transform to our format
        const transformedTrades = trades.map((trade: any) => ({
            id: `${trade.conditionId}_${trade.timestamp}_${trade.proxyWallet || Math.random()}`,
            conditionId: trade.conditionId,
            marketTitle: trade.title || 'Unknown Market',
            marketSlug: trade.slug,
            side: trade.side?.toLowerCase() || 'buy',
            outcome: trade.outcome,
            price: trade.price,
            size: trade.size,
            amount: (trade.size || 0) * (trade.price || 0),
            timestamp: trade.timestamp, // Unix timestamp in seconds
            traderName: trade.pseudonym || trade.name || null,
            traderWallet: trade.proxyWallet,
            transactionHash: trade.transactionHash,
        }));

        return NextResponse.json({
            trades: transformedTrades,
            count: transformedTrades.length,
            timestamp: Date.now(),
        });

    } catch (error: any) {
        console.error('[Live Trades API] Error:', error);
        return NextResponse.json({ trades: [], error: error.message }, { status: 500 });
    }
}
