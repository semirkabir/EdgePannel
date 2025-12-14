
import { Market } from '@/types/market';

export interface GeoJSONFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: any;
}

export interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

export function marketsToGeoJSON(markets: Market[]): GeoJSONFeatureCollection {
    const features = markets.map((m: any) => {
        // Fallback coordinates if none found (generic "Global" location at 0,0 or distributed)
        // Use deterministic pseudo-random based on ID to avoid hydration mismatches and jumping
        const hasLoc = m.location?.coordinates;

        let lng, lat;
        if (hasLoc) {
            lng = m.location.coordinates.lng;
            lat = m.location.coordinates.lat;
        } else {
            // Simple hash of the ID
            let hash = 0;
            const str = m.id || 'unknown';
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0; // Convert to 32bit integer
            }

            // Map hash to coordinates (pseudo-random but deterministic)
            const rand1 = Math.abs(Math.sin(hash) * 10000) % 1;
            const rand2 = Math.abs(Math.cos(hash) * 10000) % 1;

            lng = (rand1 * 360) - 180;
            lat = (rand2 * 160) - 80;
        }

        // Fix URL logic could go here too, but likely handled in map tooltip or type
        // We assume properties are mostly passed through

        // Fix Kalshi URL: Prefer series_ticker from rawData
        let marketUrl = m.url;
        if (!marketUrl) {
            if (m.platform === 'polymarket') {
                marketUrl = `https://polymarket.com/market/${m.slug || m.id}`;
            } else {
                // Kalshi: Try rawData.series_ticker, then m.series_ticker, then ticker
                const series = m.rawData?.series_ticker || m.series_ticker;
                marketUrl = `https://kalshi.com/markets/${series || m.ticker}`;
            }
        }

        return {
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [lng, lat] as [number, number]
            },
            properties: {
                id: m.id,
                market_id: m.id,
                title: m.title,
                slug: m.id,
                url: marketUrl,
                last_price: m.price || m.probability || 0,
                volume: m.volume24h || m.liquidity || 0,
                image_url: null,
                is_open: true,
                description: m.description,
                price_movement: m.price_movement || 0,
                isBreakingNews: m.isBreakingNews || false,
                platform: m.platform,
                is_random_location: !hasLoc,
                priceHistory: m.priceHistory ? JSON.stringify(m.priceHistory) : null
            }
        };
    });

    return {
        type: 'FeatureCollection',
        features
    };
}
