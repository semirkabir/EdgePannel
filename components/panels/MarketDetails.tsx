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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, TrendingUp, DollarSign, Clock, ExternalLink, BarChart3, MessageCircle, Twitter } from 'lucide-react'
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

  // Mock tweets
  const mockTweets = [
    { id: 1, user: 'MarketAnalyst', handle: '@analyst_top', text: `Huge movement on "${market?.title}" today! Volume spiking. #predictionmarkets`, time: '2m ago' },
    { id: 2, user: 'CryptoTrader', handle: '@cryptotrader', text: 'Buying YES on this one. The odds are too good to pass up.', time: '15m ago' },
    { id: 3, user: 'NewsBreaker', handle: '@newsbreaker', text: 'Breaking: New developments might affect the outcome of this market significantly.', time: '1h ago' },
    { id: 4, user: 'PolymarketWhale', handle: '@polywhale', text: 'Just saw a massive buy order come in. Someone knows something.', time: '3h ago' },
  ]

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
          "glass-effect border-l border-border flex flex-col",
          "transform transition-transform duration-300 ease-out",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-sm">
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

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {market && (
              <Tabs defaultValue="price" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="price">Price</TabsTrigger>
                  <TabsTrigger value="stats">Stats</TabsTrigger>
                  <TabsTrigger value="tweets">Tweets</TabsTrigger>
                </TabsList>

                <TabsContent value="price" className="space-y-4 mt-0">
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

                      {/* Price History Chart */}
                      {market.priceHistory && market.priceHistory.length > 0 && (
                        <div className="h-[200px] w-full mt-4">
                          <MarketChart data={market.priceHistory} />
                        </div>
                      )}

                      {/* Trade Interface */}
                      <div className="pt-4 border-t border-border">
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Trade
                        </h3>
                        <TradeInterface market={market} />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stats" className="space-y-4 mt-0">
                  <Card>
                    <CardContent className="p-4 space-y-4">
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
                          <p className="text-sm leading-relaxed">
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
                </TabsContent>

                <TabsContent value="tweets" className="space-y-4 mt-0">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Twitter className="h-4 w-4 text-blue-400" />
                        Relevant Tweets
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {mockTweets.map((tweet) => (
                        <div key={tweet.id} className="p-3 rounded-lg bg-background/50 border border-border/50">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                                {tweet.user[0]}
                              </div>
                              <div>
                                <div className="text-xs font-bold">{tweet.user}</div>
                                <div className="text-[10px] text-muted-foreground">{tweet.handle}</div>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{tweet.time}</span>
                          </div>
                          <p className="text-xs leading-relaxed mt-2">
                            {tweet.text}
                          </p>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                        Load more tweets
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  )
}


