'use client';

import { MarketCardStack } from '@/components/polyglobe/MarketCardStack';
import { EnrichedMarket } from '@/lib/markets/enrich';
import React, { useState, useEffect } from 'react';
import { PolyglobeMap } from '@/components/polyglobe/PolyglobeMap';
import { PolyglobeUI } from '@/components/polyglobe/PolyglobeUI';
import { CountryNewsPanel } from '@/components/polyglobe/CountryNewsPanel';
import { Starfield } from '@/components/polyglobe/Starfield';
import { GlobeSettings } from '@/components/polyglobe/GlobeSettings';
import { useSearch } from '@/hooks/use-search';
import { MarketDetails } from '@/components/panels/MarketDetails';

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

  const { markets, isLoading } = useSearch({ q: searchQuery, limit: 100 });

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

  const handleMarketClick = (market: EnrichedMarket) => {
    console.log('Market selected:', market);
    setSelectedMarket(market);
    setSelectedCountry(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950">
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
        />
      </div>
      <PolyglobeUI
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        activeFilters={activeFilters}
        onViewToggle={handleViewToggle}
        currentView={viewMode}
        isPlaying={isPlaying}
        onPlayPause={setIsPlaying}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        searchResults={markets}
        onMarketSelect={handleMarketClick}
        isSearching={isLoading}
      />

      {/* Search results are now handled inside PolyglobeUI */}

      <MarketDetails
        market={selectedMarket as any}
        onClose={() => setSelectedMarket(null)}
      />

      <CountryNewsPanel
        country={selectedCountry}
        onClose={handleCloseNews}
      />

      <GlobeSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        rotationSpeed={rotationSpeed}
        onRotationSpeedChange={setRotationSpeed}
        pauseOnHover={pauseOnHover}
        onPauseOnHoverChange={setPauseOnHover}
        autoRotate={isPlaying}
        onAutoRotateChange={setIsPlaying}
      />
    </div>
  );
}

