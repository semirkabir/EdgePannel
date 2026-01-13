'use client';

import { useState } from 'react';
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
    { key: 'GEOPOLITICS', label: 'Geopolitics', icon: Globe, color: 'text-blue-400' },
    { key: 'TECH_AI', label: 'Tech & AI', icon: Zap, color: 'text-cyan-400' },
    { key: 'CONTRACTS', label: 'Gov Contracts', icon: Briefcase, color: 'text-emerald-400' },
    { key: 'POLICY', label: 'US Policy', icon: Landmark, color: 'text-violet-400' },
    { key: 'MONEY_PRINTER', label: 'Economic Indicators', icon: Banknote, color: 'text-green-400' },
    { key: 'CRYPTO', label: 'Crypto Whales', icon: Coins, color: 'text-yellow-400' },
    { key: 'COMMODITIES', label: 'Commodities', icon: Factory, color: 'text-orange-400' },
    { key: 'LAYOFFS', label: 'Layoffs', icon: Activity, color: 'text-rose-400' },
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

    const isCensusActive = isLayerActive('CENSUS');

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
                    <Radio className={cn("w-3.5 h-3.5", (Object.values(activeFeeds).some(Boolean) || activeLayers.length > 0) ? "text-[#00ff7f] animate-pulse" : "text-white/50")} />
                    <span className="font-bold tracking-wide">SITUATION FEED</span>
                </span>
                <span className="text-[10px] opacity-50 font-sans">{isExpanded ? 'CLOSE' : 'OPEN'}</span>
            </Button>

            {isExpanded && (
                <div className="bg-[#0e0f11]/90 backdrop-blur-md border border-white/10 rounded-xl p-2 space-y-1 overflow-hidden transition-all animate-in slide-in-from-top-2 shadow-2xl max-h-[70vh] overflow-y-auto custom-scrollbar">

                    {/* SECTION 1: LIVE INTELLIGENCE (Situation Feeds) */}
                    <div className="px-2 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-white/40" />
                        Live Intelligence
                    </div>

                    {SITUATION_FEEDS.map((feed) => {
                        const isActive = activeFeeds[feed.key];
                        const Icon = feed.icon;

                        return (
                            <div
                                key={feed.key}
                                onClick={() => onToggle(feed.key, !isActive)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border border-transparent group",
                                    isActive ? "bg-white/10 border-white/10" : "hover:bg-white/5 opacity-70 hover:opacity-100"
                                )}
                            >
                                <div className={cn("w-1.5 h-1.5 rounded-full transition-all flex-shrink-0", isActive ? "bg-[#00ff7f] shadow-[0_0_8px_rgba(0,255,127,0.5)]" : "bg-white/20 group-hover:bg-white/40")} />
                                <Icon className={cn("w-3.5 h-3.5", isActive ? feed.color : "text-white/50")} />
                                <span className={cn("text-xs font-medium flex-1", isActive ? "text-white" : "text-white/70")}>
                                    {feed.label}
                                </span>
                                {isActive && <Check className="w-3 h-3 text-[#00ff7f]" />}
                            </div>
                        );
                    })}

                    <div className="h-px bg-white/5 w-full my-2" />

                    {/* SECTION 2: MARKET DATA LAYERS */}
                    <div className="px-2 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-white/40" />
                        Market Layers
                    </div>

                    {/* Prediction Markets */}
                    <button
                        onClick={() => toggleLayer('PREDICTION')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left border border-transparent group",
                            isLayerActive('PREDICTION') ? "bg-white/10 border-white/10" : "hover:bg-white/5 opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className={cn("w-1.5 h-1.5 rounded-full transition-all flex-shrink-0", isLayerActive('PREDICTION') ? "bg-emerald-400" : "bg-white/20")} />
                        <Activity className={cn("w-3.5 h-3.5", isLayerActive('PREDICTION') ? "text-emerald-400" : "text-white/50")} />
                        <span className={cn("text-xs font-medium flex-1", isLayerActive('PREDICTION') ? "text-white" : "text-white/70")}>
                            Prediction Markets
                        </span>
                        {isLayerActive('PREDICTION') && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>

                    {/* Financial Markets */}
                    <button
                        onClick={() => toggleLayer('FINANCE')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left border border-transparent group",
                            isLayerActive('FINANCE') ? "bg-white/10 border-white/10" : "hover:bg-white/5 opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className={cn("w-1.5 h-1.5 rounded-full transition-all flex-shrink-0", isLayerActive('FINANCE') ? "bg-yellow-400" : "bg-white/20")} />
                        <TrendingUp className={cn("w-3.5 h-3.5", isLayerActive('FINANCE') ? "text-yellow-400" : "text-white/50")} />
                        <span className={cn("text-xs font-medium flex-1", isLayerActive('FINANCE') ? "text-white" : "text-white/70")}>
                            Financial Markets
                        </span>
                        {isLayerActive('FINANCE') && <Check className="w-3 h-3 text-yellow-400" />}
                    </button>

                    {/* Global News (Social) */}
                    <button
                        onClick={() => toggleLayer('NEWS')}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left border border-transparent group",
                            isLayerActive('NEWS') ? "bg-white/10 border-white/10" : "hover:bg-white/5 opacity-70 hover:opacity-100"
                        )}
                    >
                        <div className={cn("w-1.5 h-1.5 rounded-full transition-all flex-shrink-0", isLayerActive('NEWS') ? "bg-blue-400" : "bg-white/20")} />
                        <Rss className={cn("w-3.5 h-3.5", isLayerActive('NEWS') ? "text-blue-400" : "text-white/50")} />
                        <span className={cn("text-xs font-medium flex-1", isLayerActive('NEWS') ? "text-white" : "text-white/70")}>
                            Social / News Feed
                        </span>
                        {isLayerActive('NEWS') && <Check className="w-3 h-3 text-blue-400" />}
                    </button>


                    <div className="h-px bg-white/5 w-full my-2" />

                    {/* SECTION 3: GOVERNMENT DATA (Census) */}
                    <div className="px-2 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-white/40" />
                        Government Data
                    </div>

                    <button
                        onClick={() => setIsGovExpanded(!isGovExpanded)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left border border-transparent group",
                            isCensusActive ? "bg-white/10 border-white/10" : "hover:bg-white/5"
                        )}
                    >
                        <div className={cn("w-1.5 h-1.5 rounded-full transition-all flex-shrink-0", isCensusActive ? "bg-indigo-400" : "bg-white/20")} />
                        <Building2 className={cn("w-3.5 h-3.5", isCensusActive ? "text-indigo-400" : "text-white/50")} />
                        <div className="flex-1 flex flex-col">
                            <span className={cn("text-xs font-medium", isCensusActive ? "text-white" : "text-white/70")}>
                                U.S. Census Bureau
                            </span>
                            {selectedCensusDataset && (
                                <span className="text-[9px] text-white/50 leading-none mt-0.5">
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
                                            "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-left text-xs",
                                            isSelected ? "bg-indigo-500/20 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                                        )}
                                    >
                                        <Icon className={cn("w-3 h-3", isSelected ? dataset.color : "text-gray-500")} />
                                        <span className="flex-1">{dataset.label}</span>
                                        {isSelected && <Check className="w-3 h-3 text-indigo-400" />}
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
                            <div className="px-2 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-white/40" />
                                Community Layers
                            </div>
                            {customLayers.map((layer) => (
                                <button
                                    key={layer.id}
                                    onClick={() => toggleLayer(layer.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left border border-transparent group",
                                        isLayerActive(layer.id) ? "bg-white/10 border-white/10" : "hover:bg-white/5 opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <div className={cn("w-1.5 h-1.5 rounded-full transition-all flex-shrink-0", isLayerActive(layer.id) ? layer.color.replace('text-', 'bg-') : "bg-white/20")} />
                                    <MapPin className={cn("w-3.5 h-3.5", isLayerActive(layer.id) ? layer.color : "text-white/50")} />
                                    <span className={cn("text-xs font-medium flex-1 truncate", isLayerActive(layer.id) ? "text-white" : "text-white/70")}>
                                        {layer.label}
                                    </span>
                                    {isLayerActive(layer.id) && <Check className="w-3 h-3 text-white" />}
                                </button>
                            ))}
                        </>
                    )}

                </div>
            )}
        </div>
    );
}
