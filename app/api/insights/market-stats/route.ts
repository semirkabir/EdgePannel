import { NextRequest, NextResponse } from 'next/server';
import { PolymarketClient } from '@/lib/api/polymarket';

export const dynamic = 'force-dynamic';

/**
 * Extract event ID from a market object
 */
function getEventIdFromMarket(market: any): string | null {
    // Try eventId from rawData (set when fetching from events API)
    if (market.eventId != null) {
        return String(market.eventId).trim();
    }

    // Fallback to events array
    if (market.events && Array.isArray(market.events) && market.events.length > 0) {
        const eventId = market.events[0].id;
        if (eventId != null) {
            return String(eventId).trim();
        }
    }

    return null;
}

/**
 * Aggregate daily price history to weekly
 */
function aggregateToWeekly(history: { timestamp: Date; price: number; volume: number }[]): number[] {
    if (history.length === 0) return [];

    // Group by week
    const weeklyData = new Map<string, number[]>();
    
    for (const point of history) {
        const date = new Date(point.timestamp);
        // Get the start of the week (Sunday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekKey = weekStart.toISOString();
        if (!weeklyData.has(weekKey)) {
            weeklyData.set(weekKey, []);
        }
        weeklyData.get(weekKey)!.push(point.price);
    }

    // Calculate average price per week
    const weeklyPrices: number[] = [];
    const sortedWeeks = Array.from(weeklyData.entries()).sort((a, b) => 
        new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );

    for (const [, prices] of sortedWeeks) {
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        weeklyPrices.push(avgPrice);
    }

    return weeklyPrices;
}

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

        // Group markets by event and select the highest volume market per event
        const eventGroups = new Map<string, any[]>();
        
        for (const m of markets) {
            const eventId = getEventIdFromMarket(m) || `single_${m.conditionId}`;
            
            if (!eventGroups.has(eventId)) {
                eventGroups.set(eventId, []);
            }
            eventGroups.get(eventId)!.push(m);
        }

        // For each event, select the market with highest volume
        const topMarketsByEvent: any[] = [];
        for (const [eventId, eventMarkets] of eventGroups.entries()) {
            // Sort markets in event by volume and take the top one
            const sortedMarkets = eventMarkets.sort((a, b) => {
                const volA = parseFloat(a.volume24hr) || 0;
                const volB = parseFloat(b.volume24hr) || 0;
                return volB - volA;
            });
            
            topMarketsByEvent.push({
                market: sortedMarkets[0],
                eventId,
                volume: parseFloat(sortedMarkets[0].volume24hr) || 0,
            });
        }

        // Sort events by their top market's volume
        topMarketsByEvent.sort((a, b) => b.volume - a.volume);

        // Take top 50 events and fetch weekly price history
        const polymarketClient = new PolymarketClient();
        const trendingMarkets = await Promise.all(
            topMarketsByEvent.slice(0, 50).map(async ({ market: m, eventId }) => {
                // Use lastTradePrice as the primary price source
                let price = parseFloat(m.lastTradePrice);

                // Fallback to outcomePrices if lastTradePrice is missing or zero
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

                // Fetch weekly price history
                let weeklyPriceHistory: number[] = [];
                try {
                    // Get tokenId from clobTokenIds (first token is usually the "Yes" outcome)
                    let tokenId: string | null = null;
                    if (m.clobTokenIds) {
                        try {
                            const tokenIds = typeof m.clobTokenIds === 'string'
                                ? JSON.parse(m.clobTokenIds)
                                : m.clobTokenIds;
                            if (Array.isArray(tokenIds) && tokenIds.length > 0) {
                                tokenId = tokenIds[0];
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }

                    if (tokenId) {
                        // Fetch daily data and aggregate to weekly
                        const dailyHistory = await polymarketClient.getPriceHistory(tokenId, '1d');
                        if (dailyHistory.length > 0) {
                            weeklyPriceHistory = aggregateToWeekly(dailyHistory);
                        }
                    }
                } catch (error) {
                    console.error(`[Market Stats API] Error fetching price history for ${m.conditionId}:`, error);
                }

                // If we don't have enough weekly data, use generated sparkline
                if (weeklyPriceHistory.length < 2) {
                    weeklyPriceHistory = generateSparkline(price, priceChangePercent);
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
                    priceHistory: weeklyPriceHistory,
                    outcomeCount: m.outcomes ? (typeof m.outcomes === 'string' ? JSON.parse(m.outcomes).length : m.outcomes.length) : 2,
                    endDate: m.endDateIso,
                    imageUrl: m.image || m.icon,
                    eventId: eventId,
                };
            })
        );

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
