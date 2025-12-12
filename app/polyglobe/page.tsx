'use client';

import React, { useState } from 'react';
import { PolyglobeMap } from '@/components/polyglobe/PolyglobeMap';
import { PolyglobeUI } from '@/components/polyglobe/PolyglobeUI';

export default function PolyglobePage() {
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    breaking: false,
    osint: true,
    live: true,
    fires: false,
    frontline: false
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'globe'>('map');

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (filter: string, active: boolean) => {
    setActiveFilters(prev => ({ ...prev, [filter]: active }));
  };

  const handleViewToggle = () => {
    setViewMode(prev => prev === 'map' ? 'globe' : 'map');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950">
      <div className="absolute inset-0">
        <PolyglobeMap 
          activeFilters={activeFilters} 
          searchQuery={searchQuery}
          projection={viewMode === 'globe' ? 'globe' : 'mercator'}
        />
      </div>
      <PolyglobeUI 
        onSearch={handleSearch} 
        onFilterChange={handleFilterChange} 
        activeFilters={activeFilters}
        onViewToggle={handleViewToggle}
        currentView={viewMode}
      />
    </div>
  );
}
