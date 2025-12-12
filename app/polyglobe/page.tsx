'use client';

import React, { useState, useEffect } from 'react';
import { PolyglobeMap } from '@/components/polyglobe/PolyglobeMap';
import { PolyglobeUI } from '@/components/polyglobe/PolyglobeUI';
import { CountryNewsPanel } from '@/components/polyglobe/CountryNewsPanel';

export default function PolyglobePage() {
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    breaking: false,
    osint: true,
    live: true,
    fires: false,
    frontline: false
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'globe'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('polyglobe-view-mode');
      return (saved === 'globe' || saved === 'map') ? saved : 'map';
    }
    return 'map';
  });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

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
  };

  const handleCloseNews = () => {
    setSelectedCountry(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950">
      <div className={`absolute inset-0 transition-opacity duration-150 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
        <PolyglobeMap 
          activeFilters={activeFilters} 
          searchQuery={searchQuery}
          projection={viewMode === 'globe' ? 'globe' : 'mercator'}
          onCountryClick={handleCountryClick}
        />
      </div>
      <PolyglobeUI 
        onSearch={handleSearch} 
        onFilterChange={handleFilterChange} 
        activeFilters={activeFilters}
        onViewToggle={handleViewToggle}
        currentView={viewMode}
      />
      {selectedCountry && (
        <CountryNewsPanel 
          country={selectedCountry}
          onClose={handleCloseNews}
        />
      )}
    </div>
  );
}
