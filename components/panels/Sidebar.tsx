'use client'

import { Market } from '@/types/market'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SidebarProps {
  markets: Market[]
  onMarketSelect?: (market: Market) => void
  selectedMarket?: Market | null
}

export function Sidebar({ markets, onMarketSelect, selectedMarket }: SidebarProps) {
  return (
    <div className="w-80 h-full overflow-y-auto glass-effect border-r border-border">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Markets</h2>
        <div className="space-y-2">
          {markets.map(market => (
            <Card
              key={market.id}
              className={`cursor-pointer transition-all ${
                selectedMarket?.id === market.id
                  ? 'border-primary bg-accent'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => onMarketSelect?.(market)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{market.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span className="uppercase">{market.platform}</span>
                  {market.price && (
                    <span className="font-semibold text-foreground">
                      {(market.price * 100).toFixed(1)}%
                    </span>
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

