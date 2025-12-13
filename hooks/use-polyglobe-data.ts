import { useMemo } from 'react';
import { useMarkets } from './use-markets';
import { useMarketWebSocket } from './use-market-websocket';
import { MOCK_TWEETS } from '@/lib/polyglobe-data';
import type { Market } from '@/types/market';

// GeoJSON types
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

export function usePolyglobeData() {
  // 1. Fetch markets from our own internal API
  const { markets: localMarkets, isLoading: marketsLoading } = useMarkets();

  // 2. Construct the market features from our enriched local markets
  const marketFeatures = useMemo(() => {
    if (!localMarkets) return [];

    return localMarkets
      .filter(m => m.location?.coordinates) // Only show markets where we successfully inferred a location
      .map(m => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [m.location!.coordinates!.lng, m.location!.coordinates!.lat]
        },
        properties: {
          id: m.id,
          market_id: m.id,
          title: m.title,
          slug: m.id,
          url: `https://polymarket.com/market/${m.id}`,
          last_price: m.price || 0,
          volume: m.volume24h || 0,
          image_url: null,
          is_open: true,
          description: m.description,
          price_movement: 0
        }
      }));
  }, [localMarkets]);

  // 3. Construct tweet features
  const tweetFeatures = useMemo(() => {
    return MOCK_TWEETS.map(t => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [t.lng, t.lat]
      },
      properties: {
        tweet_id: t.id,
        text: t.content,
        url: '#',
        handle: t.handle,
        timestamp: t.time,
        is_alert: t.tag === 'BREAKING',
        name: 'Unknown Location'
      }
    }));
  }, []);

  // 4. Setup WebSocket for live updates
  const marketIds = useMemo(() => {
    return marketFeatures
      .slice(0, 500)
      .map((f: any) => f.properties.market_id)
      .filter(Boolean);
  }, [marketFeatures]);

  // Pass localMarkets to useMarketWebSocket so it can find the platform for each ID
  const { getMarketUpdate } = useMarketWebSocket({
    watchlistMarketIds: marketIds,
    markets: localMarkets
  });

  // 5. Merge live updates into features and raw markets
  const { liveFeatures, liveMarkets } = useMemo(() => {
    const features = marketFeatures.map((feature: any) => {
      const id = feature.properties.market_id;
      const update = getMarketUpdate(id);

      if (update) {
        const oldPrice = feature.properties.last_price;
        const newPrice = update.price ?? oldPrice;
        const movement = newPrice - oldPrice;

        return {
          ...feature,
          properties: {
            ...feature.properties,
            last_price: newPrice,
            volume: update.volume24h ?? feature.properties.volume,
            price_movement: movement
          }
        };
      }
      return feature;
    });

    // Also apply updates to the raw enriched markets for the card stack
    const markets = (localMarkets || []).map(m => {
      if (!m.location?.coordinates) return null; // Filter out markets without location (matching GeoJSON logic)

      const update = getMarketUpdate(m.id);
      if (update) {
        return {
          ...m,
          price: update.price ?? m.price,
          volume24h: update.volume24h ?? m.volume24h,
          // Calculate movement if previous price is known, or store it in update
          price_movement: (update.price && m.price) ? update.price - m.price : 0,
          // Note: simplified movement calc. Ideally we track historical price.
          // merging properties needed for MarketCard:
          probability: update.price ?? m.price, // assuming price is probability
        };
      }
      return {
        ...m,
        price_movement: 0,
        probability: m.price
      };
    }).filter(Boolean) as any[]; // Type assertion for now

    return { liveFeatures: features, liveMarkets: markets };
  }, [marketFeatures, getMarketUpdate, localMarkets]);

  return {
    markets: { type: 'FeatureCollection', features: liveFeatures } as GeoJSONFeatureCollection,
    tweets: { type: 'FeatureCollection', features: tweetFeatures } as GeoJSONFeatureCollection,
    rawMarkets: liveMarkets,
    isLoading: marketsLoading,
    usingRemote: false
  };
}

