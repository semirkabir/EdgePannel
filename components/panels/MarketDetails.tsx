'use client'

import { useEffect, useState } from 'react'
import { MarketDetails as MarketDetailsType } from '@/types/market'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketChart } from '@/components/charts/MarketChart'
import { TradeInterface } from '@/components/trading/TradeInterface'
import { WatchlistButton } from '@/components/panels/WatchlistPanel'
import { AlertButton } from '@/components/panels/AlertDialog'
import { ShareButton } from '@/components/ui/share-button'
import { X, TrendingUp, DollarSign, Clock, ExternalLink, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface MarketDetailsProps {
  market: MarketDetailsType | null
  onClose?: () => void
}

export function MarketDetails({ market, onClose }: MarketDetailsProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  // Handle animation states
  useEffect(() => {
    if (market) {
      setShouldRender(true)
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true)
        })
      })
    } else {
      setIsVisible(false)
      // Wait for animation to complete before unmounting
      const timeout = setTimeout(() => {
        setShouldRender(false)
      }, 300)
      return () => clearTimeout(timeout)
    }
  }, [market])

  if (!shouldRender) return null

  // Format end date
  const formatEndDate = (endDate: Date | string | undefined) => {
    if (!endDate) return null
    const date = endDate instanceof Date ? endDate : new Date(endDate)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (diff < 0) return 'Ended'
    if (days > 30) return date.toLocaleDateString()
    if (days > 0) return `${days}d ${hours}h remaining`
    if (hours > 0) return `${hours}h remaining`
    return 'Ending soon'
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-full w-full sm:w-96 z-50 lg:relative lg:z-auto",
          "overflow-y-auto glass-effect border-l border-border",
          "transform transition-transform duration-300 ease-out",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-4 space-y-4">
          {/* Header with close button */}
          <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-sm -mx-4 px-4 py-2 -mt-4 mb-2 border-b border-border">
            <h2 className="text-lg font-semibold">Market Details</h2>
            <div className="flex items-center gap-1">
              {market && (
                <>
                  <WatchlistButton market={market} size="sm" />
                  <AlertButton market={market} size="sm" />
                  <ShareButton market={market} size="sm" />
                </>
              )}
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {market && (
            <>
              {/* Market Title Card */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{market.title}</CardTitle>
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium uppercase shrink-0",
                      market.platform === 'polymarket' 
                        ? "bg-blue-500/20 text-blue-400" 
                        : "bg-green-500/20 text-green-400"
                    )}>
                      {market.platform}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Price Display */}
                  {market.price !== undefined && (
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-1">Current Probability</div>
                        <div className="text-3xl font-bold text-primary">
                          {(market.price * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="h-16 w-16 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                        <div 
                          className="absolute inset-0 rounded-full border-4 border-primary"
                          style={{
                            clipPath: `polygon(0 0, 100% 0, 100% ${market.price * 100}%, 0 ${market.price * 100}%)`
                          }}
                        />
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {market.volume24h !== undefined && (
                      <div className="bg-background/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <BarChart3 className="h-3 w-3" />
                          <span className="text-xs">24h Volume</span>
                        </div>
                        <div className="font-semibold">
                          ${market.volume24h.toLocaleString()}
                        </div>
                      </div>
                    )}
                    {market.liquidity !== undefined && (
                      <div className="bg-background/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-xs">Liquidity</span>
                        </div>
                        <div className="font-semibold">
                          ${market.liquidity.toLocaleString()}
                        </div>
                      </div>
                    )}
                    {market.endDate && (
                      <div className="bg-background/50 rounded-lg p-3 col-span-2">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">End Date</span>
                        </div>
                        <div className="font-semibold">
                          {formatEndDate(market.endDate)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {market.description && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Description</div>
                      <p className="text-sm leading-relaxed line-clamp-4">
                        {market.description}
                      </p>
                    </div>
                  )}

                  {/* External Link */}
                  {market.rawData?.url && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full gap-2"
                      onClick={() => window.open(market.rawData.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on {market.platform}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Price History Chart */}
              {market.priceHistory && market.priceHistory.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Price History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarketChart data={market.priceHistory} />
                  </CardContent>
                </Card>
              )}

              {/* Trade Interface */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Trade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TradeInterface market={market} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  )
}

