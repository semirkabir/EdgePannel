'use client';

import { MarketCardStack } from '@/components/edge/MarketCardStack';
import { EnrichedMarket } from '@/lib/markets/enrich';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EdgeMap } from '@/components/edge/EdgeMap';
import { EdgeUI, type VisualizationMode } from '@/components/edge/EdgeUI';
import { CountryNewsPanel } from '@/components/edge/CountryNewsPanel';
import { Starfield } from '@/components/edge/Starfield';
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
import { useUserSettings } from '@/hooks/use-user-settings';


export default function EdgePage() {
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    breaking: false,
    live: true,
    fires: false,
    heatmap: false,
    noiseFilter: false // Hide low liquidity markets
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<EnrichedMarket | null>(null);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  // User Preferences
  const { preferences, updatePreferences } = useUserSettings();

  // Use preferences with local fallback/sync
  const [viewMode, setViewMode] = useState<'map' | 'globe' | 'insights' | 'agent'>(preferences.viewMode || 'globe');
  const [isPlaying, setIsPlaying] = useState(preferences.autoRotate);
  const [rotationSpeed, setRotationSpeed] = useState(preferences.rotationSpeed);
  const [pauseOnHover, setPauseOnHover] = useState(preferences.pauseOnHover);
  const [showLabels, setShowLabels] = useState(preferences.showLabels);
  const [showGrid, setShowGrid] = useState(preferences.showGrid);


  // Sync state when preferences load
  useEffect(() => {
    if (preferences) {
      if (preferences.viewMode) setViewMode(preferences.viewMode);
      setIsPlaying(preferences.autoRotate);
      setRotationSpeed(preferences.rotationSpeed);
      setPauseOnHover(preferences.pauseOnHover);
      setShowLabels(preferences.showLabels);
      setShowGrid(preferences.showGrid);
    }

  }, [preferences]);


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
    // Immediately clear the view modified state so reset button disappears
    // The shouldResetZoom flag will be cleared after animation completes
    setIsZoomedIn(false);
    setIsViewModified(false);
    // Reset the trigger after the animation completes (1000ms + buffer)
    // Must wait for flyTo animation to complete before clearing the trigger
    setTimeout(() => {
      setShouldResetZoom(false);
    }, 1100);
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
      console.log('[Edge] Created default whale alert for $5000+ trades');
    }
  }, [whaleAlertsLoaded, whaleAlerts.length, createGlobalAlert]);

  // 1. Search for Dropdown
  const { markets: searchResults, isLoading: isSearching } = useSearch({
    q: searchQuery,
    platform: selectedPlatform,
    limit: 10,
  });

  // 2. Fetch geotagged markets (only what's needed for display + WebSocket performance)
  const isAllCategories = selectedCategories.includes('All') || selectedCategories.length === 0;
  const { markets: geotaggedMarkets, isLoading: isGeotaggedLoading, error: geotaggedError, total: geotaggedTotal } = useGeotaggedMarkets({
    category: !isAllCategories && selectedCategories.length > 0 ? selectedCategories[0] : undefined,
    platform: selectedPlatform === 'all' ? undefined : selectedPlatform,
    limit: 500, // Reduced from 2000 to improve performance and prevent WebSocket issues
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
          price_movement: (update.price && m.price) ? (update.price - m.price) / m.price : ((m as any).price_movement || 0)
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
  }, [liveMapFilteredMarkets, selectedMarket]);

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);


  // Sync settings when they change
  const handleSetIsPlaying = (playing: boolean) => {
    setIsPlaying(playing);
    updatePreferences({ autoRotate: playing });
  };

  const handleSetRotationSpeed = (speed: number) => {
    setRotationSpeed(speed);
    updatePreferences({ rotationSpeed: speed });
  };

  const handleSetPauseOnHover = (pause: boolean) => {
    setPauseOnHover(pause);
    updatePreferences({ pauseOnHover: pause });
  };

  const handleSetViewMode = (mode: 'map' | 'globe' | 'insights' | 'agent') => {
    setViewMode(mode);
    updatePreferences({ viewMode: mode });
  };

  const handleSetShowLabels = (show: boolean) => {
    setShowLabels(show);
    updatePreferences({ showLabels: show });
  };

  const handleSetShowGrid = (show: boolean) => {
    setShowGrid(show);
    updatePreferences({ showGrid: show });
  };



  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Handle URL-based market search
  const handleUrlSearch = async (url: string) => {
    const parsed = parseMarketUrl(url);
    if (!parsed) return;

    console.log('[Edge] Fetching market from URL:', parsed);

    try {
      const response = await fetch(
        `/api/markets/by-url?platform=${parsed.platform}&identifier=${encodeURIComponent(parsed.identifier)}&type=${parsed.type}`
      );

      if (!response.ok) {
        console.error('[Edge] Failed to fetch market from URL:', response.statusText);
        return;
      }

      const data = await response.json();
      if (data.market) {
        setSelectedMarket(data.market);
        setSelectedCountry(null);
      }
    } catch (error) {
      console.error('[Edge] Error fetching market from URL:', error);
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
          localStorage.setItem('edge-last-map-view', 'globe');
          newView = 'globe';
        } else {
          // Globe -> Map or to Agent mode
          // This will be handled by the individual buttons
          localStorage.setItem('edge-last-map-view', 'map');
          newView = 'map';
        }

        localStorage.setItem('polyglobe-view-mode', newView);
        updatePreferences({ viewMode: newView });
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
          localStorage.setItem('edge-last-map-view', prev);
          newView = 'insights';
        }

        localStorage.setItem('polyglobe-view-mode', newView);
        updatePreferences({ viewMode: newView });
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
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950">
      {/* Starfield background - only in globe mode */}
      {viewMode === 'globe' && <Starfield starCount={300} />}

      {/* Map/Globe View */}
      {viewMode !== 'insights' && (
        <div className={`absolute inset-0 transition-opacity duration-150 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`} style={{ zIndex: 10 }}>
          <EdgeMap
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
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
        <EdgeUI
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
      </div>

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
        onRotationSpeedChange={handleSetRotationSpeed}
        pauseOnHover={pauseOnHover}
        onPauseOnHoverChange={handleSetPauseOnHover}
        autoRotate={isPlaying}
        onAutoRotateChange={handleSetIsPlaying}
        showLabels={showLabels}
        onShowLabelsChange={handleSetShowLabels}
        showGrid={showGrid}
        onShowGridChange={handleSetShowGrid}
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









