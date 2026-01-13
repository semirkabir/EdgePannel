import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { GDELTFeedType } from '@/lib/api/gdelt';

export type FeedType = 'NEWS' | 'FINANCE' | 'CONTRACT' | 'POLICY' | 'CRYPTO' | 'COMMODITY' | 'LAYOFF';

export interface FeedConfig {
    activeFeeds: Record<string, boolean>;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useFeedData({ activeFeeds }: FeedConfig) {
    // 1. GDELT (Conflict & Tech)
    // We fetch multiple GDELT feeds if their respective toggles are on
    const { data: conflictFeed } = useSWR(
        activeFeeds['CONFLICT'] ? '/api/feeds/gdelt?type=CONFLICT' : null,
        fetcher, { refreshInterval: 600000 }
    );

    const { data: techFeed } = useSWR(
        activeFeeds['TECH_AI'] ? '/api/feeds/gdelt?type=TECH_AI' : null,
        fetcher, { refreshInterval: 600000 }
    );

    const { data: geoFeed } = useSWR(
        activeFeeds['GEOPOLITICS'] ? '/api/feeds/gdelt?type=GEOPOLITICS' : null,
        fetcher, { refreshInterval: 600000 }
    );

    // 2. Finance (FRED)
    // Fetch multiple indicators
    const { data: m2Feed } = useSWR(
        activeFeeds['MONEY_PRINTER'] ? '/api/feeds/fred?series=M2SL' : null,
        fetcher, { refreshInterval: 3600000 } // 1 hour
    );

    const { data: rateFeed } = useSWR(
        activeFeeds['RATES'] ? '/api/feeds/fred?series=FEDFUNDS' : null,
        fetcher, { refreshInterval: 3600000 }
    );

    // 3. Contracts
    const { data: contractFeed } = useSWR(
        activeFeeds['CONTRACTS'] ? '/api/feeds/usaspending' : null,
        fetcher, { refreshInterval: 3600000 }
    );

    // 4. Policy
    const { data: policyFeed } = useSWR(
        activeFeeds['POLICY'] ? '/api/feeds/policy' : null,
        fetcher, { refreshInterval: 3600000 }
    );

    // 5. Crypto
    const { data: cryptoFeed } = useSWR(
        activeFeeds['CRYPTO'] ? '/api/feeds/crypto' : null,
        fetcher, { refreshInterval: 60000 } // 1 min
    );

    // 6. Commodities
    const { data: commodityFeed } = useSWR(
        activeFeeds['COMMODITIES'] ? '/api/feeds/commodities' : null,
        fetcher, { refreshInterval: 3600000 }
    );

    // 7. Layoffs
    const { data: layoffFeed } = useSWR(
        activeFeeds['LAYOFFS'] ? '/api/feeds/layoffs' : null,
        fetcher, { refreshInterval: 86400000 } // 24 hours
    );

    const feedFeatures = useMemo(() => {
        const features: any[] = [];

        // GDELT Processing
        if (conflictFeed?.features) features.push(...conflictFeed.features.map((f: any) => ({ ...f, properties: { ...f.properties, layer: 'conflict', isCustom: true } })));
        if (techFeed?.features) features.push(...techFeed.features.map((f: any) => ({ ...f, properties: { ...f.properties, layer: 'tech', isCustom: true } })));
        if (geoFeed?.features) features.push(...geoFeed.features.map((f: any) => ({ ...f, properties: { ...f.properties, layer: 'geopolitics', isCustom: true } })));

        // Contracts Processing
        if (contractFeed?.contracts) {
            features.push(...contractFeed.contracts.map((c: any) => {
                if (!c.location) return null;
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [c.location.lng, c.location.lat]
                    },
                    properties: {
                        ...c,
                        id: c.id,
                        title: `CONTRACT: ${c.agency}`,
                        subTitle: c.recipient,
                        value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact" }).format(c.amount),
                        layer: 'contracts',
                        isCustom: true // Treat as custom for generic handling in MarketDetails
                    }
                };
            }).filter(Boolean));
        }

        // Policy Processing (Bills)
        if (policyFeed?.bills) {
            // All bills map to Washington DC for now
            features.push(...policyFeed.bills.map((b: any) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [-77.0090, 38.8899] // US Capitol
                },
                properties: {
                    ...b,
                    title: `BILL: ${b.number}`,
                    subTitle: b.title,
                    layer: 'policy',
                    isCustom: true
                }
            })));
        }

        // Layoffs Processing
        if (layoffFeed?.layoffs) {
            features.push(...layoffFeed.layoffs.map((l: any) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [l.lng, l.lat]
                },
                properties: {
                    ...l,
                    title: `LAYOFF: ${l.company}`,
                    subTitle: `${l.employees} employees`,
                    layer: 'layoffs',
                    isCustom: true
                }
            })));
        }

        // Crypto/Whales (Mock locations or map to major exchanges/countries)
        // For whales we might random dispers or use exchange locations
        if (cryptoFeed?.whales) {
            // Mock locations for visual interest if not provided
            const exchangeLocs: Record<string, [number, number]> = {
                'Binance': [139.6917, 35.6895], // Tokyo (approx, generic for Asia)
                'Coinbase': [-122.4194, 37.7749], // SF
                'Bitfinex': [114.1694, 22.3193], // Hong Kong
            };

            features.push(...cryptoFeed.whales.map((w: any) => {
                const coords = exchangeLocs[w.to] || exchangeLocs[w.from] || [-40 + Math.random() * 80, -20 + Math.random() * 40]; // Random ocean spot?
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coords
                    },
                    properties: {
                        ...w,
                        title: `WHALE: ${w.amount} ${w.symbol}`,
                        subTitle: `${w.from} -> ${w.to}`,
                        layer: 'crypto-whale',
                        isCustom: true
                    }
                };
            }));
        }

        // Note: FRED and Commodities are global/national stats, often better as overlay cards 
        // rather than map points, but we can map them to Central Banks or major exchanges.
        if (m2Feed?.observations) {
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [-77.0365, 38.8951] // Federal Reserve Board, DC
                },
                properties: {
                    ...m2Feed,
                    title: 'MONEY PRINTER (M2)',
                    subTitle: 'Federal Reserve',
                    layer: 'money-printer',
                    isCustom: true,
                    description: 'M2 Money Supply and other key economic indicators.'
                }
            });
        }

        if (commodityFeed?.commodities) {
            // Map oil to Cushing, OK or Brent Sea? Map Gold to London/NY?
            // Simplified: London for Brent/Gold
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-0.0761, 51.5126] }, // London
                properties: {
                    commodities: commodityFeed.commodities,
                    title: 'COMMODITIES FIX',
                    layer: 'commodities',
                    isCustom: true,
                    description: 'Global commodities prices and supply chain data.'
                }
            });
        }

        return { type: 'FeatureCollection', features };
    }, [conflictFeed, techFeed, geoFeed, contractFeed, policyFeed, layoffFeed, cryptoFeed, m2Feed, commodityFeed]);

    return {
        feedFeatures
    };
}
