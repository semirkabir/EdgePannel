'use client'

import { Market } from '@/types/market'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Zap } from 'lucide-react'

interface BreakingNewsProps {
  breakingNews: Market[]
  livePredictions: Market[]
  onMarketClick?: (market: Market) => void
}

export function BreakingNews({ breakingNews, livePredictions, onMarketClick }: BreakingNewsProps) {
  const allHighlights = [
    ...breakingNews.map(m => ({ ...m, type: 'breaking' as const })),
    ...livePredictions.map(m => ({ ...m, type: 'live' as const })),
  ].slice(0, 10)

  if (allHighlights.length === 0) {
    return null
  }

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 max-w-4xl w-full px-4">
      <div className="glass-effect rounded-lg p-3 border border-border/50">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
          {allHighlights.map((market) => (
            <Card
              key={market.id}
              className="flex-shrink-0 w-64 cursor-pointer hover:bg-accent/50 transition-colors border-border/50"
              onClick={() => onMarketClick?.(market)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  {market.type === 'breaking' ? (
                    <Zap className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                        market.type === 'breaking'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {market.type === 'breaking' ? 'Breaking' : 'Live'}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {market.platform}
                      </span>
                    </div>
                    <h4 className="text-xs font-medium line-clamp-2 leading-tight">
                      {market.title}
                    </h4>
                  </div>
                </div>
                {market.price !== undefined && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground">Probability</span>
                    <span className="text-sm font-bold text-primary">
                      {(market.price * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

