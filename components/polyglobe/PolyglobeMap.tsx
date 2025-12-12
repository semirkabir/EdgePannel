'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Map, { Source, Layer, Popup, NavigationControl, FullscreenControl, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { usePolyglobeData } from '@/hooks/use-polyglobe-data';
import { cn } from '@/lib/utils/cn';

interface PolyglobeMapProps {
  activeFilters: Record<string, boolean>;
  searchQuery?: string;
  projection?: 'globe' | 'mercator';
}

// Inner component to isolate Map state from Data updates
function InnerMap({ 
  markets, 
  tweets, 
  activeFilters, 
  searchQuery,
  projection = 'mercator'
}: { 
  markets: any; 
  tweets: any; 
  activeFilters: Record<string, boolean>;
  searchQuery: string;
  projection?: 'globe' | 'mercator';
}) {
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: projection === 'mercator' ? 20 : 0,
    zoom: projection === 'mercator' ? 1.5 : 2,
    pitch: 0,
    bearing: 0
  });

  const [hoverInfo, setHoverInfo] = useState<{
    feature: any;
    x: number;
    y: number;
  } | null>(null);

  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);

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

  const onClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features && event.features[0];
    if (feature) {
      setSelectedFeature(feature);
    } else {
      setSelectedFeature(null);
    }
  }, []);

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
        ['zoom'],
        0, 3, // Zoom 0 -> 3px
        5, 6, // Zoom 5 -> 6px
        10, 10 // Zoom 10 -> 10px
      ],
      'circle-color': [
        'case',
        ['>', ['get', 'price_movement'], 0], '#3b82f6',
        ['<', ['get', 'price_movement'], 0], '#ef4444',
        '#3b82f6'
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

  return (
    <div className="w-full h-full bg-[#030712]">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://api.maptiler.com/maps/darkmatter/style.json?key=35TZqSTSBjgDvsawKAK9"
        attributionControl={false}
        interactiveLayerIds={['markets-layer', 'tweets-layer']}
        onMouseEnter={onHover}
        onMouseLeave={() => setHoverInfo(null)}
        onClick={onClick}
        projection={projection}
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
    </div>
  );
}

export function PolyglobeMap({ activeFilters, searchQuery = '', projection = 'mercator' }: PolyglobeMapProps) {
  const { markets, tweets } = usePolyglobeData();

  return (
    <InnerMap 
      markets={markets} 
      tweets={tweets} 
      activeFilters={activeFilters} 
      searchQuery={searchQuery}
      projection={projection}
    />
  );
}
