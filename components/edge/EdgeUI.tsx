import React, { useState, useRef, useEffect } from 'react';
import { Settings, Play, Pause, Search, Flame, Radio, Activity, Globe, Shield, Map, Filter, X, ChevronDown, Bell, User, LogOut, RotateCcw, Wallet, Brain, Circle, Layers, VolumeX, Eye, ArrowRightLeft, SlidersHorizontal, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils/cn';
import { SearchResults } from './SearchResults';
import { EnrichedMarket } from '@/lib/markets/enrich';
import { parseMarketUrl } from '@/lib/utils/market-url-parser';
import { MarketType } from '@/types/exchange';

export type VisualizationMode = 'dots' | 'heatmap' | 'cluster';

interface EdgeUIProps {
  onSearch: (query: string) => void;
  onUrlSearch?: (url: string) => void;
  onFilterChange: (filter: string, active: boolean) => void;
  activeFilters: Record<string, boolean>;
  onViewToggle?: () => void;
  onHubToggle?: () => void;
  onMapGlobeToggle?: () => void;
  currentView?: 'map' | 'globe' | 'insights' | 'agent' | 'hub';
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
  // Market type toggle props
  marketType?: MarketType;
  onMarketTypeChange?: (type: MarketType) => void;
  // Navigation
  onSetView?: (view: 'map' | 'globe' | 'insights' | 'agent' | 'hub') => void;
  // Research Notebook
  isResearchOpen?: boolean;
  setIsResearchOpen?: (open: boolean) => void;
  isNotificationCenterOpen?: boolean;
  setIsNotificationCenterOpen?: (open: boolean) => void;
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

export function EdgeUI({
  onSearch,
  onUrlSearch,
  onFilterChange,
  activeFilters,
  onViewToggle,
  onHubToggle,
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
  searchInputRef: externalSearchInputRef,
  marketType = 'prediction',
  onMarketTypeChange,
  onSetView,
  isResearchOpen,
  setIsResearchOpen,
  isNotificationCenterOpen,
  setIsNotificationCenterOpen
}: EdgeUIProps) {
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
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const isMapView = currentView === 'map';
  const isInsightsView = currentView === 'insights';

  // Click-outside handling for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsViewSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileRef, settingsRef]);

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

      {/* Mobile Header - Single stacked layout for small screens */}
      <div className="md:hidden absolute top-2 left-2 right-2 z-[1000] pointer-events-auto flex flex-col gap-1.5">
        {/* Row 1: Logo + Icons */}
        <div
          className="flex items-center justify-between p-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-xl"
          style={{
            boxShadow: "10px 20px 40px -5px rgba(0, 0, 0, 0.9), 5px 10px 20px -5px rgba(0, 0, 0, 0.7), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)"
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-0.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
            <span className="font-serif text-sm italic font-bold text-white tracking-tight">Edge</span>
            <span className="font-sans text-sm font-bold text-white tracking-tighter">Pannel</span>
          </div>

          {/* Search Bar - Mobile */}
          <div className="relative group flex-1 mx-2">
            <input
              ref={inputRef}
              type="text"
              className="block w-full pl-8 pr-3 py-2 bg-[#0e0f11]/80 border border-white/10 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 backdrop-blur-xl transition-all font-sans tracking-tight"
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
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
              <Search className="h-3.5 w-3.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
            </div>
            {/* Search Results Dropdown - Mobile */}
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

          {/* Icons Group */}
          <div className="flex items-center gap-0.5">
            {/* Notifications */}
            <button
              onClick={onNotificationClick}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all touch-manipulation"
            >
              <Bell className="w-3.5 h-3.5" />
              {notificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#0e0f11]" />
              )}
            </button>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all touch-manipulation"
              >
                <User className="w-3.5 h-3.5" />
              </button>
              {/* Profile Dropdown Menu - Mobile */}
              {isProfileOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-[#0e0f11] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
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

        {/* Row 2: Filter Buttons - Mobile (only when not in insights/financials view) */}
        {!isInsightsView && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">


            {/* Consolidated View Settings - Mobile */}
            <div className="relative flex-shrink-0" ref={settingsRef}>
              <button
                onClick={() => setIsViewSettingsOpen(!isViewSettingsOpen)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg backdrop-blur-xl border text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-lg whitespace-nowrap",
                  isViewSettingsOpen
                    ? "bg-white/20 border-white/30 text-white"
                    : "bg-[#0e0f11]/90 border-white/20 text-gray-200 hover:bg-[#0e0f11]/80"
                )}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>OPTIONS</span>
                {(() => {
                  const activeCount =
                    (selectedCategories.length > 0 && !selectedCategories.includes('All') ? 1 : 0) +
                    ([activeFilters.live, activeFilters.fires, activeFilters.noiseFilter].filter(Boolean).length > 0 ? 1 : 0);

                  return activeCount > 0 && (
                    <span className="w-3.5 h-3.5 flex items-center justify-center bg-purple-500 text-white rounded-full text-[8px] font-bold">
                      {activeCount}
                    </span>
                  );
                })()}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>

              {/* View Settings Popover - Mobile */}
              {isViewSettingsOpen && (
                <div className="absolute top-full left-0 mt-2 w-[280px] bg-[#0e0f11] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

                    {/* Section 1: Data Source (Tags) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-white/90">
                          <Filter className="w-3 h-3 text-purple-400" />
                          <h3 className="text-[10px] font-bold uppercase tracking-wider">Data Source</h3>
                        </div>
                        {!selectedCategories.includes('All') && selectedCategories.length > 0 && (
                          <button
                            onClick={() => onCategorySelect && onCategorySelect(['All'])}
                            className="text-[9px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
                          >
                            RESET
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
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
                                "px-2 py-1 rounded-md text-[10px] font-medium transition-all border relative overflow-hidden group",
                                isSelected
                                  ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                                  : "bg-white/15 border-white/20 text-gray-300 hover:bg-white/25 hover:border-white/30 hover:text-white"
                              )}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {/* Section 2: Visualization Mode */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-white/90">
                        <Eye className="w-3 h-3 text-cyan-400" />
                        <h3 className="text-[10px] font-bold uppercase tracking-wider">Visual Style</h3>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => onVisualizationModeChange?.('dots')}
                          className={cn(
                            "px-2 py-1.5 rounded-lg flex flex-col items-center gap-1 transition-all border",
                            visualizationMode === 'dots'
                              ? "bg-cyan-600 border-cyan-400 text-white shadow-lg"
                              : "bg-white/15 border-white/20 text-gray-300 hover:bg-white/25"
                          )}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span className="text-[9px] font-bold">Points</span>
                        </button>

                        <button
                          onClick={() => onVisualizationModeChange?.('heatmap')}
                          className={cn(
                            "px-2 py-1.5 rounded-lg flex flex-col items-center gap-1 transition-all border",
                            visualizationMode === 'heatmap'
                              ? "bg-orange-600 border-orange-400 text-white shadow-lg"
                              : "bg-white/15 border-white/20 text-gray-300 hover:bg-white/25"
                          )}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60 blur-[1px]" />
                          <span className="text-[9px] font-bold">Heat</span>
                        </button>

                        <button
                          onClick={() => onVisualizationModeChange?.('cluster')}
                          className={cn(
                            "px-2 py-1.5 rounded-lg flex flex-col items-center gap-1 transition-all border",
                            visualizationMode === 'cluster'
                              ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                              : "bg-white/15 border-white/20 text-gray-300 hover:bg-white/25"
                          )}
                        >
                          <div className="w-1.5 h-1.5 rounded-full border-2 border-current" />
                          <span className="text-[9px] font-bold">Group</span>
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {/* Section 3: Overlays */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-white/90">
                        <Layers className="w-3 h-3 text-emerald-400" />
                        <h3 className="text-[10px] font-bold uppercase tracking-wider">Overlays</h3>
                      </div>

                      <div className="space-y-1.5">
                        {/* Live Updates */}
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/15 border border-white/20">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full", activeFilters.live ? "bg-emerald-400 animate-pulse" : "bg-gray-500")} />
                            <span className="text-[10px] text-gray-300">Live Updates</span>
                          </div>
                          <button
                            onClick={() => onFilterChange('live', !activeFilters.live)}
                            className={cn(
                              "w-6 h-3.5 rounded-full relative transition-colors",
                              activeFilters.live ? "bg-emerald-500" : "bg-white/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm",
                              activeFilters.live ? "left-[13px]" : "left-0.5"
                            )} />
                          </button>
                        </div>

                        {/* Fires */}
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/15 border border-white/20">
                          <div className="flex items-center gap-1.5">
                            <Flame className={cn("w-2.5 h-2.5", activeFilters.fires ? "text-orange-400" : "text-gray-500")} />
                            <span className="text-[10px] text-gray-300">Viral / Fires</span>
                          </div>
                          <button
                            onClick={() => onFilterChange('fires', !activeFilters.fires)}
                            className={cn(
                              "w-6 h-3.5 rounded-full relative transition-colors",
                              activeFilters.fires ? "bg-orange-600" : "bg-white/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm",
                              activeFilters.fires ? "left-[13px]" : "left-0.5"
                            )} />
                          </button>
                        </div>

                        {/* Low Liquidity Filter */}
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/15 border border-white/20">
                          <div className="flex items-center gap-1.5">
                            <VolumeX className={cn("w-2.5 h-2.5", activeFilters.noiseFilter ? "text-amber-400" : "text-gray-500")} />
                            <span className="text-[10px] text-gray-300">Hide Low Liquidity</span>
                          </div>
                          <button
                            onClick={() => onFilterChange('noiseFilter', !activeFilters.noiseFilter)}
                            className={cn(
                              "w-6 h-3.5 rounded-full relative transition-colors",
                              activeFilters.noiseFilter ? "bg-amber-600" : "bg-white/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm",
                              activeFilters.noiseFilter ? "left-[13px]" : "left-0.5"
                            )} />
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

      {/* Desktop Header - Original layout for md and above */}
      {/* Top Left: Control Island */}
      <div className="hidden md:flex absolute top-4 left-4 z-[1000] pointer-events-auto flex-col items-start gap-1.5">
        {/* Logo & Main Controls */}
        <div
          className="flex items-center gap-2 p-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl"
          style={{
            boxShadow: "10px 20px 40px -5px rgba(0, 0, 0, 0.9), 5px 10px 20px -5px rgba(0, 0, 0, 0.7), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)"
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-0.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
            <span className="font-serif text-lg italic font-bold text-white tracking-tight">Edge</span>
            <span className="font-sans text-lg font-bold text-white tracking-tighter">Pannel</span>
          </div>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Unified View Controller */}
          <div className="flex items-center gap-1">
            {/* Play/Pause Rotation - Only show in map/globe view */}
            {!isInsightsView && (
              <button
                onClick={handlePlayPause}
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-all bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20"
                title={isPlaying ? "Pause Rotation" : "Resume Rotation"}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
            )}

            {/* Reset View - Only show when zoomed in and not in insights/financials */}
            {!isInsightsView && isZoomedIn && (
              <button
                onClick={onResetZoom}
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-all bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="w-px h-4 bg-white/10 mx-1" />

            {/* Navigation Tabs */}
            <div className="flex p-0.5 bg-black/40 border border-white/10 rounded-xl">
              <button
                onClick={onMapGlobeToggle} // This toggles between map/globe
                className={cn(
                  "group px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 relative",
                  !isInsightsView
                    ? "bg-white/20 text-white shadow-md border border-white/10"
                    : "text-gray-300 hover:text-white hover:bg-white/15"
                )}
              >
                {/* Main Icon */}
                <div className="relative w-3.5 h-3.5">
                  <div className={cn("absolute inset-0 transition-all duration-300", !isInsightsView ? "opacity-100 group-hover:opacity-0 group-hover:scale-75" : "opacity-100")}>
                    {isMapView ? <Map className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                  </div>
                  <div className={cn("absolute inset-0 transition-all duration-300 opacity-0 scale-75 rotate-90", !isInsightsView ? "group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-0" : "hidden")}>
                    <ArrowRightLeft className="w-3.5 h-3.5 text-white/80" />
                  </div>
                </div>

                {/* Text Label */}
                <span>{isMapView ? 'Map' : 'Globe'}</span>
              </button>

              <button
                onClick={onViewToggle}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  isInsightsView
                    ? "bg-amber-600/90 text-white shadow-md border border-amber-500/50"
                    : "text-gray-300 hover:text-white hover:bg-white/15"
                )}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Insights</span>
              </button>
            </div>
          </div>
        </div>

        {/* Control Buttons Row - Hide when in insights/financials view */}
        {!isInsightsView && (
          <div
            className="flex items-center gap-1.5 p-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl"
            style={{
              boxShadow: "10px 20px 40px -5px rgba(0, 0, 0, 0.9), 5px 10px 20px -5px rgba(0, 0, 0, 0.7), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)"
            }}
          >
            {/* Layer Menu removed, consolidated into FeedControls */}

            {/* Consolidated View Settings Dropdown */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setIsViewSettingsOpen(!isViewSettingsOpen)}
                className={cn(
                  "h-7 px-2.5 flex items-center gap-1.5 rounded-xl text-[10px] uppercase font-bold transition-all border shadow-sm",
                  isViewSettingsOpen
                    ? "bg-white/20 border-white/30 text-white shadow-lg"
                    : "bg-[#0e0f11]/90 border-white/20 text-gray-200 hover:text-white hover:bg-white/10"
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Options</span>
                {(() => {
                  const activeCount =
                    (selectedCategories.length > 0 && !selectedCategories.includes('All') ? 1 : 0) +
                    ([activeFilters.live, activeFilters.fires, activeFilters.noiseFilter].filter(Boolean).length > 0 ? 1 : 0);

                  return activeCount > 0 && (
                    <span className="ml-1 flex items-center justify-center w-4 h-4 bg-purple-500 text-white rounded-full text-[9px] font-bold">
                      {activeCount}
                    </span>
                  );
                })()}
                <ChevronDown className="w-3 h-3 text-white/50" />
              </button>

              {/* View Settings Popover */}
              {isViewSettingsOpen && (
                <div className="absolute top-full left-0 mt-2 w-[320px] bg-[#0e0f11] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">

                    {/* Section 1: Data Source (Tags) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white/90">
                          <Filter className="w-3.5 h-3.5 text-purple-400" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">Data Source</h3>
                        </div>
                        {!selectedCategories.includes('All') && selectedCategories.length > 0 && (
                          <button
                            onClick={() => onCategorySelect && onCategorySelect(['All'])}
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
                          >
                            RESET
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
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
                                "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border relative overflow-hidden group",
                                isSelected
                                  ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                                  : "bg-white/15 border-white/20 text-gray-300 hover:bg-white/25 hover:border-white/30 hover:text-white"
                              )}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {/* Section 2: Visualization Mode */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-white/90">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">Visual Style</h3>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => onVisualizationModeChange?.('dots')}
                          className={cn(
                            "px-2 py-2 rounded-lg flex flex-col items-center gap-1.5 transition-all border",
                            visualizationMode === 'dots'
                              ? "bg-cyan-600 border-cyan-400 text-white shadow-lg"
                              : "bg-white/15 border-white/20 text-gray-300 hover:bg-white/25"
                          )}
                        >
                          <div className="w-2 h-2 rounded-full bg-current" />
                          <span className="text-[10px] font-bold">Points</span>
                        </button>

                        <button
                          onClick={() => onVisualizationModeChange?.('heatmap')}
                          className={cn(
                            "px-2 py-2 rounded-lg flex flex-col items-center gap-1.5 transition-all border",
                            visualizationMode === 'heatmap'
                              ? "bg-orange-600 border-orange-400 text-white shadow-lg"
                              : "bg-white/15 border-white/20 text-gray-300 hover:bg-white/25"
                          )}
                        >
                          <div className="w-2 h-2 rounded-full bg-current opacity-60 blur-[1px]" />
                          <span className="text-[10px] font-bold">Heatmap</span>
                        </button>

                        <button
                          onClick={() => onVisualizationModeChange?.('cluster')}
                          className={cn(
                            "px-2 py-2 rounded-lg flex flex-col items-center gap-1.5 transition-all border",
                            visualizationMode === 'cluster'
                              ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                              : "bg-white/15 border-white/20 text-gray-300 hover:bg-white/25"
                          )}
                        >
                          <div className="w-2 h-2 rounded-full border-2 border-current" />
                          <span className="text-[10px] font-bold">Clusters</span>
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {/* Section 3: Overlays */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-white/90">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">Overlays</h3>
                      </div>

                      <div className="space-y-2">
                        {/* Live Updates */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white/15 border border-white/20">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-1.5 h-1.5 rounded-full", activeFilters.live ? "bg-emerald-400 animate-pulse" : "bg-gray-500")} />
                            <span className="text-xs text-gray-300">Live Updates</span>
                          </div>
                          <button
                            onClick={() => onFilterChange('live', !activeFilters.live)}
                            className={cn(
                              "w-8 h-4 rounded-full relative transition-colors",
                              activeFilters.live ? "bg-emerald-500" : "bg-white/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm",
                              activeFilters.live ? "left-[18px]" : "left-0.5"
                            )} />
                          </button>
                        </div>

                        {/* Fires */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white/15 border border-white/20">
                          <div className="flex items-center gap-2">
                            <Flame className={cn("w-3 h-3", activeFilters.fires ? "text-orange-400" : "text-gray-500")} />
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-300">OSINT / Thermal</span>
                              <span className="text-[9px] text-gray-500">NASA FIRMS Data</span>
                            </div>
                          </div>
                          <button
                            onClick={() => onFilterChange('fires', !activeFilters.fires)}
                            className={cn(
                              "w-8 h-4 rounded-full relative transition-colors",
                              activeFilters.fires ? "bg-orange-600" : "bg-white/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm",
                              activeFilters.fires ? "left-[18px]" : "left-0.5"
                            )} />
                          </button>
                        </div>

                        {/* Low Liquidity Filter */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white/15 border border-white/20">
                          <div className="flex items-center gap-2">
                            <VolumeX className={cn("w-3 h-3", activeFilters.noiseFilter ? "text-amber-400" : "text-gray-500")} />
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-300">Hide Low Liquidity</span>
                              <span className="text-[9px] text-gray-500">Under $100 Vol</span>
                            </div>
                          </div>
                          <button
                            onClick={() => onFilterChange('noiseFilter', !activeFilters.noiseFilter)}
                            className={cn(
                              "w-8 h-4 rounded-full relative transition-colors",
                              activeFilters.noiseFilter ? "bg-amber-600" : "bg-white/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm",
                              activeFilters.noiseFilter ? "left-[18px]" : "left-0.5"
                            )} />
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

      {/* Top Right: User Island - Desktop only */}
      <div className="hidden md:flex absolute top-4 right-4 z-[1000] pointer-events-auto items-center gap-3">
        {/* Search Bar - Modernized */}
        <div className="relative group">
          <input
            ref={inputRef}
            type="text"
            className="block w-[320px] pl-10 pr-4 py-2.5 bg-[#0e0f11]/80 border border-white/10 rounded-2xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 backdrop-blur-xl transition-all font-sans tracking-tight"
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
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
            <Search className="h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
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
          className="flex items-center p-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl gap-1"
          style={{
            boxShadow: "10px 20px 40px -5px rgba(0, 0, 0, 0.9), 5px 10px 20px -5px rgba(0, 0, 0, 0.7), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)"
          }}
        >
          {/* Research Notebook */}
          <button
            onClick={() => setIsResearchOpen?.(!isResearchOpen)}
            className={cn(
              "relative w-9 h-9 flex items-center justify-center rounded-xl transition-all touch-manipulation",
              isResearchOpen ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/10 text-gray-400 hover:text-white"
            )}
            title="Research Notebook"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-white/10" />

          {/* Notifications */}
          <button
            onClick={onNotificationClick}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all touch-manipulation"
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
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all touch-manipulation"
            >
              <User className="w-4 h-4" />
            </button>
            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-[#0e0f11] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
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

    </div >
  );
}





