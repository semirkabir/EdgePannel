'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { useLayerStore, CensusDatasetType } from '@/lib/store/layer-store';
import {
    Activity,
    Banknote,
    Briefcase,
    Building2,
    Coins,
    Factory,
    Flame,
    Globe,
    Landmark,
    Radio,
    Zap,
    TrendingUp,
    Users,
    DollarSign,
    AlertTriangle,
    Ship,
    ChevronDown,
    ChevronRight,
    MapPin,
    Check,
    Rss
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface FeedControlsProps {
    activeFeeds: Record<string, boolean>;
    onToggle: (feedKey: string, active: boolean) => void;
    className?: string;
}

// Situation Feeds (Passed via Props)
const SITUATION_FEEDS = [
    { key: 'CONFLICT', label: 'Global Conflict', icon: Flame, color: 'text-red-500' },
    { key: 'fires', label: 'Fires & Ops Risk', icon: Flame, color: 'text-orange-500' },
    { key: 'GEOPOLITICS', label: 'Geopolitics', icon: Globe, color: 'text-blue-400' },
    { key: 'TECH_AI', label: 'Tech & AI', icon: Zap, color: 'text-cyan-400' },
    { key: 'CONTRACTS', label: 'Gov Contracts', icon: Briefcase, color: 'text-emerald-400' },
    { key: 'POLICY', label: 'US Policy', icon: Landmark, color: 'text-violet-400' },
    { key: 'MONEY_PRINTER', label: 'Economic Indicators', icon: Banknote, color: 'text-green-400' },
    { key: 'CRYPTO', label: 'Crypto Whales', icon: Coins, color: 'text-yellow-400' },
    { key: 'COMMODITIES', label: 'Commodities', icon: Factory, color: 'text-orange-400' },
    { key: 'LAYOFFS', label: 'Layoffs', icon: Activity, color: 'text-rose-400' },
    { key: 'usni', label: 'USNI Navy Fleet', icon: Ship, color: 'text-sky-400' },
    { key: 'satellites', label: 'Orbit Tracker', icon: Globe, color: 'text-cyan-400' },
    { key: 'gpsjam', label: 'GPS Jamming Radar', icon: Zap, color: 'text-red-400' },
];

// Government-related feeds (moved from situation feeds)
const GOVERNMENT_FEEDS = [
    { key: 'CONTRACTS', label: 'Gov Contracts', icon: Briefcase, color: 'text-emerald-400' },
    { key: 'POLICY', label: 'US Policy', icon: Landmark, color: 'text-violet-400' },
    { key: 'MONEY_PRINTER', label: 'Economic Indicators', icon: Banknote, color: 'text-green-400' },
];

// Census Config
const CENSUS_DATASETS: { id: CensusDatasetType; label: string; icon: React.ElementType; color: string; refresh: string }[] = [
    { id: 'population', label: 'Population', icon: Users, color: 'text-blue-400', refresh: 'Annual' },
    { id: 'income', label: 'Income & Wealth', icon: DollarSign, color: 'text-green-400', refresh: 'Annual' },
    { id: 'poverty', label: 'Poverty Rates', icon: AlertTriangle, color: 'text-amber-400', refresh: 'Annual' },
    { id: 'employment', label: 'Employment', icon: Briefcase, color: 'text-cyan-400', refresh: 'Monthly' },
    { id: 'trade', label: 'Trade & Exports', icon: Ship, color: 'text-rose-400', refresh: 'Monthly' },
];

export function FeedControls({ activeFeeds, onToggle, className }: FeedControlsProps) {
    const {
        activeLayers,
        toggleLayer,
        isLayerActive,
        customLayers,
        selectedCensusDataset,
        setCensusDataset,
        censusGeography,
        setCensusGeography
    } = useLayerStore();

    const [isExpanded, setIsExpanded] = useState(false);
    const [isGovExpanded, setIsGovExpanded] = useState(false);
    const [latencies, setLatencies] = useState<Record<string, number>>({});

    const isCensusActive = isLayerActive('CENSUS');

    useEffect(() => {
        const interval = setInterval(() => {
            setLatencies(prev => {
                const next = { ...prev };
                const keys = [
                    ...SITUATION_FEEDS.map(f => f.key), 
                    'PREDICTION', 
                    'FINANCE', 
                    'NEWS', 
                    ...GOVERNMENT_FEEDS.map(f => f.key)
                ];
                keys.forEach(key => {
                    const base = prev[key] || Math.floor(Math.random() * 50) + 30;
                    const change = Math.floor(Math.random() * 11) - 5; // -5 to +5 fluctuation
                    next[key] = Math.max(15, Math.min(120, base + change));
                });
                return next;
            });
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    // Helper for Census logic
    const handleCensusDatasetSelect = (datasetId: CensusDatasetType) => {
        if (selectedCensusDataset === datasetId) {
            setCensusDataset(null);
            if (isLayerActive('CENSUS')) toggleLayer('CENSUS');
        } else {
            setCensusDataset(datasetId);
            if (!isLayerActive('CENSUS')) toggleLayer('CENSUS');
        }
    };

    return (
        <div className={cn("flex flex-col gap-2 w-64", className)}>
            {/* Toggle Button */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="bg-[#0e0f11]/90 backdrop-blur border border-white/10 hover:bg-white/10 text-xs font-mono w-full justify-between h-9 rounded-xl shadow-lg shadow-black/20"
            >
                <span className="flex items-center gap-2">
                    <Radio className={cn("w-3.5 h-3.5", (Object.values(activeFeeds).some(Boolean) || activeLayers.length > 0) ? "text-[#ffb000] animate-pulse shadow-[0_0_8px_#ffb000]" : "text-white/50")} />
                    <span className="font-bold tracking-wide uppercase text-white/90">SITUATION FEED</span>
                </span>
                <span className="text-[10px] opacity-50 font-sans">{isExpanded ? 'CLOSE' : 'OPEN'}</span>
            </Button>

            {isExpanded && (
                <div className="bg-[#0e0f11]/95 backdrop-blur-md border border-white/10 rounded-xl p-2 space-y-1 overflow-hidden transition-all animate-in slide-in-from-top-2 shadow-2xl max-h-[70vh] overflow-y-auto custom-scrollbar">

                    {/* SECTION 1: LIVE INTELLIGENCE (Situation Feeds) */}
                    <div className="px-2 py-1.5 text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2 font-mono">
                        <div className="w-1 h-1 rounded-full bg-[#ffb000]/60 animate-pulse" />
                        Live Intelligence
                    </div>

                    {SITUATION_FEEDS.filter(feed => !GOVERNMENT_FEEDS.some(gf => gf.key === feed.key)).map((feed) => {
                        const isActive = activeFeeds[feed.key];
                        const Icon = feed.icon;

                        return (
                            <div
                                key={feed.key}
                                onClick={() => onToggle(feed.key, !isActive)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-300 border border-transparent group relative overflow-hidden",
                                    isActive 
                                        ? "bg-[#ffb000]/5 border-[#ffb000]/20 shadow-[inset_0_0_12px_rgba(255,176,0,0.02)]" 
                                        : "hover:bg-white/[0.03] opacity-70 hover:opacity-100 hover:border-white/5"
                                )}
                            >
                                {/* Glass-sliding shine hover effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />

                                {/* Cyber-amber Custom Checkbox */}
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center flex-shrink-0",
                                    isActive 
                                        ? "border-[#ffb000] bg-[#ffb000]/20 shadow-[0_0_8px_rgba(255,176,0,0.3)]" 
                                        : "border-white/20 group-hover:border-[#ffb000]/40 bg-black/20"
                                )}>
                                    {isActive && <Check className="w-2.5 h-2.5 text-[#ffb000] stroke-[3]" />}
                                </div>

                                <Icon className={cn("w-3.5 h-3.5 transition-colors duration-300", isActive ? "text-[#ffb000]" : "text-white/50 group-hover:text-white/80")} />
                                <span className={cn("text-xs font-mono tracking-wide flex-1 transition-colors duration-300", isActive ? "text-[#ffb000] font-bold" : "text-white/70 group-hover:text-white")}>
                                    {feed.label}
                                    {isActive && (
                                        <span className="text-[8px] font-mono text-[#ffb000]/60 animate-pulse pl-1.5 font-normal select-none">
                                            [{latencies[feed.key] || 45}ms]
                                        </span>
                                    )}
                                </span>
                            </div>
                        );
                    })}

                    {/* Prediction Markets */}
                    <button
                        onClick={() => toggleLayer('PREDICTION')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 text-left border border-transparent group relative overflow-hidden",
                            isLayerActive('PREDICTION')
                                ? "bg-[#ffb000]/5 border-[#ffb000]/20 shadow-[inset_0_0_12px_rgba(255,176,0,0.02)]" 
                                : "hover:bg-white/[0.03] opacity-70 hover:opacity-100 hover:border-white/5"
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                        <div className={cn(
                            "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center flex-shrink-0",
                            isLayerActive('PREDICTION')
                                ? "border-[#ffb000] bg-[#ffb000]/20 shadow-[0_0_8px_rgba(255,176,0,0.3)]" 
                                : "border-white/20 group-hover:border-[#ffb000]/40 bg-black/20"
                        )}>
                            {isLayerActive('PREDICTION') && <Check className="w-2.5 h-2.5 text-[#ffb000] stroke-[3]" />}
                        </div>
                        <Activity className={cn("w-3.5 h-3.5 transition-colors duration-300", isLayerActive('PREDICTION') ? "text-[#ffb000]" : "text-white/50 group-hover:text-white/80")} />
                        <span className={cn("text-xs font-mono tracking-wide flex-1 transition-colors duration-300", isLayerActive('PREDICTION') ? "text-[#ffb000] font-bold" : "text-white/70 group-hover:text-white")}>
                            Prediction Markets
                            {isLayerActive('PREDICTION') && (
                                <span className="text-[8px] font-mono text-[#ffb000]/60 animate-pulse pl-1.5 font-normal select-none">
                                    [{latencies['PREDICTION'] || 45}ms]
                                </span>
                            )}
                        </span>
                    </button>

                    {/* Financial Markets */}
                    <button
                        onClick={() => toggleLayer('FINANCE')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 text-left border border-transparent group relative overflow-hidden",
                            isLayerActive('FINANCE')
                                ? "bg-[#ffb000]/5 border-[#ffb000]/20 shadow-[inset_0_0_12px_rgba(255,176,0,0.02)]" 
                                : "hover:bg-white/[0.03] opacity-70 hover:opacity-100 hover:border-white/5"
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                        <div className={cn(
                            "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center flex-shrink-0",
                            isLayerActive('FINANCE')
                                ? "border-[#ffb000] bg-[#ffb000]/20 shadow-[0_0_8px_rgba(255,176,0,0.3)]" 
                                : "border-white/20 group-hover:border-[#ffb000]/40 bg-black/20"
                        )}>
                            {isLayerActive('FINANCE') && <Check className="w-2.5 h-2.5 text-[#ffb000] stroke-[3]" />}
                        </div>
                        <TrendingUp className={cn("w-3.5 h-3.5 transition-colors duration-300", isLayerActive('FINANCE') ? "text-[#ffb000]" : "text-white/50 group-hover:text-white/80")} />
                        <span className={cn("text-xs font-mono tracking-wide flex-1 transition-colors duration-300", isLayerActive('FINANCE') ? "text-[#ffb000] font-bold" : "text-white/70 group-hover:text-white")}>
                            Financial Markets
                            {isLayerActive('FINANCE') && (
                                <span className="text-[8px] font-mono text-[#ffb000]/60 animate-pulse pl-1.5 font-normal select-none">
                                    [{latencies['FINANCE'] || 45}ms]
                                </span>
                            )}
                        </span>
                    </button>

                    {/* Global News (Social) */}
                    <button
                        onClick={() => toggleLayer('NEWS')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 text-left border border-transparent group relative overflow-hidden",
                            isLayerActive('NEWS')
                                ? "bg-[#ffb000]/5 border-[#ffb000]/20 shadow-[inset_0_0_12px_rgba(255,176,0,0.02)]" 
                                : "hover:bg-white/[0.03] opacity-70 hover:opacity-100 hover:border-white/5"
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                        <div className={cn(
                            "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center flex-shrink-0",
                            isLayerActive('NEWS')
                                ? "border-[#ffb000] bg-[#ffb000]/20 shadow-[0_0_8px_rgba(255,176,0,0.3)]" 
                                : "border-white/20 group-hover:border-[#ffb000]/40 bg-black/20"
                        )}>
                            {isLayerActive('NEWS') && <Check className="w-2.5 h-2.5 text-[#ffb000] stroke-[3]" />}
                        </div>
                        <Rss className={cn("w-3.5 h-3.5 transition-colors duration-300", isLayerActive('NEWS') ? "text-[#ffb000]" : "text-white/50 group-hover:text-white/80")} />
                        <span className={cn("text-xs font-mono tracking-wide flex-1 transition-colors duration-300", isLayerActive('NEWS') ? "text-[#ffb000] font-bold" : "text-white/70 group-hover:text-white")}>
                            Social / News Feed
                            {isLayerActive('NEWS') && (
                                <span className="text-[8px] font-mono text-[#ffb000]/60 animate-pulse pl-1.5 font-normal select-none">
                                    [{latencies['NEWS'] || 45}ms]
                                </span>
                            )}
                        </span>
                    </button>

                    <div className="h-px bg-white/5 w-full my-2" />

                    {/* SECTION 3: GOVERNMENT DATA (Census) */}
                    <div className="px-2 py-1.5 text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2 font-mono">
                        <div className="w-1 h-1 rounded-full bg-[#ffb000]/60 animate-pulse" />
                        Government Data
                    </div>

                    {/* Government Feeds */}
                    {GOVERNMENT_FEEDS.map((feed) => {
                        const isActive = activeFeeds[feed.key];
                        const Icon = feed.icon;

                        return (
                            <div
                                key={feed.key}
                                onClick={() => onToggle(feed.key, !isActive)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-300 border border-transparent group relative overflow-hidden",
                                    isActive 
                                        ? "bg-[#ffb000]/5 border-[#ffb000]/20 shadow-[inset_0_0_12px_rgba(255,176,0,0.02)]" 
                                        : "hover:bg-white/[0.03] opacity-70 hover:opacity-100 hover:border-white/5"
                                )}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center flex-shrink-0",
                                    isActive 
                                        ? "border-[#ffb000] bg-[#ffb000]/20 shadow-[0_0_8px_rgba(255,176,0,0.3)]" 
                                        : "border-white/20 group-hover:border-[#ffb000]/40 bg-black/20"
                                )}>
                                    {isActive && <Check className="w-2.5 h-2.5 text-[#ffb000] stroke-[3]" />}
                                </div>
                                <Icon className={cn("w-3.5 h-3.5 transition-colors duration-300", isActive ? "text-[#ffb000]" : "text-white/50 group-hover:text-white/80")} />
                                <span className={cn("text-xs font-mono tracking-wide flex-1 transition-colors duration-300", isActive ? "text-[#ffb000] font-bold" : "text-white/70 group-hover:text-white")}>
                                    {feed.label}
                                    {isActive && (
                                        <span className="text-[8px] font-mono text-[#ffb000]/60 animate-pulse pl-1.5 font-normal select-none">
                                            [{latencies[feed.key] || 45}ms]
                                        </span>
                                    )}
                                </span>
                            </div>
                        );
                    })}

                    <button
                        onClick={() => setIsGovExpanded(!isGovExpanded)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 text-left border border-transparent group relative overflow-hidden",
                            isCensusActive 
                                ? "bg-[#ffb000]/5 border-[#ffb000]/20 shadow-[inset_0_0_12px_rgba(255,176,0,0.02)]" 
                                : "hover:bg-white/[0.03] opacity-70 hover:opacity-100 hover:border-white/5"
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                        <div className={cn(
                            "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center flex-shrink-0",
                            isCensusActive 
                                ? "border-[#ffb000] bg-[#ffb000]/20 shadow-[0_0_8px_rgba(255,176,0,0.3)]" 
                                : "border-white/20 group-hover:border-[#ffb000]/40 bg-black/20"
                        )}>
                            {isCensusActive && <Check className="w-2.5 h-2.5 text-[#ffb000] stroke-[3]" />}
                        </div>
                        <Building2 className={cn("w-3.5 h-3.5 transition-colors duration-300", isCensusActive ? "text-[#ffb000]" : "text-white/50 group-hover:text-white/80")} />
                        <div className="flex-1 flex flex-col">
                            <span className={cn("text-xs font-mono tracking-wide transition-colors duration-300", isCensusActive ? "text-[#ffb000] font-bold" : "text-white/70 group-hover:text-white")}>
                                U.S. Census Bureau
                            </span>
                            {selectedCensusDataset && (
                                <span className="text-[9px] text-white/50 leading-none mt-0.5 font-mono">
                                    {CENSUS_DATASETS.find(d => d.id === selectedCensusDataset)?.label} ({censusGeography})
                                </span>
                            )}
                        </div>
                        {isGovExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white/50" /> : <ChevronRight className="w-3.5 h-3.5 text-white/50" />}
                    </button>

                    {/* Expanded Census Options */}
                    {isGovExpanded && (
                        <div className="ml-4 pl-3 border-l border-white/10 space-y-0.5 mt-1">
                            {CENSUS_DATASETS.map((dataset) => {
                                const isSelected = selectedCensusDataset === dataset.id;
                                const Icon = dataset.icon;
                                return (
                                    <button
                                        key={dataset.id}
                                        onClick={() => handleCensusDatasetSelect(dataset.id)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 text-left text-xs border border-transparent relative overflow-hidden",
                                            isSelected 
                                                ? "bg-[#ffb000]/5 border-[#ffb000]/10 text-[#ffb000]" 
                                                : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]"
                                        )}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                                        <div className={cn(
                                            "w-3 h-3 rounded border transition-all flex items-center justify-center flex-shrink-0",
                                            isSelected 
                                                ? "border-[#ffb000] bg-[#ffb000]/20 shadow-[0_0_4px_rgba(255,176,0,0.3)]" 
                                                : "border-white/10 bg-black/10"
                                        )}>
                                            {isSelected && <Check className="w-2 h-2 text-[#ffb000] stroke-[3]" />}
                                        </div>
                                        <Icon className={cn("w-3 h-3 transition-colors", isSelected ? "text-[#ffb000]" : "text-gray-500")} />
                                        <span className="flex-1 font-mono text-[10px] uppercase tracking-wider">{dataset.label}</span>
                                    </button>
                                );
                            })}

                            {/* Geography Toggle */}
                            {selectedCensusDataset && (
                                <div className="mt-2 pt-2 border-t border-white/5 px-2">
                                    <div className="flex bg-white/5 rounded-lg p-0.5">
                                        <button
                                            onClick={() => setCensusGeography('state')}
                                            className={cn("flex-1 py-1 text-[9px] font-medium rounded-md transition-all text-center", censusGeography === 'state' ? "bg-indigo-500/30 text-indigo-300" : "text-gray-500 hover:text-gray-300")}
                                        >
                                            State
                                        </button>
                                        <button
                                            onClick={() => setCensusGeography('county')}
                                            className={cn("flex-1 py-1 text-[9px] font-medium rounded-md transition-all text-center", censusGeography === 'county' ? "bg-indigo-500/30 text-indigo-300" : "text-gray-500 hover:text-gray-300")}
                                        >
                                            County
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CUSTOM / COMMUNITY */}
                    {customLayers.length > 0 && (
                        <>
                            <div className="h-px bg-white/5 w-full my-2" />
                            <div className="px-2 py-1.5 text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2 font-mono">
                                <div className="w-1 h-1 rounded-full bg-[#ffb000]/60 animate-pulse" />
                                Community Layers
                            </div>
                            {customLayers.map((layer) => (
                                <button
                                    key={layer.id}
                                    onClick={() => toggleLayer(layer.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 text-left border border-transparent group relative overflow-hidden",
                                        isLayerActive(layer.id)
                                            ? "bg-[#ffb000]/5 border-[#ffb000]/20 shadow-[inset_0_0_12px_rgba(255,176,0,0.02)]" 
                                            : "hover:bg-white/[0.03] opacity-70 hover:opacity-100 hover:border-white/5"
                                    )}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                                    <div className={cn(
                                        "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center flex-shrink-0",
                                        isLayerActive(layer.id)
                                            ? "border-[#ffb000] bg-[#ffb000]/20 shadow-[0_0_8px_rgba(255,176,0,0.3)]" 
                                            : "border-white/20 group-hover:border-[#ffb000]/40 bg-black/20"
                                    )}>
                                        {isLayerActive(layer.id) && <Check className="w-2.5 h-2.5 text-[#ffb000] stroke-[3]" />}
                                    </div>
                                    <MapPin className={cn("w-3.5 h-3.5 transition-colors duration-300", isLayerActive(layer.id) ? "text-[#ffb000]" : "text-white/50 group-hover:text-white/80")} />
                                    <span className={cn("text-xs font-mono tracking-wide flex-1 transition-colors duration-300", isLayerActive(layer.id) ? "text-[#ffb000] font-bold" : "text-white/70 group-hover:text-white")}>
                                        {layer.label}
                                    </span>
                                </button>
                            ))}
                        </>
                    )}

                </div>
            )}
        </div>
    );
}
