'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { Source, Layer, Popup, NavigationControl, FullscreenControl, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { usePolyglobeData } from '@/hooks/use-polyglobe-data';
import { cn } from '@/lib/utils/cn';
import { loadGeoJSON } from '@/lib/geojson-loader';
import { Sparkline } from '@/components/ui/Sparkline';
import { Landmark, TrendingUp, CloudRain, Trophy, Cpu, Film, Activity, Globe as GlobeIcon, LayoutGrid } from 'lucide-react';

// Map categories to icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Politics': <Landmark className="w-2.5 h-2.5" />,
  'Economics': <TrendingUp className="w-2.5 h-2.5" />,
  'Weather': <CloudRain className="w-2.5 h-2.5" />,
  'Sports': <Trophy className="w-2.5 h-2.5" />,
  'Technology': <Cpu className="w-2.5 h-2.5" />,
  'Entertainment': <Film className="w-2.5 h-2.5" />,
  'Health': <Activity className="w-2.5 h-2.5" />,
  'International': <GlobeIcon className="w-2.5 h-2.5" />,
  'General': <LayoutGrid className="w-2.5 h-2.5" />,
  'Other': <LayoutGrid className="w-2.5 h-2.5" />
};

interface PolyglobeMapProps {
  activeFilters: Record<string, boolean>;
  searchQuery?: string;
  projection?: 'globe' | 'mercator';
  onCountryClick?: (countryName: string) => void;
  isPlaying?: boolean;
  rotationSpeed?: number;
  pauseOnHover?: boolean;
  overrideMarkets?: any; // GeoJSON FeatureCollection
  onZoomChange?: (isZoomed: boolean) => void;
  shouldResetZoom?: boolean;
}

// Inner component to isolate Map state from Data updates
function InnerMap({
  markets,
  rawMarkets = [],
  tweets,
  activeFilters,
  searchQuery,
  projection = 'mercator',
  onCountryClick,
  isPlaying = true,
  rotationSpeed = 0.05,
  pauseOnHover = false,
  selectedMarket,
  onMarketSelect,
  isUsingOverride = false,
  onZoomChange,
  shouldResetZoom = false
}: {
  markets: any;
  rawMarkets?: any[];
  tweets: any;
  activeFilters: Record<string, boolean>;
  searchQuery: string;
  projection?: 'globe' | 'mercator';
  onCountryClick?: (countryName: string) => void;
  isPlaying?: boolean;
  rotationSpeed?: number;
  pauseOnHover?: boolean;
  selectedMarket?: any;
  onMarketSelect?: (market: any) => void;
  isUsingOverride?: boolean;
  onZoomChange?: (isZoomed: boolean) => void;
  shouldResetZoom?: boolean;
}) {
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: projection === 'mercator' ? 20 : 0,
    zoom: 2.5,
    pitch: 0,
    bearing: 0
  });

  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rotationAnimationRef = useRef<number | null>(null);
  const mapRef = useRef<MapRef>(null);

  // Detect zoom level changes
  const DEFAULT_ZOOM = 2.5;
  const ZOOM_THRESHOLD = 0.3; // Consider zoomed if zoom > DEFAULT_ZOOM + THRESHOLD

  useEffect(() => {
    if (onZoomChange) {
      const isZoomed = viewState.zoom > DEFAULT_ZOOM + ZOOM_THRESHOLD;
      onZoomChange(isZoomed);
    }
  }, [viewState.zoom, onZoomChange]);

  // Handle reset zoom request
  useEffect(() => {
    if (shouldResetZoom && mapRef.current) {
      const map = mapRef.current.getMap();
      if (map) {
        map.flyTo({
          center: [0, projection === 'mercator' ? 20 : 0],
          zoom: DEFAULT_ZOOM,
          pitch: 0,
          bearing: 0,
          duration: 1000
        });
      }
    }
  }, [shouldResetZoom, projection]);

  // Auto-rotate globe
  useEffect(() => {
    // Return early if paused or user is interacting
    if (!isPlaying || isUserInteracting) {
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }
      return;
    }

    let lastTime = performance.now();
    const rotationSpeedVal = 0.05;

    const rotate = (currentTime: number) => {
      // Pause if:
      // 1. User is interacting (dragging/zooming)
      // 2. A market is selected (we are focused on it)
      // 3. Pause on Hover is enabled AND mouse is hovering
      const shouldPause = isUserInteracting || !!selectedMarket || (pauseOnHover && isHovering);

      if (!isPlaying || shouldPause) {
        rotationAnimationRef.current = null;
        return;
      }

      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      setViewState(prev => ({
        ...prev,
        longitude: (prev.longitude + rotationSpeedVal * (deltaTime / 16.67)) % 360,
      }));

      rotationAnimationRef.current = requestAnimationFrame(rotate);
    };

    rotationAnimationRef.current = requestAnimationFrame(rotate);

    return () => {
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }
    };
  }, [isPlaying, isUserInteracting, isHovering, pauseOnHover, rotationSpeed, selectedMarket]);

  // Track when selection changes to prevent immediate closure during fly-in
  const lastSelectionTimeRef = useRef(0);

  useEffect(() => {
    if (selectedMarket) {
      lastSelectionTimeRef.current = Date.now();
    }
  }, [selectedMarket]);

  // Handle manual zoom out to close panel
  useEffect(() => {
    // If we have a selected market, the user is interacting, and they zoom out below a threshold
    // KEY FIX: Ensure we don't trigger this during the initial "fly-in" animation (2 second grace period)
    const isInGracePeriod = Date.now() - lastSelectionTimeRef.current < 2000;

    if (selectedMarket && isUserInteracting && viewState.zoom < 3.5 && !isInGracePeriod) {
      console.log('[InnerMap] Users zoomed out, deselecting market');
      if (onMarketSelect) {
        onMarketSelect(null);
      }
    }
  }, [selectedMarket, isUserInteracting, viewState.zoom, onMarketSelect]);

  // Interaction Handlers
  const handleInteractionStart = useCallback((e?: any) => {
    // If event is provided and has no originalEvent, it's likely programmatic (flyTo) - ignore
    if (e && typeof e === 'object' && 'originalEvent' in e && !e.originalEvent) {
      return;
    }

    setIsUserInteracting(true);
    if (rotationAnimationRef.current) {
      cancelAnimationFrame(rotationAnimationRef.current);
      rotationAnimationRef.current = null;
    }
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  }, []);

  const handleInteractionEnd = useCallback(() => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 3000);
  }, []);

  const [cursor, setCursor] = useState<string>('grab');
  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    setCursor('grabbing');
    handleInteractionStart();
  }, [handleInteractionStart]);

  const handleDragEnd = useCallback(() => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
    setCursor('grab');
    handleInteractionEnd();
  }, [handleInteractionEnd]);

  const onMouseEnter = useCallback(() => setCursor('pointer'), []);
  const onMouseLeave = useCallback(() => setCursor('grab'), []);

  const [hoverInfo, setHoverInfo] = useState<{
    feature: any;
    x: number;
    y: number;
  } | null>(null);

  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [countryBorders, setCountryBorders] = useState<any>(null);

  useEffect(() => {
    loadGeoJSON().then(data => {
      setCountryBorders(data);
    }).catch(err => {
      console.error('Failed to load country borders:', err);
    });
  }, []);

  const onHover = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features && event.features[0];
    setHoverInfo(
      feature
        ? {
          feature,
          x: event.point.x,
          y: event.point.y
        }
        : null
    );
    if (!isDraggingRef.current) {
      setCursor(feature ? 'pointer' : 'grab');
    }
  }, []);

  // Handle card click (internal or from map marker)
  const handleCardClick = (market: any) => {
    if (onMarketSelect) {
      onMarketSelect(market);
    }
  };

  const onClick = useCallback(async (event: MapLayerMouseEvent) => {
    console.log('[InnerMap] onClick triggered, isDragging:', isDraggingRef.current, 'features:', event.features?.length);

    if (isDraggingRef.current) return;

    // Check for feature clicks first
    const feature = event.features && event.features.length > 0 ? event.features[0] : null;

    if (feature) {
      console.log('[InnerMap] Feature detected, layer:', feature.layer.id);

      if (feature.layer.id === 'markets-layer' || feature.layer.id === 'markets-glow-layer') {
        const marketId = feature.properties?.id;
        console.log('[InnerMap] Market clicked, ID:', marketId);

        // Try to find full market data in rawMarkets (default view) OR from the feature properties itself (search view)
        let market = rawMarkets?.find((m: any) => m.id === marketId);

        // If market not found in rawMarkets, reconstruct from feature properties
        // This happens when using override markets (database/geotagged markets)
        if (!market) {
          console.log('[InnerMap] Market not found in rawMarkets, reconstructing from feature properties');

          // Parse rawData if it's a JSON string
          let rawData = feature.properties.rawData;
          if (typeof rawData === 'string') {
            try {
              rawData = JSON.parse(rawData);
            } catch (e) {
              console.warn('[InnerMap] Failed to parse rawData:', e);
              rawData = {};
            }
          }

          market = {
            id: feature.properties.id || feature.properties.market_id,
            title: feature.properties.title,
            description: feature.properties.description || '',
            platform: feature.properties.platform,
            volume24h: feature.properties.volume || feature.properties.volume24h,
            price: feature.properties.last_price || feature.properties.price,
            probability: feature.properties.last_price || feature.properties.price,
            liquidity: feature.properties.liquidity,
            endDate: feature.properties.endDate,
            slug: feature.properties.slug,
            ticker: feature.properties.ticker,
            category: feature.properties.category,
            rawData: rawData || {},
          };
          console.log('[InnerMap] Reconstructed market:', market);
        }

        if (market) {
          console.log('[InnerMap] Calling handleCardClick');
          handleCardClick(market);
          setSelectedFeature(null);
        }
        // CRITICAL: Stop propagation to prevent country click
        return;
      } else if (feature.layer.id !== 'markets-heatmap') {
        // Handle other clickable layers (like tweets)
        setSelectedFeature(feature);
        return;
      }
    }

    setSelectedFeature(null);

    // Only proceed to country click if NO feature was clicked
    if (onCountryClick && event.lngLat) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${event.lngLat.lat}&lon=${event.lngLat.lng}&zoom=3&addressdetails=1`,
          { headers: { 'User-Agent': 'EdgePannel/1.0' } }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.address && data.address.country) {
            onCountryClick(data.address.country);
          }
        }
      } catch (error) {
        console.error('Error detecting country:', error);
      }
    }
  }, [onCountryClick, rawMarkets]);

  // Filter data
  const filteredMarkets = useMemo(() => {
    // Handle both direct array of features and FeatureCollection object
    let features = Array.isArray(markets) ? markets : (markets?.features || []);

    console.log('[InnerMap] Initial features count:', features.length);
    console.log('[InnerMap] isUsingOverride:', isUsingOverride);
    console.log('[InnerMap] activeFilters:', activeFilters);

    // IMPORTANT: When using override markets (category/platform filters active),
    // we should always show them regardless of "live" toggle state
    // The "live" toggle only affects the default global view
    if (!isUsingOverride) {
      // Only apply live filter when NOT using category/platform overrides
      if (!activeFilters.live && !activeFilters.heatmap) {
        console.log('[InnerMap] Clearing features because live is off and not using override');
        features = [];
      }
    } else {
      console.log('[InnerMap] Using override, keeping all features regardless of live toggle');
    }

    // Filter for active/breaking - apply to all cases
    if (activeFilters.breaking) {
      const beforeCount = features.length;
      features = features.filter((f: any) =>
        (f.properties.volume > 50000) || f.properties.price_movement > 0.05
      );
      console.log('[InnerMap] Breaking filter applied:', beforeCount, '->', features.length);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const beforeCount = features.length;
      features = features.filter((f: any) =>
        (f.properties.title || '').toLowerCase().includes(q) ||
        (f.properties.description || '').toLowerCase().includes(q)
      );
      console.log('[InnerMap] Search filter applied:', beforeCount, '->', features.length);
    }

    console.log('[InnerMap] Final filtered features:', features.length);
    return { type: 'FeatureCollection', features };
  }, [markets, activeFilters, searchQuery, isUsingOverride]);

  const filteredTweets = useMemo(() => {
    if (!activeFilters.osint) return { type: 'FeatureCollection', features: [] };
    return tweets;
  }, [tweets, activeFilters.osint]);

  // Layers
  const marketLayer = {
    id: 'markets-layer',
    type: 'circle',
    paint: {
      'circle-color': [
        'case',
        ['==', ['get', 'platform'], 'kalshi'], '#00d26a', // Kalshi Green
        '#2b7fff' // Polymarket Blue default
      ],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'volume'],
        0, 3,
        100000, 6,
        1000000, 12,
        10000000, 20
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 1
    }
  };

  const marketGlowLayer = {
    id: 'markets-glow-layer',
    type: 'circle',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'volume'],
        0, 6,
        100000, 15,
        1000000, 25,
        10000000, 40
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'platform'], 'kalshi'], '#00d26a',
        '#2b7fff'
      ],
      'circle-opacity': 0.3,
      'circle-blur': 0.5
    }
  };

  const heatmapLayer = {
    id: 'markets-heatmap',
    type: 'heatmap',
    paint: {
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['get', 'volume'],
        0, 0,
        1000, 0.5,
        10000, 0.8,
        100000, 1
      ],
      'heatmap-intensity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 1,
        9, 3
      ],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0,0,0,0)',
        0.2, '#3b82f6',
        0.4, '#06b6d4',
        0.6, '#10b981',
        0.8, '#f59e0b',
        1, '#ef4444'
      ],
      'heatmap-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 8,
        9, 30
      ],
      'heatmap-opacity': 0.8
    }
  };

  const tweetLayer = {
    id: 'tweets-layer',
    type: 'circle',
    paint: {
      'circle-radius': 5,
      'circle-color': '#ef4444',
      'circle-opacity': 0.9,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.5
    }
  };

  const renderPopup = () => {
    const feature = selectedFeature || (hoverInfo && hoverInfo.feature);
    if (!feature) return null;

    const props = feature.properties;
    const [lon, lat] = feature.geometry.coordinates;
    const isMarket = feature.layer.id === 'markets-layer' || feature.layer.id === 'markets-glow-layer';

    return (
      <Popup
        longitude={lon}
        latitude={lat}
        closeButton={false}
        closeOnClick={false}
        onClose={() => setSelectedFeature(null)}
        anchor="top"
        className="polyglobe-popup z-50"
        maxWidth="280px"
      >
        <div className="bg-gradient-to-br from-gray-900/98 via-gray-900/95 to-gray-950/98 border border-gray-700/50 rounded-lg p-3 text-white shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Gradient overlay for modern effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>

          {isMarket ? (
            <div className="relative z-10">
              {/* Price Badge - Floating top right */}
              <div className="absolute -top-1 -right-1 bg-gradient-to-br from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg">
                <span className="text-xl font-bold tabular-nums">{Math.round(props.last_price * 100)}¢</span>
              </div>

              {/* Title */}
              <div className="pr-16 mb-3">
                <h3 className="font-semibold text-base leading-tight text-white line-clamp-2">{props.title}</h3>
              </div>

              {/* Platform & Category Badge Row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm",
                  props.platform === 'polymarket'
                    ? "bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 border border-blue-400/30"
                    : "bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-300 border border-green-400/30"
                )}>
                  {props.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                </span>
                {props.category && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-700/40 text-gray-300 border border-gray-600/30">
                    {props.category.charAt(0).toUpperCase() + props.category.slice(1)}
                  </span>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-800/40 rounded-lg p-2 border border-gray-700/30">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Volume 24h</div>
                  <div className="text-sm font-bold text-white">${(props.volume / 1000).toFixed(1)}k</div>
                </div>
                {props.price_movement !== undefined && props.price_movement !== 0 && (
                  <div className="bg-gray-800/40 rounded-lg p-2 border border-gray-700/30">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">24h Change</div>
                    <div className={cn(
                      "text-sm font-bold",
                      props.price_movement >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {props.price_movement > 0 ? '+' : ''}{Math.round(props.price_movement * 100)}%
                    </div>
                  </div>
                )}
              </div>

              {/* End Date */}
              {props.endDate && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Ends {new Date(props.endDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}</span>
                </div>
              )}

              {/* Chart */}
              {JSON.parse(props.priceHistory || '[]').length > 0 && (
                <div className="mb-3">
                  <div className="bg-black/30 rounded-lg p-2 border border-gray-700/20">
                    <Sparkline
                      data={JSON.parse(props.priceHistory || '[]').map((p: any) => p.price)}
                      width={240}
                      height={40}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* CTA Button */}
              <button
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                onClick={(e) => {
                  e.stopPropagation();
                  // Find full market data or reconstruct from properties
                  const marketId = props.id || props.market_id;
                  let market = rawMarkets?.find((m: any) => m.id === marketId);

                  // If not found, reconstruct from feature properties (for geotagged markets)
                  if (!market) {
                    let rawData = props.rawData;
                    if (typeof rawData === 'string') {
                      try {
                        rawData = JSON.parse(rawData);
                      } catch (e) {
                        rawData = {};
                      }
                    }

                    market = {
                      id: props.id || props.market_id,
                      title: props.title,
                      description: props.description || '',
                      platform: props.platform,
                      volume24h: props.volume || props.volume24h,
                      price: props.last_price || props.price,
                      probability: props.last_price || props.price,
                      liquidity: props.liquidity,
                      endDate: props.endDate,
                      slug: props.slug,
                      ticker: props.ticker,
                      category: props.category,
                      rawData: rawData || {},
                    };
                  }

                  if (market) {
                    handleCardClick(market);
                  }
                }}
              >
                VIEW DETAILS →
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{props.handle}</div>
                  <div className="text-[10px] text-gray-400">{props.timestamp}</div>
                </div>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed font-sans border-t border-gray-800 pt-2 mt-2">
                {props.text}
              </p>
            </>
          )}
        </div>
      </Popup>
    );
  };

  // Handle selectedMarket padding
  useEffect(() => {
    if (selectedMarket && selectedMarket.location && selectedMarket.location.coordinates) {
      const { lat, lng } = selectedMarket.location.coordinates;
      const map = mapRef.current?.getMap();
      if (map) {
        map.flyTo({
          center: [lng, lat],
          zoom: 6,
          duration: 2000,
          padding: { right: 400, top: 0, bottom: 0, left: 0 }
        });
      }
    } else if (!selectedMarket) {
      const map = mapRef.current?.getMap();
      if (map) {
        map.easeTo({
          padding: { right: 0, top: 0, bottom: 0, left: 0 },
          duration: 1000
        });
      }
    }
  }, [selectedMarket]);

  // Handle projection change
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map && map.setProjection) {
      map.setProjection(projection === 'globe' ? { type: 'globe' } : { type: 'mercator' });

      // Reset viewState to appropriate values for the new projection
      // Use flyTo for smooth transition
      if (projection === 'globe') {
        // For globe: reset to world view
        map.flyTo({
          center: [viewState.longitude, 0],
          zoom: 2.5,
          pitch: 0,
          bearing: 0,
          duration: 800
        });
      } else {
        // For mercator: reset to slightly higher latitude
        map.flyTo({
          center: [viewState.longitude, 20],
          zoom: 2.5,
          pitch: 0,
          bearing: 0,
          duration: 800
        });
      }
    }
  }, [projection]);

  // Debug: Log map and layer state on load
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      map.on('load', () => {
        console.log('[InnerMap] Map loaded');
        console.log('[InnerMap] Available layers:', map.getStyle()?.layers?.map((l: any) => l.id));
      });

      // Also check layers after a delay to ensure they're rendered
      setTimeout(() => {
        console.log('[InnerMap] Layers after timeout:', map.getStyle()?.layers?.map((l: any) => l.id));
        console.log('[InnerMap] interactiveLayerIds:', activeFilters.heatmap ? [] : ['markets-layer', 'tweets-layer']);
      }, 2000);
    }
  }, [mapRef.current, activeFilters.heatmap]);

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: projection === 'globe' ? 'transparent' : '#030712' }}>
      <Map
        ref={mapRef}
        {...viewState}
        cursor={cursor}
        onMove={evt => {
          setViewState(evt.viewState);
          if (evt.viewState.longitude !== viewState.longitude && isUserInteracting) {
            handleInteractionStart();
          }
        }}
        onMoveStart={handleInteractionStart}
        onMoveEnd={handleInteractionEnd}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrag={handleInteractionStart}
        onZoomStart={handleInteractionStart}
        onZoomEnd={handleInteractionEnd}
        onRotateStart={handleInteractionStart}
        onRotateEnd={handleInteractionEnd}
        onPitchStart={handleInteractionStart}
        onPitchEnd={handleInteractionEnd}
        onMouseDown={(e) => {
          console.log('[InnerMap] onMouseDown fired');
          handleInteractionStart(e);
        }}
        onTouchStart={handleInteractionStart}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onHover}
        onClick={(e) => {
          console.log('[InnerMap] onClick PROP FIRED');
          onClick(e);
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://api.maptiler.com/maps/darkmatter/style.json?key=35TZqSTSBjgDvsawKAK9"
        attributionControl={false}
        interactiveLayerIds={activeFilters.heatmap ? [] : ['markets-glow-layer', 'tweets-layer']}
      >
        <NavigationControl position="bottom-right" />
        <FullscreenControl position="bottom-right" />

        <Source id="markets" type="geojson" data={filteredMarkets as any}>
          {activeFilters.heatmap ? (
            <Layer {...heatmapLayer as any} source="markets" />
          ) : (
            <>
              <Layer {...marketLayer as any} source="markets" />
              <Layer {...marketGlowLayer as any} source="markets" />
            </>
          )}
        </Source>

        <Source id="tweets" type="geojson" data={filteredTweets as any}>
          <Layer {...tweetLayer as any} />
        </Source>

        {countryBorders && (
          <Source id="country-borders" type="geojson" data={countryBorders as any}>
            <Layer
              id="country-borders-layer"
              type="line"
              paint={{
                'line-color': '#ffffff',
                'line-width': 0.5,
                'line-opacity': 0.5
              }}
            />
          </Source>
        )}

        {renderPopup()}
      </Map>
      <style jsx global>{`
        .maplibregl-popup-content {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .maplibregl-popup-tip {
          border-top-color: rgba(17, 24, 39, 0.95) !important;
        }
      `}</style>
    </div >
  );
}

export function PolyglobeMap({
  activeFilters,
  searchQuery = '',
  projection = 'mercator',
  onCountryClick,
  isPlaying = true,
  rotationSpeed = 0.05,
  pauseOnHover = false,
  selectedMarket,
  onMarketSelect,
  overrideMarkets,
  onZoomChange,
  shouldResetZoom
}: PolyglobeMapProps & {
  selectedMarket?: any;
  onMarketSelect?: (market: any) => void;
}) {
  const { markets, tweets, rawMarkets } = usePolyglobeData();
  const [mounted, setMounted] = useState(false);

  // If overrideMarkets is provided, use it, otherwise default.
  // ALSO, if a market is selected, ensure it's included in the display list so it can be seen/focused.
  const displayMarkets = useMemo(() => {
    const base = overrideMarkets || markets;

    console.log('[PolyglobeMap] overrideMarkets provided:', !!overrideMarkets);
    console.log('[PolyglobeMap] overrideMarkets count:', overrideMarkets ? (Array.isArray(overrideMarkets) ? overrideMarkets.length : overrideMarkets?.features?.length) : 0);
    console.log('[PolyglobeMap] Using displayMarkets source:', overrideMarkets ? 'override' : 'default');

    if (!selectedMarket) return base;

    // Check if selectedMarket is already in base list
    // base can be array or FeatureCollection. Normalize to array for check.
    const baseFeatures = Array.isArray(base) ? base : (base?.features || []);
    const exists = baseFeatures.find((f: any) =>
      (f.properties?.id === selectedMarket.id) || (f.id === selectedMarket.id)
    );

    if (exists) return base;

    // If not exists, add it. We need to convert selectedMarket to GeoJSON feature first if it isn't one.
    // selectedMarket is usually EnrichedMarket object.
    // We can rely on marketsToGeoJSON utils or manual creation.
    // For now, let's just assume we need to add it.
    // However, selectedMarket from onMarketSelect might not be a Feature.
    // We should probably rely on the parent (Page) to ensure selectedMarket is a Feature or pass it correctly.
    // But selectedMarket here is `any` (likely EnrichedMarket).

    // Actually, creating a feature on the fly here is risky without the helper.
    // Let's just trust the parent for now, OR better:
    // Page.tsx should handle this logic.
    return base;
  }, [overrideMarkets, markets, selectedMarket]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <InnerMap
      markets={displayMarkets}
      rawMarkets={rawMarkets}
      tweets={tweets}
      activeFilters={activeFilters}
      searchQuery={searchQuery}
      projection={projection}
      onCountryClick={onCountryClick}
      isPlaying={isPlaying}
      rotationSpeed={rotationSpeed}
      pauseOnHover={pauseOnHover}
      selectedMarket={selectedMarket}
      onMarketSelect={onMarketSelect}
      isUsingOverride={!!overrideMarkets}
      onZoomChange={onZoomChange}
      shouldResetZoom={shouldResetZoom}
    />
  );
}
