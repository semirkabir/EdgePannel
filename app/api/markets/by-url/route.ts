import { NextRequest, NextResponse } from 'next/server';
import { PolymarketClient } from '@/lib/api/polymarket';
import { KalshiClient } from '@/lib/api/kalshi';
import { enrichMarket } from '@/lib/markets/enrich';

/**
 * GET /api/markets/by-url
 * Fetch a single market by platform and identifier
 *
 * Query params:
 * - platform: 'polymarket' | 'kalshi'
 * - identifier: slug/ticker/id depending on platform
 * - type: 'slug' | 'ticker' | 'id'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const identifier = searchParams.get('identifier');
    const type = searchParams.get('type');

    if (!platform || !identifier) {
      return NextResponse.json(
        { error: 'Missing platform or identifier' },
        { status: 400 }
      );
    }

    console.log(`[Markets By URL API] Fetching ${platform} market with ${type}: ${identifier}`);

    if (platform === 'polymarket') {
      if (type === 'slug') {
        // Query Gamma API directly by slug
        try {
          const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(identifier)}&limit=1`;
          console.log('[Markets By URL API] Querying Gamma API:', url);

          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          });

          if (!response.ok) {
            console.error('[Markets By URL API] Gamma API error:', response.status);
            return NextResponse.json(
              { error: 'Failed to fetch from Polymarket' },
              { status: response.status }
            );
          }

          const markets = await response.json();
          console.log('[Markets By URL API] Received markets:', markets.length);

          if (!Array.isArray(markets) || markets.length === 0) {
            return NextResponse.json(
              { error: 'Market not found' },
              { status: 404 }
            );
          }

          // Transform the market data to our format
          const marketData = markets[0];

          // Get proper category from Polymarket
          let category = marketData.category

          // Prefer tags over category field if available
          if (marketData.tags && Array.isArray(marketData.tags) && marketData.tags.length > 0) {
            category = marketData.tags[0]
          }

          // If still no category, try groupItemTitle (used in some Polymarket responses)
          if (!category && marketData.groupItemTitle) {
            category = marketData.groupItemTitle
          }

          const transformedMarket = {
            id: marketData.conditionId,
            platform: 'polymarket' as const,
            title: marketData.question,
            description: marketData.description || '',
            category: category,
            price: marketData.outcomePrices ? parseFloat(JSON.parse(marketData.outcomePrices)[0]) : undefined,
            probability: marketData.outcomePrices ? parseFloat(JSON.parse(marketData.outcomePrices)[0]) : undefined,
            volume24h: marketData.volume24hr ? parseFloat(marketData.volume24hr) : 0,
            liquidity: marketData.liquidityNum ? parseFloat(marketData.liquidityNum) : undefined,
            endDate: marketData.endDateIso ? new Date(marketData.endDateIso) : undefined,
            slug: marketData.slug,
            outcomes: marketData.outcomes || ['Yes', 'No'],
            outcomePrices: marketData.outcomePrices ? JSON.parse(marketData.outcomePrices).map((p: string) => parseFloat(p)) : undefined,
            rawData: marketData,
          };

          const enriched = enrichMarket(transformedMarket, []);
          return NextResponse.json({ market: enriched });
        } catch (error: any) {
          console.error('[Markets By URL API] Error fetching by slug:', error);
          return NextResponse.json(
            { error: error.message || 'Failed to fetch market' },
            { status: 500 }
          );
        }
      } else if (type === 'id') {
        // Query by condition ID
        try {
          const url = `https://gamma-api.polymarket.com/markets?condition_id=${encodeURIComponent(identifier)}&limit=1`;
          console.log('[Markets By URL API] Querying Gamma API:', url);

          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          });

          if (!response.ok) {
            return NextResponse.json(
              { error: 'Failed to fetch from Polymarket' },
              { status: response.status }
            );
          }

          const markets = await response.json();

          if (!Array.isArray(markets) || markets.length === 0) {
            return NextResponse.json(
              { error: 'Market not found' },
              { status: 404 }
            );
          }

          const marketData = markets[0];

          // Get proper category from Polymarket
          let category = marketData.category

          // Prefer tags over category field if available
          if (marketData.tags && Array.isArray(marketData.tags) && marketData.tags.length > 0) {
            category = marketData.tags[0]
          }

          // If still no category, try groupItemTitle (used in some Polymarket responses)
          if (!category && marketData.groupItemTitle) {
            category = marketData.groupItemTitle
          }

          const transformedMarket = {
            id: marketData.conditionId,
            platform: 'polymarket' as const,
            title: marketData.question,
            description: marketData.description || '',
            category: category,
            price: marketData.outcomePrices ? parseFloat(JSON.parse(marketData.outcomePrices)[0]) : undefined,
            probability: marketData.outcomePrices ? parseFloat(JSON.parse(marketData.outcomePrices)[0]) : undefined,
            volume24h: marketData.volume24hr ? parseFloat(marketData.volume24hr) : 0,
            liquidity: marketData.liquidityNum ? parseFloat(marketData.liquidityNum) : undefined,
            endDate: marketData.endDateIso ? new Date(marketData.endDateIso) : undefined,
            slug: marketData.slug,
            rawData: marketData,
          };

          const enriched = enrichMarket(transformedMarket, []);
          return NextResponse.json({ market: enriched });
        } catch (error: any) {
          console.error('[Markets By URL API] Error fetching by ID:', error);
          return NextResponse.json(
            { error: error.message || 'Failed to fetch market' },
            { status: 500 }
          );
        }
      }
    } else if (platform === 'kalshi') {
      const accessKeyId = process.env.KALSHI_API_KEY_ID || '';
      const privateKey = process.env.KALSHI_PRIVATE_KEY || '';

      if (!accessKeyId || !privateKey) {
        console.warn('[Markets By URL API] Kalshi credentials not configured');
        return NextResponse.json(
          { error: 'Kalshi not configured' },
          { status: 503 }
        );
      }

      const client = new KalshiClient({ accessKeyId, privateKey });

      // For Kalshi, identifier is the ticker
      const market = await client.getMarket(identifier);

      if (!market) {
        return NextResponse.json(
          { error: 'Market not found' },
          { status: 404 }
        );
      }

      const enriched = enrichMarket(market, []);
      return NextResponse.json({ market: enriched });
    }

    return NextResponse.json(
      { error: 'Invalid platform' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Markets By URL API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch market' },
      { status: 500 }
    );
  }
}
