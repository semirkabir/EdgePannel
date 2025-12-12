'use client'

import { useState } from 'react'
import { Market } from '@/types/market'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePortfolio, Position } from '@/hooks/use-portfolio'
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  X, 
  Trash2, 
  DollarSign,
  PieChart,
  Plus,
  Minus
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/hooks/use-toast'

interface PortfolioPanelProps {
  markets: Market[]
  onMarketSelect: (market: Market) => void
  isOpen: boolean
  onClose: () => void
}

export function PortfolioPanel({ 
  markets, 
  onMarketSelect,
  isOpen,
  onClose 
}: PortfolioPanelProps) {
  const { 
    positions,
    calculateStats,
    getPositionsWithPnL,
    closePosition,
    clearPortfolio,
  } = usePortfolio()

  const [closingPosition, setClosingPosition] = useState<string | null>(null)

  const stats = calculateStats(markets)
  const positionsWithPnL = getPositionsWithPnL(markets)

  const handleClose = (position: Position & { pnl: number }) => {
    closePosition(position.id)
    toast.success(
      'Position closed', 
      `${position.marketTitle.slice(0, 30)}... P&L: ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}`
    )
    setClosingPosition(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Portfolio</h2>
            <span className="text-sm text-muted-foreground">
              ({positions.length} positions)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {positions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearPortfolio()
                  toast.info('Portfolio cleared')
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 border-b border-border">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Positions</div>
            <div className="text-xl font-bold">{stats.totalPositions}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Invested</div>
            <div className="text-xl font-bold">${stats.totalInvested.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Current Value</div>
            <div className="text-xl font-bold">${stats.currentValue.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Unrealized P&L</div>
            <div className={cn(
              "text-xl font-bold flex items-center justify-center gap-1",
              stats.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"
            )}>
              {stats.unrealizedPnL >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {stats.unrealizedPnL >= 0 ? '+' : ''}${stats.unrealizedPnL.toFixed(2)}
              <span className="text-sm">
                ({stats.unrealizedPnLPercent >= 0 ? '+' : ''}{stats.unrealizedPnLPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Positions List */}
        <div className="flex-1 overflow-auto p-4">
          {positionsWithPnL.length === 0 ? (
            <div className="text-center py-12">
              <PieChart className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium mb-2">No positions yet</h3>
              <p className="text-sm text-muted-foreground">
                Your trading positions will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {positionsWithPnL.map(position => (
                <Card 
                  key={position.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div 
                        className="flex-1 min-w-0"
                        onClick={() => {
                          if (position.market) {
                            onMarketSelect(position.market)
                            onClose()
                          }
                        }}
                      >
                        <h3 className="font-medium line-clamp-2 text-sm">
                          {position.marketTitle}
                        </h3>
                        <div className="flex items-center flex-wrap gap-2 mt-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium uppercase",
                            position.platform === 'polymarket' 
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-green-500/20 text-green-400"
                          )}>
                            {position.platform}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium uppercase",
                            position.side === 'yes' 
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          )}>
                            {position.side}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {position.quantity} @ {(position.avgPrice * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm text-muted-foreground mb-1">
                          Value: ${position.currentValue.toFixed(2)}
                        </div>
                        <div className={cn(
                          "font-semibold flex items-center gap-1 justify-end",
                          position.pnl >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {position.pnl >= 0 ? (
                            <Plus className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          ${Math.abs(position.pnl).toFixed(2)}
                          <span className="text-xs">
                            ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(1)}%)
                          </span>
                        </div>
                        
                        {closingPosition === position.id ? (
                          <div className="flex gap-1 mt-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setClosingPosition(null)
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleClose(position)
                              }}
                            >
                              Confirm Close
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              setClosingPosition(position.id)
                            }}
                          >
                            Close Position
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Mini portfolio stats for header
export function PortfolioMiniStats({ markets }: { markets: Market[] }) {
  const { calculateStats, positionCount } = usePortfolio()
  
  if (positionCount === 0) return null

  const stats = calculateStats(markets)

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/50 rounded-lg text-sm">
      <div className="flex items-center gap-1">
        <Briefcase className="h-4 w-4 text-muted-foreground" />
        <span>{positionCount}</span>
      </div>
      <div className={cn(
        "flex items-center gap-1 font-medium",
        stats.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"
      )}>
        {stats.unrealizedPnL >= 0 ? '+' : ''}${stats.unrealizedPnL.toFixed(2)}
        <span className="text-xs text-muted-foreground">
          ({stats.unrealizedPnLPercent >= 0 ? '+' : ''}{stats.unrealizedPnLPercent.toFixed(1)}%)
        </span>
      </div>
    </div>
  )
}



