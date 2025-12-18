import React, { useState, useRef, useEffect } from 'react';
import { Settings, Play, Pause, Search, Flame, Radio, Activity, Globe, Shield, Map, Filter, X, ChevronDown, Bell, User, LogOut, RotateCcw, Wallet, Brain, Circle, Layers, VolumeX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils/cn';
import { SearchResults } from './SearchResults';
import { EnrichedMarket } from '@/lib/markets/enrich';
import { parseMarketUrl } from '@/lib/utils/market-url-parser';

export type VisualizationMode = 'dots' | 'heatmap' | 'cluster';

interface PolyglobeUIProps {
  onSearch: (query: string) => void;
  onUrlSearch?: (url: string) => void;
  onFilterChange: (filter: string, active: boolean) => void;
  activeFilters: Record<string, boolean>;
  onViewToggle?: () => void;
  onMapGlobeToggle?: () => void;
  currentView?: 'map' | 'globe' | 'insights' | 'agent';
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
  selectedPlatform?: string;
  onPlatformChange?: (platform: string) => void;
  // Notification props
  onNotificationClick?: () => void;
  notificationCount?: number;
  // Zoom control props
  isZoomedIn?: boolean;
  onResetZoom?: () => void;
  // Visualization mode props
  visualizationMode?: VisualizationMode;
  onVisualizationModeChange?: (mode: VisualizationMode) => void;
  // Available markets for random selection
  availableMarkets?: EnrichedMarket[];
  // Search input ref for keyboard shortcuts
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

const CATEGORIES = [
  "All",
  "Politics",
  "Economics",
  "Sports",
  "Technology",
  "International",
  "Weather",
  "Health",
  "Entertainment"
];

export function PolyglobeUI({
  onSearch,
  onUrlSearch,
  onFilterChange,
  activeFilters,
  onViewToggle,
  onMapGlobeToggle,
  currentView = 'map',
  isPlaying: externalIsPlaying,
  onPlayPause,
  onSettingsOpen,
  searchResults = [],
  onMarketSelect,
  isSearching,
  selectedCategories = [],
  onNotificationClick,
  notificationCount = 0,
  onCategorySelect,
  isZoomedIn = false,
  onResetZoom,
  visualizationMode = 'dots',
  onVisualizationModeChange,
  availableMarkets = [],
  searchInputRef: externalSearchInputRef
}: PolyglobeUIProps) {
  const router = useRouter();
  const [internalIsPlaying, setInternalIsPlaying] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [randomMarkets, setRandomMarkets] = useState<EnrichedMarket[]>([]);
  const internalInputRef = useRef<HTMLInputElement>(null);
  // Use external ref if provided, otherwise use internal
  const inputRef = externalSearchInputRef || internalInputRef;
  const profileRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const visualizationRef = useRef<HTMLDivElement>(null);
  const overlaysRef = useRef<HTMLDivElement>(null);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isVisualizationOpen, setIsVisualizationOpen] = useState(false);
  const [isOverlaysOpen, setIsOverlaysOpen] = useState(false);
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const isMapView = currentView === 'map';
  const isInsightsView = currentView === 'insights';

  // Click-outside handling for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (categoriesRef.current && !categoriesRef.current.contains(event.target as Node)) {
        setIsCategoriesOpen(false);
      }
      if (visualizationRef.current && !visualizationRef.current.contains(event.target as Node)) {
        setIsVisualizationOpen(false);
      }
      if (overlaysRef.current && !overlaysRef.current.contains(event.target as Node)) {
        setIsOverlaysOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileRef, categoriesRef, visualizationRef, overlaysRef]);

  // Generate random markets when search is focused
  useEffect(() => {
    if (isSearchFocused && availableMarkets.length > 0) {
      // Get 5 random markets every time search is focused
      const shuffled = [...availableMarkets].sort(() => Math.random() - 0.5);
      setRandomMarkets(shuffled.slice(0, 5));
    } else if (!isSearchFocused) {
      // Clear random markets when search loses focus
      setRandomMarkets([]);
    }
  }, [isSearchFocused, availableMarkets]);

  const handlePlayPause = () => {
    const newState = !isPlaying;
    if (onPlayPause) {
      onPlayPause(newState);
    } else {
      setInternalIsPlaying(newState);
    }
  };

  // Handle search input - just update regular search
  const handleSearchInput = (value: string) => {
    onSearch(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value.trim() || '';
      const parsedUrl = parseMarketUrl(value);

      if (parsedUrl && onUrlSearch) {
        // It's a valid market URL - fetch and display it
        console.log('[PolyglobeUI] Detected market URL on Enter:', parsedUrl);
        onUrlSearch(value);

        // Clear the input and search query
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        onSearch(''); // Clear regular search results
        setIsSearchFocused(false);
        e.currentTarget.blur();
      }
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* Top Left: Control Island */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] pointer-events-auto flex flex-col gap-2 sm:gap-3">
        {/* Logo & Main Controls */}
        <div
          className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl"
          style={{
            boxShadow: "10px 20px 40px -5px rgba(0, 0, 0, 0.9), 5px 10px 20px -5px rgba(0, 0, 0, 0.7), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)"
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-0.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
            <span className="font-serif text-sm sm:text-lg italic font-bold text-white tracking-tight">Edge</span>
            <span className="font-sans text-sm sm:text-lg font-bold text-white tracking-tighter">Pannel</span>
          </div>

          <div className="w-px h-5 sm:h-6 bg-white/10 mx-0.5 sm:mx-1" />

          {/* Play/Pause Rotation - Only show in map/globe view */}
          {!isInsightsView && (
            <button
              onClick={handlePlayPause}
              className="h-7 sm:h-8 px-2 sm:px-3 flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20"
              title={isPlaying ? "Pause Rotation" : "Resume Rotation"}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Pause Rotation</span>
                  <span className="sm:hidden">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 ml-0.5" />
                  <span className="hidden sm:inline">Resume Rotation</span>
                  <span className="sm:hidden">Resume</span>
                </>
              )}
            </button>
          )}

          {/* View Toggle / Reset */}
          {isZoomedIn ? (
            <button
              onClick={onResetZoom}
              className="h-8 px-3 flex items-center gap-2 rounded-xl text-xs font-bold transition-all bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset View</span>
            </button>
          ) : (
            <>
              {/* Map/Globe Toggle - Only show when not in insights view */}
              {!isInsightsView && (
                <button
                  onClick={onMapGlobeToggle}
                  className="h-8 px-3 flex items-center gap-2 rounded-xl text-xs font-bold transition-all bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20"
                >
                  {isMapView ? (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Switch to Globe</span>
                    </>
                  ) : (
                    <>
                      <Map className="w-3.5 h-3.5" />
                      <span>Switch to Map</span>
                    </>
                  )}
                </button>
              )}

              {/* Insights Mode Toggle */}
              <button
                onClick={onViewToggle}
                className={cn(
                  "h-8 px-3 flex items-center gap-2 rounded-xl transition-all duration-300 border shadow-sm",
                  isInsightsView
                    ? "bg-gradient-to-r from-blue-500/20 via-blue-600/15 to-blue-500/20 border-blue-400/50 shadow-blue-500/20"
                    : "bg-gradient-to-r from-amber-900/20 via-yellow-900/15 to-amber-900/20 border-amber-700/30 hover:border-amber-500/40 hover:shadow-amber-500/10"
                )}
              >
                {isInsightsView ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-blue-300" />
                    <span className="font-sans tracking-tight font-bold text-white text-xs">
                      Back to Map
                    </span>
                  </>
                ) : (
                  <>
                    <Brain className="w-3.5 h-3.5 text-amber-400/70" />
                    <span className="font-serif italic tracking-tight font-bold text-white/90 text-xs">
                      Insights
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Control Buttons Row - Hide when in insights view */}
        {!isInsightsView && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Categories Dropdown */}
            <div className="relative" ref={categoriesRef}>
              <button
                onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                className={cn(
                  "px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl backdrop-blur-xl border text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 shadow-lg",
                  isCategoriesOpen || (selectedCategories.length > 0 && !selectedCategories.includes('All'))
                    ? "bg-purple-500/10 border-purple-500/50 text-purple-400"
                    : "bg-[#0e0f11]/80 border-white/10 text-gray-400 hover:bg-[#0e0f11]/60"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                TAGS
                {(selectedCategories.length > 0 && !selectedCategories.includes('All')) && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-500 text-white rounded-full text-[9px] font-bold">
                    {selectedCategories.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Categories Popover */}
              {isCategoriesOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#0e0f11]/98 border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Categories</h3>
                    {!selectedCategories.includes('All') && selectedCategories.length > 0 && (
                      <button
                        onClick={() => {
                          if (onCategorySelect) onCategorySelect(['All']);
                        }}
                        className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            if (!onCategorySelect) return;
                            if (cat === 'All') {
                              onCategorySelect(['All']);
                            } else {
                              const newCats = isSelected
                                ? selectedCategories.filter(c => c !== cat)
                                : [...selectedCategories.filter(c => c !== 'All'), cat];
                              onCategorySelect(newCats.length === 0 ? ['All'] : newCats);
                            }
                          }}
                          className={cn(
                            "px-3 py-2 rounded-lg text-xs font-medium transition-all border relative overflow-hidden group",
                            isSelected
                              ? "bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500 text-white shadow-lg shadow-purple-500/30"
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                          )}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                          <span className="relative z-10">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Visualization Mode Dropdown */}
            <div className="relative" ref={visualizationRef}>
              <button
                onClick={() => setIsVisualizationOpen(!isVisualizationOpen)}
                className={cn(
                  "px-3 py-2 rounded-xl backdrop-blur-xl border text-xs font-bold transition-all flex items-center gap-2 shadow-lg",
                  isVisualizationOpen || visualizationMode !== 'dots'
                    ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                    : "bg-[#0e0f11]/80 border-white/10 text-gray-400 hover:bg-[#0e0f11]/60"
                )}
              >
                <Circle className="w-3.5 h-3.5" />
                VISUALIZATION
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Visualization Popover */}
              {isVisualizationOpen && (
                <div className="absolute top-full left-0 mt-2 w-[260px] sm:w-[280px] bg-[#0e0f11]/98 border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 p-3 sm:p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Mode</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Dots Mode */}
                    <button
                      onClick={() => {
                        onVisualizationModeChange?.('dots');
                        setIsVisualizationOpen(false);
                      }}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 relative overflow-hidden group",
                        visualizationMode === 'dots'
                          ? "bg-gradient-to-br from-cyan-600 to-cyan-700 border-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                      )}
                    >
                      <Circle className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10">Dots</span>
                    </button>

                    {/* Heatmap Mode */}
                    <button
                      onClick={() => {
                        onVisualizationModeChange?.('heatmap');
                        setIsVisualizationOpen(false);
                      }}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 relative overflow-hidden group",
                        visualizationMode === 'heatmap'
                          ? "bg-gradient-to-br from-orange-600 to-orange-700 border-orange-500 text-white shadow-lg shadow-orange-500/30"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                      )}
                    >
                      <Activity className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10">Heatmap</span>
                    </button>

                    {/* Cluster Mode */}
                    <button
                      onClick={() => {
                        onVisualizationModeChange?.('cluster');
                        setIsVisualizationOpen(false);
                      }}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 relative overflow-hidden group",
                        visualizationMode === 'cluster'
                          ? "bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500 text-white shadow-lg shadow-purple-500/30"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                      )}
                    >
                      <Layers className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10">Clusters</span>
                    </button>

                  </div>
                </div>
              )}
            </div>

            {/* Map Overlays Dropdown */}
            <div className="relative" ref={overlaysRef}>
              <button
                onClick={() => setIsOverlaysOpen(!isOverlaysOpen)}
                className={cn(
                  "px-3 py-2 rounded-xl backdrop-blur-xl border text-xs font-bold transition-all flex items-center gap-2 shadow-lg",
                  isOverlaysOpen || activeFilters.live || activeFilters.fires || activeFilters.noiseFilter
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                    : "bg-[#0e0f11]/80 border-white/10 text-gray-400 hover:bg-[#0e0f11]/60"
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                OVERLAYS
                {(() => {
                  const activeOverlayCount = [activeFilters.live, activeFilters.fires, activeFilters.noiseFilter].filter(Boolean).length;
                  return activeOverlayCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-emerald-500 text-white rounded-full text-[9px] font-bold">
                      {activeOverlayCount}
                    </span>
                  );
                })()}
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Overlays Popover */}
              {isOverlaysOpen && (
                <div className="absolute top-full left-0 mt-2 w-[240px] sm:w-[260px] bg-[#0e0f11]/98 border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 p-3 sm:p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Map Overlays</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {/* LIVE Toggle */}
                    <button
                      onClick={() => onFilterChange('live', !activeFilters.live)}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 relative overflow-hidden group",
                        activeFilters.live
                          ? "bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full relative z-10", activeFilters.live ? "bg-white animate-pulse" : "bg-gray-500")} />
                      <span className="relative z-10">LIVE</span>
                    </button>

                    {/* Fires Toggle */}
                    <button
                      onClick={() => onFilterChange('fires', !activeFilters.fires)}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 relative overflow-hidden group",
                        activeFilters.fires
                          ? "bg-gradient-to-br from-orange-600 to-orange-700 border-orange-500 text-white shadow-lg shadow-orange-500/30"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                      )}
                    >
                      <Flame className={cn("w-3.5 h-3.5 relative z-10", activeFilters.fires ? "fill-white" : "")} />
                      <span className="relative z-10">Fires</span>
                    </button>

                  </div>

                  {/* Noise Filter - Full Width */}
                  <div className="pt-2 border-t border-white/10 mt-2">
                    <button
                      onClick={() => onFilterChange('noiseFilter', !activeFilters.noiseFilter)}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 relative overflow-hidden group",
                        activeFilters.noiseFilter
                          ? "bg-gradient-to-br from-amber-600 to-amber-700 border-amber-500 text-white shadow-lg shadow-amber-500/30"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                      )}
                    >
                      <VolumeX className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10">Hide Low Liquidity</span>
                      <span className="ml-auto text-[10px] text-gray-400 relative z-10">$100+</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Top Right: User Island */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000] pointer-events-auto flex items-center gap-2 sm:gap-3">
        {/* Search Bar - Modernized */}
        <div className="relative group">
          <input
            ref={inputRef}
            type="text"
            className="block w-[200px] sm:w-[280px] md:w-[320px] pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-[#0e0f11]/80 border border-white/10 rounded-xl sm:rounded-2xl text-xs sm:text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 backdrop-blur-xl transition-all font-sans tracking-tight"
            style={{
              boxShadow: "0px 20px 40px -5px rgba(0, 0, 0, 0.9), 5px 10px 20px -5px rgba(0, 0, 0, 0.7), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)",
              backgroundImage: "linear-gradient(90deg, rgba(255, 255, 255, 1) 55%, rgba(0, 0, 0, 1) 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent"
            }}
            placeholder="Search markets or paste URL..."
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
          />
          <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none z-10">
            <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
          </div>
          {/* Search Results Dropdown */}
          {isSearchFocused && (searchResults.length > 0 || isSearching || (inputRef.current?.value === '' && randomMarkets.length > 0)) && (
            <div className="absolute top-full left-0 right-0 mt-2">
              <SearchResults
                results={inputRef.current?.value === '' ? randomMarkets : searchResults}
                onSelect={(market) => {
                  if (onMarketSelect) onMarketSelect(market);
                  onSearch('');
                  if (inputRef.current) inputRef.current.value = '';
                  setIsSearchFocused(false);
                }}
                isLoading={isSearching}
              />
            </div>
          )}
        </div>

        {/* Action Buttons Group */}
        <div
          className="flex items-center p-1 sm:p-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl gap-0.5 sm:gap-1"
          style={{
            boxShadow: "10px 20px 40px -5px rgba(0, 0, 0, 0.9), 5px 10px 20px -5px rgba(0, 0, 0, 0.7), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)"
          }}
        >
          {/* Notifications */}
          <button
            onClick={onNotificationClick}
            className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all touch-manipulation"
          >
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {notificationCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#0e0f11]" />
            )}
          </button>

          <div className="w-px h-4 sm:h-5 bg-white/10" />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all touch-manipulation"
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-[#0e0f11]/95 border border-white/10 rounded-lg shadow-2xl backdrop-blur-xl overflow-hidden">
                <div className="p-2">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push('/dashboard/portfolio');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-blue-500/10 text-blue-400 transition-colors text-left"
                  >
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm font-medium">Portfolio</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onSettingsOpen?.();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 text-gray-200 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm font-medium">Settings</span>
                  </button>

                  <div className="my-1 border-t border-white/10" />

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      signOut({ callbackUrl: '/login' });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-red-500/10 text-red-400 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}





