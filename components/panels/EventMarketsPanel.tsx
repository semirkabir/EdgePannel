'use client'

import React, { useState, useMemo } from 'react'
import { Market, PricePoint, EventData } from '@/types/market'
import { cn } from '@/lib/utils/cn'
import { Calendar, BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EventMultiChart } from '@/components/charts/EventMultiChart'

interface EventMarketsPanelProps {
    eventData: EventData
    markets: Market[]
    priceHistories?: Record<string, PricePoint[]>
    onMarketSelect?: (market: Market) => void
}

// Color palette for chart lines
const OUTCOME_COLORS = [
    '#60A5FA', // blue-400
    '#F97316', // orange-500
    '#14B8A6', // teal-500
    '#A855F7', // purple-500
    '#EF4444', // red-500
    '#22C55E', // green-500
    '#FBBF24', // amber-400
    '#EC4899', // pink-500
]

export function EventMarketsPanel({
    eventData,
    markets,
    priceHistories,
    onMarketSelect
}: EventMarketsPanelProps) {
    const [expandedMarket, setExpandedMarket] = useState<string | null>(null)
    const [timeRange, setTimeRange] = useState<'1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'>('1D')

    // Calculate total volume across all markets
    const totalVolume = useMemo(() => {
        return markets.reduce((sum, m) => sum + (m.volume24h || 0), 0)
    }, [markets])

    // Format volume for display
    const formatVolume = (vol: number) => {
        if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`
        if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`
        return `$${vol.toFixed(0)}`
    }

    // Format date for display
    const formatEndDate = () => {
        if (!eventData.dateRangeEnd) return null
        const date = new Date(eventData.dateRangeEnd)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    // Get price change from last 24h
    const getPriceChange = (marketId: string): number | null => {
        const history = priceHistories?.[marketId]
        if (!history || history.length < 2) return null
        const oldest = history[0].price
        const newest = history[history.length - 1].price
        if (oldest === 0) return null
        return ((newest - oldest) / oldest) * 100
    }

    const toggleExpand = (marketId: string) => {
        setExpandedMarket(expandedMarket === marketId ? null : marketId)
    }

    return (
        <div className="flex flex-col h-full">
            {/* Event Header */}
            <div className="px-4 py-3 border-b border-white/10 bg-[#0e0f11]">
                {/* Event Image + Title */}
                <div className="flex items-start gap-3 mb-3">
                    {eventData.imageUrl && (
                        <img
                            src={eventData.imageUrl}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-white leading-tight line-clamp-2">
                            {eventData.title || eventData.question}
                        </h2>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span className="font-medium text-white">{formatVolume(eventData.totalVolume || totalVolume)}</span>
                        <span>Vol.</span>
                    </div>
                    {formatEndDate() && (
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatEndDate()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Multi-line Chart */}
            {priceHistories && Object.keys(priceHistories).length > 0 && (
                <div className="px-4 py-3 border-b border-white/10">
                    <EventMultiChart
                        markets={markets}
                        priceHistories={priceHistories}
                        colors={OUTCOME_COLORS}
                        height={180}
                    />

                    {/* Time Range Selector */}
                    <div className="flex items-center justify-end gap-1 mt-2">
                        {(['1H', '6H', '1D', '1W', '1M', 'ALL'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={cn(
                                    'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                                    timeRange === range
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                )}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Outcomes/Markets List */}
            <div className="flex-1 overflow-auto">
                {markets.map((market, index) => {
                    const isExpanded = expandedMarket === market.id
                    const priceChange = getPriceChange(market.id)
                    const price = market.price ?? market.probability
                    const pricePercent = price !== undefined ? Math.round(price * 100) : null
                    const color = OUTCOME_COLORS[index % OUTCOME_COLORS.length]

                    // Extract outcome label from title (or use full title)
                    const outcomeLabel = market.rawData?.subtitle || market.title

                    return (
                        <div
                            key={market.id}
                            className={cn(
                                'border-b border-white/5 transition-colors',
                                isExpanded ? 'bg-white/5' : 'hover:bg-white/[0.02]'
                            )}
                        >
                            {/* Outcome Row */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                                onClick={() => toggleExpand(market.id)}
                            >
                                {/* Color indicator */}
                                <div
                                    className="w-1 h-8 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                />

                                {/* Outcome Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">
                                        {outcomeLabel}
                                    </div>
                                    <div className="text-[11px] text-gray-500">
                                        {formatVolume(market.volume24h || 0)} Vol.
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="text-right shrink-0">
                                    <div className="text-xl font-bold text-white">
                                        {pricePercent !== null ? `${pricePercent}%` : '—'}
                                    </div>
                                    {priceChange !== null && (
                                        <div className={cn(
                                            'flex items-center justify-end gap-0.5 text-[11px] font-medium',
                                            priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        )}>
                                            {priceChange >= 0 ? (
                                                <TrendingUp className="w-3 h-3" />
                                            ) : (
                                                <TrendingDown className="w-3 h-3" />
                                            )}
                                            {Math.abs(priceChange).toFixed(0)}%
                                        </div>
                                    )}
                                </div>

                                {/* Expand indicator */}
                                <div className="text-gray-500 shrink-0">
                                    {isExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4" />
                                    )}
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="px-4 pb-4">
                                    {/* Buy Yes/No Buttons */}
                                    <div className="flex gap-2 mb-3">
                                        <Button
                                            variant="outline"
                                            className="flex-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-sm font-bold"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onMarketSelect?.(market)
                                            }}
                                        >
                                            Buy Yes {pricePercent !== null ? `${pricePercent}¢` : ''}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm font-bold"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onMarketSelect?.(market)
                                            }}
                                        >
                                            Buy No {pricePercent !== null ? `${100 - pricePercent}¢` : ''}
                                        </Button>
                                    </div>

                                    {/* View Full Market Button */}
                                    <Button
                                        variant="ghost"
                                        className="w-full text-xs text-gray-400 hover:text-white"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onMarketSelect?.(market)
                                        }}
                                    >
                                        View Full Market Details →
                                    </Button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
