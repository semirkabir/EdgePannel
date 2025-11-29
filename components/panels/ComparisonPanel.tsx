'use client'

import { MarketComparison } from '@/types/market'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ComparisonPanelProps {
  comparisons: MarketComparison[]
  onMarketSelect?: (marketId: string) => void
}

export function ComparisonPanel({ comparisons, onMarketSelect }: ComparisonPanelProps) {
  return (
    <div className="w-full h-64 overflow-y-auto glass-effect border-t border-border">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Market Comparisons</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparisons.map((comparison, index) => (
            <Card
              key={index}
              className={comparison.arbitrageOpportunity ? 'border-primary neon-glow' : ''}
            >
              <CardHeader>
                <CardTitle className="text-sm">
                  {comparison.markets.map(m => m.title).join(' vs ')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {comparison.markets.map(market => (
                    <div
                      key={market.id}
                      className="flex justify-between items-center cursor-pointer hover:bg-accent p-2 rounded"
                      onClick={() => onMarketSelect?.(market.id)}
                    >
                      <span className="uppercase text-xs text-muted-foreground">
                        {market.platform}
                      </span>
                      {market.price && (
                        <span className="font-semibold">
                          {(market.price * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                  {comparison.discrepancy !== undefined && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Discrepancy:</span>
                        <span className="font-semibold">
                          {(comparison.discrepancy * 100).toFixed(2)}%
                        </span>
                      </div>
                      {comparison.arbitrageOpportunity && (
                        <div className="mt-2 text-xs text-primary font-semibold">
                          ⚡ Arbitrage Opportunity
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

