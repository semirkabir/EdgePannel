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
    // Group results by category
    const groupedResults = useMemo(() => {
        const groups: Record<string, EnrichedMarket[]> = {}

        results.forEach(market => {
            // Capitalize category or default to 'General'
            let category = market.category || 'General'
            // Simple capitalization if it's lowercase
            category = category.charAt(0).toUpperCase() + category.slice(1)

            if (!groups[category]) {
                groups[category] = []
            }
            groups[category].push(market)
        })

        return groups
    }, [results])

    const sortedCategories = useMemo(() => {
        return Object.keys(groupedResults).sort((a, b) => {
            // Priority ordering
            const priority = ['Politics', 'Economics', 'Technology'];
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
            "max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent animate-in fade-in slide-in-from-top-2 duration-200",
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
                                    "group relative cursor-pointer p-3 transition-all hover:pl-4",
                                    // Subtle background tint based on platform
                                    market.platform === 'polymarket'
                                        ? "hover:bg-blue-500/5 hover:shadow-[inset_2px_0_0_0_#3b82f6]"
                                        : "hover:bg-green-500/5 hover:shadow-[inset_2px_0_0_0_#10b981]"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Platform Indicator - Icon/Badge style */}
                                    <div className={cn(
                                        "shrink-0 w-8 h-8 rounded-lg flex flex-col items-center justify-center border mt-0.5",
                                        market.platform === 'polymarket'
                                            ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                            : "bg-green-500/10 border-green-500/20 text-green-400"
                                    )}>
                                        <span className="text-[9px] font-black tracking-tighter leading-none">
                                            {market.platform === 'polymarket' ? 'POLY' : 'KALS'}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between gap-4">
                                            <h4 className="text-sm font-medium text-gray-200 leading-snug group-hover:text-white transition-colors line-clamp-2">
                                                {market.title}
                                            </h4>

                                            {/* Price/Probability */}
                                            {market.price !== undefined && (
                                                <div className="text-right shrink-0">
                                                    <span className={cn(
                                                        "text-sm font-bold tabular-nums block",
                                                        market.price > 0.5 ? "text-emerald-400 shadow-emerald-500/20" : "text-red-400"
                                                    )}>
                                                        {(market.price * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 mt-1.5">
                                            {/* Volume */}
                                            {market.volume24h !== undefined && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 group-hover:text-gray-400">
                                                    <BarChart3 className="w-3 h-3" />
                                                    <span className="font-mono">${market.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0, notation: 'compact' })} Vol</span>
                                                </div>
                                            )}

                                            {/* Source Tag (Subtle) */}
                                            <div className={cn(
                                                "text-[9px] uppercase tracking-wider font-semibold opacity-60",
                                                market.platform === 'polymarket' ? "text-blue-400" : "text-green-400"
                                            )}>
                                                {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
