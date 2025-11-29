'use client'

import { MarketDetails as MarketDetailsType } from '@/types/market'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MarketChart } from '@/components/charts/MarketChart'
import { TradeInterface } from '@/components/trading/TradeInterface'

interface MarketDetailsProps {
  market: MarketDetailsType | null
  onClose?: () => void
}

export function MarketDetails({ market, onClose }: MarketDetailsProps) {
  if (!market) return null

  return (
    <div className="w-96 h-full overflow-y-auto glass-effect border-l border-border">
      <div className="p-4 space-y-4">
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground mb-4"
          >
            ✕ Close
          </button>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{market.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Platform:</span>
                <span className="ml-2 uppercase font-medium">{market.platform}</span>
              </div>
              {market.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Description:</span>
                  <p className="text-sm mt-1">{market.description}</p>
                </div>
              )}
              {market.price && (
                <div>
                  <span className="text-sm text-muted-foreground">Current Price:</span>
                  <div className="text-2xl font-bold mt-1">
                    {(market.price * 100).toFixed(2)}%
                  </div>
                </div>
              )}
              {market.volume24h && (
                <div>
                  <span className="text-sm text-muted-foreground">24h Volume:</span>
                  <span className="ml-2">${market.volume24h.toLocaleString()}</span>
                </div>
              )}
              {market.liquidity && (
                <div>
                  <span className="text-sm text-muted-foreground">Liquidity:</span>
                  <span className="ml-2">${market.liquidity.toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {market.priceHistory && market.priceHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Price History</CardTitle>
            </CardHeader>
            <CardContent>
              <MarketChart data={market.priceHistory} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trade</CardTitle>
          </CardHeader>
          <CardContent>
            <TradeInterface market={market} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

