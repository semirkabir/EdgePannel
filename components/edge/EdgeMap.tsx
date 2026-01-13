'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import Map, { Source, Layer, Popup, NavigationControl, FullscreenControl, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEdgeData } from '@/hooks/use-edge-data';
import { cn } from '@/lib/utils/cn';
import { loadGeoJSON } from '@/lib/geojson-loader';
import { Landmark, TrendingUp, CloudRain, Trophy, Cpu, Film, Activity, Globe as GlobeIcon, LayoutGrid, MapPin, Clock } from 'lucide-react';
import { MarketPopupVolume } from './MarketPopup';
import { MarketHoverChart } from './MarketHoverChart';
import { MarketType } from '@/types/exchange';
import { useExchanges } from '@/hooks/use-exchanges';
import { getExchangeById } from '@/lib/data/exchanges';
import { getDetailedMarketStatus } from '@/lib/utils/exchange-geojson';
import { ExchangePopup } from './ExchangePopup';
import { useLayerStore } from '@/lib/store/layer-store';

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

// Map feed types to icon characters (Unicode/emoji)
const FEED_ICON_MAP: Record<string, string> = {
  'PREDICTION': '💓', // Activity/Heartbeat
  'FINANCE': '📈', // TrendingUp
  'NEWS': '📰', // Rss/News
  'CONFLICT': '🔥', // Flame
  'GEOPOLITICS': '🌍', // Globe
  'TECH_AI': '⚡', // Zap
  'CONTRACTS': '💼', // Briefcase
  'POLICY': '🏛️', // Landmark
  'MONEY_PRINTER': '💵', // Banknote
  'CRYPTO': '🪙', // Coins
  'COMMODITIES': '🏭', // Factory
  'LAYOFFS': '📉', // Activity/Down
  'conflict': '🔥',
  'tech': '⚡',
  'geopolitics': '🌍',
  'contracts': '💼',
  'policy': '🏛️',
  'crypto': '🪙',
  'commodities': '🏭',
  'layoffs': '📉',
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
  marketType?: MarketType;
  onInteractionStart?: () => void;
  feedData?: any;
}


const PulsingMarker = ({ longitude, latitude }: { longitude: number, latitude: number }) => (
  <div className="relative w-4 h-4">
    <div className="absolute inset-0 bg-blue-500 rounded-full opacity-75 animate-ping"></div>
    <div className="absolute inset-0.5 bg-blue-400 rounded-full"></div>
  </div>
);

// Inner map component now supports live trade pulsing
// For demo purposes, we'll auto-generate a few pulsing markers near active hotspots
const LivePulseLayer = ({ active }: { active: boolean }) => {
  const [pulse, setPulse] = useState(1);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setPulse(p => (p === 1 ? 0.6 : 1));
    }, 800);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  // Mock live trades locations (Middle East, Ukraine, Taiwan, etc)
  const pulses = [
    { id: 1, lat: 31.0, lng: 34.5 },   // Israel/Palestine
    { id: 2, lat: 48.3, lng: 37.0 },   // Donetsk
    { id: 3, lat: 25.0, lng: 121.5 },  // Taiwan
    { id: 4, lat: 38.8, lng: -77.0 },  // DC
    { id: 5, lat: 31.5, lng: 34.4 },   // Gaza
    { id: 6, lat: 15.3, lng: 44.2 },   // Yemen
  ];

  const pulseGeoJSON = {
    type: 'FeatureCollection',
    features: pulses.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id }
    }))
  };

  return (
    <Source id="live-pulses" type="geojson" data={pulseGeoJSON as any}>
      {/* Outer Pulse Glow */}
      <Layer
        id="live-pulse-glow"
        type="circle"
        paint={{
          'circle-radius': pulse * 25,
          'circle-color': '#06b6d4', // Cyan 500
          'circle-opacity': (1.1 - pulse) * 0.4,
          'circle-blur': 1.0
        }}
      />
      {/* Inner Core Dot */}
      <Layer
        id="live-pulse-center"
        type="circle"
        paint={{
          'circle-radius': 4.5,
          'circle-color': '#22d3ee', // Cyan 400
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }}
      />
    </Source>
  );
};



// ... (existing imports)

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
  showGrid = false,
  marketType = 'prediction',
  onInteractionStart,
  exchanges,
  feedData
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
  marketType?: MarketType;
  onInteractionStart?: () => void;
  exchanges?: any; // Added exchanges prop
  feedData?: any; // Added feedData prop
}) {
  const { isLayerActive, selectedCensusDataset, activeLayers } = useLayerStore();

  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: projection === 'mercator' ? 20 : 0,
    zoom: 2.5,
    pitch: 0,
    bearing: 0
  });

  // Track longitude natively for rotation to avoid React re-render bottleneck
  const nativeLongitudeRef = useRef(0);

  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rotationAnimationRef = useRef<number | null>(null);
  const mapRef = useRef<MapRef>(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const isFirstLoadRef = useRef(true);
  const prevViewModifiedRef = useRef<boolean>(false);
  const prevIsZoomedRef = useRef<boolean>(false);
  const lastIsZoomedInRef = useRef<boolean>(false);

  // Debug interaction state - disabled to reduce console spam
  // useEffect(() => {
  //   console.log('[DEBUG] Interaction State:', {
  //     isPlaying,
  //     isUserInteracting,
  //     isHovering,
  //     zoom: viewState.zoom
  //   });
  // }, [isPlaying, isUserInteracting, isHovering, viewState.zoom]);

  // Real Data State
  const [fetchedNewsData, setFetchedNewsData] = useState<any>({ type: 'FeatureCollection', features: [] });

  // Fetch News Data when layer is active
  useEffect(() => {
    if (!isLayerActive('NEWS')) return;

    const fetchNews = async () => {
      try {
        const res = await fetch('/api/layers/news');
        if (res.ok) {
          const data = await res.json();
          setFetchedNewsData(data);
        }
      } catch (err) {
        console.error('Failed to load news layer:', err);
      }
    };

    fetchNews();
    // Optional: Poll every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeLayers]);

  // Filter logic for newsData
  const newsData = useMemo(() => {
    if (!activeLayers.includes('NEWS')) return { type: 'FeatureCollection', features: [] };

    let features = fetchedNewsData.features || [];
    if (searchQuery && features.length > 0) {
      const q = searchQuery.toLowerCase();
      features = features.filter((f: any) =>
        (f.properties.title || '').toLowerCase().includes(q)
      );
    }
    
    // Add icon property
    features = features.map((f: any) => ({
      ...f,
      properties: {
        ...f.properties,
        icon: FEED_ICON_MAP['NEWS'] || '📰'
      }
    }));

    return { type: 'FeatureCollection', features };
  }, [fetchedNewsData, searchQuery, activeLayers]);

  const [fetchedFinanceData, setFetchedFinanceData] = useState<any>({ type: 'FeatureCollection', features: [] });

  // Fetch Finance Data
  useEffect(() => {
    if (!isLayerActive('FINANCE')) return;

    const fetchFinance = async () => {
      try {
        const res = await fetch('/api/layers/finance');
        if (res.ok) {
          const data = await res.json();
          setFetchedFinanceData(data);
        }
      } catch (err) {
        console.error('Failed to load finance layer:', err);
      }
    };
    fetchFinance();
  }, [activeLayers]);

  const financeData = useMemo(() => {
    if (!activeLayers.includes('FINANCE')) return { type: 'FeatureCollection', features: [] };

    let features = fetchedFinanceData.features || [];
    if (searchQuery && features.length > 0) {
      const q = searchQuery.toLowerCase();
      features = features.filter((f: any) =>
        (f.properties.symbol || '').toLowerCase().includes(q) ||
        (f.properties.title || '').toLowerCase().includes(q)
      );
    }
    
    // Add icon property
    features = features.map((f: any) => ({
      ...f,
      properties: {
        ...f.properties,
        icon: FEED_ICON_MAP['FINANCE'] || '📈'
      }
    }));

    return { type: 'FeatureCollection', features };
  }, [fetchedFinanceData, searchQuery, activeLayers]);

  const [fetchedCustomData, setFetchedCustomData] = useState<any>({ type: 'FeatureCollection', features: [] });

  // Fetch Custom Data
  useEffect(() => {
    if (!isLayerActive('CUSTOM')) return;

    const fetchCustom = async () => {
      try {
        const res = await fetch('/api/layers/custom');
        if (res.ok) {
          const data = await res.json();
          setFetchedCustomData(data);
        }
      } catch (err) {
        console.error('Failed to load custom layer:', err);
      }
    };
    fetchCustom();
  }, [activeLayers]);

  const customData = useMemo(() => {
    if (!activeLayers.includes('CUSTOM')) return { type: 'FeatureCollection', features: [] };

    if (searchQuery && fetchedCustomData.features) {
      const q = searchQuery.toLowerCase();
      const filtered = fetchedCustomData.features.filter((f: any) =>
        (f.properties.label || '').toLowerCase().includes(q) ||
        (f.properties.title || '').toLowerCase().includes(q)
      );
      return { type: 'FeatureCollection', features: filtered };
    }
    return fetchedCustomData;
  }, [fetchedCustomData, searchQuery, activeLayers]);

  // Census Data State
  const [fetchedCensusData, setFetchedCensusData] = useState<any>({ type: 'FeatureCollection', features: [] });
  const [usCountiesGeoJSON, setUsCountiesGeoJSON] = useState<any>(null);
  const [isCensusLoading, setIsCensusLoading] = useState(false);

  // Get census geography from store
  const { censusGeography, setCensusGeography } = useLayerStore();

  // Load US Counties Geometry (once)
  useEffect(() => {
    // Only load if we ever switch to county view and haven't loaded yet
    if (censusGeography === 'county' && !usCountiesGeoJSON) {
      fetch('/data/geo/us-counties.json')
        .then(res => res.json())
        .then(data => {
          console.log('[Census] Loaded US Counties geometry:', data.features?.length);
          setUsCountiesGeoJSON(data);
        })
        .catch(err => console.error('Failed to load county geometry:', err));
    }
  }, [censusGeography, usCountiesGeoJSON]);

  // Zoom threshold for auto-switching to county level
  const COUNTY_ZOOM_THRESHOLD = 5;

  // Auto-switch geography based on zoom level (using viewState.zoom)
  useEffect(() => {
    if (!isLayerActive('CENSUS') || !selectedCensusDataset) return;

    const shouldBeCounty = viewState.zoom >= COUNTY_ZOOM_THRESHOLD;
    const currentIsCounty = censusGeography === 'county';

    // Auto-switch to county when zoomed in enough
    if (shouldBeCounty && !currentIsCounty) {
      console.log(`[Census] Auto-switching to county level at zoom ${viewState.zoom.toFixed(1)}`);
      setCensusGeography('county');
    } else if (!shouldBeCounty && currentIsCounty && viewState.zoom < COUNTY_ZOOM_THRESHOLD - 1) {
      // Only switch back to state if significantly zoomed out (hysteresis prevents flicker)
      console.log(`[Census] Auto-switching to state level at zoom ${viewState.zoom.toFixed(1)}`);
      setCensusGeography('state');
    }
  }, [viewState.zoom, activeLayers, selectedCensusDataset, censusGeography, setCensusGeography]);

  // Fetch Census Data when layer is active and dataset is selected
  useEffect(() => {
    if (!isLayerActive('CENSUS') || !selectedCensusDataset) {
      setFetchedCensusData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const fetchCensus = async () => {
      setIsCensusLoading(true);
      try {
        const res = await fetch(`/api/layers/census?dataset=${selectedCensusDataset}&geography=${censusGeography}`);
        if (res.ok) {
          const data = await res.json();
          setFetchedCensusData(data);
          console.log(`[Census] Loaded ${data.features?.length || 0} features for ${selectedCensusDataset} (${censusGeography})`);
        }
      } catch (err) {
        console.error('Failed to load census layer:', err);
      } finally {
        setIsCensusLoading(false);
      }
    };
    fetchCensus();
  }, [activeLayers, selectedCensusDataset, censusGeography]);

  // Prepare Census Display Data (Merge with Geometry if Choropleth needed)
  const censusData = useMemo(() => {
    if (!activeLayers.includes('CENSUS') || !selectedCensusDataset) {
      return { type: 'FeatureCollection', features: [] };
    }

    // Standard Point Data (State level or Employment/Trade which are always points)
    // If geometry isn't loaded yet, falling back to points is better than nothing
    if (censusGeography === 'state' || selectedCensusDataset === 'employment' || selectedCensusDataset === 'trade' || !usCountiesGeoJSON) {
      return fetchedCensusData;
    }

    // Choropleth Data (Population, Income, Poverty at County Level)
    // We need to merge the API data (values) with the Geometry (shapes)
    if (usCountiesGeoJSON && fetchedCensusData.features) {
      // PERF: Create a lookup map O(N) instead of finding in loop O(N^2)
      const dataMap = new globalThis.Map<string, any>();
      fetchedCensusData.features.forEach((f: any) => {
        const id = f.properties.stateFips + f.properties.countyFips;
        dataMap.set(id, f);
      });

      const mergedFeatures = usCountiesGeoJSON.features.map((geoFeature: any) => {
        // Find matching data value by FIPS
        // Geometry uses 'id' (FIPS), Data uses properties.stateFips + properties.countyFips
        const fips = geoFeature.id;

        // Find the feature in our data that matches this FIPS
        // Data format: stateFips="01", countyFips="001" -> "01001"
        const dataFeature = dataMap.get(fips);

        if (dataFeature) {
          return {
            ...geoFeature,
            properties: {
              ...geoFeature.properties,
              ...dataFeature.properties, // Inject values (color, population, etc.)
              boxIsSet: true // Flag to filter empty ones
            }
          };
        }
        return null; // No data for this county
      }).filter(Boolean); // Remove nulls

      return {
        type: 'FeatureCollection',
        features: mergedFeatures
      };
    }

    return fetchedCensusData;
  }, [fetchedCensusData, usCountiesGeoJSON, activeLayers, selectedCensusDataset, censusGeography]);

  // ... (rest of InnerMap)


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

  // Track previous zoom state for hysteresis using a ref to avoid re-render loops
  const wasZoomedInRef = useRef(false);

  // Reset zoom state when projection changes
  useEffect(() => {
    wasZoomedInRef.current = false;
  }, [projection]);

  useEffect(() => {
    const zoomThresholdIn = DEFAULT_ZOOM + ZOOM_THRESHOLD + ZOOM_HYSTERESIS;
    const zoomThresholdOut = DEFAULT_ZOOM + ZOOM_THRESHOLD - ZOOM_HYSTERESIS;

    const isZoomed = wasZoomedInRef.current
      ? viewState.zoom > zoomThresholdOut
      : viewState.zoom > zoomThresholdIn;

    if (isZoomed !== wasZoomedInRef.current) {
      wasZoomedInRef.current = isZoomed;
    }

    // Capture current values for the closure
    const currentZoom = viewState.zoom;
    const currentLng = viewState.longitude;
    const currentLat = viewState.latitude;

    // View modified logic (Zoomed or Panned)
    const isPanned = (
      Math.abs(currentLng - DEFAULT_LONGITUDE) > PAN_THRESHOLD ||
      Math.abs(currentLat - DEFAULT_LATITUDE) > PAN_THRESHOLD
    );
    const isViewModified = isZoomed || isPanned;

    // Only notify parent when values actually change
    // and use a small timeout or guard to prevent rapid firing during interaction
    if (onZoomChange && isZoomed !== prevIsZoomedRef.current) {
      prevIsZoomedRef.current = isZoomed;
      onZoomChange(isZoomed);
    }

    if (onViewChange && isViewModified !== prevViewModifiedRef.current) {
      prevViewModifiedRef.current = isViewModified;
      onViewChange(isViewModified);
    }

  }, [viewState.zoom, viewState.longitude, viewState.latitude, projection, onZoomChange, onViewChange, DEFAULT_ZOOM, ZOOM_THRESHOLD, ZOOM_HYSTERESIS, DEFAULT_LONGITUDE, DEFAULT_LATITUDE, PAN_THRESHOLD]);

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

      const map = mapRef.current?.getMap();
      if (!map) {
        rotationAnimationRef.current = requestAnimationFrame(rotate);
        return;
      }

      nativeLongitudeRef.current = (nativeLongitudeRef.current + rotationSpeedVal * (deltaTime / 16.6)) % 360;

      map.setCenter([nativeLongitudeRef.current, viewState.latitude]);

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
    setIsUserInteracting(true);
    if (onInteractionStart) {
      onInteractionStart();
    }
    if (rotationAnimationRef.current) {
      cancelAnimationFrame(rotationAnimationRef.current);
      rotationAnimationRef.current = null;
    }
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  }, [onInteractionStart]);

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
    if (onInteractionStart) {
      onInteractionStart();
    }
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
    lngLat?: { lng: number; lat: number };
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

  // Ref for throttling hover updates
  const hoverThrottleRef = useRef<NodeJS.Timeout | null>(null);

  const onHover = useCallback((event: MapLayerMouseEvent) => {
    // Capture properties synchronously
    const { point, lngLat } = event;
    const features = event.features;

    // Throttle hover updates to prevent performance degradation during zoom/pan
    if (hoverThrottleRef.current) return;

    hoverThrottleRef.current = setTimeout(() => {
      const feature = features && features[0];

      setHoverInfo(
        feature
          ? {
            feature,
            x: point.x,
            y: point.y,
            lngLat
          }
          : null
      );
      setIsHovering(!!feature);
      if (!isDraggingRef.current) {
        setCursor(feature ? 'pointer' : 'grab');
      }

      hoverThrottleRef.current = null;
    }, 16);
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

      // Handle exchange clicks
      if (feature.layer.id === 'exchanges-layer' || feature.layer.id === 'exchanges-glow-layer') {
        const props = feature.properties;
        const [lng, lat] = (feature.geometry as any).coordinates;

        const exchangeData = {
          id: props.id,
          name: props.name,
          shortName: props.shortName,
          country: props.country,
          city: props.city,
          region: props.region,
          isOpen: props.isOpen,
          currency: props.currency,
          indices: props.indices,
          website: props.website,
          timezone: props.timezone,
          isExchange: true, // Flag to identify this as an exchange
          location: {
            coordinates: { lat, lng }
          }
        };

        if (onMarketSelect) {
          onMarketSelect(exchangeData);
        }
        setSelectedFeature(null);
        return;
      }

      if (feature.layer.id === 'news-layer' || feature.layer.id === 'news-glow') {
        const props = { ...feature.properties };
        const [lng, lat] = (feature.geometry as any).coordinates;

        // Parse news array if it's stored as a JSON string (MapLibre serialization)
        if (typeof props.news === 'string') {
          try {
            props.news = JSON.parse(props.news);
          } catch (e) {
            console.warn('[EdgeMap] Failed to parse news array:', e);
            props.news = [];
          }
        }

        if (onMarketSelect) onMarketSelect({ ...props, isNews: true, location: { coordinates: { lat, lng } } });
        setSelectedFeature(null);
        return;
      }

      if (feature.layer.id === 'finance-layer') {
        const props = feature.properties;
        const [lng, lat] = (feature.geometry as any).coordinates;
        if (onMarketSelect) onMarketSelect({ ...props, isFinance: true, location: { coordinates: { lat, lng } } });
        setSelectedFeature(null);
        return;
      }

      if (feature.layer.id === 'custom-layer') {
        const props = feature.properties;
        const [lng, lat] = (feature.geometry as any).coordinates;
        if (onMarketSelect) onMarketSelect({ ...props, isCustom: true, location: { coordinates: { lat, lng } } });
        setSelectedFeature(null);
        return;
      }

      if (feature.layer.id === 'census-layer' || feature.layer.id === 'census-glow' || feature.layer.id === 'census-fill') {
        const props = feature.properties;

        let lng, lat;
        if (feature.geometry.type === 'Point') {
          [lng, lat] = (feature.geometry as any).coordinates;
        } else {
          // For polygons (fill), use click location
          lng = event.lngLat.lng;
          lat = event.lngLat.lat;
        }

        if (onMarketSelect) onMarketSelect({
          ...props,
          title: props.countyName || props.regionName || props.name,
          isCensus: true,
          location: { coordinates: { lat, lng } }
        });
        setSelectedFeature(null);
        return;
      }

      if (feature.layer.id === 'markets-layer' || feature.layer.id === 'markets-glow-layer' || feature.layer.id === 'markets-unclustered') {
        const props = feature.properties;
        const isGroup = props.isGroup === true;
        const [lng, lat] = (feature.geometry as any).coordinates;

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
            location: {
              coordinates: { lat, lng }
            }
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
          // Inject coordinates from the click if missing
          if (!market.location || !market.location.coordinates) {
            market = {
              ...market,
              location: {
                coordinates: { lat, lng }
              }
            };
          }
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
    // Check Layer Visibility first
    if (!activeLayers.includes('PREDICTION')) {
      return { type: 'FeatureCollection', features: [] };
    }

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

    // Noise filter: Hide low volume markets (Volume < $100)
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

    // Add icon property to each feature based on feed type
    features = features.map((f: any) => ({
      ...f,
      properties: {
        ...f.properties,
        icon: FEED_ICON_MAP['PREDICTION'] || '💓' // Default to prediction market icon
      }
    }));

    return { type: 'FeatureCollection', features };
  }, [markets, activeFilters, searchQuery, isUsingOverride, activeLayers]);

  const filteredExchanges = useMemo(() => {
    // If FINANCE is not active, don't show exchanges (assuming they are part of FINANCE layer logic)
    // Or we could have a separate 'EXCHANGES' layer if desired. 
    // For now, let's treat them as part of "FINANCE" or just always show if marketType was 'financial'.
    // The user request implies "Financial Markets" should show exchanges.
    // So if FINANCE layer is active, we show exchanges.
    if (!activeLayers.includes('FINANCE')) {
      return { type: 'FeatureCollection', features: [] };
    }

    let features = exchanges?.features || [];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      features = features.filter((f: any) =>
        (f.properties.name || '').toLowerCase().includes(q) ||
        (f.properties.symbol || '').toLowerCase().includes(q)
      );
    }

    // Add icon property for financial markets
    features = features.map((f: any) => ({
      ...f,
      properties: {
        ...f.properties,
        icon: FEED_ICON_MAP['FINANCE'] || '📈'
      }
    }));

    return { type: 'FeatureCollection', features };
  }, [exchanges, activeLayers, searchQuery]);

  const filteredTweets = useMemo(() => {
    if (!activeFilters.osint) return { type: 'FeatureCollection', features: [] };
    return tweets;
  }, [tweets, activeFilters.osint]);

  // Layers
  const firmsSource = {
    type: 'raster',
    tiles: [
      'https://firms.modaps.eosdis.nasa.gov/mapserver/tms/1.0.0/Fires_All/{z}/{x}/{y}.png'
    ],
    tileSize: 256,
    attribution: 'NASA FIRMS'
  };

  const firmsLayer: any = {
    id: 'firms-layer',
    type: 'raster',
    source: 'firms',
    minzoom: 0,
    maxzoom: 24,
    paint: {
      'raster-opacity': 0.8,
      'raster-hue-rotate': 0,
      'raster-brightness-min': 0,
      'raster-brightness-max': 1,
      'raster-saturation': 1,
      'raster-contrast': 1
    }
  };

  const marketLayer = {
    id: 'markets-layer',
    source: 'markets',
    type: 'symbol',
    layout: {
      'text-field': ['get', 'icon'],
      'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['get', 'volume'],
        0, 12,
        100000, 16,
        1000000, 24,
        10000000, 32
      ],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'platform'], 'kalshi'], '#10b981', // Emerald Green 500
        '#2563eb' // Cobalt Blue 600 (Polymarket)
      ],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
      'text-halo-blur': 1,
      'text-opacity': 1
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
        0, 8,
        100000, 15,
        1000000, 25,
        10000000, 45
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'platform'], 'kalshi'], '#10b981',
        '#2563eb'
      ],
      'circle-opacity': 0.2,
      'circle-blur': 0.8
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
        0.1, 'rgba(37, 99, 235, 0.1)',
        0.3, 'rgba(59, 130, 246, 0.4)',
        0.5, 'rgba(6, 182, 212, 0.7)',
        0.7, 'rgba(16, 185, 129, 0.85)',
        0.9, 'rgba(245, 158, 11, 0.95)',
        1, 'rgba(239, 68, 68, 1)'
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
        '#6366f1',  // Indigo 500 for < 10
        10,
        '#8b5cf6',  // Violet 500 for 10-30
        30,
        '#d946ef',  // Fuchsia 500 for 30-100
        100,
        '#f43f5e'   // Rose 500 for 100+
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
    type: 'symbol',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['get', 'icon'],
      'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['get', 'volume'],
        0, 14,
        100000, 18,
        1000000, 26,
        10000000, 36
      ],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'platform'], 'kalshi'], '#10b981',
        '#2563eb'
      ],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
      'text-halo-blur': 1,
      'text-opacity': 0.95
    }
  };

  const unclusteredGlowLayer = {
    id: 'markets-unclustered-glow',
    source: 'markets',
    type: 'circle',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'volume'],
        0, 10,
        100000, 20,
        1000000, 35,
        10000000, 55
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'platform'], 'kalshi'], '#10b981',
        '#2563eb'
      ],
      'circle-opacity': 0.15,
      'circle-blur': 0.9
    }
  };


  const tweetLayer = {
    id: 'tweets-layer',
    source: 'tweets',
    type: 'circle',
    paint: {
      'circle-radius': 4.5,
      'circle-color': '#f43f5e', // Rose/Ruby
      'circle-opacity': 0.9,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.7
    }
  };

  // Exchange layers - for financial markets
  const exchangeLayer = {
    id: 'exchanges-layer',
    source: 'exchanges',
    type: 'symbol',
    layout: {
      'text-field': ['get', 'icon'],
      'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'totalMarketCap'], 0],
        0, 18,
        1000000000000, 22,    // $1T
        10000000000000, 28,   // $10T
        50000000000000, 34    // $50T
      ],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': [
        'case',
        ['get', 'isOpen'], '#34d399',  // Emerald 400 for open
        '#94a3b8'                       // Slate 400 for closed
      ],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
      'text-halo-blur': 1,
      'text-opacity': 0.95
    }
  };

  const exchangeGlowLayer = {
    id: 'exchanges-glow-layer',
    source: 'exchanges',
    type: 'circle',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'totalMarketCap'], 0],
        0, 12,
        1000000000000, 20,
        10000000000000, 30,
        50000000000000, 45
      ],
      'circle-color': [
        'case',
        ['get', 'isOpen'], '#34d399',
        '#94a3b8'
      ],
      'circle-opacity': 0.2,
      'circle-blur': 0.8
    }
  };

  const renderPopup = () => {
    const feature = selectedFeature || (hoverInfo && hoverInfo.feature);
    if (!feature) return null;

    const props = feature.properties;

    // Determine coordinates based on geometry type
    let lon, lat;
    const gType = feature.geometry.type;
    if (gType === 'Point' || gType === 'MultiPoint') {
      [lon, lat] = gType === 'MultiPoint' ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
    } else if (hoverInfo && hoverInfo.feature === feature && hoverInfo.lngLat) {
      // For polygons (hover), use cursor position
      lon = hoverInfo.lngLat.lng;
      lat = hoverInfo.lngLat.lat;
    } else if (selectedFeature === feature && feature.layer.id === 'census-fill') {
      // For selected polygon, we might need a centroid or just valid coords
      // If we selected it via click, we likely passed coordinates to onMarketSelect, 
      // but this popup is for the map itself.
      // If we don't have coords, we can't show popup.
      if ((feature as any)._clickLngLat) {
        lon = (feature as any)._clickLngLat.lng;
        lat = (feature as any)._clickLngLat.lat;
      } else {
        return null;
      }
    } else {
      return null;
    }

    // Validate coordinates
    if (lon === undefined || lat === undefined || isNaN(lon) || isNaN(lat)) return null;

    const isMarket = feature.layer.id === 'markets-layer' || feature.layer.id === 'markets-glow-layer' || feature.layer.id === 'markets-unclustered' || feature.layer.id === 'markets-unclustered-glow';
    const isExchange = feature.layer.id === 'exchanges-layer' || feature.layer.id === 'exchanges-glow-layer';
    const isNews = feature.layer.id === 'news-layer' || feature.layer.id === 'news-glow';
    const isFinance = feature.layer.id === 'finance-layer';
    const isCustom = feature.layer.id === 'custom-layer';
    const isCensus = feature.layer.id === 'census-layer' || feature.layer.id === 'census-glow' || feature.layer.id === 'census-fill';
    const isGroup = props.isGroup === true && isMarket;

    return (
      <Popup
        longitude={lon}
        latitude={lat}
        closeButton={false}
        closeOnClick={false}
        onClose={() => setSelectedFeature(null)}
        anchor="top"
        className="edge-popup z-50"
        maxWidth="280px"
      >
        <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden p-3 w-[280px] max-w-[280px]">

          {/* NEWS POPUP */}
          {isNews && (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                  <span className="text-[10px] uppercase font-bold text-blue-400">Global News • {props.country || 'World'}</span>
                </div>
                {props.isTrending && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded border border-red-500/30 font-bold uppercase tracking-wider animate-pulse">
                    TRENDING
                  </span>
                )}
              </div>

              {(() => {
                // Parse news array if it's a JSON string (MapLibre serializes arrays)
                let newsItems = props.news;
                if (typeof newsItems === 'string') {
                  try {
                    newsItems = JSON.parse(newsItems);
                  } catch (e) {
                    newsItems = [];
                  }
                }

                return newsItems && Array.isArray(newsItems) && newsItems.length > 0 ? (
                  <div className="space-y-3">
                    {newsItems.slice(0, 5).map((item: any, idx: number) => (
                      <a key={idx} href={item.url || '#'} target="_blank" rel="noreferrer" className="block group border-b border-gray-800 last:border-0 pb-2 last:pb-0">
                        {idx === 0 && item.imageUrl && (
                          <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-800 mb-2">
                            <img src={item.imageUrl} alt={item.title} onError={(e) => e.currentTarget.style.display = 'none'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                          <h3 className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">{item.title}</h3>
                          <span className="text-[9px] text-gray-400">{item.source}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <>
                    {props.imageUrl && (
                      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-800">
                        <img src={props.imageUrl} alt={props.title} onError={(e) => e.currentTarget.style.display = 'none'} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h3 className="text-sm font-bold text-white leading-snug">{props.title}</h3>
                    {props.source && <div className="text-[10px] text-gray-400">Source: {props.source}</div>}
                  </>
                );
              })()}
            </div>
          )}

          {/* FINANCE POPUP */}
          {isFinance && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-yellow-400">{props.subtype || 'Asset'}</span>
                <span className={cn("text-xs font-bold", props.change?.startsWith('-') ? "text-red-400" : "text-emerald-400")}>
                  {props.change}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-base font-black text-white">{props.symbol}</h3>
                <span className="text-xs text-gray-300 truncate max-w-[120px]">{props.title}</span>
              </div>
              <div className="text-xl font-bold text-white font-mono">{props.price}</div>
              <div className="text-[9px] text-gray-500 mt-1 flex justify-between">
                <span>{props.source}</span>
              </div>
            </div>
          )}

          {/* CUSTOM POPUP */}
          {isCustom && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                <span className="text-[10px] uppercase font-bold text-purple-400">{props.subtype || 'Custom Data'}</span>
              </div>
              <h3 className="text-sm font-bold text-white">{props.featureTitle || props.title || props.label}</h3>
              <div className="text-xs text-gray-300">{props.status || props.price}</div>
            </div>
          )}

          {/* CENSUS POPUP */}
          {isCensus && (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  props.dataset === 'population' ? "bg-blue-400" :
                    props.dataset === 'income' ? "bg-green-400" :
                      props.dataset === 'poverty' ? "bg-amber-400" :
                        props.dataset === 'employment' ? "bg-cyan-400" : "bg-rose-400"
                )}></div>
                <span className={cn(
                  "text-[10px] uppercase font-bold",
                  props.dataset === 'population' ? "text-blue-400" :
                    props.dataset === 'income' ? "text-green-400" :
                      props.dataset === 'poverty' ? "text-amber-400" :
                        props.dataset === 'employment' ? "text-cyan-400" : "text-rose-400"
                )}>
                  {props.geography === 'county' ? 'County' : 'State'} • {props.dataset === 'population' ? 'Population' :
                    props.dataset === 'income' ? 'Income' :
                      props.dataset === 'poverty' ? 'Poverty' :
                        props.dataset === 'employment' ? 'Employment' : 'Trade'}
                </span>
              </div>
              {/* Region Name - County or State */}
              <h3 className="text-base font-bold text-white">{props.countyName || props.regionName || props.stateName || props.name}</h3>
              {props.geography === 'county' && props.stateName && (
                <div className="text-[10px] text-gray-400 -mt-1 mb-1">{props.stateName}</div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {props.dataset === 'population' && (
                  <>
                    <div className="text-gray-400">Population</div>
                    <div className="text-white font-semibold text-right">{parseInt(props.population || 0).toLocaleString()}</div>
                  </>
                )}
                {props.dataset === 'income' && (
                  <>
                    <div className="text-gray-400">Median Income</div>
                    <div className="text-green-400 font-semibold text-right">${parseInt(props.medianIncome || 0).toLocaleString()}</div>
                    <div className="text-gray-400">Per Capita</div>
                    <div className="text-white font-semibold text-right">${parseInt(props.perCapitaIncome || 0).toLocaleString()}</div>
                  </>
                )}
                {props.dataset === 'poverty' && (
                  <>
                    <div className="text-gray-400">Poverty Rate</div>
                    <div className="text-amber-400 font-semibold text-right">{parseFloat(props.povertyRate || 0).toFixed(1)}%</div>
                    <div className="text-gray-400">In Poverty</div>
                    <div className="text-white font-semibold text-right">{parseInt(props.povertyCount || 0).toLocaleString()}</div>
                  </>
                )}
                {props.dataset === 'employment' && (
                  <>
                    <div className="text-gray-400">Employed</div>
                    <div className="text-cyan-400 font-semibold text-right">{parseInt(props.employees || 0).toLocaleString()}</div>
                    <div className="text-gray-400">Labor Force</div>
                    <div className="text-white font-semibold text-right">{parseInt(props.establishments || 0).toLocaleString()}</div>
                  </>
                )}
                {props.dataset === 'trade' && (
                  <>
                    <div className="text-gray-400">Exports</div>
                    <div className="text-rose-400 font-semibold text-right">${(parseInt(props.exportValue || 0) / 1000000).toFixed(1)}M</div>
                  </>
                )}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">Source: U.S. Census Bureau (ACS 2022)</div>
            </div>
          )}

          {/* EXCHANGES / MARKETS */}
          {(isMarket || isExchange) && (
            <>
              {isExchange ? (
                <ExchangePopup
                  exchangeId={props.id}
                  exchangeName={props.name}
                  shortName={props.shortName}
                  isOpen={props.isOpen}
                  status={props.status}
                  nextStatusText={props.nextStatusText}
                  timeUntilNextStatus={props.timeUntilNextStatus}
                  exchangeTime={props.exchangeTime}
                  localOpenTime={props.localOpenTime}
                  localCloseTime={props.localCloseTime}
                  userTimezone={props.userTimezone}
                  city={props.city}
                  country={props.country}
                  onViewDetails={() => {
                    const exchangeData = {
                      id: props.id,
                      name: props.name,
                      shortName: props.shortName,
                      country: props.country,
                      city: props.city,
                      region: props.region,
                      isOpen: props.isOpen,
                      status: props.status,
                      nextStatusText: props.nextStatusText,
                      timeUntilNextStatus: props.timeUntilNextStatus,
                      exchangeTime: props.exchangeTime,
                      localOpenTime: props.localOpenTime,
                      localCloseTime: props.localCloseTime,
                      userTimezone: props.userTimezone,
                      currency: props.currency,
                      indices: props.indices,
                      website: props.website,
                      timezone: props.timezone,
                      isExchange: true,
                      location: { coordinates: { lat, lng: lon } }
                    };
                    handleCardClick(exchangeData);
                  }}
                />
              ) : (
                <div className="bg-gradient-to-br from-gray-900/98 via-gray-900/95 to-gray-950/98 border border-gray-700/50 rounded-lg p-2.5 text-white shadow-2xl backdrop-blur-xl relative overflow-hidden w-full">

                  {/* Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>

                  {/* GROUP (EVENT) POPUP */}
                  {isGroup ? (
                    <div className="relative z-10">
                      {(props.imageUrl || props.image_url || props.image) && (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-800 mb-2">
                          <img
                            src={props.imageUrl || props.image_url || props.image}
                            alt={props.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        </div>
                      )}
                      <div className="mb-2">
                        <h3 className="font-semibold text-sm leading-tight text-white mb-1.5">{props.title}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {props.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-700/40 text-purple-300 border border-purple-600/30">
                            {props.marketCount} Options
                          </span>
                        </div>
                      </div>

                      {/* Markets List */}
                      <div className="space-y-1.5 mb-2 max-h-64 overflow-y-auto">
                        {props.markets && JSON.parse(JSON.stringify(props.markets)).map((market: any, idx: number) => (
                          <div key={idx} className="bg-gray-800/40 rounded p-2 border border-gray-700/30 hover:bg-gray-800/60 transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Market Click Logic
                              const fullMarket = { ...market, location: { coordinates: { lat, lng: lon } } };
                              handleCardClick(fullMarket);
                            }}>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-white line-clamp-2">{market.title}</div>
                              </div>
                              <div className="flex-shrink-0">
                                <span className="text-sm font-bold text-blue-300">{Math.round(market.price * 100)}¢</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // SINGLE MARKET POPUP
                    <div className="relative z-10">
                      <div className="absolute -top-1 -right-1 bg-gradient-to-br from-blue-500 to-blue-600 text-white px-2.5 py-1 rounded-lg shadow-lg z-10">
                        <span className="text-lg font-bold tabular-nums">{Math.round(props.last_price * 100)}¢</span>
                      </div>

                      {(props.imageUrl || props.image_url || props.image) && (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-800 mb-2">
                          <img
                            src={props.imageUrl || props.image_url || props.image}
                            alt={props.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        </div>
                      )}

                      <div className="mb-2.5">
                        <h3 className="font-semibold text-sm leading-tight text-white line-clamp-3 mb-1.5 pr-10">{props.title}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {props.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                          </span>
                        </div>
                      </div>

                      <div className="mb-2">
                        <MarketHoverChart
                          marketId={props.id || props.market_id}
                          platform={props.platform}
                          currentPrice={props.last_price || props.price}
                          priceChange={props.price_movement}
                          enabled={true}
                        />
                      </div>

                      <button
                        className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded shadow hover:bg-blue-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          const marketId = props.id || props.market_id;
                          let market = rawMarkets?.find((m: any) => m.id === marketId);
                          if (!market) {
                            // Reconstruct if missing
                            market = {
                              id: marketId,
                              title: props.title,
                              platform: props.platform,
                              price: props.last_price || props.price,
                              // ... other props
                              rawData: props.rawData || {}
                            };
                          }
                          if (market) {
                            handleCardClick({ ...market, location: { coordinates: { lat, lng: lon } } });
                          }
                        }}
                      >
                        View Market
                      </button>
                    </div>
                  )}
                </div>
              )}
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

    if (selectedMarket) {
      const lat = selectedMarket.location?.coordinates?.lat ?? selectedMarket.latitude;
      const lng = selectedMarket.location?.coordinates?.lng ?? selectedMarket.longitude;

      if (lat != null && lng != null) {
        map.flyTo({
          center: [lng, lat],
          zoom: 6,
          duration: 2000,
          padding: { right: 450, top: 0, bottom: 0, left: 0 }
        });
      }
    } else if (!selectedMarket) {
      map.easeTo({
        padding: { right: 0, top: 0, bottom: 0, left: 0 },
        duration: 1000
      });
    }
  }, [selectedMarket, getMapIfReady, isStyleLoaded]);

  // Handle projection change


  // Compute interactive layers - memoize to prevent re-renders
  const interactiveIds = useMemo(() => {
    const common = [
      'news-layer',
      'news-glow',
      'finance-layer',
      'custom-layer',
      'census-layer',
      'census-fill',
      'tweets-layer',
      'exchanges-layer',        // Always interactive if rendered
      'exchanges-glow-layer'    // Always interactive if rendered
    ];

    if (visualizationMode === 'heatmap') {
      // In heatmap mode, keep dots invisible but interactive for clicks
      return ['markets-layer', 'markets-glow-layer', ...common];
    } else if (visualizationMode === 'cluster') {
      return ['markets-clusters', 'markets-unclustered', 'markets-unclustered-glow', ...common];
    } else {
      // Default dots mode
      return ['markets-layer', 'markets-glow-layer', 'feed-conflict', 'feed-tech', 'feed-contracts', 'feed-policy', 'feed-layoffs', 'feed-crypto-whale', ...common];
    }
  }, [visualizationMode]);

  // Debug: Log map and layer state on load
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      const logState = () => {
        // Debug logs disabled
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
              // Click handler attached
            });
          }
          if (map.getLayer('markets-glow-layer')) {
            map.on('click', 'markets-glow-layer', (e: any) => {
              // Click handler attached
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
        initialViewState={{
          longitude: 0,
          latitude: projection === 'mercator' ? 20 : 0,
          zoom: 2.5,
          pitch: 0,
          bearing: 0
        }}
        projection={projection === 'globe' ? { type: 'globe' } : { type: 'mercator' }}
        cursor={cursor}
        onMove={evt => {
          setViewState(evt.viewState);
          nativeLongitudeRef.current = evt.viewState.longitude;
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

        {/* OSINT Layer (NASA FIRMS) */}
        {/* OSINT / Wildfires Layer */}
        {(activeFilters.fires || isLayerActive('WILDFIRES')) && (
          <Source id="firms" type="raster" tiles={['https://firms.modaps.eosdis.nasa.gov/mapserver/tms/1.0.0/Fires_All/{z}/{x}/{y}.png']} tileSize={256}>
            <Layer {...firmsLayer} />
          </Source>
        )}

        {/* Community Layers: Shipping (Mock Tile for demo) */}
        {isLayerActive('SHIPPING') && (
          <Source id="shipping" type="geojson" data={{ type: 'FeatureCollection', features: [] } as any}>
            {/* Placeholder for shipping data */}
          </Source>
        )}

        {isLayerActive('PREDICTION') && (
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
                {/* Overlay individual market dots on top of heatmap for interactivity but keep them invisible */}
                <Layer {...marketGlowLayer as any} paint={{
                  ...marketGlowLayer.paint,
                  'circle-opacity': 0,
                  'circle-stroke-opacity': 0
                }} />
                <Layer {...marketLayer as any} paint={{
                  ...marketLayer.paint,
                  'text-opacity': 0
                }} />
              </>
            ) : visualizationMode === 'cluster' ? (
              <>
                <Layer {...unclusteredGlowLayer as any} />
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
        )}

        {/* Exchanges Layer (Part of Financials) */}
        {isLayerActive('FINANCE') && (
          <Source
            id="exchanges"
            type="geojson"
            data={filteredExchanges as any}
          >
            <Layer {...exchangeGlowLayer as any} />
            <Layer {...exchangeLayer as any} />
          </Source>
        )}

        <Source id="tweets" type="geojson" data={filteredTweets as any}>
          <Layer {...tweetLayer as any} />
        </Source>

        {/* Live Pulse Layer */}
        <LivePulseLayer active={activeFilters.live} />

        {/* NEWS Layer */}
        {isLayerActive('NEWS') && (
          <Source id="news-source" type="geojson" data={newsData as any}>
            <Layer
              id="news-layer"
              type="symbol"
              layout={{
                'text-field': ['get', 'icon'],
                'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
                'text-size': [
                  'interpolate',
                  ['linear'],
                  ['get', 'importance'],
                  0, 14,
                  0.5, 18,
                  1, 24
                ],
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'importance'],
                  0, '#f8fafc', // Bright Slate 50 (almost white)
                  1, '#22d3ee'  // Cyan 400
                ],
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5,
                'text-halo-blur': 1,
                'text-opacity': 0.95
              }}
            />
            <Layer
              id="news-glow"
              type="circle"
              paint={{
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['get', 'importance'],
                  0, 8,
                  1, 24
                ],
                'circle-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'importance'],
                  0, '#38bdf8', // Sky 400
                  1, '#06b6d4'  // Cyan 500
                ],
                'circle-opacity': 0.2,
                'circle-blur': 0.8
              }}
            />
          </Source>
        )}

        {/* FINANCE Layer */}
        {isLayerActive('FINANCE') && (
          <Source id="finance-source" type="geojson" data={financeData as any}>
            <Layer
              id="finance-layer"
              type="symbol"
              layout={{
                'text-field': ['get', 'icon'],
                'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
                'text-size': 20,
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-color': '#fbbf24', // Amber/Gold 400
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5,
                'text-halo-blur': 1,
                'text-opacity': 0.95
              }}
            />
            <Layer
              id="finance-glow"
              type="circle"
              paint={{
                'circle-radius': 15,
                'circle-color': '#fbbf24',
                'circle-opacity': 0.15,
                'circle-blur': 0.8
              }}
            />
          </Source>
        )}

        {/* CUSTOM Layer */}
        {isLayerActive('CUSTOM') && (
          <Source id="custom-source" type="geojson" data={customData as any}>
            <Layer
              id="custom-layer"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': '#A020F0',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
              }}
            />
          </Source>
        )}

        {/* FEED LAYERS (Conflict, Contracts, Policy, etc.) */}
        {/* We assume these features are passed in via overrideMarkets/markets or a dedicated feeds prop.
            For now, check if they exist in the main data source or a new source.
            The simplified approach is to rely on 'layer' property in the single main source if possible,
            but EdgeMap splits sources. Let's assume we pass them as a merged 'feeds' source or handle them in 'custom'
            but with data-driven styling.
            
            BETTER: Add a dedicated FEEDS Source that accepts generic features with 'layer' property.
        */}
        {(activeFilters.feeds || Object.keys(activeFilters).some(k => k.startsWith('feed_'))) && (
          <Source id="feeds-source" type="geojson" data={feedData || { type: 'FeatureCollection', features: [] } as any}>
            {/* Conflict Layer - Red/Pulsing */}
            <Layer
              id="feed-conflict"
              type="symbol"
              filter={['==', ['get', 'layer'], 'conflict']}
              layout={{
                'text-field': '🔥',
                'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
                'text-size': 20,
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-halo-color': '#fff',
                'text-halo-width': 1.5,
                'text-halo-blur': 1,
                'text-opacity': 0.9
              }}
            />
            <Layer
              id="feed-conflict-glow"
              type="circle"
              filter={['==', ['get', 'layer'], 'conflict']}
              paint={{
                'circle-radius': 15,
                'circle-color': '#ef4444',
                'circle-opacity': 0.3,
                'circle-blur': 0.5
              }}
            />

            {/* Tech Layer - Cyan/Cyber */}
            <Layer
              id="feed-tech"
              type="symbol"
              filter={['==', ['get', 'layer'], 'tech']}
              layout={{
                'text-field': '⚡',
                'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
                'text-size': 18,
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-halo-color': '#fff',
                'text-halo-width': 1,
                'text-halo-blur': 1,
                'text-opacity': 0.9
              }}
            />

            {/* Contracts Layer - Emerald/Money */}
            <Layer
              id="feed-contracts"
              type="symbol"
              filter={['==', ['get', 'layer'], 'contracts']}
              layout={{
                'text-field': '💼',
                'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
                'text-size': 18,
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-halo-color': '#fff',
                'text-halo-width': 1,
                'text-halo-blur': 1,
                'text-opacity': 0.9
              }}
            />

            {/* Policy Layer - Violet/Gov */}
            <Layer
              id="feed-policy"
              type="symbol"
              filter={['==', ['get', 'layer'], 'policy']}
              layout={{
                'text-field': '🏛️',
                'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
                'text-size': 18,
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-halo-color': '#fff',
                'text-halo-width': 1,
                'text-halo-blur': 1,
                'text-opacity': 0.9
              }}
            />

            {/* Layoffs Layer - Orange/Warning */}
            <Layer
              id="feed-layoffs"
              type="symbol"
              filter={['==', ['get', 'layer'], 'layoffs']}
              layout={{
                'text-field': '📉',
                'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
                'text-size': 18,
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-halo-color': '#fff',
                'text-halo-width': 1,
                'text-halo-blur': 1,
                'text-opacity': 0.9
              }}
            />

            {/* Crypto Whales - Indigo */}
            <Layer
              id="feed-crypto-whale"
              type="symbol"
              filter={['==', ['get', 'layer'], 'crypto-whale']}
              layout={{
                'text-field': '🪙',
                'text-font': ['Noto Color Emoji Regular', 'Arial Unicode MS Regular'],
                'text-size': 22,
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true
              }}
              paint={{
                'text-halo-color': '#fff',
                'text-halo-width': 2,
                'text-halo-blur': 1,
                'text-opacity': 0.9
              }}
            />
          </Source>
        )}

        {/* CENSUS Layer - Data-driven styling based on dataset type */}
        {isLayerActive('CENSUS') && selectedCensusDataset && censusData.features?.length > 0 && (
          <Source id="census-source" type="geojson" data={censusData as any}>
            {/* Choropleth Fill Layer - for Polygons (County Level Pop/Income/Poverty) */}
            <Layer
              id="census-fill"
              type="fill"
              filter={['==', '$type', 'Polygon']}
              paint={{
                'fill-color': ['coalesce', ['get', 'color'], '#3b82f6'],
                'fill-opacity': 0.7,
                'fill-outline-color': 'rgba(255,255,255,0.2)'
              }}
            />

            {/* Glow Layer - for Points */}
            <Layer
              id="census-glow"
              type="circle"
              filter={['==', '$type', 'Point']}
              paint={{
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'normalizedValue'], 0.5],
                  0, 12,
                  1, 45
                ],
                'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
                'circle-opacity': 0.15,
                'circle-blur': 0.9
              }}
            />
            {/* Main Circle Layer - for Points */}
            <Layer
              id="census-layer"
              type="circle"
              filter={['==', '$type', 'Point']}
              paint={{
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'normalizedValue'], 0.5],
                  0, ['coalesce', ['get', 'size'], 5],
                  1, ['+', ['coalesce', ['get', 'size'], 5], 12]
                ],
                'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
                'circle-stroke-width': [
                  'case',
                  ['==', ['get', 'geography'], 'county'], 1,
                  1.5
                ],
                'circle-stroke-color': '#ffffff',
                'circle-opacity': [
                  'case',
                  ['==', ['get', 'geography'], 'county'], 0.85,
                  0.95
                ]
              }}
            />
            {/* Label Layer for state-level only */}
            {censusGeography === 'state' && (
              <Layer
                id="census-labels"
                type="symbol"
                layout={{
                  'text-field': ['get', 'stateName'],
                  'text-size': 10,
                  'text-offset': [0, 1.5],
                  'text-anchor': 'top',
                  'text-optional': true,
                }}
                paint={{
                  'text-color': '#ffffff',
                  'text-halo-color': '#000000',
                  'text-halo-width': 1,
                }}
              />
            )}
          </Source>
        )}

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
  feedData,
  onZoomChange,
  onViewChange,
  shouldResetZoom,
  visualizationMode = 'dots',
  showLabels = true,
  showGrid = false,
  marketType = 'prediction',
  onInteractionStart
}: EdgeMapProps) {
  const { markets, tweets, rawMarkets, isLoading } = useEdgeData();
  const { geoJSON: exchangeGeoJSON } = useExchanges();
  const [mounted, setMounted] = useState(false);

  // If overrideMarkets is provided, use it, otherwise default.
  // When marketType is 'financial', show exchanges instead of prediction markets
  // ALSO, if a market is selected, ensure it's included in the display list so it can be seen/focused.
  const displayMarkets = useMemo(() => {
    // If financial mode, use exchanges
    if (marketType === 'financial') {
      return exchangeGeoJSON;
    }

    // Otherwise use prediction markets
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
  }, [marketType, exchangeGeoJSON, overrideMarkets, markets, selectedMarket]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-full h-full bg-black" />;

  return (
    <InnerMap
      markets={overrideMarkets || markets} // Always pass prediction markets here
      exchanges={exchangeGeoJSON} // Always pass exchanges here
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
      marketType={marketType}
      onInteractionStart={onInteractionStart}
      feedData={feedData}
    />
  );
}
