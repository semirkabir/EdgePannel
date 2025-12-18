'use client';

import React, { useState, useEffect, useRef } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Mock market data for demo
const MOCK_MARKETS = [
  {
    id: '1',
    title: 'Will Bitcoin reach $100k in 2026?',
    lat: 40.7128,
    lng: -74.0060,
    location: 'New York, USA',
    platform: 'polymarket',
    price: 0.68,
    change: 5.2,
    volume: 142000,
    category: 'Crypto'
  },
  {
    id: '2',
    title: 'S&P 500 to hit new ATH in Q1?',
    lat: 37.7749,
    lng: -122.4194,
    location: 'San Francisco, USA',
    platform: 'kalshi',
    price: 0.42,
    change: -3.1,
    volume: 89000,
    category: 'Economics'
  },
  {
    id: '3',
    title: 'Fed rate cut in March 2026?',
    lat: 38.9072,
    lng: -77.0369,
    location: 'Washington DC, USA',
    platform: 'polymarket',
    price: 0.55,
    change: 2.8,
    volume: 234000,
    category: 'Politics'
  },
  {
    id: '4',
    title: 'AI regulation passed in EU?',
    lat: 50.8503,
    lng: 4.3517,
    location: 'Brussels, Belgium',
    platform: 'kalshi',
    price: 0.73,
    change: 8.4,
    volume: 156000,
    category: 'Technology'
  },
  {
    id: '5',
    title: 'UK general election in 2026?',
    lat: 51.5074,
    lng: -0.1278,
    location: 'London, UK',
    platform: 'polymarket',
    price: 0.38,
    change: -1.5,
    volume: 98000,
    category: 'Politics'
  },
  {
    id: '6',
    title: 'China GDP growth > 5%?',
    lat: 39.9042,
    lng: 116.4074,
    location: 'Beijing, China',
    platform: 'kalshi',
    price: 0.61,
    change: 3.7,
    volume: 187000,
    category: 'Economics'
  },
  {
    id: '7',
    title: 'Japan to lift rates in Q2?',
    lat: 35.6762,
    lng: 139.6503,
    location: 'Tokyo, Japan',
    platform: 'polymarket',
    price: 0.45,
    change: 4.2,
    volume: 123000,
    category: 'Economics'
  },
  {
    id: '8',
    title: 'Major earthquake in California?',
    lat: 34.0522,
    lng: -118.2437,
    location: 'Los Angeles, USA',
    platform: 'kalshi',
    price: 0.12,
    change: 0.8,
    volume: 67000,
    category: 'Weather'
  },
  {
    id: '9',
    title: 'Olympics Gold medal count USA > 40?',
    lat: 48.8566,
    lng: 2.3522,
    location: 'Paris, France',
    platform: 'polymarket',
    price: 0.67,
    change: 2.1,
    volume: 145000,
    category: 'Sports'
  },
  {
    id: '10',
    title: 'Australia climate bill passed?',
    lat: -33.8688,
    lng: 151.2093,
    location: 'Sydney, Australia',
    platform: 'kalshi',
    price: 0.52,
    change: -2.3,
    volume: 91000,
    category: 'Politics'
  },
  {
    id: '11',
    title: 'Brazil deforestation reduced 30%?',
    lat: -15.8267,
    lng: -47.9218,
    location: 'Brasília, Brazil',
    platform: 'polymarket',
    price: 0.34,
    change: 6.5,
    volume: 78000,
    category: 'Weather'
  },
  {
    id: '12',
    title: 'India tech exports exceed $200B?',
    lat: 28.6139,
    lng: 77.2090,
    location: 'New Delhi, India',
    platform: 'kalshi',
    price: 0.58,
    change: 1.9,
    volume: 134000,
    category: 'Technology'
  }
];

interface EdgePreviewProps {
  className?: string;
}

export function EdgePreview({ className }: EdgePreviewProps) {
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 1.8,
    pitch: 0,
    bearing: 0
  });
  const [hoveredMarket, setHoveredMarket] = useState<typeof MOCK_MARKETS[0] | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const rotationAnimationRef = useRef<number | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-rotate globe (pauses on hover)
  useEffect(() => {
    if (isHovering) {
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }
      return;
    }

    let lastTime = performance.now();
    const rotationSpeed = 0.03;

    const rotate = (currentTime: number) => {
      if (isHovering) {
        rotationAnimationRef.current = null;
        return;
      }

      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      setViewState(prev => ({
        ...prev,
        longitude: (prev.longitude + rotationSpeed * (deltaTime / 16.67)) % 360,
      }));

      rotationAnimationRef.current = requestAnimationFrame(rotate);
    };

    rotationAnimationRef.current = requestAnimationFrame(rotate);

    return () => {
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
      }
    };
  }, [isHovering]);

  // Cycle through markets to show popups automatically
  useEffect(() => {
    const showRandomMarket = () => {
      const randomMarket = MOCK_MARKETS[Math.floor(Math.random() * MOCK_MARKETS.length)];
      setHoveredMarket(randomMarket);

      // Clear after 3 seconds
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredMarket(null);
      }, 3000);
    };

    // Show first market after 2 seconds
    const initialTimeout = setTimeout(showRandomMarket, 2000);

    // Then show a random market every 8 seconds
    const interval = setInterval(showRandomMarket, 8000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Convert markets to GeoJSON
  const marketsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: MOCK_MARKETS.map(market => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [market.lng, market.lat]
      },
      properties: {
        ...market,
        size: Math.log(market.volume) / 12
      }
    }))
  };

  return (
    <div
      className={className}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-950 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#00ff7f]/30 border-t-[#00ff7f] rounded-full animate-spin" />
            <span className="text-xs text-gray-500 font-mono">Loading globe...</span>
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onLoad={() => setIsLoaded(true)}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        projection={{ type: 'globe' }}
        style={{ width: '100%', height: '100%' }}
        dragPan={false}
        dragRotate={false}
        scrollZoom={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        interactive={false}
      >
        {/* Market points layer */}
        <Source id="markets" type="geojson" data={marketsGeoJSON}>
          <Layer
            id="market-circles"
            type="circle"
            paint={{
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'size'],
                0.5, 4,
                2, 10
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'platform'], 'polymarket'],
                '#2196F3',
                '#00ff7f'
              ],
              'circle-opacity': 0.8,
              'circle-stroke-width': 2,
              'circle-stroke-color': [
                'case',
                ['==', ['get', 'platform'], 'polymarket'],
                '#64B5F6',
                '#4fffb0'
              ],
              'circle-stroke-opacity': 0.6
            }}
          />

          {/* Pulsing effect layer */}
          <Layer
            id="market-pulse"
            type="circle"
            paint={{
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'size'],
                0.5, 8,
                2, 16
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'platform'], 'polymarket'],
                '#2196F3',
                '#00ff7f'
              ],
              'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 0.1,
                5, 0.05
              ]
            }}
          />
        </Source>

        {/* Highlighted market layer */}
        {hoveredMarket && (
          <Source
            id="highlighted-market"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [hoveredMarket.lng, hoveredMarket.lat]
              },
              properties: hoveredMarket
            }}
          >
            <Layer
              id="highlighted-glow"
              type="circle"
              paint={{
                'circle-radius': 20,
                'circle-color': hoveredMarket.platform === 'polymarket' ? '#2196F3' : '#00ff7f',
                'circle-opacity': 0.2,
                'circle-blur': 1
              }}
            />
            <Layer
              id="highlighted-ring"
              type="circle"
              paint={{
                'circle-radius': 12,
                'circle-color': hoveredMarket.platform === 'polymarket' ? '#2196F3' : '#00ff7f',
                'circle-opacity': 0,
                'circle-stroke-width': 2,
                'circle-stroke-color': hoveredMarket.platform === 'polymarket' ? '#64B5F6' : '#4fffb0',
                'circle-stroke-opacity': 1
              }}
            />
          </Source>
        )}

        {/* Hover popup */}
        {hoveredMarket && (
          <Popup
            longitude={hoveredMarket.lng}
            latitude={hoveredMarket.lat}
            closeButton={false}
            closeOnClick={false}
            className="market-popup"
            offset={15}
            style={{ zIndex: 100 }}
          >
            <div className="bg-[#0e0f11]/95 backdrop-blur-xl border border-white/10 rounded-lg p-3 min-w-[240px] animate-in fade-in duration-300">
              {/* Platform badge */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono uppercase tracking-wider ${hoveredMarket.platform === 'polymarket' ? 'text-blue-400' : 'text-[#00ff7f]'
                  }`}>
                  {hoveredMarket.platform}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  {hoveredMarket.category}
                </span>
              </div>

              {/* Title */}
              <h4 className="text-xs font-medium text-white/90 mb-2 line-clamp-2">
                {hoveredMarket.title}
              </h4>

              {/* Location */}
              <div className="text-[10px] text-gray-500 mb-2">
                📍 {hoveredMarket.location}
              </div>

              {/* Price and stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-mono font-bold tabular-nums ${hoveredMarket.price >= 0.5 ? 'text-[#00ff7f]' : 'text-[#ff4d4d]'
                    }`}>
                    {Math.round(hoveredMarket.price * 100)}%
                  </span>
                  {hoveredMarket.change !== 0 && (
                    <span className={`flex items-center text-[10px] font-medium ${hoveredMarket.change > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                      {hoveredMarket.change > 0 ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      {Math.abs(hoveredMarket.change)}%
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 font-mono">
                  ${(hoveredMarket.volume / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
