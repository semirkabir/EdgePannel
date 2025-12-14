import React, { useState, useRef, useEffect } from 'react';
import { Settings, Play, Pause, Search, Flame, Radio, Activity, Globe, Shield, Map, Filter, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SearchResults } from './SearchResults';
import { EnrichedMarket } from '@/lib/markets/enrich';

interface PolyglobeUIProps {
  onSearch: (query: string) => void;
  onFilterChange: (filter: string, active: boolean) => void;
  activeFilters: Record<string, boolean>;
  onViewToggle?: () => void;
  currentView?: 'map' | 'globe';
  isPlaying?: boolean;
  onPlayPause?: (playing: boolean) => void;
  onSettingsOpen?: () => void;
  searchResults?: EnrichedMarket[];
  onMarketSelect?: (market: EnrichedMarket) => void;
  isSearching?: boolean;
  // New props for advanced filtering
  selectedCategories?: string[];
  onCategorySelect?: (categories: string[]) => void;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

const CATEGORIES = [
  "Politics", "Sports", "Finance", "Crypto",
  "Geopolitics", "Earnings", "Tech", "Culture",
  "World", "Economy", "Elections", "Mentions",
  "Science", "Business", "News" // Added based on "and more" and common prediction market cats
];

const SORT_OPTIONS = [
  { label: "24hr Volume", value: "volume" },
  { label: "Liquidity", value: "liquidity" },
  { label: "Newest", value: "newest" },
];

export function PolyglobeUI({
  onSearch,
  onFilterChange,
  activeFilters,
  onViewToggle,
  currentView = 'map',
  isPlaying: externalIsPlaying,
  onPlayPause,
  onSettingsOpen,
  searchResults = [],
  onMarketSelect,
  isSearching,
  selectedCategories = [],
  onCategorySelect,
  sortBy = 'volume',
  onSortChange
}: PolyglobeUIProps) {
  const [internalIsPlaying, setInternalIsPlaying] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const isMapView = currentView === 'map';

  // ID for click-outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterRef]);

  const handlePlayPause = () => {
    const newState = !isPlaying;
    if (onPlayPause) {
      onPlayPause(newState);
    } else {
      setInternalIsPlaying(newState);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Left: Logo - moved below controls */}
      <div className="absolute top-16 left-4 pointer-events-auto flex items-center gap-2">
        <div className="flex items-center gap-1 bg-[#0e0f11]/90 border border-white/10 rounded-lg px-2 py-1.5 text-gray-200 shadow-md backdrop-blur-md">
          <span className="font-mono text-sm font-bold">EDGEPANNEL</span>
        </div>
      </div>

      {/* Top Right: Search */}
      <div className="absolute top-4 right-4 z-[1000] min-w-[320px] pointer-events-auto">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search markets..."
            className="w-full bg-[#0e0f11]/90 border border-white/10 rounded-lg py-2.5 pl-3 pr-10 font-mono text-xs text-gray-200 outline-none focus:border-blue-500 transition-colors shadow-lg backdrop-blur-md"
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              // Delay blur to allow click on results
              setTimeout(() => setIsSearchFocused(false), 200);
            }}
          />
          <div className="absolute right-3 top-0 bottom-0 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>

          {isSearchFocused && (searchResults.length > 0 || isSearching) && (
            <SearchResults
              results={searchResults}
              onSelect={(market) => {
                if (onMarketSelect) onMarketSelect(market);
                // Clear search
                onSearch('');
                if (inputRef.current) inputRef.current.value = '';
              }}
              isLoading={isSearching}
            />
          )}
        </div>
      </div>


      {/* Top Left Controls */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-auto">
        <div className="flex items-center gap-2">
          {/* Settings */}
          <button className="flex items-center justify-center w-8 h-8 bg-[#0e0f11]/90 border border-white/10 rounded-lg hover:bg-white/5 text-gray-300 shadow-lg backdrop-blur-md transition-colors">
            <Settings className="w-4 h-4" />
          </button>

          {/* Play/Pause Group */}
          <div className="flex items-center">
            <button
              className="flex items-center justify-center w-9 h-9 bg-[#0e0f11]/90 text-blue-400 border-y border-l border-white/10 rounded-l-lg hover:bg-white/5 backdrop-blur-md transition-colors"
              onClick={handlePlayPause}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              className="flex items-center justify-center h-9 px-1.5 bg-[#0e0f11]/90 text-blue-400 border border-white/10 rounded-r-lg hover:bg-white/5 backdrop-blur-md transition-colors"
              onClick={() => onSettingsOpen?.()}
              title="Globe Settings"
            >
              <Settings className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Toggles */}
          <button
            className={cn(
              "px-2.5 py-2 bg-[#0e0f11]/90 border border-white/10 rounded-lg font-mono text-xs text-gray-200 hover:bg-white/5 backdrop-blur-md transition-all",
              activeFilters.breaking && "border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse"
            )}
            onClick={() => onFilterChange('breaking', !activeFilters.breaking)}
          >
            Breaking
          </button>

          <button
            className={cn(
              "px-2.5 py-2 bg-[#0e0f11]/90 border border-white/10 rounded-lg font-mono text-xs text-gray-200 hover:bg-white/5 backdrop-blur-md transition-all",
              activeFilters.osint && "bg-blue-500/10 border-blue-500/50 text-blue-400"
            )}
            onClick={() => onFilterChange('osint', !activeFilters.osint)}
          >
            OSINT
          </button>

          <button
            className={cn(
              "px-2.5 py-2 bg-emerald-500/10 border border-white/10 rounded-lg font-mono text-xs text-gray-200 hover:bg-emerald-500/20 backdrop-blur-md flex items-center gap-1.5 transition-all",
              activeFilters.live && "ring-1 ring-emerald-500/50 text-emerald-400 bg-emerald-500/20"
            )}
            onClick={() => onFilterChange('live', !activeFilters.live)}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", activeFilters.live ? "bg-emerald-400 animate-pulse" : "bg-gray-500")} />
            LIVE
          </button>

          <button
            className="w-8 h-8 flex items-center justify-center bg-[#0e0f11]/90 border border-white/10 rounded-lg text-gray-200 hover:bg-white/5 backdrop-blur-md transition-colors"
            title="Toggle routes + fires"
            onClick={() => onFilterChange('fires', !activeFilters.fires)}
          >
            <Flame className={cn("w-4 h-4", activeFilters.fires ? "text-orange-500 fill-orange-500" : "text-gray-400")} />
          </button>

          <button
            className={cn(
              "px-2.5 py-2 bg-[#0e0f11]/90 border border-white/10 rounded-lg font-mono text-xs text-gray-200 hover:bg-white/5 backdrop-blur-md flex items-center gap-1 transition-all",
              activeFilters.heatmap && "bg-orange-500/10 border-orange-500/50 text-orange-400"
            )}
            onClick={() => onFilterChange('heatmap', !activeFilters.heatmap)}
          >
            HEATMAP
            <Activity className="w-3 h-3" />
          </button>


          <button
            className="px-2.5 py-2 bg-red-600/90 border border-gray-700 rounded-lg font-mono text-xs text-white hover:bg-red-700/90 backdrop-blur-md flex items-center gap-1"
            onClick={() => onFilterChange('frontline', !activeFilters.frontline)}
          >
            FRONTLINE
            <Shield className="w-3 h-3" />
          </button>

          {/* Filter Popover Trigger */}
          <div className="relative" ref={filterRef}>
            <button
              className={cn(
                "w-8 h-8 flex items-center justify-center border rounded-lg backdrop-blur-md transition-colors",
                isFilterOpen || selectedCategories.length > 0
                  ? "bg-blue-500/20 border-blue-500 text-blue-400"
                  : "bg-[#0e0f11]/90 border-white/10 text-gray-200 hover:bg-white/5"
              )}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              title="Filters"
            >
              <Filter className="w-4 h-4" />
            </button>

            {/* Filter Popover */}
            {isFilterOpen && (
              <div className="absolute top-full left-0 mt-2 w-[320px] bg-[#0e0f11]/95 border border-gray-700 rounded-xl shadow-2xl backdrop-blur-xl p-4 flex flex-col gap-4 overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                  <span className="text-sm font-semibold text-white">Pro Filters</span>
                  {selectedCategories.length > 0 && (
                    <button
                      onClick={() => {
                        if (onCategorySelect) onCategorySelect([]);
                        setIsFilterOpen(false);
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Sort & Quick Options */}
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[120px]">
                    <select
                      className="w-full bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-700 focus:border-blue-500 outline-none appearance-none"
                      value={sortBy}
                      onChange={(e) => onSortChange?.(e.target.value)}
                    >
                      {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>Sort by: {opt.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Categories Grid */}
                <div>
                  <span className="text-[10px] uppercase text-gray-500 font-bold mb-2 block">Categories</span>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            if (!onCategorySelect) return;
                            const newCats = isSelected
                              ? selectedCategories.filter(c => c !== cat)
                              : [...selectedCategories, cat];
                            onCategorySelect(newCats);
                          }}
                          className={cn(
                            "text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                            isSelected
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                              : "bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                          )}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maps/Globe Toggle */}
      <div className="fixed top-4 right-[344px] z-[1001] flex flex-col items-end gap-2 pointer-events-auto">
        <button
          onClick={onViewToggle}
          className="group inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/40 text-blue-300 shadow-lg backdrop-blur-md transition-all"
          title={isMapView ? 'Switch to Globe View' : 'Switch to Map View'}
        >
          {isMapView ? (
            <Globe className="w-4 h-4" />
          ) : (
            <Map className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Bottom Center: Ukraine Timeline (Positioned absolutely) */}
      <button
        className="absolute flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-md border border-gray-700 rounded-full text-white hover:bg-gray-800 hover:border-blue-500/50 transition-all shadow-lg group pointer-events-auto z-40 justify-start flex-wrap"
        style={{ left: '50%', top: '853px', transform: 'translateX(-50%)' }}
      >
        <span className="text-xs font-mono text-blue-400 uppercase tracking-wider">Ukraine War</span>
        <div className="h-3 w-[1px] bg-gray-700"></div>
        <span className="text-sm font-medium group-hover:text-blue-300">View Timeline</span>
        <span className="text-gray-500 text-xs">›</span>
      </button>
    </div>
  );
}

