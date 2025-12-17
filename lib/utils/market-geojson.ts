
import { Market } from '@/types/market';
import { EnrichedMarket, MarketGroup, getMarketsWithGroups } from '@/lib/markets/enrich';

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
    // Filter out markets without valid coordinates first
    const validMarkets = markets.filter((m: any) => {
        const hasNestedCoords = m.location?.coordinates;
        const hasDirectCoords = m.latitude != null && m.longitude != null;
        return hasNestedCoords || hasDirectCoords;
    });

    const features = validMarkets.map((m: any) => {
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
            // Should not happen due to filter above, but safety check
            return null;
        }

        // Apply jitter to prevent exact overlaps
        const marketId = m.externalId || m.id || 'unknown';
        [lng, lat] = applyJitter(lng, lat, marketId);

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
                image_url: m.imageUrl || (m as any).image || m.rawData?.image || m.rawData?.icon || m.rawData?.eventImage || null,
                is_open: true,
                description: m.description || '',
                category: m.category || '',
                price_movement: Number(m.price_movement || 0),
                isBreakingNews: Boolean(m.isBreakingNews),
                platform: m.platform || '',
                endDate: m.endDate ? String(m.endDate) : null,
                is_random_location: false,
                rawData: m.rawData ? JSON.stringify(m.rawData) : '{}'
            }
        };
    }).filter(Boolean); // Filter out any null entries

    return {
        type: 'FeatureCollection',
        features
    };
}

/**
 * Convert enriched markets to GeoJSON with grouping support
 * Groups markets that are options for the same event into a single feature
 */
export function marketsToGeoJSONWithGroups(markets: EnrichedMarket[]): GeoJSONFeatureCollection {
    const { groups, ungroupedMarkets } = getMarketsWithGroups(markets);
    const features: GeoJSONFeature[] = [];

    // Only show events (groups) on the map, not individual markets
    // Add grouped markets as single features (only if they have valid coordinates)
    groups.forEach((group) => {
        // Use the location from the first market in the group
        const primaryMarket = group.markets[0];

        const hasNestedCoords = primaryMarket.location?.coordinates;
        const hasDirectCoords = (primaryMarket as any).latitude != null && (primaryMarket as any).longitude != null;

        // Skip groups without valid coordinates
        if (!hasNestedCoords && !hasDirectCoords) {
            return;
        }

        let lng, lat;
        if (hasNestedCoords) {
            lng = primaryMarket.location!.coordinates.lng;
            lat = primaryMarket.location!.coordinates.lat;
        } else if (hasDirectCoords) {
            lng = (primaryMarket as any).longitude;
            lat = (primaryMarket as any).latitude;
        } else {
            return; // Should not happen, but safety check
        }

        const hasValidCoords = true;

        // Apply jitter
        if (hasValidCoords) {
            [lng, lat] = applyJitter(lng, lat, group.groupId);
        }

        // Create a feature for the group
        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lng, lat]
            },
            properties: {
                id: group.groupId,
                market_id: group.groupId,
                title: group.baseQuestion,
                isGroup: true,
                groupId: group.groupId,
                marketCount: group.markets.length,
                // Store all market options - preserve all data for matching
                markets: group.markets.map(m => ({
                    id: m.id,
                    title: m.title,
                    slug: m.slug || m.id,
                    ticker: m.ticker || '',
                    price: Number(m.price || m.probability || 0),
                    volume24h: Number(m.volume24h || 0),
                    platform: m.platform,
                    description: m.description || '',
                    imageUrl: m.imageUrl || null,
                    endDate: m.endDate ? (typeof m.endDate === 'string' ? m.endDate : String(m.endDate)) : null,
                    url: m.platform === 'polymarket'
                        ? `https://polymarket.com/market/${m.slug || m.id}`
                        : `https://kalshi.com/markets/${(m.rawData as any)?.series_ticker || m.ticker}`,
                    // Preserve rawData for event ID matching
                    rawData: m.rawData || {},
                })),
                // Aggregate properties for event display
                last_price: group.markets[0].price || group.markets[0].probability || 0, // Show first option's price
                volume: group.totalVolume,
                volume24h: group.totalVolume, // For compatibility
                liquidity: group.markets.reduce((sum, m) => sum + (m.liquidity || 0), 0),
                category: group.category,
                platform: primaryMarket.platform,
                isBreakingNews: group.isBreakingNews,
                is_random_location: false,
                image_url: primaryMarket.imageUrl || (primaryMarket as any).image || primaryMarket.rawData?.image || primaryMarket.rawData?.icon || primaryMarket.rawData?.eventImage || null,
                description: primaryMarket.description || group.baseQuestion, // Event description
                // Event metadata - prefer eventId from rawData (set when fetching from events API)
                eventId: primaryMarket.rawData?.eventId 
                  || primaryMarket.rawData?.events?.[0]?.id 
                  || group.groupId 
                  || null,
                eventData: primaryMarket.rawData?.events?.[0] || null,
            }
        });
    });

    // Skip ungrouped markets - we only show events (groups) on the map
    // Individual markets will be shown in the right panel when an event is clicked
    // ungroupedMarkets.forEach((m) => { ... }); // Removed - only show events

    return {
        type: 'FeatureCollection',
        features
    };
}
