'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { Source, Layer, Popup, NavigationControl, FullscreenControl, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { usePolyglobeData } from '@/hooks/use-polyglobe-data';
import { cn } from '@/lib/utils/cn';
import { loadGeoJSON } from '@/lib/geojson-loader';

interface PolyglobeMapProps {
  activeFilters: Record<string, boolean>;
  searchQuery?: string;
  projection?: 'globe' | 'mercator';
  onCountryClick?: (countryName: string) => void;
  isPlaying?: boolean;
  rotationSpeed?: number;
  pauseOnHover?: boolean;
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
  onMarketSelect
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

  // Interaction Handlers
  const handleInteractionStart = useCallback(() => {
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
    if (isDraggingRef.current) return;

    // Check for feature clicks first
    const feature = event.features && event.features.length > 0 ? event.features[0] : null;

    if (feature) {
      if (feature.layer.id === 'markets-layer') {
        const marketId = feature.properties?.id;
        const market = rawMarkets?.find((m: any) => m.id === marketId);
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
  }, [onCountryClick, rawMarkets]);

  // Filter data
  const filteredMarkets = useMemo(() => {
    let features = markets.features || [];

    // Filter for active/breaking
    if (activeFilters.breaking) {
      features = features.filter((f: any) =>
        (f.properties.volume > 50000) || f.properties.price_movement > 0.05
      );
    } else if (!activeFilters.live && !activeFilters.heatmap) {
      if (!activeFilters.live) {
        features = [];
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      features = features.filter((f: any) =>
        (f.properties.title || '').toLowerCase().includes(q) ||
        (f.properties.description || '').toLowerCase().includes(q)
      );
    }

    return { type: 'FeatureCollection', features };
  }, [markets, activeFilters, searchQuery]);

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
    const isMarket = feature.layer.id === 'markets-layer';

    return (
      <Popup
        longitude={lon}
        latitude={lat}
        closeButton={false}
        closeOnClick={false}
        onClose={() => setSelectedFeature(null)}
        anchor="top"
        className="polyglobe-popup z-50"
        maxWidth="320px"
      >
        <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-4 text-white shadow-xl backdrop-blur-md min-w-[240px]">
          {isMarket ? (
            <>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-sm leading-tight text-blue-100">{props.title}</h3>
                <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", "bg-blue-500/20 text-blue-400")}>
                  {Math.round(props.last_price * 100)}¢
                </span>
              </div>
              <div className="text-xs text-gray-400 font-mono mb-3">
                <div>Vol: <span className="text-gray-200">${Math.round(props.volume).toLocaleString()}</span></div>
              </div>
              <button
                className="block text-center w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Find full market data
                  const marketId = props.id || props.market_id;
                  const fullMarket = rawMarkets?.find((m: any) => m.id === marketId);
                  if (fullMarket) {
                    handleCardClick(fullMarket);
                  }
                }}
              >
                VIEW DETAILS
              </button>
            </>
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
    }
  }, [projection]);

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
        onMouseDown={handleInteractionStart}
        onTouchStart={handleInteractionStart}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onHover}
        onClick={onClick}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://api.maptiler.com/maps/darkmatter/style.json?key=35TZqSTSBjgDvsawKAK9"
        attributionControl={false}
        interactiveLayerIds={activeFilters.heatmap ? [] : ['markets-layer', 'tweets-layer']}
      >
        <NavigationControl position="bottom-right" />
        <FullscreenControl position="bottom-right" />

        <Source id="markets" type="geojson" data={filteredMarkets as any}>
          {activeFilters.heatmap ? (
            <Layer {...heatmapLayer as any} source="markets" />
          ) : (
            <>
              <Layer {...marketGlowLayer as any} source="markets" />
              <Layer {...marketLayer as any} source="markets" />
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
  onMarketSelect
}: PolyglobeMapProps & {
  selectedMarket?: any,
  onMarketSelect?: (market: any) => void
}) {
  const { markets, tweets, rawMarkets } = usePolyglobeData();

  return (
    <InnerMap
      markets={markets}
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
    />
  );
}
