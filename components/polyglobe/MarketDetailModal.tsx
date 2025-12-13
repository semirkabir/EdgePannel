import { useState, useEffect } from 'react'
import { EnrichedMarket } from '@/lib/markets/enrich'
import { X, ExternalLink, TrendingUp, TrendingDown, BarChart2, DollarSign, Calendar, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface MarketDetailModalProps {
  market: EnrichedMarket | null
  isOpen: boolean
  onClose: () => void
}

export function MarketDetailModal({ market, isOpen, onClose }: MarketDetailModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      const timer = setTimeout(() => setMounted(false), 300)
      document.body.style.overflow = 'unset'
      return () => clearTimeout(timer)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!mounted && !isOpen) return null
  if (!market) return null

  const formatPrice = (prob: number) => {
    return `${Math.round(prob * 100)}¢`
  }

  const formatPercent = (prob: number) => {
    return `${(prob * 100).toFixed(1)}%`
  }

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`
    return `$${vol.toFixed(0)}`
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'N/A'
    try {
      const d = date instanceof Date ? date : new Date(date)
      if (isNaN(d.getTime())) return 'N/A'
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(d)
    } catch (e) {
      return 'N/A'
    }
  }

  // Generate market URL
  const getMarketUrl = () => {
    if (market.platform === 'polymarket') {
      if (market.slug) {
        return `https://polymarket.com/event/${market.slug}`
      }
      return `https://polymarket.com/markets`
    } else if (market.platform === 'kalshi') {
      if (market.ticker) {
        return `https://kalshi.com/markets/${market.ticker}`
      }
      return `https://kalshi.com/markets`
    }
    return '#'
  }

  // Get outcomes and prices - ensure they're arrays
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : ['Yes', 'No']
  const outcomePrices = Array.isArray(market.outcomePrices)
    ? market.outcomePrices
    : [market.probability || 0, 1 - (market.probability || 0)]

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none",
          "transition-all duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className={cn(
            "relative w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto",
            "bg-gradient-to-br from-gray-900 via-black to-gray-900",
            "border border-white/20 rounded-2xl shadow-2xl",
            "transform transition-all duration-300",
            isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    market.platform === 'polymarket'
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  )}>
                    {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                  </span>
                  {market.category && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-white/70">
                      {market.category}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">
                  {market.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Description */}
            {market.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                  About
                </h3>
                <p className="text-white/80 leading-relaxed">
                  {market.description}
                </p>
              </div>
            )}

            {/* Live Odds */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                Live Odds
              </h3>
              <div className="grid gap-3">
                {outcomes.map((outcome, index) => {
                  const outcomePrice = outcomePrices[index] || 0
                  const isYes = outcome.toLowerCase() === 'yes'
                  const isNo = outcome.toLowerCase() === 'no'

                  return (
                    <div
                      key={index}
                      className={cn(
                        "relative overflow-hidden rounded-xl border p-4",
                        "bg-gradient-to-r",
                        isYes
                          ? "from-emerald-500/10 to-emerald-500/5 border-emerald-500/30"
                          : isNo
                          ? "from-rose-500/10 to-rose-500/5 border-rose-500/30"
                          : "from-blue-500/10 to-blue-500/5 border-blue-500/30"
                      )}
                    >
                      {/* Progress bar */}
                      <div
                        className={cn(
                          "absolute inset-0 transition-all duration-500",
                          isYes
                            ? "bg-emerald-500/10"
                            : isNo
                            ? "bg-rose-500/10"
                            : "bg-blue-500/10"
                        )}
                        style={{
                          width: `${outcomePrice * 100}%`,
                          opacity: 0.3
                        }}
                      />

                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-white">
                            {outcome}
                          </span>
                          <span className={cn(
                            "text-2xl font-mono font-bold",
                            isYes
                              ? "text-emerald-400"
                              : isNo
                              ? "text-rose-400"
                              : "text-blue-400"
                          )}>
                            {formatPrice(outcomePrice)}
                          </span>
                        </div>
                        <span className="text-xl font-semibold text-white/60">
                          {formatPercent(outcomePrice)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Market Stats */}
            <div className="grid grid-cols-2 gap-4">
              {market.volume24h !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <BarChart2 size={16} />
                    <span>24h Volume</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatVolume(market.volume24h)}
                  </div>
                </div>
              )}

              {market.liquidity !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <DollarSign size={16} />
                    <span>Liquidity</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatVolume(market.liquidity)}
                  </div>
                </div>
              )}

              {market.endDate && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <Calendar size={16} />
                    <span>End Date</span>
                  </div>
                  <div className="text-sm font-medium text-white">
                    {formatDate(market.endDate)}
                  </div>
                </div>
              )}

              {market.location?.country && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <MapPin size={16} />
                    <span>Location</span>
                  </div>
                  <div className="text-sm font-medium text-white">
                    {market.location.country}
                  </div>
                </div>
              )}
            </div>

            {/* Trade Button */}
            <a
              href={getMarketUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-center gap-2 w-full",
                "py-4 px-6 rounded-xl font-semibold text-white",
                "transition-all duration-200",
                "hover:scale-105 active:scale-95",
                market.platform === 'polymarket'
                  ? "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
                  : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400",
                "shadow-lg hover:shadow-xl"
              )}
            >
              <span>Trade on {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}</span>
              <ExternalLink size={20} />
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
