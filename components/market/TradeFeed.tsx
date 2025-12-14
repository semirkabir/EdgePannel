'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, TrendingUp, TrendingDown, DollarSign, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TradeFeedProps {
  ticker?: string
  platform?: 'kalshi' | 'polymarket'
  maxTrades?: number
  autoScroll?: boolean
}

interface Trade {
  ticker: string
  yesPrice: number
  noPrice: number
  count: number
  createdTime: string
  takerSide: 'yes' | 'no'
}

export function TradeFeed({
  ticker,
  platform = 'kalshi',
  maxTrades = 50,
  autoScroll = true
}: TradeFeedProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [stats, setStats] = useState({
    totalTrades: 0,
    totalVolume: 0,
    avgTradeSize: 0,
    buyVolume: 0,
    sellVolume: 0
  })
  const tradesEndRef = useRef<HTMLDivElement>(null)

  const fetchTrades = async () => {
    if (paused) return

    try {
      const params = new URLSearchParams({
        platform,
        limit: maxTrades.toString()
      })
      if (ticker) params.append('ticker', ticker)

      const res = await fetch(`/api/market-data/trades?${params}`)
      if (!res.ok) throw new Error('Failed to fetch trades')

      const data = await res.json()
      setTrades(data.trades || [])
      setStats(data.stats || stats)
    } catch (err) {
      console.error('[TradeFeed] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrades()
    const interval = setInterval(fetchTrades, 3000) // Update every 3 seconds
    return () => clearInterval(interval)
  }, [ticker, platform, maxTrades, paused])

  useEffect(() => {
    if (autoScroll && !paused && tradesEndRef.current) {
      tradesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [trades, autoScroll, paused])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Activity className="w-8 h-8 animate-pulse mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading trade feed...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const buyPercentage = stats.totalVolume > 0
    ? (stats.buyVolume / stats.totalVolume) * 100
    : 50

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Trade Feed
              {ticker && <Badge variant="outline">{ticker}</Badge>}
            </CardTitle>
            <CardDescription>
              Real-time market tape
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPaused(!paused)}
              variant={paused ? "destructive" : "default"}
              size="sm"
            >
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Badge variant="secondary">
              {trades.length} trades
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Trade Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Total Trades</p>
            <p className="text-lg font-semibold">{stats.totalTrades}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Total Volume</p>
            <p className="text-lg font-semibold">
              ${stats.totalVolume.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Avg Size</p>
            <p className="text-lg font-semibold">
              ${stats.avgTradeSize.toFixed(0)}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Buy/Sell Ratio</p>
            <p className="text-lg font-semibold">
              {buyPercentage.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Buy/Sell Volume Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Buy Volume: ${stats.buyVolume.toLocaleString()}</span>
            <span>Sell Volume: ${stats.sellVolume.toLocaleString()}</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div
              className="bg-green-500"
              style={{ width: `${buyPercentage}%` }}
            />
            <div
              className="bg-red-500"
              style={{ width: `${100 - buyPercentage}%` }}
            />
          </div>
        </div>

        {/* Trade List */}
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {trades.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No trades yet</p>
            </div>
          ) : (
            trades.map((trade, i) => {
              const isBuy = trade.takerSide === 'yes'
              const price = isBuy ? trade.yesPrice : trade.noPrice
              const value = price * trade.count
              const tradeTime = new Date(trade.createdTime)

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    isBuy ? 'bg-green-50' : 'bg-red-50'
                  } hover:opacity-75 transition-opacity`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {isBuy ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <Badge
                      variant={isBuy ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {isBuy ? 'BUY' : 'SELL'}
                    </Badge>
                    <span className="font-mono text-xs text-gray-600">
                      {ticker || trade.ticker}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <p className="font-semibold">
                        {price.toFixed(2)} × {trade.count}
                      </p>
                      <p className="text-gray-500">
                        ${value.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-3 h-3" />
                      {tradeTime.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={tradesEndRef} />
        </div>

        {/* Volume Histogram */}
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h4 className="font-semibold text-sm mb-2">Trade Size Distribution</h4>
          <div className="flex items-end gap-1 h-16">
            {trades.slice(0, 30).map((trade, i) => {
              const maxValue = Math.max(...trades.slice(0, 30).map(t => t.yesPrice * t.count))
              const value = (trade.takerSide === 'yes' ? trade.yesPrice : trade.noPrice) * trade.count
              const height = (value / maxValue) * 100
              const isBuy = trade.takerSide === 'yes'

              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-all duration-300 ${
                    isBuy ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                  }`}
                  style={{ height: `${height}%`, minHeight: '4px' }}
                  title={`${trade.ticker}: $${value.toFixed(2)}`}
                />
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
