'use client';

'use client';

import { useRef, useEffect } from 'react'
import { EnrichedMarket } from '@/lib/markets/enrich'
import { MarketCard } from './MarketCard'
import { cn } from '@/lib/utils/cn'

interface MarketCardStackProps {
    markets: EnrichedMarket[]
    onMarketClick: (market: EnrichedMarket) => void
    maxCards?: number
    className?: string
}

export function MarketCardStack({
    markets,
    onMarketClick,
    maxCards = 5,
    className
}: MarketCardStackProps) {
    const stackRef = useRef<HTMLDivElement>(null)

    // Only show the most recent/relevant markets
    const displayMarkets = markets.slice(0, maxCards)

    useEffect(() => {
        // Scroll to top when new markets come in if needed, 
        // but standard stack behavior usually puts new items at top or bottom.
        // Here we just render them. 
    }, [markets])

    if (displayMarkets.length === 0) return null

    return (
        <div
            ref={stackRef}
            className={cn(
                "flex flex-col gap-3 w-80 max-h-[60vh] overflow-y-auto pr-2 pointer-events-auto",
                "scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20",
                className
            )}
        >
            {displayMarkets.map((market) => (
                <MarketCard
                    key={market.id}
                    market={market}
                    onClick={() => onMarketClick(market)}
                />
            ))}
        </div>
    )
}
