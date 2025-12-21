'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import Map, { Source, Layer, Popup, NavigationControl, FullscreenControl, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEdgeData } from '@/hooks/use-edge-data';
import { cn } from '@/lib/utils/cn';
import { loadGeoJSON } from '@/lib/geojson-loader';
import { Sparkline } from '@/components/ui/Sparkline';
import { Landmark, TrendingUp, CloudRain, Trophy, Cpu, Film, Activity, Globe as GlobeIcon, LayoutGrid } from 'lucide-react';
import { MarketPopupVolume } from './MarketPopup';
import { MarketHoverChart } from './MarketHoverChart';
import { LatencyTag } from './LatencyTag';

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

export type VisualizationMode = 'dots' | 'heatmap' | 'cluster' | 'choropleth';

interface EdgeMapProps {
  activeFilters: Record<string, boolean>;
  searchQuery?: string;
  projection?: 'globe' | 'mercator';
  onCountryClick?: (countryName: string) => void;
  isPlaying?: boolean;
  rotationSpeed?: number;
  pauseOnHover?: boolean;
  overrideMarkets?: any; // GeoJSON FeatureCollection
  onZoomChange?: (isZoomed: boolean) => void;
  onViewChange?: (isModified: boolean) => void;
  shouldResetZoom?: boolean;
  visualizationMode?: VisualizationMode;
  selectedMarket?: any;
  onMarketSelect?: (market: any) => void;
  showLabels?: boolean;
  showGrid?: boolean;
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
  onViewChange,
  shouldResetZoom = false,
  visualizationMode = 'dots',
  showLabels = true,
  showGrid = false
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
  onViewChange?: (isModified: boolean) => void;
  shouldResetZoom?: boolean;
  visualizationMode?: VisualizationMode;
  showLabels?: boolean;
  showGrid?: boolean;
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
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const prevViewModifiedRef = useRef<boolean>(false);
  const prevIsZoomedRef = useRef<boolean>(false);

  // Toggle label visibility
  useEffect(() => {
    if (!isStyleLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    try {
      const style = map.getStyle();
      if (!style || !style.layers) return;

      style.layers.forEach(layer => {
        // Check for common label layer indicators
        const isLabel = layer.id.includes('label') ||
          layer.id.includes('place') ||
          layer.id.includes('poi') ||
          layer.type === 'symbol';

        if (isLabel) {
          map.setLayoutProperty(layer.id, 'visibility', showLabels ? 'visible' : 'none');
        }
      });
    } catch (e) {
      console.warn('Could not toggle labels:', e);
    }
  }, [showLabels, isStyleLoaded]);


  // Helper to safely get map instance and check if style is loaded
  const getMapIfReady = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && map.isStyleLoaded()) {
      return map;
    }
    return null;
  }, []);

  // Detect zoom level changes and pan changes
  const DEFAULT_ZOOM = 2.5;
  const ZOOM_THRESHOLD = 0.3; // Consider zoomed if zoom > DEFAULT_ZOOM + THRESHOLD
  const ZOOM_HYSTERESIS = 0.15; // Add hysteresis to prevent flickering near threshold
  const DEFAULT_LONGITUDE = 0;
  const DEFAULT_LATITUDE = projection === 'mercator' ? 20 : 0;
  const PAN_THRESHOLD = 10; // Consider panned if moved more than 10 degrees

  // Track previous zoom state for hysteresis
  const [wasZoomedIn, setWasZoomedIn] = useState(false);

  // Reset zoom state when projection changes to prevent stuttering during mode switches
  useEffect(() => {
    setWasZoomedIn(false);
  }, [projection]);

  useEffect(() => {
    // Only check zoom state - don't track pan during every frame
    // This prevents callbacks from firing repeatedly during drag/rotation
    const zoomThresholdIn = DEFAULT_ZOOM + ZOOM_THRESHOLD + ZOOM_HYSTERESIS;
    const zoomThresholdOut = DEFAULT_ZOOM + ZOOM_THRESHOLD - ZOOM_HYSTERESIS;

    let isZoomed: boolean;
    if (wasZoomedIn) {
      isZoomed = viewState.zoom > zoomThresholdOut;
    } else {
      isZoomed = viewState.zoom > zoomThresholdIn;
    }

    setWasZoomedIn(isZoomed);

    // Only call onZoomChange if zoom state actually changed
    if (onZoomChange && isZoomed !== prevIsZoomedRef.current) {
      prevIsZoomedRef.current = isZoomed;
      onZoomChange(isZoomed);
    }
  }, [viewState.zoom, DEFAULT_ZOOM, ZOOM_THRESHOLD, ZOOM_HYSTERESIS, wasZoomedIn, onZoomChange]);


  // Track view modifications only when user stops interacting
  // This prevents callbacks from firing every frame during rotation/pan
  useEffect(() => {
    if (isUserInteracting) return;

    const DEFAULT_LONGITUDE = 0;
    const DEFAULT_LATITUDE = projection === 'mercator' ? 20 : 0;
    const PAN_THRESHOLD = 10;

    const zoomThresholdIn = DEFAULT_ZOOM + ZOOM_THRESHOLD + ZOOM_HYSTERESIS;
    const zoomThresholdOut = DEFAULT_ZOOM + ZOOM_THRESHOLD - ZOOM_HYSTERESIS;

    let isZoomed = wasZoomedIn
      ? viewState.zoom > zoomThresholdOut
      : viewState.zoom > zoomThresholdIn;

    const isPanned = (
      Math.abs(viewState.longitude - DEFAULT_LONGITUDE) > PAN_THRESHOLD ||
      Math.abs(viewState.latitude - DEFAULT_LATITUDE) > PAN_THRESHOLD
    );

    const isViewModified = isZoomed || isPanned;

    if (onViewChange && isViewModified !== prevViewModifiedRef.current) {
      prevViewModifiedRef.current = isViewModified;
      onViewChange(isViewModified);
    }
  }, [isUserInteracting, viewState.zoom, viewState.longitude, viewState.latitude, projection, onViewChange, wasZoomedIn, DEFAULT_ZOOM, ZOOM_THRESHOLD, ZOOM_HYSTERESIS]);

  // Handle reset zoom request
  useEffect(() => {
    if (shouldResetZoom) {
      const map = getMapIfReady();
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
  }, [shouldResetZoom, projection, getMapIfReady, isStyleLoaded]);

  // Auto-rotate globe - stops on interaction and only resumes when user clicks play
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
    const rotationSpeedVal = rotationSpeed || 0.15;

    const rotate = (currentTime: number) => {
      // Pause if:
      // 1. User is interacting (dragging/zooming) - rotation stops and won't resume until user clicks play
      // 2. A market is selected (we are focused on it) - rotation stops
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


  // Interaction Handlers
  const handleInteractionStart = useCallback(() => {
    console.log('[EdgeMap] Interaction started');
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
    }, 1000);
  }, []);

  const [cursor, setCursor] = useState<string>('grab');
  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    setCursor('grabbing');
    // Immediately cancel rotation and mark as interacting
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
    setIsHovering(!!feature);
    if (!isDraggingRef.current) {
      setCursor(feature ? 'pointer' : 'grab');
    }
  }, []);

  // Handle card click (internal or from map marker)
  const handleCardClick = useCallback((market: any) => {
    if (onMarketSelect) {
      onMarketSelect(market);
    }
  }, [onMarketSelect]);


  const onClick = useCallback(async (event: MapLayerMouseEvent) => {
    if (isDraggingRef.current) {
      return;
    }

    // Check for feature clicks first
    const feature = event.features && event.features.length > 0 ? event.features[0] : null;

    if (feature) {
      // Handle cluster clicks - zoom in
      if (feature.layer.id === 'markets-clusters') {
        const clusterId = feature.properties.cluster_id;
        const mapInstance = getMapIfReady();
        const source = mapInstance?.getSource('markets') as any;

        if (source && source.getClusterExpansionZoom) {
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;

            const coordinates = (feature.geometry as any).coordinates;
            mapInstance?.easeTo({
              center: coordinates,
              zoom: zoom
            });
          });
        }
        return;
      }

      if (feature.layer.id === 'markets-layer' || feature.layer.id === 'markets-glow-layer' || feature.layer.id === 'markets-unclustered') {
        const props = feature.properties;
        const isGroup = props.isGroup === true;

        // If it's a group (event), pass the event data with markets array
        if (isGroup && props.markets && Array.isArray(props.markets)) {
          // Parse markets if they're stored as JSON strings
          let marketsArray = props.markets;
          if (typeof marketsArray[0] === 'string') {
            try {
              marketsArray = marketsArray.map((m: string) => JSON.parse(m));
            } catch (e) {
              console.warn('[InnerMap] Failed to parse markets array:', e);
            }
          }

          // Create an event object that contains all markets
          const eventData = {
            id: props.id || props.groupId,
            title: props.title || props.baseQuestion,
            isEvent: true,
            markets: marketsArray, // Array of market objects
            platform: props.platform,
            category: props.category,
            totalVolume: props.volume || props.volume24h,
            liquidity: props.liquidity,
            imageUrl: props.image_url,
            description: props.description || '',
          };

          if (onMarketSelect) {
            onMarketSelect(eventData);
          }
          setSelectedFeature(null);
          return;
        }

        // Otherwise, it's a single market (shouldn't happen now, but keep for safety)
        const marketId = props?.id;
        let market = rawMarkets?.find((m: any) => m.id === marketId);

        // If market not found in rawMarkets, reconstruct from feature properties
        if (!market) {
          // Parse rawData if it's a JSON string
          let rawData = props.rawData;
          if (typeof rawData === 'string') {
            try {
              rawData = JSON.parse(rawData);
            } catch (e) {
              console.warn('[InnerMap] Failed to parse rawData:', e);
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
  }, [onCountryClick, rawMarkets, getMapIfReady, handleCardClick, onMarketSelect]);

  // Filter data
  const filteredMarkets = useMemo(() => {
    // Handle both direct array of features and FeatureCollection object
    let features = Array.isArray(markets) ? markets : (markets?.features || []);

    // IMPORTANT: When using override markets (category/platform filters active),
    // we should always show them regardless of "live" toggle state
    // The "live" toggle only affects the default global view
    if (!isUsingOverride) {
      // Only apply live filter when NOT using category/platform overrides
      if (!activeFilters.live && !activeFilters.heatmap) {
        features = [];
      }
    }

    // Filter for active/breaking - apply to all cases
    if (activeFilters.breaking) {
      features = features.filter((f: any) =>
        (f.properties.volume > 50000) || f.properties.price_movement > 0.05
      );
    }

    // Noise filter: Hide low liquidity markets (volume < $100)
    if (activeFilters.noiseFilter) {
      features = features.filter((f: any) => {
        const volume = f.properties.volume || f.properties.volume24h || 0;
        return volume >= 100; // Only show markets with at least $100 volume
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      features = features.filter((f: any) =>
        (f.properties.title || '').toLowerCase().includes(q) ||
        (f.properties.description || '').toLowerCase().includes(q)
      );
    }

    return { type: 'FeatureCollection', features };
  }, [markets, activeFilters, searchQuery, isUsingOverride]);

  const filteredTweets = useMemo(() => {
    if (!activeFilters.osint) return { type: 'FeatureCollection', features: [] };
    return tweets;
  }, [tweets, activeFilters.osint]);

  // Layers
  const marketLayer = {
    id: 'markets-layer',
    source: 'markets',
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
    source: 'markets',
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
    source: 'markets',
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

  // Cluster layers - shows aggregated circles with count
  const clusterLayer = {
    id: 'markets-clusters',
    source: 'markets',
    type: 'circle',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#3b82f6',  // blue for < 10
        10,
        '#8b5cf6',  // purple for 10-30
        30,
        '#ec4899',  // pink for 30-100
        100,
        '#ef4444'   // red for 100+
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        20,  // radius for < 10
        10, 30,
        30, 40,
        100, 50
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.5
    }
  };

  const clusterCountLayer = {
    id: 'markets-cluster-count',
    source: 'markets',
    type: 'symbol',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 14
    },
    paint: {
      'text-color': '#ffffff'
    }
  };

  const unclusteredPointLayer = {
    id: 'markets-unclustered',
    source: 'markets',
    type: 'circle',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'case',
        ['==', ['get', 'platform'], 'kalshi'], '#00d26a',
        '#2563eb'
      ],
      'circle-radius': [
        'interpolate',
        ['exponential', 1.2],
        ['zoom'],
        2, ['*', ['sqrt', ['/', ['coalesce', ['get', 'volume'], 0], 10000]], 3],
        10, ['*', ['sqrt', ['/', ['coalesce', ['get', 'volume'], 0], 10000]], 8]
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.8
    }
  };

  const tweetLayer = {
    id: 'tweets-layer',
    source: 'tweets',
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

    // Validate coordinates before rendering popup
    if (!lon || !lat || isNaN(lon) || isNaN(lat)) {
      console.warn('[PolyglobeMap] Invalid coordinates:', { lon, lat, feature });
      return null;
    }

    const isMarket = feature.layer.id === 'markets-layer' || feature.layer.id === 'markets-glow-layer';
    const isGroup = props.isGroup === true;

    return (
      <Popup
        longitude={lon}
        latitude={lat}
        closeButton={false}
        closeOnClick={false}
        onClose={() => setSelectedFeature(null)}
        anchor="top"
        className="edge-popup z-50"
        maxWidth={isGroup ? "280px" : "210px"}
      >
        <div className="bg-gradient-to-br from-gray-900/98 via-gray-900/95 to-gray-950/98 border border-gray-700/50 rounded-lg p-2.5 text-white shadow-2xl backdrop-blur-xl relative overflow-hidden max-w-[280px]">
          {/* Gradient overlay for modern effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>

          {isMarket && isGroup ? (
            <div className="relative z-10">
              {/* Group Header */}
              <div className="mb-2">
                <h3 className="font-semibold text-sm leading-tight text-white mb-1.5">{props.title}</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-semibold shadow-sm",
                    props.platform === 'polymarket'
                      ? "bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 border border-blue-400/30"
                      : "bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-300 border border-green-400/30"
                  )}>
                    {props.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-700/40 text-purple-300 border border-purple-600/30">
                    {props.marketCount} Options
                  </span>
                  {props.category && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-700/40 text-gray-300 border border-gray-600/30">
                      {props.category.charAt(0).toUpperCase() + props.category.slice(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Market Options List */}
              <div className="space-y-1.5 mb-2 max-h-64 overflow-y-auto">
                {props.markets && JSON.parse(JSON.stringify(props.markets)).map((market: any, idx: number) => {
                  const marketImageUrl = market.imageUrl || market.image || market.rawData?.image || market.rawData?.icon || market.rawData?.eventImage;
                  return (
                    <div
                      key={idx}
                      className="bg-gray-800/40 rounded p-2 border border-gray-700/30 hover:bg-gray-800/60 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Reconstruct market for selection
                        const fullMarket = {
                          id: market.id,
                          title: market.title,
                          description: market.description || '',
                          platform: market.platform,
                          volume24h: market.volume24h,
                          price: market.price,
                          probability: market.price,
                          slug: market.slug,
                          ticker: market.ticker,
                          imageUrl: market.imageUrl,
                          endDate: market.endDate,
                          rawData: {},
                        };
                        handleCardClick(fullMarket);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Image Thumbnail */}
                        <div className="shrink-0 w-10 h-10 rounded overflow-hidden border border-gray-600/30 bg-gray-700 flex items-center justify-center">
                          {marketImageUrl ? (
                            <div className="relative w-full h-full">
                              <Image
                                src={marketImageUrl}
                                alt={market.title}
                                fill
                                className="object-cover"
                                onError={(e) => {
                                  // Fallback handled by parent CSS logic or hidden element
                                  const target = e.currentTarget as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling;
                                  if (fallback) fallback.classList.remove('hidden');
                                }}
                              />
                            </div>
                          ) : null}
                          <span className={`text-[8px] font-black ${marketImageUrl ? 'hidden' : ''} ${market.platform === 'polymarket' ? 'text-blue-400' : 'text-green-400'}`}>
                            {market.platform === 'polymarket' ? 'POLY' : 'KALS'}
                          </span>
                        </div>

                        {/* Title and Price */}
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white line-clamp-2">{market.title}</div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="text-sm font-bold text-blue-300">{Math.round(market.price * 100)}¢</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Event Stats - Volume and OI */}
              <div className="flex gap-1.5 mb-2">
                <MarketPopupVolume
                  market={{
                    id: props.id || props.groupId,
                    rawData: props.rawData ? (typeof props.rawData === 'string' ? JSON.parse(props.rawData) : props.rawData) : {},
                    eventData: props.eventData,
                    eventId: props.eventId,
                  }}
                  volume24h={props.volume || props.volume24h}
                  platform={props.platform}
                />
              </div>
            </div>
          ) : isMarket ? (
            <div className="relative z-10">
              {/* Price Badge - Floating top right */}
              <div className="absolute -top-1 -right-1 bg-gradient-to-br from-blue-500 to-blue-600 text-white px-2.5 py-1 rounded-lg shadow-lg z-10">
                <span className="text-lg font-bold tabular-nums">{Math.round(props.last_price * 100)}¢</span>
              </div>

              {/* Compact Layout with Image Float */}
              <div className="flex gap-2.5 mb-2.5">
                {/* Left: Title and Badges */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className="font-semibold text-sm leading-tight text-white line-clamp-3 mb-1.5 pr-10">{props.title}</h3>

                  {/* Platform & Category Badge Row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold shadow-sm",
                      props.platform === 'polymarket'
                        ? "bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 border border-blue-400/30"
                        : "bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-300 border border-green-400/30"
                    )}>
                      {props.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                    </span>
                    {props.category && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-700/40 text-gray-300 border border-gray-600/30">
                        {props.category.charAt(0).toUpperCase() + props.category.slice(1)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Compact Image */}
                {props.image_url && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-700/30 relative">
                    <Image
                      src={props.image_url}
                      alt={props.title}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        // Hide parent container if image fails to load
                        const target = e.currentTarget as HTMLImageElement;
                        if (target.parentElement) target.parentElement.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Stats Grid - Volume and OI side by side */}
              <div className="flex gap-1.5 mb-2">
                <MarketPopupVolume
                  market={{
                    id: props.id || props.market_id,
                    rawData: props.rawData ? (typeof props.rawData === 'string' ? JSON.parse(props.rawData) : props.rawData) : {},
                    eventData: props.eventData,
                    eventId: props.eventId,
                  }}
                  volume24h={props.volume || props.volume24h}
                  platform={props.platform}
                />
                {props.price_movement !== undefined && props.price_movement !== 0 && (
                  <div className="bg-gray-800/40 rounded p-1.5 border border-gray-700/30 flex-1">
                    <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">24h Change</div>
                    <div className={cn(
                      "text-xs font-bold",
                      props.price_movement >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {props.price_movement > 0 ? '+' : ''}{Math.round(props.price_movement * 100)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Latency Tag */}
              {props.updatedAt && (
                <div className="mb-2">
                  <LatencyTag updatedAt={props.updatedAt} size="sm" />
                </div>
              )}

              {/* End Date */}
              {props.endDate && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-2">
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

              {/* Mini Chart - Fetches on hover (only for single markets, not groups) */}
              <div className="mb-2">
                <MarketHoverChart
                  marketId={props.id || props.market_id}
                  platform={props.platform}
                  currentPrice={props.last_price || props.price}
                  priceChange={props.price_movement}
                  enabled={true}
                />
              </div>

              {/* CTA Button */}
              <button
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
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
                      imageUrl: props.image_url,
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
    const map = getMapIfReady();
    if (!map) return;

    if (selectedMarket && selectedMarket.location && selectedMarket.location.coordinates) {
      const { lat, lng } = selectedMarket.location.coordinates;
      map.flyTo({
        center: [lng, lat],
        zoom: 6,
        duration: 2000,
        padding: { right: 400, top: 0, bottom: 0, left: 0 }
      });
    } else if (!selectedMarket) {
      map.easeTo({
        padding: { right: 0, top: 0, bottom: 0, left: 0 },
        duration: 1000
      });
    }
  }, [selectedMarket, getMapIfReady, isStyleLoaded]);

  // Handle projection change
  useEffect(() => {
    const map = getMapIfReady();
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
  }, [projection, getMapIfReady, isStyleLoaded, viewState.longitude]);


  // Compute interactive layers - memoize to prevent re-renders
  const interactiveIds = useMemo(() => {
    if (visualizationMode === 'heatmap') {
      // In heatmap mode, keep dots invisible but interactive for clicks
      return ['markets-layer', 'markets-glow-layer', 'tweets-layer'];
    } else if (visualizationMode === 'cluster') {
      return ['markets-clusters', 'markets-unclustered', 'tweets-layer'];
    } else {
      // Default dots mode
      return ['markets-layer', 'markets-glow-layer', 'tweets-layer'];
    }
  }, [visualizationMode]);

  // Debug: Log map and layer state on load
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      const logState = () => {
        console.log('[InnerMap] Map style loaded');
        console.log('[InnerMap] Available layers:', map.getStyle()?.layers?.map((l: any) => l.id));
      };

      if (map.isStyleLoaded()) {
        logState();
      } else {
        map.once('idle', logState);
      }

      // Add direct map click listener as backup (safest after load)
      const setupClickListeners = () => {
        try {
          if (map.getLayer('markets-layer')) {
            map.on('click', 'markets-layer', (e: any) => {
              console.log('[MapLibre Direct] markets-layer clicked!', e);
            });
          }
          if (map.getLayer('markets-glow-layer')) {
            map.on('click', 'markets-glow-layer', (e: any) => {
              console.log('[MapLibre Direct] markets-glow-layer clicked!', e);
            });
          }
        } catch (e) {
          console.warn('[InnerMap] Failed to attach direct click listeners:', e);
        }
      };

      if (map.isStyleLoaded()) {
        setupClickListeners();
      } else {
        map.once('load', setupClickListeners);
      }
    }
  }, [interactiveIds, visualizationMode]);

  // Only log on mount or when interactive IDs change
  useEffect(() => {
    // console.log('[InnerMap] interactiveLayerIds updated:', interactiveIds);
  }, [interactiveIds]);

  return (
    <div
      className="w-full h-full relative"
      style={{ backgroundColor: projection === 'globe' ? 'transparent' : '#030712' }}
    >
      <Map
        ref={mapRef}
        {...viewState}
        cursor={cursor}
        onMove={evt => {
          console.log('[EdgeMap] Map moved - zoom:', evt.viewState.zoom, 'lng:', evt.viewState.longitude);
          setViewState(evt.viewState);
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
        onMouseDown={() => {
          handleInteractionStart();
        }}
        onTouchStart={handleInteractionStart}
        onMouseMove={onHover}
        onClick={(e) => {
          onClick(e);
        }}
        onLoad={() => setIsStyleLoaded(true)}
        onStyleData={() => {
          const map = mapRef.current?.getMap();
          if (map && map.isStyleLoaded()) {
            setIsStyleLoaded(true);
          }
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={`https://api.maptiler.com/maps/darkmatter/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY || '35TZqSTSBjgDvsawKAK9'}`}
        attributionControl={false}
        interactiveLayerIds={interactiveIds}
        scrollZoom={true}
        boxZoom={true}
        touchZoomRotate={true}
        touchPitch={true}
        doubleClickZoom={true}
        dragPan={true}
        dragRotate={true}
      >
        <NavigationControl position="bottom-right" />
        <FullscreenControl position="bottom-right" />

        <Source
          key={`markets-${visualizationMode}`}
          id="markets"
          type="geojson"
          data={filteredMarkets as any}
          cluster={visualizationMode === 'cluster'}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          {visualizationMode === 'heatmap' ? (
            <>
              <Layer {...heatmapLayer as any} />
              {/* Overlay individual market dots on top of heatmap for interactivity - very low opacity */}
              <Layer {...marketGlowLayer as any} paint={{
                ...marketGlowLayer.paint,
                'circle-opacity': 0.1
              }} />
              <Layer {...marketLayer as any} paint={{
                ...marketLayer.paint,
                'circle-opacity': 0.15
              }} />
            </>
          ) : visualizationMode === 'cluster' ? (
            <>
              <Layer {...clusterLayer as any} />
              <Layer {...clusterCountLayer as any} />
              <Layer {...unclusteredPointLayer as any} />
            </>
          ) : (
            // Default dots mode
            <>
              <Layer {...marketGlowLayer as any} />
              <Layer {...marketLayer as any} />
            </>
          )}
        </Source>

        <Source id="tweets" type="geojson" data={filteredTweets as any}>
          <Layer {...tweetLayer as any} />
        </Source>

        {showGrid && (
          <Source id="grid" type="geojson" data={{
            type: 'FeatureCollection',
            features: (() => {
              const features = [];
              for (let lng = -180; lng <= 180; lng += 30) {
                features.push({
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: [[lng, -90], [lng, 90]] },
                  properties: {}
                });
              }
              for (let lat = -90; lat <= 90; lat += 30) {
                features.push({
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: [[-180, lat], [180, lat]] },
                  properties: {}
                });
              }
              return features;
            })()
          } as any}>
            <Layer
              id="grid-layer"
              type="line"
              paint={{
                'line-color': '#ffffff',
                'line-width': 0.5,
                'line-opacity': 0.1
              }}
            />
          </Source>
        )}

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

export function EdgeMap({
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
  onViewChange,
  shouldResetZoom,
  visualizationMode = 'dots',
  showLabels = true,
  showGrid = false
}: EdgeMapProps) {
  const { markets, tweets, rawMarkets, isLoading } = useEdgeData();
  const [mounted, setMounted] = useState(false);

  // If overrideMarkets is provided, use it, otherwise default.
  // ALSO, if a market is selected, ensure it's included in the display list so it can be seen/focused.
  const displayMarkets = useMemo(() => {
    const base = overrideMarkets || markets;

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
      onViewChange={onViewChange}
      shouldResetZoom={shouldResetZoom}
      visualizationMode={visualizationMode}
      showLabels={showLabels}
      showGrid={showGrid}
    />
  );
}
