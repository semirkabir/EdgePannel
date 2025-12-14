import React, { useState, useRef, useEffect } from 'react';
import { Settings, Play, Pause, Search, Flame, Radio, Activity, Globe, Shield, Map, Filter, X, ChevronDown, Bell, User, LogOut, RotateCcw, Wallet } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const isMapView = currentView === 'map';

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

  // Handle search input - detect URLs and route accordingly
  const handleSearchInput = (value: string) => {
    const trimmed = value.trim();

    // Check if input is a Polymarket or Kalshi URL
    const parsedUrl = parseMarketUrl(trimmed);

    if (parsedUrl && onUrlSearch) {
      // It's a valid market URL - fetch and display it
      console.log('[PolyglobeUI] Detected market URL:', parsedUrl);
      onUrlSearch(trimmed);

      // Clear the input after URL is processed
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      setIsSearchFocused(false);
    } else {
      // Regular search
      onSearch(value);
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

      {/* Top Right: Alerts, Maps, Search and Profile */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-auto flex items-center gap-2">
        {/* Notification Button */}
        <button
          onClick={onNotificationClick}
          className="relative px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 backdrop-blur-md transition-all shadow-lg"
          title="Notifications"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-300" />
            <span className="text-xs font-bold text-gray-300">ALERTS</span>
            {notificationCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 rounded-full text-[9px] font-bold text-white animate-pulse">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </div>
        </button>

        {/* Maps/Globe Toggle / Reset Zoom */}
        <button
          onClick={isZoomedIn ? onResetZoom : onViewToggle}
          className={cn(
            "px-4 py-2 rounded-lg border backdrop-blur-md transition-all shadow-lg",
            isZoomedIn
              ? "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40"
              : "bg-white/5 hover:bg-white/10 border-white/5"
          )}
          title={isZoomedIn ? 'Reset Zoom' : (isMapView ? 'Switch to Globe View' : 'Switch to Map View')}
        >
          <div className="flex items-center gap-2">
            {isZoomedIn ? (
              <RotateCcw className="w-4 h-4 text-amber-300" />
            ) : isMapView ? (
              <Globe className="w-4 h-4 text-blue-300" />
            ) : (
              <Map className="w-4 h-4 text-blue-300" />
            )}
            <span className={cn(
              "text-xs font-bold",
              isZoomedIn ? "text-amber-300" : "text-gray-300"
            )}>
              {isZoomedIn ? 'RESET' : (isMapView ? 'GLOBE' : 'MAP')}
            </span>
          </div>
        </button>

        {/* Search Bar */}
        <div className="relative min-w-[320px]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search markets or paste URL..."
            className="w-full bg-[#0e0f11]/90 border border-white/10 rounded-lg py-2.5 pl-3 pr-10 font-mono text-xs text-gray-200 outline-none focus:border-blue-500 transition-colors shadow-lg backdrop-blur-md"
            onChange={(e) => handleSearchInput(e.target.value)}
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

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center justify-center w-10 h-10 bg-[#0e0f11]/90 border border-white/10 rounded-lg hover:bg-white/5 text-gray-300 shadow-lg backdrop-blur-md transition-colors"
            title="Profile Menu"
          >
            <User className="w-5 h-5" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-[#0e0f11]/95 border border-white/10 rounded-lg shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="p-2">
                {/* Portfolio Option */}
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

                {/* Profile Option */}
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    // TODO: Navigate to profile page
                    console.log('Navigate to profile');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 text-gray-200 transition-colors text-left"
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Profile</span>
                </button>

                {/* Settings Option */}
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

                {/* Divider */}
                <div className="my-1 border-t border-white/10" />

                {/* Logout Option */}
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    // TODO: Handle logout
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


      {/* Top Left Controls */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-auto">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            className="flex items-center justify-center w-9 h-9 bg-[#0e0f11]/90 text-blue-400 border border-white/10 rounded-lg hover:bg-white/5 backdrop-blur-md transition-colors"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Breaking Button - Keep outside filter */}
          <button
            className={cn(
              "px-2.5 py-2 bg-[#0e0f11]/90 border border-white/10 rounded-lg font-mono text-xs text-gray-200 hover:bg-white/5 backdrop-blur-md transition-all",
              activeFilters.breaking && "border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse"
            )}
            onClick={() => onFilterChange('breaking', !activeFilters.breaking)}
          >
            Breaking
          </button>

          {/* Filter Popover Trigger */}
          <div className="relative" ref={filterRef}>
            <button
              className={cn(
                "px-3 py-2 flex items-center gap-2 border rounded-lg backdrop-blur-md transition-all font-medium text-xs",
                isFilterOpen || selectedCategories.length > 0
                  ? "bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/20"
                  : "bg-[#0e0f11]/90 border-white/10 text-gray-200 hover:bg-white/5 hover:border-white/20"
              )}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              title="Filters"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {(selectedCategories.length > 0 && !selectedCategories.includes('All')) && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-bold">
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

                                // Special handling for "All"
                                if (cat === 'All') {
                                  // Clicking "All" deselects everything else and selects only "All"
                                  onCategorySelect(['All']);
                                } else {
                                  // Clicking any other category deselects "All"
                                  const newCats = isSelected
                                    ? selectedCategories.filter(c => c !== cat)
                                    : [...selectedCategories.filter(c => c !== 'All'), cat];

                                  // If no categories left, revert to "All"
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
                          {activeFilters.osint && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
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
                          {activeFilters.live && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
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
                          {activeFilters.fires && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
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
                          {activeFilters.heatmap && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
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
                          {activeFilters.frontline && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
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

