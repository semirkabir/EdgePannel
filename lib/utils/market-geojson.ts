
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

/**
 * Apply smart jitter to prevent markets from overlapping exactly
 * Uses deterministic offset based on market ID so positions are stable
 */
function applyJitter(lng: number, lat: number, marketId: string, zoom: number = 2.5): [number, number] {
    // Create deterministic offset from market ID
    let hash = 0;
    for (let i = 0; i < marketId.length; i++) {
        hash = ((hash << 5) - hash) + marketId.charCodeAt(i);
        hash |= 0;
    }

    // Scale jitter based on zoom level (less jitter at world view, more when zoomed)
    // At zoom 2.5 (world view): ~0.5-1 degree offset
    // At zoom 5: ~0.1-0.2 degree offset
    const baseJitter = 0.8 / Math.pow(2, zoom - 2.5);

    // Use sin/cos for even distribution in a circle
    const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
    const radius = (Math.abs(Math.sin(hash)) * baseJitter);

    const offsetLng = Math.cos(angle) * radius;
    const offsetLat = Math.sin(angle) * radius;

    return [lng + offsetLng, lat + offsetLat];
}

export function marketsToGeoJSON(markets: Market[]): GeoJSONFeatureCollection {
    const features = markets.map((m: any) => {
        // Check for coordinates in multiple formats:
        // 1. Nested in location.coordinates (standard Market type)
        // 2. Direct properties latitude/longitude (GeotaggedMarket from DB)
        const hasNestedCoords = m.location?.coordinates;
        const hasDirectCoords = m.latitude != null && m.longitude != null;

        let lng, lat;
        if (hasNestedCoords) {
            lng = m.location.coordinates.lng;
            lat = m.location.coordinates.lat;
        } else if (hasDirectCoords) {
            // GeotaggedMarket format (latitude/longitude as direct properties)
            lng = m.longitude;
            lat = m.latitude;
        } else {
            // Fallback: generate deterministic pseudo-random coordinates
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

        const hasValidCoords = hasNestedCoords || hasDirectCoords;

        // Apply jitter to prevent exact overlaps (only for valid coordinates)
        if (hasValidCoords) {
            const marketId = m.externalId || m.id || 'unknown';
            [lng, lat] = applyJitter(lng, lat, marketId);
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

        // For geotagged markets from DB, use externalId as the actual market ID
        // For regular markets, use the existing id
        const actualId = m.externalId || m.id;
        const actualSlug = m.slug || actualId;

        return {
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [lng, lat] as [number, number]
            },
            properties: {
                id: actualId,
                market_id: actualId,
                title: m.title || '',
                slug: actualSlug || '',
                ticker: m.ticker || '',
                url: marketUrl || '',
                last_price: Number(m.price || m.probability || 0),
                volume: Number(m.volume24h || m.liquidity || 0),
                liquidity: Number(m.liquidity || 0),
                image_url: m.imageUrl || null,
                is_open: true,
                description: m.description || '',
                category: m.category || '',
                price_movement: Number(m.price_movement || 0),
                isBreakingNews: Boolean(m.isBreakingNews),
                platform: m.platform || '',
                endDate: m.endDate ? String(m.endDate) : null,
                is_random_location: !hasValidCoords,
                rawData: m.rawData ? JSON.stringify(m.rawData) : '{}'
            }
        };
    });

    return {
        type: 'FeatureCollection',
        features
    };
}
