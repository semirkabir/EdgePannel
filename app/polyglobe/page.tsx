'use client';

import { MarketCardStack } from '@/components/polyglobe/MarketCardStack';
import { EnrichedMarket } from '@/lib/markets/enrich';
import React, { useState, useEffect, useMemo } from 'react';
import { PolyglobeMap } from '@/components/polyglobe/PolyglobeMap';
import { PolyglobeUI } from '@/components/polyglobe/PolyglobeUI';
import { CountryNewsPanel } from '@/components/polyglobe/CountryNewsPanel';
import { Starfield } from '@/components/polyglobe/Starfield';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { useSearch } from '@/hooks/use-search';
import { useGeotaggedMarkets } from '@/hooks/use-geotagged-markets';
import { useWhaleTrades } from '@/hooks/use-whale-trades';
import { useWhaleAlerts } from '@/hooks/use-whale-alerts';
import { usePriceAlerts } from '@/hooks/use-price-alerts';
import { marketsToGeoJSON } from '@/lib/utils/market-geojson';
import { MarketDetails } from '@/components/panels/MarketDetails';
import { NotificationCenter } from '@/components/panels/NotificationCenter';
import { DatabaseSetupNotice } from '@/components/polyglobe/DatabaseSetupNotice';
import { parseMarketUrl } from '@/lib/utils/market-url-parser';

export default function PolyglobePage() {
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    breaking: false,
    osint: true,
    live: true,
    fires: false,
    frontline: false,
    heatmap: false
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'globe'>('globe');
  const [selectedMarket, setSelectedMarket] = useState<EnrichedMarket | null>(null);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [sortBy, setSortBy] = useState('volume');
  const [selectedPlatform, setSelectedPlatform] = useState<'kalshi' | 'polymarket' | 'all'>('all');

  // Zoom state
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [shouldResetZoom, setShouldResetZoom] = useState(false);

  // Whale Trade Detection Setup
  const { createGlobalAlert, alerts: whaleAlerts, isLoaded: whaleAlertsLoaded } = useWhaleAlerts();
  const { processTicker, unreadCount: whaleUnreadCount } = useWhaleTrades({ enabled: true });
  const { triggeredAlertCount } = usePriceAlerts();

  // Combined notification count
  const totalNotificationCount = whaleUnreadCount + triggeredAlertCount;

  // Handle zoom reset
  const handleResetZoom = () => {
    setShouldResetZoom(true);
    setSelectedMarket(null);
    setSelectedCountry(null);
    // Reset the trigger after a short delay
    setTimeout(() => {
      setShouldResetZoom(false);
      setIsZoomedIn(false);
    }, 100);
  };

  // Create default whale alert on first load (for testing)
  useEffect(() => {
    if (whaleAlertsLoaded && whaleAlerts.length === 0) {
      // Create a global alert for trades over $5000
      createGlobalAlert(5000, {
        minAmount: 5000,
        platforms: ['polymarket', 'kalshi'],
        tradeDirection: 'both',
      });
      console.log('[Polyglobe] Created default whale alert for $5000+ trades');
    }
  }, [whaleAlertsLoaded, whaleAlerts.length, createGlobalAlert]);

  // 1. Search for Dropdown
  const { markets: searchResults, isLoading: isSearching } = useSearch({
    q: searchQuery,
    platform: selectedPlatform,
    limit: 10,
    onTickerUpdate: processTicker,
  });

  // 2. Fetch ALL geotagged markets (no more limits!)
  const isAllCategories = selectedCategories.includes('All') || selectedCategories.length === 0;
  const { markets: geotaggedMarkets, isLoading: isGeotaggedLoading, error: geotaggedError, total: geotaggedTotal } = useGeotaggedMarkets({
    category: !isAllCategories && selectedCategories.length > 0 ? selectedCategories[0] : undefined,
    platform: selectedPlatform === 'all' ? undefined : selectedPlatform,
    limit: 2000, // Fetch up to 2000 geotagged markets
    enabled: true,
  });

  // Fallback to old search method if no geotagged markets exist
  const { markets: fallbackMarkets, isLoading: isFallbackLoading } = useSearch({
    category: !isAllCategories && selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
    platform: selectedPlatform,
    sort: sortBy as 'volume' | 'relevance' | 'liquidity',
    limit: 500, // Fetch more markets as fallback
    onTickerUpdate: processTicker,
  });

  // Use geotagged markets if available, otherwise fall back to search results
  const mapFilteredMarkets = geotaggedTotal > 0 ? geotaggedMarkets : fallbackMarkets;
  const isMapFiltering = geotaggedTotal > 0 ? isGeotaggedLoading : isFallbackLoading;

  // Check if database needs setup
  const needsDatabaseSetup = geotaggedError?.includes('Database not set up');
  const needsIndexing = !needsDatabaseSetup && geotaggedTotal === 0 && !isGeotaggedLoading;

  // Process tickers for whale trade detection
  useEffect(() => {
    mapFilteredMarkets.forEach(market => {
      if (market.ticker || market.slug) {
        const marketId = market.ticker || market.slug || ''
        const price = market.price || 0
        const volume = market.volume24h || 0
        processTicker(market.platform, marketId, price, volume);
      }
    });
  }, [mapFilteredMarkets, processTicker]);

  // Convert map filtered markets to GeoJSON features for override
  const overrideMarkets = useMemo(() => {
    // Always use filtered markets now (since "All" is the default category selection)
    console.log('[Polyglobe] Filters active:', { selectedCategories, selectedPlatform, isAllCategories });
    console.log('[Polyglobe] mapFilteredMarkets count:', mapFilteredMarkets.length);
    console.log('[Polyglobe] mapFilteredMarkets sample:', mapFilteredMarkets.slice(0, 2));

    let features = marketsToGeoJSON(mapFilteredMarkets).features;

    // Verify features is an array (fix potential upstream issues)
    if (!Array.isArray(features)) {
      features = (features as any)?.features || [];
    }

    console.log('[Polyglobe] Converted to GeoJSON features:', features.length);
    console.log('[Polyglobe] Sample feature:', features[0]);

    // Ensure selectedMarket is included in the filtered view so it can be located
    if (selectedMarket) {
      const exists = features.find((f: any) =>
        f.properties.id === selectedMarket.id
      );
      if (!exists) {
        // Convert selectedMarket to feature
        const extraFeatures = marketsToGeoJSON([selectedMarket]).features;
        if (extraFeatures.length > 0) {
          features = [...features, extraFeatures[0]];
        }
      }
    }

    console.log('[Polyglobe] Final overrideMarkets features:', features.length);
    return features;
  }, [mapFilteredMarkets, selectedCategories, selectedPlatform, selectedMarket, isAllCategories]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('polyglobe-view-mode');
      if (saved === 'globe' || saved === 'map') {
        setViewMode(saved);
      }
    }
  }, []);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.05);
  const [pauseOnHover, setPauseOnHover] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Persist view mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('polyglobe-view-mode', viewMode);
    }
  }, [viewMode]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Handle URL-based market search
  const handleUrlSearch = async (url: string) => {
    const parsed = parseMarketUrl(url);
    if (!parsed) return;

    console.log('[Polyglobe] Fetching market from URL:', parsed);

    try {
      const response = await fetch(
        `/api/markets/by-url?platform=${parsed.platform}&identifier=${encodeURIComponent(parsed.identifier)}&type=${parsed.type}`
      );

      if (!response.ok) {
        console.error('[Polyglobe] Failed to fetch market from URL:', response.statusText);
        return;
      }

      const data = await response.json();
      if (data.market) {
        console.log('[Polyglobe] Market fetched from URL:', data.market);
        setSelectedMarket(data.market);
        setSelectedCountry(null);
      }
    } catch (error) {
      console.error('[Polyglobe] Error fetching market from URL:', error);
    }
  };

  const handleFilterChange = (filter: string, active: boolean) => {
    setActiveFilters(prev => ({ ...prev, [filter]: active }));
  };

  const handleViewToggle = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode(prev => prev === 'map' ? 'globe' : 'map');
      setIsTransitioning(false);
    }, 150);
  };

  const handleCountryClick = (countryName: string) => {
    setSelectedCountry(countryName);
    setSelectedMarket(null);
  };

  const handleCloseNews = () => {
    setSelectedCountry(null);
  };

  const handleMarketClick = (market: EnrichedMarket | null) => {
    console.log('Market selected:', market);
    setSelectedMarket(market);
    if (market) {
      setSelectedCountry(null);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950">
      {/* Database Setup Notice */}
      {needsDatabaseSetup && <DatabaseSetupNotice />}

      {/* Starfield background - only in globe mode */}
      {viewMode === 'globe' && <Starfield starCount={300} />}

      <div className={`absolute inset-0 transition-opacity duration-150 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`} style={{ zIndex: 2 }}>
        <PolyglobeMap
          activeFilters={activeFilters}
          searchQuery={searchQuery}
          projection={viewMode === 'globe' ? 'globe' : 'mercator'}
          onCountryClick={handleCountryClick}
          isPlaying={isPlaying}
          rotationSpeed={rotationSpeed}
          pauseOnHover={pauseOnHover}
          selectedMarket={selectedMarket}
          onMarketSelect={handleMarketClick}
          overrideMarkets={overrideMarkets}
          onZoomChange={setIsZoomedIn}
          shouldResetZoom={shouldResetZoom}
        />
      </div>
      <PolyglobeUI
        onSearch={handleSearch}
        onUrlSearch={handleUrlSearch}
        onFilterChange={handleFilterChange}
        activeFilters={activeFilters}
        onViewToggle={handleViewToggle}
        currentView={viewMode}
        isPlaying={isPlaying}
        onPlayPause={setIsPlaying}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        searchResults={searchResults}
        onMarketSelect={handleMarketClick}
        isSearching={isSearching}
        // Pass Filter Props
        selectedCategories={selectedCategories}
        onCategorySelect={setSelectedCategories}
        sortBy={sortBy}
        onSortChange={setSortBy}
        selectedPlatform={selectedPlatform}
        onPlatformChange={(platform) => setSelectedPlatform(platform as 'kalshi' | 'polymarket' | 'all')}
        // Notification Props
        onNotificationClick={() => setIsNotificationCenterOpen(true)}
        notificationCount={totalNotificationCount}
        // Zoom Props
        isZoomedIn={isZoomedIn}
        onResetZoom={handleResetZoom}
      />

      {/* Search results are now handled inside PolyglobeUI */}

      <MarketDetails
        market={selectedMarket as any}
        onClose={() => setSelectedMarket(null)}
      />

      <CountryNewsPanel
        country={selectedCountry}
        onClose={handleCloseNews}
        onMarketSelect={handleMarketClick}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        rotationSpeed={rotationSpeed}
        onRotationSpeedChange={setRotationSpeed}
        pauseOnHover={pauseOnHover}
        onPauseOnHoverChange={setPauseOnHover}
        autoRotate={isPlaying}
        onAutoRotateChange={setIsPlaying}
      />

      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onMarketSelect={(marketId, platform) => {
          // Find and select the market
          const market = mapFilteredMarkets.find(m => m.id === marketId && m.platform === platform);
          if (market) {
            setSelectedMarket(market as unknown as EnrichedMarket);
          }
        }}
      />
    </div>
  );
}

