'use client'

import { Market } from '@/types/market'
import { X } from 'lucide-react'

interface CountryOverlayProps {
  country: string
  markets: Market[]
  onClose: () => void
  onMarketClick?: (market: Market) => void
}

export function CountryOverlay({ country, markets, onClose, onMarketClick }: CountryOverlayProps) {
  // Sort markets by significance (breaking news, live predictions, then by volume/price)
  const sortedMarkets = [...markets]
    .filter(m => m.location?.country === country)
    .sort((a, b) => {
      // Breaking news first
      if (a.isBreakingNews && !b.isBreakingNews) return -1
      if (!a.isBreakingNews && b.isBreakingNews) return 1
      
      // Live predictions second
      if (a.isLivePrediction && !b.isLivePrediction) return -1
      if (!a.isLivePrediction && b.isLivePrediction) return 1
      
      // Then by volume
      const volumeA = a.volume24h || 0
      const volumeB = b.volume24h || 0
      if (volumeA !== volumeB) return volumeB - volumeA
      
      // Finally by probability significance (distance from 50%)
      const probA = a.probability ? Math.abs(a.probability - 0.5) : 0
      const probB = b.probability ? Math.abs(b.probability - 0.5) : 0
      return probB - probA
    })
    .slice(0, 10) // Top 10 markets

  if (sortedMarkets.length === 0) {
    return null
  }

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="glass-effect p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-primary/20 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              Top Markets in {country}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {sortedMarkets.length} market{sortedMarkets.length !== 1 ? 's' : ''} shown
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-md"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          {sortedMarkets.map(market => (
            <div
              key={market.id}
              className="p-4 bg-background/50 rounded-lg border border-input hover:bg-accent cursor-pointer transition-all hover:border-primary/50 group"
              onClick={() => {
                onMarketClick?.(market)
                onClose()
              }}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs uppercase font-semibold text-muted-foreground">
                      {market.platform}
                    </span>
                    {market.isBreakingNews && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-semibold">
                        BREAKING
                      </span>
                    )}
                    {market.isLivePrediction && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-semibold">
                        LIVE
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
                    {market.title}
                  </h3>
                  {(market.location?.city || market.location?.region) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {market.location?.city || market.location?.region}
                    </p>
                  )}
                </div>
                {market.price !== undefined && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold text-primary">
                      {(market.price * 100).toFixed(1)}%
                    </div>
                    {market.volume24h && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Vol: ${(market.volume24h / 1000).toFixed(1)}k
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


