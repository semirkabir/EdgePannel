import React, { useMemo } from 'react'
import { EnrichedMarket } from '@/lib/markets/enrich'
import { cn } from '@/lib/utils/cn'
import {
    BarChart3,
    TrendingUp,
    Landmark,
    CloudRain,
    Trophy,
    Cpu,
    Film,
    Activity,
    Globe,
    LayoutGrid,
    Search
} from 'lucide-react'

interface SearchResultsProps {
    results: EnrichedMarket[]
    onSelect: (market: EnrichedMarket) => void
    isLoading?: boolean
    className?: string
}

// Map categories to icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'Politics': <Landmark className="w-3 h-3" />,
    'Economics': <TrendingUp className="w-3 h-3" />,
    'Weather': <CloudRain className="w-3 h-3" />,
    'Sports': <Trophy className="w-3 h-3" />,
    'Technology': <Cpu className="w-3 h-3" />,
    'Entertainment': <Film className="w-3 h-3" />,
    'Health': <Activity className="w-3 h-3" />,
    'International': <Globe className="w-3 h-3" />,
    'General': <LayoutGrid className="w-3 h-3" />,
    'Other': <LayoutGrid className="w-3 h-3" />
}

export function SearchResults({ results, onSelect, isLoading, className }: SearchResultsProps) {
    // Filter out sports markets and group results by category
    const groupedResults = useMemo(() => {
        const groups: Record<string, EnrichedMarket[]> = {}

        results.forEach(market => {
            // Capitalize category or default to 'General'
            let category = market.category || 'General'
            // Simple capitalization if it's lowercase
            category = category.charAt(0).toUpperCase() + category.slice(1)

            // Filter out sports markets
            if (category.toLowerCase() === 'sports') {
                return;
            }

            if (!groups[category]) {
                groups[category] = []
            }
            groups[category].push(market)
        })

        return groups
    }, [results])

    const sortedCategories = useMemo(() => {
        return Object.keys(groupedResults).sort((a, b) => {
            // Priority ordering - prioritize news and finance categories
            const priority = ['Politics', 'Finance', 'Economics', 'Crypto', 'Geopolitics', 'Technology'];
            const idxA = priority.indexOf(a);
            const idxB = priority.indexOf(b);

            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;

            if (a === 'General' || a === 'Other') return 1 // General at bottom
            if (b === 'General' || b === 'Other') return -1
            return a.localeCompare(b)
        })
    }, [groupedResults])

    if (!results.length && !isLoading) return null

    return (
        <div className={cn(
            "absolute top-full left-0 right-0 mt-2",
            "bg-[#0e0f11]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl",
            "max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-in fade-in slide-in-from-top-2 duration-200",
            className
        )}>
            {isLoading && (
                <div className="p-8 flex flex-col items-center justify-center text-gray-400 gap-3">
                    <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-xs font-mono">Scanning markets...</span>
                </div>
            )}

            {!isLoading && results.length === 0 && (
                <div className="p-8 flex flex-col items-center justify-center text-gray-500 gap-2">
                    <Search className="w-6 h-6 opacity-20" />
                    <span className="text-xs">No markets found matching your query</span>
                </div>
            )}

            {!isLoading && sortedCategories.map((category) => (
                <div key={category} className="border-b border-white/5 last:border-0">
                    {/* Category Header */}
                    <div className="px-3 py-2 bg-gradient-to-r from-white/5 to-transparent text-[10px] font-bold text-blue-200/80 uppercase tracking-wider sticky top-0 backdrop-blur-md z-10 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-2">
                            {CATEGORY_ICONS[category] || <LayoutGrid className="w-3 h-3" />}
                            <span>{category}</span>
                        </div>
                        <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-gray-400 font-mono">{groupedResults[category].length}</span>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-white/5">
                        {groupedResults[category].map((market) => (
                            <div
                                key={market.id}
                                onClick={() => onSelect(market)}
                                className={cn(
                                    "group relative cursor-pointer p-4 transition-all hover:pl-5",
                                    // Enhanced background with gradient tint based on platform
                                    market.platform === 'polymarket'
                                        ? "hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-blue-500/5 hover:shadow-[inset_3px_0_0_0_#3b82f6]"
                                        : "hover:bg-gradient-to-r hover:from-green-500/10 hover:to-green-500/5 hover:shadow-[inset_3px_0_0_0_#10b981]"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Market Image or Fallback Icon */}
                                    <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-white/10 shadow-lg bg-gray-900 relative">
                                        {(() => {
                                            // Check multiple possible image sources
                                            const imageUrl = market.imageUrl ||
                                                           (market as any).image ||
                                                           (market as any).rawData?.image ||
                                                           (market as any).rawData?.icon ||
                                                           (market as any).rawData?.eventImage;

                                            return imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={market.title}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        // Hide image and show fallback
                                                        e.currentTarget.style.display = 'none';
                                                        const fallback = e.currentTarget.nextElementSibling;
                                                        if (fallback) {
                                                            fallback.classList.remove('hidden');
                                                        }
                                                    }}
                                                />
                                            ) : null;
                                        })()}

                                        {/* Fallback content - hidden by default, shown if image fails or missing */}
                                        <div className={`w-full h-full flex items-center justify-center bg-gray-800 ${
                                            !(market.imageUrl ||
                                              (market as any).image ||
                                              (market as any).rawData?.image ||
                                              (market as any).rawData?.icon ||
                                              (market as any).rawData?.eventImage) ? '' : 'hidden'
                                        }`}>
                                            {market.platform === 'polymarket' ? (
                                                <span className="text-[8px] font-black text-blue-400">POLY</span>
                                            ) : (
                                                <span className="text-[8px] font-black text-green-400">KALS</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Enhanced Content Layout */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between gap-4 mb-3">
                                            <div className="flex-1 min-w-0">
                                                {/* Title - Now with more space and no truncation */}
                                                <h4 className="text-sm font-semibold text-gray-100 leading-tight group-hover:text-white transition-colors mb-2">
                                                    {market.title}
                                                </h4>
                                            </div>

                                            {/* Enhanced Price and Platform Display */}
                                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                {market.price !== undefined && (
                                                    <div className={cn(
                                                        "text-2xl font-black tabular-nums",
                                                        market.price > 0.5 ? "text-emerald-400" : "text-red-400"
                                                    )}>
                                                        {(market.price * 100).toFixed(0)}%
                                                    </div>
                                                )}

                                                {/* Platform Badge on the Right */}
                                                <span className={cn(
                                                    "inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold border",
                                                    market.platform === 'polymarket'
                                                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                                        : "bg-green-500/10 border-green-500/20 text-green-400"
                                                )}>
                                                    {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Tags Row - Moved to Bottom */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Category Badge */}
                                            {market.category && (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gradient-to-r from-purple-500/15 to-purple-600/10 border border-purple-500/30 rounded text-[9px] font-bold text-purple-300 uppercase tracking-wide">
                                                    {CATEGORY_ICONS[category] || <LayoutGrid className="w-3 h-3" />}
                                                    {category}
                                                </span>
                                            )}

                                            {/* Volume Badge */}
                                            {market.volume24h !== undefined && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-mono font-bold text-emerald-400">
                                                    <BarChart3 className="w-3 h-3" />
                                                    ${market.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0, notation: 'compact' })}
                                                </span>
                                            )}

                                            {/* Liquidity Badge if available */}
                                            {market.liquidity !== undefined && market.liquidity > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-mono font-bold text-blue-400">
                                                    <Activity className="w-3 h-3" />
                                                    ${market.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0, notation: 'compact' })} Liq
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Hover Effect Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
