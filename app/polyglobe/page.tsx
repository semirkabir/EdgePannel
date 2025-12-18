'use client';

import { MarketCardStack } from '@/components/polyglobe/MarketCardStack';
import { EnrichedMarket } from '@/lib/markets/enrich';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PolyglobeMap } from '@/components/polyglobe/PolyglobeMap';
import { PolyglobeUI, type VisualizationMode } from '@/components/polyglobe/PolyglobeUI';
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
import { useMarketWebSocket } from '@/hooks/use-market-websocket';
import { NotificationCenter } from '@/components/panels/NotificationCenter';
import { parseMarketUrl } from '@/lib/utils/market-url-parser';
import { AgentDashboard } from '@/components/agent/AgentDashboard';
import { InsightsDashboard } from '@/components/insights/InsightsDashboard';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { KeyboardShortcutsDialog } from '@/components/ui/keyboard-shortcuts-dialog';

export default function PolyglobePage() {
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    breaking: false,
    osint: true,
    live: true,
    fires: false,
    frontline: false,
    heatmap: false,
    noiseFilter: false // Hide low liquidity markets
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'globe' | 'insights'>('globe');
  const [selectedMarket, setSelectedMarket] = useState<EnrichedMarket | null>(null);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [sortBy, setSortBy] = useState('volume');
  const [selectedPlatform, setSelectedPlatform] = useState<'kalshi' | 'polymarket' | 'all'>('all');
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('dots');

  // View state - tracks both zoom and pan
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [isViewModified, setIsViewModified] = useState(false);
  const [shouldResetZoom, setShouldResetZoom] = useState(false);

  // Whale Trade Detection Setup
  const { createGlobalAlert, alerts: whaleAlerts, isLoaded: whaleAlertsLoaded } = useWhaleAlerts();
  const { triggeredAlertCount } = usePriceAlerts();


  // Handle view reset (both zoom and pan)
  const handleResetZoom = () => {
    setShouldResetZoom(true);
    setSelectedMarket(null);
    setSelectedCountry(null);
    // Reset the trigger after a short delay
    setTimeout(() => {
      setShouldResetZoom(false);
      setIsZoomedIn(false);
      setIsViewModified(false);
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
  });

  // Use geotagged markets if available AND no error, otherwise fall back to search results
  // If geotagged has error or returns 0 results, use fallback
  const shouldUseFallback = geotaggedError || geotaggedTotal === 0;
  const mapFilteredMarkets = shouldUseFallback ? fallbackMarkets : geotaggedMarkets;
  const isMapFiltering = shouldUseFallback ? isFallbackLoading : isGeotaggedLoading;

  // Initialize Whale Trades with the currently displayed markets
  const { processTicker, unreadCount: whaleUnreadCount } = useWhaleTrades({
    enabled: true,
    markets: mapFilteredMarkets
  });

  // Combined notification count
  const totalNotificationCount = whaleUnreadCount + triggeredAlertCount;

  // Setup WebSocket for live updates on displayed markets
  const marketIds = useMemo(() => {
    return mapFilteredMarkets.slice(0, 100).map(m => m.id); // Limit to top 100 for WS performance
  }, [mapFilteredMarkets]);

  const { getMarketUpdate } = useMarketWebSocket({
    watchlistMarketIds: marketIds,
    markets: mapFilteredMarkets,
    onTickerUpdate: processTicker,
  });

  // Merge live updates
  const liveMapFilteredMarkets = useMemo(() => {
    if (!mapFilteredMarkets.length) return mapFilteredMarkets;

    return mapFilteredMarkets.map(m => {
      const update = getMarketUpdate(m.id);
      if (update) {
        return {
          ...m,
          price: update.price ?? m.price,
          volume24h: update.volume24h ?? m.volume24h,
          probability: update.price ?? m.probability,
          // Calculate movement if we have previous price
          price_movement: (update.price && m.price) ? (update.price - m.price) / m.price : (m.price_movement || 0)
        };
      }
      return m;
    });
  }, [mapFilteredMarkets, getMarketUpdate]);

  // Convert map filtered markets to GeoJSON features for override
  const overrideMarkets = useMemo(() => {
    let features = marketsToGeoJSON(liveMapFilteredMarkets).features;

    // Verify features is an array (fix potential upstream issues)
    if (!Array.isArray(features)) {
      features = (features as any)?.features || [];
    }

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
    return features;
  }, [liveMapFilteredMarkets, selectedCategories, selectedPlatform, selectedMarket, isAllCategories]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('polyglobe-view-mode');
      if (saved === 'globe' || saved === 'map' || saved === 'agent') {
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
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Handle visualization mode changes
  const handleVisualizationModeChange = (mode: VisualizationMode) => {
    setVisualizationMode(mode);
    // Sync with old heatmap filter for backward compatibility
    setActiveFilters(prev => ({ ...prev, heatmap: mode === 'heatmap' }));
  };

  const handleViewToggle = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode(prev => {
        let newView: 'map' | 'globe' | 'agent';

        if (prev === 'agent') {
          // Return to last map/globe view (default to globe)
          const lastView = localStorage.getItem('polyglobe-last-map-view') || 'globe';
          newView = lastView as 'map' | 'globe';
        } else if (prev === 'map') {
          // Map -> Globe
          localStorage.setItem('polyglobe-last-map-view', 'globe');
          newView = 'globe';
        } else {
          // Globe -> Map or to Agent mode
          // This will be handled by the individual buttons
          localStorage.setItem('polyglobe-last-map-view', 'map');
          newView = 'map';
        }

        localStorage.setItem('polyglobe-view-mode', newView);
        return newView;
      });
      setIsTransitioning(false);
    }, 150);
  };

  // Separate handler for Insights mode toggle
  const handleInsightsToggle = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode(prev => {
        let newView: 'map' | 'globe' | 'insights';

        if (prev === 'insights') {
          // Return to last map/globe view
          const lastView = localStorage.getItem('polyglobe-last-map-view') || 'globe';
          newView = lastView as 'map' | 'globe';
        } else {
          // Save current view and switch to insights
          localStorage.setItem('polyglobe-last-map-view', prev);
          newView = 'insights';
        }

        localStorage.setItem('polyglobe-view-mode', newView);
        return newView;
      });
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
    setSelectedMarket(market);
    if (market) {
      setSelectedCountry(null);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: '/',
      callback: () => {
        // Focus search input
        searchInputRef.current?.focus();
      },
      description: 'Focus search',
    },
    {
      key: 'Escape',
      callback: () => {
        // Close any open panels/modals
        if (selectedMarket) setSelectedMarket(null);
        if (selectedCountry) setSelectedCountry(null);
        if (isNotificationCenterOpen) setIsNotificationCenterOpen(false);
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isShortcutsOpen) setIsShortcutsOpen(false);
      },
      description: 'Close panel',
    },
    {
      key: ',',
      ctrl: true,
      callback: () => {
        setIsSettingsOpen(true);
      },
      description: 'Open settings',
    },
    {
      key: '?',
      shift: true,
      callback: () => {
        setIsShortcutsOpen(!isShortcutsOpen);
      },
      description: 'Show shortcuts',
    },
    {
      key: 'j',
      callback: () => {
        // Navigate to next market in list
        if (liveMapFilteredMarkets.length > 0) {
          const currentIndex = selectedMarket
            ? liveMapFilteredMarkets.findIndex(m => m.id === selectedMarket.id)
            : -1;
          const nextIndex = (currentIndex + 1) % liveMapFilteredMarkets.length;
          setSelectedMarket(liveMapFilteredMarkets[nextIndex] as EnrichedMarket);
        }
      },
      description: 'Next market',
    },
    {
      key: 'k',
      callback: () => {
        // Navigate to previous market in list
        if (liveMapFilteredMarkets.length > 0) {
          const currentIndex = selectedMarket
            ? liveMapFilteredMarkets.findIndex(m => m.id === selectedMarket.id)
            : -1;
          const prevIndex = currentIndex <= 0 
            ? liveMapFilteredMarkets.length - 1 
            : currentIndex - 1;
          setSelectedMarket(liveMapFilteredMarkets[prevIndex] as EnrichedMarket);
        }
      },
      description: 'Previous market',
    },
    {
      key: 'r',
      callback: () => {
        // Refresh - reload the page or refetch data
        window.location.reload();
      },
      description: 'Refresh',
    },
  ]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 touch-pan-y touch-pan-x">
      {/* Starfield background - only in globe mode */}
      {viewMode === 'globe' && <Starfield starCount={300} />}

      {/* Map/Globe View */}
      {viewMode !== 'insights' && (
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
            onViewChange={setIsViewModified}
            shouldResetZoom={shouldResetZoom}
            visualizationMode={visualizationMode}
          />
        </div>
      )}

      {/* Insights Dashboard View */}
      {viewMode === 'insights' && (
        <div className={`absolute inset-0 transition-opacity duration-150 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`} style={{ zIndex: 2 }}>
          <InsightsDashboard onMarketSelect={handleMarketClick} />
        </div>
      )}
      <PolyglobeUI
        onSearch={handleSearch}
        onUrlSearch={handleUrlSearch}
        onFilterChange={handleFilterChange}
        activeFilters={activeFilters}
        onViewToggle={handleInsightsToggle}
        onMapGlobeToggle={handleViewToggle}
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
        // Visualization Mode
        visualizationMode={visualizationMode}
        onVisualizationModeChange={handleVisualizationModeChange}
        // Notification Props
        onNotificationClick={() => setIsNotificationCenterOpen(true)}
        notificationCount={totalNotificationCount}
        // View Props
        isZoomedIn={isViewModified}
        onResetZoom={handleResetZoom}
        // Available markets for random selection
        availableMarkets={liveMapFilteredMarkets as EnrichedMarket[]}
        // Search input ref for keyboard shortcuts
        searchInputRef={searchInputRef}
      />

      {/* Search results are now handled inside PolyglobeUI */}

      {/* Only show MarketDetails and CountryNewsPanel in map/globe view */}
      {viewMode !== 'insights' && (
        <>
          <MarketDetails
            market={selectedMarket as any}
            onClose={() => setSelectedMarket(null)}
          />

          <CountryNewsPanel
            country={selectedCountry}
            onClose={handleCloseNews}
            onMarketSelect={handleMarketClick}
          />
        </>
      )}

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

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={isShortcutsOpen}
        onOpenChange={setIsShortcutsOpen}
      />
    </div>
  );
}









