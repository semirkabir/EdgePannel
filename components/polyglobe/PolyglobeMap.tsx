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

import { MarketCardStack } from './MarketCardStack';

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
  pauseOnHover = false
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
}) {
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: projection === 'mercator' ? 20 : 0,
    zoom: 2.5, // Same default zoom for both globe and map views
    pitch: 0,
    bearing: 0
  });

  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rotationAnimationRef = useRef<number | null>(null);

  // Auto-rotate globe when playing (spin around vertical axis like Earth)
  // Pause rotation when user is interacting
  useEffect(() => {
    if (projection !== 'globe' || !isPlaying || isUserInteracting) {
      // Stop rotation if animation is running
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }
      return;
    }

    let lastTime = performance.now();
    const rotationSpeed = 0.05; // degrees per frame (slow rotation)

    const rotate = (currentTime: number) => {
      // Check again if we should still rotate
      const shouldPause = pauseOnHover ? (isUserInteracting || isHovering) : isUserInteracting;
      if (projection !== 'globe' || !isPlaying || shouldPause) {
        rotationAnimationRef.current = null;
        return;
      }

      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      setViewState(prev => ({
        ...prev,
        longitude: (prev.longitude + rotationSpeed * (deltaTime / 16.67)) % 360, // Rotate longitude to spin around vertical axis
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
  }, [projection, isPlaying, isUserInteracting, isHovering, pauseOnHover, rotationSpeed]);

  // Handle user interaction - pause rotation immediately
  const handleInteractionStart = useCallback(() => {
    setIsUserInteracting(true);
    // Immediately stop rotation
    if (rotationAnimationRef.current) {
      cancelAnimationFrame(rotationAnimationRef.current);
      rotationAnimationRef.current = null;
    }
    // Clear any pending timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  }, []);

  const handleInteractionEnd = useCallback(() => {
    // Resume rotation after 2 seconds of no interaction
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 2000);
  }, []);

  const [hoverInfo, setHoverInfo] = useState<{
    feature: any;
    x: number;
    y: number;
  } | null>(null);

  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [countryBorders, setCountryBorders] = useState<any>(null);
  const mapRef = useRef<MapRef>(null);

  // Load country borders GeoJSON
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
  }, []);

  const onClick = useCallback(async (event: MapLayerMouseEvent) => {
    // Check if clicking on a feature (market or tweet)
    const feature = event.features && event.features.length > 0 ? event.features[0] : null;

    if (feature) {
      setSelectedFeature(feature);
      return; // Don't trigger country click when clicking on a feature
    }

    // Clear selected feature
    setSelectedFeature(null);

    // If clicking on empty map area, try to detect country
    if (onCountryClick && event.lngLat) {
      console.log('Map clicked at:', event.lngLat, 'Detecting country...');

      try {
        // Use OpenStreetMap Nominatim (free, no API key required)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${event.lngLat.lat}&lon=${event.lngLat.lng}&zoom=3&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'EdgePannel/1.0'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          // console.log('Nominatim response:', data);

          if (data.address && data.address.country) {
            onCountryClick(data.address.country);
          }
        }
      } catch (error) {
        console.error('Error detecting country:', error);
      }
    }
  }, [onCountryClick]);

  // Filter data based on active filters
  const filteredMarkets = useMemo(() => {
    let features = markets.features || [];

    if (!activeFilters.live && !activeFilters.breaking) {
      features = [];
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

  const filteredRawMarkets = useMemo(() => {
    let items = rawMarkets || [];

    if (!activeFilters.live && !activeFilters.breaking) {
      items = [];
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((m: any) =>
        (m.title || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
      );
    }

    // Sort by volume or importance? Default newest/highest vol usually
    return items.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
  }, [rawMarkets, activeFilters, searchQuery]);

  const filteredTweets = useMemo(() => {
    if (!activeFilters.osint) return { type: 'FeatureCollection', features: [] };
    return tweets;
  }, [tweets, activeFilters.osint]);

  const marketLayer = {
    id: 'markets-layer',
    type: 'circle',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'volume'],
        0, 3,
        10000, 8,
        100000, 15
      ],
      'circle-color': [
        'case',
        ['>', ['get', 'price_movement'], 0], '#10b981', // green for up
        ['<', ['get', 'price_movement'], 0], '#ef4444', // red for down
        '#3b82f6' // blue default
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff'
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
              <a
                href={props.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 rounded transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                TRADE ON POLYMARKET
              </a>
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

  const handleCardClick = (market: any) => {
    if (!market.location || !market.location.coordinates) return;

    const { lat, lng } = market.location.coordinates;

    // Fly to location
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 6,
      duration: 2000
    });

    // Select the feature logic (simplified simulation)
    // We would ideally find the feature in the source, but we can just rely on zoom.
    // Or set selectedFeature manually from the market data, transforming it to feature format.
    setSelectedFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: market.id,
        market_id: market.id,
        title: market.title,
        url: `https://polymarket.com/market/${market.id}`,
        last_price: market.price || 0,
        volume: market.volume24h || 0,
        description: market.description
      },
      layer: { id: 'markets-layer' } // Mock layer to satisfy renderPopup check
    });
  };

  // Add direct map click handler for base map clicks
  useEffect(() => {
    if (!mapRef.current || !onCountryClick) return;

    const map = mapRef.current.getMap();

    const handleMapClick = async (e: any) => {
      // Only process if no features were clicked
      if (!e.originalEvent || e.originalEvent.defaultPrevented) return;

      const lngLat = e.lngLat;
      if (!lngLat) return;

      // console.log('Base map clicked at:', lngLat);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lngLat.lat}&lon=${lngLat.lng}&zoom=3&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'EdgePannel/1.0'
            }
          }
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
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [onCountryClick]);

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: projection === 'globe' ? 'transparent' : '#030712' }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => {
          setViewState(evt.viewState);
          // Detect if this is user-initiated movement (not auto-rotation)
          if (evt.viewState.longitude !== viewState.longitude && isUserInteracting) {
            handleInteractionStart();
          }
        }}
        onMoveStart={handleInteractionStart}
        onMoveEnd={handleInteractionEnd}
        onDragStart={handleInteractionStart}
        onDragEnd={handleInteractionEnd}
        onDrag={handleInteractionStart}
        onZoomStart={handleInteractionStart}
        onZoomEnd={handleInteractionEnd}
        onRotateStart={handleInteractionStart}
        onRotateEnd={handleInteractionEnd}
        onPitchStart={handleInteractionStart}
        onPitchEnd={handleInteractionEnd}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://api.maptiler.com/maps/darkmatter/style.json?key=35TZqSTSBjgDvsawKAK9"
        attributionControl={false}
        interactiveLayerIds={['markets-layer', 'tweets-layer']}
        onMouseEnter={(e) => {
          onHover(e);
          // Only pause on hover if hovering over a market or tweet feature
          if (pauseOnHover && projection === 'globe' && e.features && e.features.length > 0) {
            setIsHovering(true);
          }
        }}
        onMouseLeave={(e) => {
          setHoverInfo(null);
          if (pauseOnHover && projection === 'globe') {
            setIsHovering(false);
          }
        }}
        onClick={onClick}
        projection={projection}
        dragRotate={true}
        touchZoomRotate={true}
        {...(projection === 'globe' ? {
          fog: {
            "range": [0.5, 10],
            "color": "rgb(3, 7, 18)",
            "high-color": "#1e293b",
            "space-color": "#000000",
            "horizon-blend": 0.04
          },
          terrain: { source: 'terrain', exaggeration: 1.5 }
        } : {})}
      >
        <NavigationControl position="bottom-right" />
        <FullscreenControl position="bottom-right" />

        <Source id="markets" type="geojson" data={filteredMarkets as any}>
          <Layer {...marketLayer as any} />
        </Source>

        <Source id="tweets" type="geojson" data={filteredTweets as any}>
          <Layer {...tweetLayer as any} />
        </Source>

        {/* Country borders layer */}
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

      {/* Market Cards Stack - Bottom Right */}
      <div className="absolute bottom-10 right-14 z-20 pointer-events-none">
        <MarketCardStack
          markets={filteredRawMarkets}
          onMarketClick={handleCardClick}
          className="pointer-events-auto"
        />
      </div>

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
    </div>
  );
}

export function PolyglobeMap({ activeFilters, searchQuery = '', projection = 'mercator', onCountryClick, isPlaying = true, rotationSpeed = 0.05, pauseOnHover = false }: PolyglobeMapProps) {
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
    />
  );
}

