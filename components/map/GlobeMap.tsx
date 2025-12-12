'use client'

import { useState, useMemo, Suspense, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Market } from '@/types/market'
import { usePageVisibility, useElementVisibility, usePrefersReducedMotion } from '@/hooks/use-visibility'
import { SkeletonGlobe } from '@/components/ui/skeleton'
import { LiveTradesPanel } from '@/components/panels/LiveTradesPanel'

// Dynamically import the entire canvas to avoid SSR issues
const GlobeCanvas = dynamic(
  () => import('./GlobeCanvas').then((mod) => ({ default: mod.GlobeCanvas })),
  { 
    ssr: false,
    loading: () => <SkeletonGlobe />
  }
)

interface GlobeMapProps {
  markets: Market[]
  activityMarkets?: Market[]
  breakingNews?: Market[]
  livePredictions?: Market[]
  onMarketClick?: (market: Market) => void
  onCountryClick?: (countryName: string, markets: Market[]) => void
  selectedMarket?: Market | null
}

export function GlobeMap({
  markets,
  activityMarkets,
  breakingNews = [],
  livePredictions = [],
  onMarketClick,
  onCountryClick,
  selectedMarket,
}: GlobeMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)
  const [countryMarkets, setCountryMarkets] = useState<Market[]>([])
  const [isMounted, setIsMounted] = useState(false)
  
  // Performance optimizations
  const isPageVisible = usePageVisibility()
  const [containerRef, isInViewport] = useElementVisibility()
  const prefersReducedMotion = usePrefersReducedMotion()
  
  // Only render/animate when visible
  const shouldAnimate = isPageVisible && isInViewport && !prefersReducedMotion

  // Ensure component only renders on client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Group markets by country for hover tooltips
  const marketsByCountry = useMemo(() => {
    const grouped: Record<string, Market[]> = {}
    markets.forEach(market => {
      const country = market.location?.country || 'Unknown'
      if (!grouped[country]) {
        grouped[country] = []
      }
      grouped[country].push(market)
    })
    return grouped
  }, [markets])

  const liveActivityMarkets = activityMarkets ?? markets

  if (!isMounted) {
    return (
      <div className="w-full h-full relative bg-[#0a0e27] flex items-center justify-center">
        <SkeletonGlobe />
      </div>
    )
  }

  return (
    <div 
      ref={containerRef as React.RefCallback<HTMLDivElement>}
      className="w-full h-full relative"
    >
      <Suspense fallback={<SkeletonGlobe />}>
        <GlobeCanvas
          markets={markets}
          breakingNews={breakingNews}
          livePredictions={livePredictions}
          selectedMarket={selectedMarket}
          onMarketClick={onMarketClick}
          isAnimating={shouldAnimate}
          overlay={<LiveTradesPanel markets={liveActivityMarkets} onMarketClick={onMarketClick} />}
        />
      </Suspense>

      {/* Country hover tooltip */}
      {hoveredCountry && countryMarkets.length > 0 && (
        <div className="absolute bottom-4 left-4 glass-effect p-4 rounded-lg max-w-sm z-10">
          <h3 className="text-sm font-bold mb-2">{hoveredCountry}</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {countryMarkets.slice(0, 5).map(market => (
              <div
                key={market.id}
                className="text-xs p-2 bg-background/50 rounded cursor-pointer hover:bg-accent"
                onClick={() => onMarketClick?.(market)}
              >
                <div className="flex justify-between items-center">
                  <span className="line-clamp-1 flex-1">{market.title}</span>
                  {market.price !== undefined && (
                    <span className="ml-2 font-semibold">
                      {(market.price * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 glass-effect p-3 rounded text-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-muted-foreground">Polymarket</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-muted-foreground">Kalshi</span>
          </div>
        </div>
      </div>
    </div>
  )
}
