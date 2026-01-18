'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { SignInPrompt } from './SignInPrompt';
import { Loader, Activity, TrendingUp, Flame } from 'lucide-react';
import { useFeedData } from '@/hooks/use-feed-data';
import { marketsToGeoJSON, eventsToGeoJSON } from '@/lib/utils/market-geojson';

// Dynamically import EdgeMap to avoid SSR issues with MapLibre
const EdgeMap = dynamic(
    () => import('@/components/edge/EdgeMap').then((mod) => mod.EdgeMap),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-black/60">
                <div className="flex flex-col items-center gap-3">
                    <Loader className="w-6 h-6 text-[#00ff7f] animate-spin" />
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                        Initializing globe...
                    </div>
                </div>
            </div>
        ),
    }
);

interface LandingGlobeProps {
    className?: string;
}

export function LandingGlobe({ className }: LandingGlobeProps) {
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [selectedMarketTitle, setSelectedMarketTitle] = useState<string | undefined>();
    const [mounted, setMounted] = useState(false);
    const [markets, setMarkets] = useState<any[]>([]);
    const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);

    // Fetch conflict feed data for landing page
    const { feedFeatures } = useFeedData({
        activeFeeds: {
            'CONFLICT': true,
            'TECH_AI': false,
            'GEOPOLITICS': false,
            'MONEY_PRINTER': false,
            'RATES': false,
            'CONTRACTS': false,
            'POLICY': false,
            'CRYPTO': false,
            'COMMODITIES': false,
            'LAYOFFS': false,
        },
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch random cached markets from database (no live updates for landing page)
    useEffect(() => {
        if (!mounted) return;

        const fetchMarkets = async () => {
            try {
                // Fetch random markets from cache - much faster than live data
                const response = await fetch('/api/markets/search?limit=100&sort=volume&random=true');
                if (!response.ok) throw new Error('Failed to fetch markets');
                const data = await response.json();

                if (data.markets && Array.isArray(data.markets)) {
                    setMarkets(data.markets);
                }
            } catch (error) {
                console.error('[LandingGlobe] Error fetching markets:', error);
                // Fallback to geotagged if search fails
                try {
                    const fallback = await fetch('/api/markets/geotagged?limit=100');
                    const fallbackData = await fallback.json();
                    if (fallbackData.markets) setMarkets(fallbackData.markets);
                } catch (e) {
                    console.error('[LandingGlobe] Fallback failed:', e);
                }
            } finally {
                setIsLoadingMarkets(false);
            }
        };

        fetchMarkets();
    }, [mounted]);

    // Convert markets to GeoJSON features (same logic as EdgePage)
    const overrideMarkets = useMemo(() => {
        if (!markets.length) return [];

        const firstMarket = markets[0] as any;
        const isGroupedAsEvents = firstMarket?.isEvent && firstMarket?.markets;

        let features = isGroupedAsEvents
            ? eventsToGeoJSON(markets).features
            : marketsToGeoJSON(markets).features;

        if (!Array.isArray(features)) {
            features = (features as any)?.features || [];
        }

        return features;
    }, [markets]);

    // Handle market click - show sign in prompt instead of market details
    const handleMarketSelect = (market: any) => {
        const title = market?.title || market?.question || market?.properties?.title || 'Market Details';
        setSelectedMarketTitle(title);
        setIsPromptOpen(true);
    };

    // Filters - enable all relevant layers
    const activeFilters = useMemo(() => ({
        breaking: false,
        live: true,
        fires: false,
        heatmap: false,
        noiseFilter: false,
        feeds: true, // Enable feed data display
    }), []);

    // Show loading state only for initial mount
    if (!mounted) {
        return (
            <div className={`${className} flex items-center justify-center bg-black/60`}>
                <Loader className="w-6 h-6 text-[#00ff7f] animate-spin" />
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {/* Globe container - shows immediately even if data is still loading */}
            <div className="absolute inset-0">
                <EdgeMap
                    activeFilters={activeFilters}
                    searchQuery=""
                    projection="globe"
                    isPlaying={true}
                    rotationSpeed={0.03}
                    pauseOnHover={false}
                    onMarketSelect={handleMarketSelect}
                    overrideMarkets={overrideMarkets}
                    visualizationMode="dots"
                    marketType="prediction"
                    showLabels={true}
                    showGrid={false}
                    feedData={feedFeatures}
                    disableZoom={true}
                    initialZoom={1.8}
                    hideControls={true}
                />
            </div>

            {/* Legend overlay with icons - mobile responsive */}
            <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-10 pointer-events-none">
                <div className="bg-black/70 backdrop-blur border border-white/10 p-2 sm:p-3 text-xs font-mono">
                    <div className="text-white/60 uppercase tracking-wider mb-1.5 sm:mb-2 text-[9px] sm:text-[10px]">Map Data</div>
                    <div className="space-y-1 sm:space-y-1.5">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-400" />
                            <span className="text-white/70 text-[10px] sm:text-xs">Predictions</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-400" />
                            <span className="text-white/70 text-[10px] sm:text-xs">Conflicts</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <TrendingUp className="w-3 h-3 text-green-400" />
                            <span className="text-white/70">Financial Data</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Click hint - bottom right - hidden on mobile */}
            <div className="hidden sm:block absolute bottom-4 right-4 z-10 pointer-events-none">
                <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
                    Click any marker to explore
                </div>
            </div>

            {/* Sign in prompt modal */}
            <SignInPrompt
                isOpen={isPromptOpen}
                onClose={() => setIsPromptOpen(false)}
                marketTitle={selectedMarketTitle}
            />
        </div>
    );
}
