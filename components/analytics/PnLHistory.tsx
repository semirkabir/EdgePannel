'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { TrendingUp, TrendingDown, DollarSign, Calendar, Target, Award } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface PnLHistoryProps {
  userId: string
  platform?: 'kalshi' | 'polymarket' | 'combined'
}

interface TradeHistoryItem {
  id: string
  userId: string
  platform: string
  marketId: string
  ticker?: string
  side: string
  action: string
  quantity: number
  price: number
  value: number
  fees: number
  executedAt: string
  tradeData: any
}

interface DailyPnL {
  date: string
  totalPnl: number
  tradeCount: number
  winCount: number
  lossCount: number
  totalValue: number
  fees: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function PnLHistory({ userId, platform = 'combined' }: PnLHistoryProps) {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  // Fetch trade history
  const { data: trades, isLoading } = useSWR<TradeHistoryItem[]>(
    `/api/analytics/trade-history?userId=${userId}&platform=${platform}`,
    fetcher,
    { refreshInterval: 60000 }
  )

  // Calculate daily P&L
  const dailyPnL = useMemo(() => {
    if (!trades || trades.length === 0) return []

    const pnlByDate = new Map<string, DailyPnL>()

    trades.forEach(trade => {
      const date = new Date(trade.executedAt).toISOString().split('T')[0]

      if (!pnlByDate.has(date)) {
        pnlByDate.set(date, {
          date,
          totalPnl: 0,
          tradeCount: 0,
          winCount: 0,
          lossCount: 0,
          totalValue: 0,
          fees: 0
        })
      }

      const dayData = pnlByDate.get(date)!

      // Calculate P&L based on action
      const pnl = trade.action === 'sell' || trade.action === 'close'
        ? trade.value - trade.fees
        : -(trade.value + trade.fees)

      dayData.totalPnl += pnl
      dayData.tradeCount += 1
      dayData.totalValue += Math.abs(trade.value)
      dayData.fees += trade.fees

      if (pnl > 0) dayData.winCount += 1
      else if (pnl < 0) dayData.lossCount += 1
    })

    return Array.from(pnlByDate.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [trades])

  // Calculate statistics
  const stats = useMemo(() => {
    if (dailyPnL.length === 0) {
      return {
        totalPnl: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        bestDay: 0,
        worstDay: 0,
        totalFees: 0,
        profitFactor: 0
      }
    }

    const totalPnl = dailyPnL.reduce((sum, day) => sum + day.totalPnl, 0)
    const totalTrades = dailyPnL.reduce((sum, day) => sum + day.tradeCount, 0)
    const winningTrades = dailyPnL.reduce((sum, day) => sum + day.winCount, 0)
    const losingTrades = dailyPnL.reduce((sum, day) => sum + day.lossCount, 0)
    const totalFees = dailyPnL.reduce((sum, day) => sum + day.fees, 0)

    const wins = dailyPnL.filter(d => d.totalPnl > 0)
    const losses = dailyPnL.filter(d => d.totalPnl < 0)

    const avgWin = wins.length > 0
      ? wins.reduce((sum, d) => sum + d.totalPnl, 0) / wins.length
      : 0

    const avgLoss = losses.length > 0
      ? Math.abs(losses.reduce((sum, d) => sum + d.totalPnl, 0) / losses.length)
      : 0

    const totalGain = wins.reduce((sum, d) => sum + d.totalPnl, 0)
    const totalLoss = Math.abs(losses.reduce((sum, d) => sum + d.totalPnl, 0))

    return {
      totalPnl,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      avgWin,
      avgLoss,
      bestDay: Math.max(...dailyPnL.map(d => d.totalPnl), 0),
      worstDay: Math.min(...dailyPnL.map(d => d.totalPnl), 0),
      totalFees,
      profitFactor: totalLoss > 0 ? totalGain / totalLoss : 0
    }
  }, [dailyPnL])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <DollarSign className="w-8 h-8 animate-pulse mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading P&L history...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxPnl = Math.max(...dailyPnL.map(d => Math.abs(d.totalPnl)), 1)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500">
              {stats.totalTrades} trades • ${stats.totalFees.toFixed(2)} fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.winRate.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500">
              {stats.winningTrades}W / {stats.losingTrades}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Day</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +${stats.bestDay.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500">
              Avg win: ${stats.avgWin.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Worst Day</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${stats.worstDay.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500">
              Avg loss: ${stats.avgLoss.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Daily P&L
              </CardTitle>
              <CardDescription>
                {dailyPnL.length > 0
                  ? `${dailyPnL.length} trading days tracked`
                  : 'No trading history yet'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={stats.totalPnl >= 0 ? 'default' : 'destructive'}>
                {stats.totalPnl >= 0 ? 'Profitable' : 'Loss'}
              </Badge>
              {stats.profitFactor > 0 && (
                <Badge variant="outline">
                  PF: {stats.profitFactor.toFixed(2)}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dailyPnL.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Start trading to see your P&L history</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* P&L Bar Chart */}
              <div className="h-64">
                <div className="flex items-end justify-around h-full gap-1">
                  {dailyPnL.slice(-30).map((day, i) => {
                    const height = Math.abs(day.totalPnl) / maxPnl * 90
                    const isPositive = day.totalPnl >= 0

                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center group cursor-pointer"
                        title={`${day.date}: ${day.totalPnl >= 0 ? '+' : ''}$${day.totalPnl.toFixed(2)} (${day.tradeCount} trades)`}
                      >
                        <div className="flex-1 flex items-end w-full">
                          <div
                            className={`w-full rounded-t transition-all ${
                              isPositive
                                ? 'bg-green-500 hover:bg-green-600'
                                : 'bg-red-500 hover:bg-red-600'
                            }`}
                            style={{
                              height: `${height}%`,
                              minHeight: day.totalPnl === 0 ? '0' : '4px'
                            }}
                          />
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {new Date(day.date).getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cumulative P&L Line */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Cumulative P&L</h4>
                <div className="h-32 relative">
                  <svg width="100%" height="100%" className="overflow-visible">
                    {/* Grid lines */}
                    {[0, 0.5, 1].map((ratio) => (
                      <line
                        key={ratio}
                        x1="0"
                        y1={`${ratio * 100}%`}
                        x2="100%"
                        y2={`${ratio * 100}%`}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                        strokeDasharray={ratio === 0.5 ? "4" : "0"}
                      />
                    ))}

                    {/* Cumulative P&L line */}
                    <polyline
                      fill="none"
                      stroke={stats.totalPnl >= 0 ? '#10b981' : '#ef4444'}
                      strokeWidth="2"
                      points={dailyPnL.slice(-30).map((day, i) => {
                        const cumulativePnl = dailyPnL
                          .slice(0, dailyPnL.indexOf(day) + 1)
                          .reduce((sum, d) => sum + d.totalPnl, 0)

                        const x = (i / (dailyPnL.slice(-30).length - 1)) * 100
                        const maxAbsPnl = Math.max(
                          Math.abs(stats.bestDay),
                          Math.abs(stats.worstDay)
                        )
                        const y = 50 - (cumulativePnl / maxAbsPnl) * 40

                        return `${x}%,${y}%`
                      }).join(' ')}
                    />
                  </svg>
                </div>
              </div>

              {/* Trade Details Table */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Recent Days</h4>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {dailyPnL.slice(-10).reverse().map((day, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-mono">
                          {new Date(day.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <Badge variant={day.totalPnl >= 0 ? 'default' : 'destructive'} className="text-xs">
                          {day.tradeCount} trades
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${day.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {day.totalPnl >= 0 ? '+' : ''}${day.totalPnl.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {day.winCount}W/{day.lossCount}L • ${day.fees.toFixed(2)} fees
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
