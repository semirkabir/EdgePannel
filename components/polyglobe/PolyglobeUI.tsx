import React, { useState, useRef, useEffect } from 'react';
import { Settings, Play, Pause, Search, Flame, Radio, Activity, Globe, Shield, Map, Filter, X, ChevronDown, Bell, User, LogOut, RotateCcw, Wallet, Brain } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { SearchResults } from './SearchResults';
import { EnrichedMarket } from '@/lib/markets/enrich';
import { parseMarketUrl } from '@/lib/utils/market-url-parser';

interface PolyglobeUIProps {
  onSearch: (query: string) => void;
  onUrlSearch?: (url: string) => void;
  onFilterChange: (filter: string, active: boolean) => void;
  activeFilters: Record<string, boolean>;
  onViewToggle?: () => void;
  onMapGlobeToggle?: () => void;
  currentView?: 'map' | 'globe' | 'insights';
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
}

const CATEGORIES = [
  "All", // Default - shows all categories
  "Politics", "Sports", "Finance", "Crypto",
  "Geopolitics", "Earnings", "Tech", "Culture",
  "World", "Economy", "Elections", "Mentions",
  "Science", "Business", "News"
];

const SORT_OPTIONS = [
  { label: "24hr Volume", value: "volume" },
  { label: "Liquidity", value: "liquidity" },
  { label: "Newest", value: "newest" },
];

const PLATFORM_OPTIONS = [
  { label: "All Platforms", value: "all" },
  { label: "Polymarket", value: "polymarket" },
  { label: "Kalshi", value: "kalshi" },
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
  sortBy = 'volume',
  onSortChange,
  selectedPlatform = 'all',
  onPlatformChange,
  isZoomedIn = false,
  onResetZoom
}: PolyglobeUIProps) {
  const router = useRouter();
  const [internalIsPlaying, setInternalIsPlaying] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const isMapView = currentView === 'map';
  const isInsightsView = currentView === 'insights';

  // Click-outside handling for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterRef, profileRef]);

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
      <div className="absolute top-4 left-4 z-[1000] pointer-events-auto flex flex-col gap-3">
        {/* Logo & Main Controls */}
        <div className="flex items-center gap-2 p-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-0.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
            <span className="font-serif text-lg italic font-bold text-white tracking-tight">Edge</span>
            <span className="font-sans text-lg font-bold text-white tracking-tighter">Pannel</span>
          </div>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Play/Pause Rotation - Only show in map/globe view */}
          {!isInsightsView && (
            <button
              onClick={handlePlayPause}
              className="h-8 px-3 flex items-center gap-2 rounded-xl text-xs font-bold transition-all bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20"
              title={isPlaying ? "Pause Rotation" : "Resume Rotation"}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Rotation</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                  <span>Resume Rotation</span>
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

        {/* Filters Row - Hide when in insights view */}
        {!isInsightsView && (
          <div className="flex items-center gap-2">
            {/* Breaking Toggle */}
            <button
              onClick={() => onFilterChange('breaking', !activeFilters.breaking)}
              className={cn(
                "px-3 py-2 rounded-xl backdrop-blur-xl border text-xs font-bold transition-all flex items-center gap-2 shadow-lg",
                activeFilters.breaking
                  ? "bg-red-500/10 border-red-500/50 text-red-400"
                  : "bg-[#0e0f11]/80 border-white/10 text-gray-400 hover:bg-[#0e0f11]/60"
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", activeFilters.breaking ? "bg-red-500 animate-pulse" : "bg-gray-600")} />
              BREAKING
            </button>

            {/* Filter Menu Trigger */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "px-3 py-2 rounded-xl backdrop-blur-xl border text-xs font-bold transition-all flex items-center gap-2 shadow-lg",
                  isFilterOpen || selectedCategories.length > 0
                    ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                    : "bg-[#0e0f11]/80 border-white/10 text-gray-400 hover:bg-[#0e0f11]/60"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                FILTERS
                {(selectedCategories.length > 0 && !selectedCategories.includes('All')) && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[9px] font-bold">
                    {selectedCategories.length}
                  </span>
                )}
              </button>

            {/* Filter Popover */}
            {isFilterOpen && (
              <div className="absolute top-full left-0 mt-2 w-[420px] bg-[#0e0f11]/98 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Filter className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Filters</h3>
                        <p className="text-[10px] text-gray-400">Customize your view</p>
                      </div>
                    </div>
                    {!selectedCategories.includes('All') && selectedCategories.length > 0 && (
                      <button
                        onClick={() => {
                          if (onCategorySelect) onCategorySelect(['All']);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Scrollable Content */}
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                  <div className="p-5 space-y-6">
                    {/* Sort & Platform Options */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-blue-500 rounded-full" />
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Sorting & Platform</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block font-medium">Sort By</label>
                          <select
                            className="w-full bg-white/5 text-gray-200 text-xs rounded-lg px-3 py-2.5 border border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none transition-all hover:bg-white/10"
                            value={sortBy}
                            onChange={(e) => onSortChange?.(e.target.value)}
                          >
                            {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-8 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block font-medium">Platform</label>
                          <select
                            className="w-full bg-white/5 text-gray-200 text-xs rounded-lg px-3 py-2.5 border border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none transition-all hover:bg-white/10"
                            value={selectedPlatform}
                            onChange={(e) => onPlatformChange?.(e.target.value)}
                          >
                            {PLATFORM_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-8 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Categories Grid */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-purple-500 rounded-full" />
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Categories</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
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
                                  ? "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 text-white shadow-lg shadow-blue-500/30"
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

                    {/* Map Overlays Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Map Overlays</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* OSINT Toggle */}
                        <button
                          onClick={() => onFilterChange('osint', !activeFilters.osint)}
                          className={cn(
                            "px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 relative overflow-hidden group",
                            activeFilters.osint
                              ? "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 text-white shadow-lg shadow-blue-500/30"
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                          )}
                        >
                          <Radio className="w-3.5 h-3.5 relative z-10" />
                          <span className="relative z-10">OSINT</span>
                        </button>

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

                        {/* Heatmap Toggle */}
                        <button
                          onClick={() => onFilterChange('heatmap', !activeFilters.heatmap)}
                          className={cn(
                            "px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 relative overflow-hidden group",
                            activeFilters.heatmap
                              ? "bg-gradient-to-br from-orange-600 to-orange-700 border-orange-500 text-white shadow-lg shadow-orange-500/30"
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                          )}
                        >
                          <Activity className="w-3.5 h-3.5 relative z-10" />
                          <span className="relative z-10">Heatmap</span>
                        </button>

                        {/* Frontline Toggle - Full Width */}
                        <button
                          onClick={() => onFilterChange('frontline', !activeFilters.frontline)}
                          className={cn(
                            "px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center justify-center gap-2 col-span-2 relative overflow-hidden group",
                            activeFilters.frontline
                              ? "bg-gradient-to-br from-red-600 to-red-700 border-red-500 text-white shadow-lg shadow-red-500/30"
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200"
                          )}
                        >
                          <Shield className="w-3.5 h-3.5 relative z-10" />
                          <span className="relative z-10">Frontline</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Top Right: User Island */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-auto flex items-center gap-3">
        {/* Search Bar - Modernized */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="block w-[320px] pl-10 pr-4 py-2.5 bg-[#0e0f11]/80 border border-white/10 rounded-2xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 backdrop-blur-xl transition-all shadow-xl font-sans tracking-tight"
            placeholder="Search markets or paste URL..."
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
          />
          {/* Search Results Dropdown */}
          {isSearchFocused && (searchResults.length > 0 || isSearching) && (
            <div className="absolute top-full left-0 right-0 mt-2">
              <SearchResults
                results={searchResults}
                onSelect={(market) => {
                  if (onMarketSelect) onMarketSelect(market);
                  onSearch('');
                  if (inputRef.current) inputRef.current.value = '';
                }}
                isLoading={isSearching}
              />
            </div>
          )}
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center p-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl gap-1">
          {/* Notifications */}
          <button
            onClick={onNotificationClick}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#0e0f11]" />
            )}
          </button>

          <div className="w-px h-5 bg-white/10" />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            >
              <User className="w-4 h-4" />
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
                      console.log('Logout');
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

      {/* Bottom Center: Ukraine Timeline (Positioned absolutely) - Only show in map/globe view */}
      {!isInsightsView && (
        <button
          className="absolute flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-md border border-gray-700 rounded-full text-white hover:bg-gray-800 hover:border-blue-500/50 transition-all shadow-lg group pointer-events-auto z-40 justify-start flex-wrap"
          style={{ left: '50%', bottom: '32px', transform: 'translateX(-50%)' }}
        >
          <span className="text-xs font-mono text-blue-400 uppercase tracking-wider">Ukraine War</span>
          <div className="h-3 w-[1px] bg-gray-700"></div>
          <span className="text-sm font-medium group-hover:text-blue-300">View Timeline</span>
          <span className="text-gray-500 text-xs">›</span>
        </button>
      )}
    </div>
  );
}
