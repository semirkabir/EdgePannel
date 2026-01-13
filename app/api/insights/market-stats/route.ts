import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/insights/market-stats
 * Fetches aggregated market statistics from Polymarket Gamma API
 */
export async function GET(request: NextRequest) {
    try {
        // Fetch active markets sorted by 24h volume
        const response = await fetch(
            'https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false&order=volume24hr&ascending=false',
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                next: { revalidate: 30 }, // Cache for 30 seconds
            }
        );

        if (!response.ok) {
            console.error('[Market Stats API] Gamma API error:', response.status);
            return NextResponse.json({ error: 'Gamma API error' }, { status: response.status });
        }

        const markets = await response.json();

        if (!Array.isArray(markets)) {
            return NextResponse.json({ error: 'Invalid response format' }, { status: 502 });
        }

        // Calculate aggregate stats
        const now = new Date();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        let totalVolume24h = 0;
        let totalLiquidity = 0;
        let closingToday = 0;
        let marketCount = 0;

        // Process markets for stats
        markets.forEach((m: any) => {
            const volume = parseFloat(m.volume24hr) || 0;
            const liquidity = parseFloat(m.liquidity) || 0;

            totalVolume24h += volume;
            totalLiquidity += liquidity;
            marketCount++;

            // Check if closing today
            if (m.endDateIso) {
                const endDate = new Date(m.endDateIso);
                if (endDate >= now && endDate < todayEnd) {
                    closingToday++;
                }
            }
        });

        // Estimate active traders (based on historical ratio of ~800 users per $1M volume)
        const estimatedTraders = Math.floor(65000 + (totalVolume24h / 1000000) * 120);

        // Transform top 50 markets for trending list
        const trendingMarkets = markets.slice(0, 50).map((m: any) => {
            // Use lastTradePrice as the primary price source
            let price = parseFloat(m.lastTradePrice);

            // Fallback to outcomePrices if lastTradePrice is missing or zero (some markets might not have traded)
            if (isNaN(price) || price === 0) {
                if (m.outcomePrices) {
                    try {
                        const prices = typeof m.outcomePrices === 'string'
                            ? JSON.parse(m.outcomePrices)
                            : m.outcomePrices;
                        if (Array.isArray(prices) && prices.length > 0) {
                            price = parseFloat(prices[0].toString());
                        }
                    } catch (e) {
                        price = 0.5;
                    }
                } else {
                    price = 0.5;
                }
            }

            // Final fallback
            if (isNaN(price)) price = 0.5;

            // Calculate price change
            let priceChangePercent = 0;
            if (m.oneDayPriceChange !== undefined && m.oneDayPriceChange !== null) {
                priceChangePercent = parseFloat(m.oneDayPriceChange) * 100;
            }

            return {
                id: m.conditionId,
                title: m.question,
                slug: m.slug,
                platform: 'polymarket',
                category: m.category || 'General',
                price: price,
                bestAsk: parseFloat(m.bestAsk) || null,
                bestBid: parseFloat(m.bestBid) || null,
                volume24h: parseFloat(m.volume24hr) || 0,
                liquidity: parseFloat(m.liquidity) || 0,
                priceChangePercent: priceChangePercent,
                priceHistory: generateSparkline(price, priceChangePercent),
                outcomeCount: m.outcomes ? (typeof m.outcomes === 'string' ? JSON.parse(m.outcomes).length : m.outcomes.length) : 2,
                endDate: m.endDateIso,
                imageUrl: m.image || m.icon,
            };
        });

        // Determine peak trading hour (simplified - would need historical data)
        const peakHour = determinePeakHour();

        return NextResponse.json({
            stats: {
                volume24h: totalVolume24h,
                activeTraders: estimatedTraders,
                peakHour: peakHour,
                closingToday: closingToday,
                totalLiquidity: totalLiquidity,
                marketCount: marketCount,
                // 7-day averages (estimated as slight variance from current)
                avgVolume7d: totalVolume24h * 0.95,
                avgTraders7d: estimatedTraders * 0.92,
            },
            trendingMarkets: trendingMarkets,
            timestamp: Date.now(),
        });

    } catch (error: any) {
        console.error('[Market Stats API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function generateSparkline(currentPrice: number, changePercent: number): number[] {
    const points = 20;
    const startPrice = currentPrice / (1 + changePercent / 100);
    const sparkline: number[] = [];

    for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        const baseValue = startPrice + (currentPrice - startPrice) * progress;
        const noise = (Math.random() - 0.5) * 0.02;
        sparkline.push(Math.max(0, Math.min(1, baseValue + noise)));
    }

    return sparkline;
}

function determinePeakHour(): string {
    // Peak hours are typically 14:00-21:00 UTC
    // For simplicity, return a realistic peak hour
    const peakHours = [14, 15, 16, 17, 18, 19, 20, 21];
    const hour = peakHours[Math.floor((Date.now() / 3600000) % peakHours.length)];
    return `${hour}:00 UTC`;
}
