import React from 'react';
import { Rss, Activity, TrendingUp, Globe, MapPin, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useLayerStore, LayerType } from '@/lib/store/layer-store';

export function LayerMenu() {
    const { activeLayers, toggleLayer, isLayerActive, customLayers, addCustomLayer } = useLayerStore();
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const defaultLayers: { id: string; label: string; icon: React.ElementType; color: string }[] = [
        { id: 'PREDICTION', label: 'Prediction Markets', icon: Activity, color: 'text-emerald-400' },
        { id: 'NEWS', label: 'Global News', icon: Globe, color: 'text-blue-400' },
        { id: 'FINANCE', label: 'Financial Markets', icon: TrendingUp, color: 'text-yellow-400' },
    ];

    const MOCK_COMMUNITY_LAYERS = [
        { id: 'WILDFIRES', label: 'Active Wildfires (NASA)', color: 'text-orange-500' },
        { id: 'SHIPPING', label: 'Global Shipping Routes', color: 'text-cyan-400' },
        { id: 'SATELLITES', label: 'Starlink Satellites', color: 'text-purple-400' },
        { id: 'ENERGY', label: 'Energy Infrastructure', color: 'text-yellow-500' },
    ];

    const activeCount = activeLayers.length;

    const filteredResults = searchQuery
        ? MOCK_COMMUNITY_LAYERS.filter(l =>
            l.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !customLayers.some(cl => cl.id === l.id)
        )
        : [];

    const handleAddLayer = (layer: typeof MOCK_COMMUNITY_LAYERS[0]) => {
        addCustomLayer({
            id: layer.id,
            label: layer.label,
            color: layer.color
        });
        setSearchQuery('');
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-7 px-2.5 flex items-center gap-1.5 rounded-xl text-[10px] uppercase font-bold transition-all border shadow-sm",
                    isOpen
                        ? "bg-white/20 border-white/30 text-white shadow-lg"
                        : "bg-[#0e0f11]/90 border-white/20 text-gray-200 hover:text-white hover:bg-white/10"
                )}
            >
                <Rss className="w-3.5 h-3.5" />
                <span>Data Feeds</span>
                {activeCount > 0 && (
                    <span className="ml-1 flex items-center justify-center w-4 h-4 bg-blue-500 text-white rounded-full text-[9px] font-bold">
                        {activeCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#0e0f11]/98 border border-white/10 rounded-xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 flex flex-col max-h-[400px]">
                    <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-shrink-0">
                        <div className="px-2 py-1.5 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                            Core Data Feeds
                        </div>

                        {defaultLayers.map((layer) => {
                            const isActive = isLayerActive(layer.id);
                            const Icon = layer.icon;

                            return (
                                <button
                                    key={layer.id}
                                    onClick={() => toggleLayer(layer.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-xs font-medium",
                                        isActive
                                            ? "bg-white/10 text-white"
                                            : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className={cn("w-3.5 h-3.5", isActive ? layer.color : "text-gray-500")} />
                                        <span>{layer.label}</span>
                                    </div>
                                    {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                                </button>
                            );
                        })}

                        {customLayers.length > 0 && (
                            <>
                                <div className="h-px bg-white/5 w-full my-2" />
                                <div className="px-2 py-1.5 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                                    Community Feeds
                                </div>
                                {customLayers.map((layer) => {
                                    const isActive = isLayerActive(layer.id);

                                    return (
                                        <button
                                            key={layer.id}
                                            onClick={() => toggleLayer(layer.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-xs font-medium",
                                                isActive
                                                    ? "bg-white/10 text-white"
                                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <MapPin className={cn("w-3.5 h-3.5", isActive ? layer.color : "text-gray-500")} />
                                                <span className="truncate max-w-[140px] text-left">{layer.label}</span>
                                            </div>
                                            {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    <div className="border-t border-white/5 bg-black/20 p-2">
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Search community feeds..."
                                className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <Search className="w-3.5 h-3.5 text-white/30 group-focus-within:text-white/70 transition-colors" />
                            </div>
                        </div>

                        {/* Search Results */}
                        {searchQuery && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-[#1a1b1e] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                {filteredResults.length > 0 ? (
                                    filteredResults.map(result => (
                                        <button
                                            key={result.id}
                                            onClick={() => handleAddLayer(result)}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-left hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                                        >
                                            <div className={cn("w-2 h-2 rounded-full", result.color.replace('text-', 'bg-'))} />
                                            <span>{result.label}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-xs text-white/30 italic">
                                        No feeds found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
