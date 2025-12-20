'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, BarChart3, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface MarketDepthProps {
  ticker: string
  platform?: 'kalshi' | 'polymarket'
  refreshInterval?: number
}

interface OrderLevel {
  price: number
  quantity: number
}

interface OrderBookData {
  ticker: string
  platform: string
  bids: OrderLevel[]
  asks: OrderLevel[]
  metrics: {
    spread: number
    spreadPercent: number
    bidDepth: number
    askDepth: number
    totalDepth: number
    imbalance: number
    bidLevels: number
    askLevels: number
  }
}

export function MarketDepth({ ticker, platform = 'kalshi', refreshInterval = 5000 }: MarketDepthProps) {
  const [orderbook, setOrderbook] = useState<OrderBookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchOrderbook = useCallback(async () => {
    try {
      const res = await fetch(`/api/market-data/orderbook?ticker=${ticker}&platform=${platform}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch orderbook: ${res.statusText}`)
      }
      const data = await res.json()
      setOrderbook(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (err: any) {
      setError(err.message)
      console.error('[MarketDepth] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [ticker, platform])

  useEffect(() => {
    fetchOrderbook()
    const interval = setInterval(fetchOrderbook, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchOrderbook, refreshInterval])


  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading order book...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !orderbook) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-500">
            <p className="font-semibold">Error loading order book</p>
            <p className="text-sm">{error}</p>
            <Button onClick={fetchOrderbook} className="mt-4" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxQuantity = Math.max(
    ...orderbook.bids.map(b => b.quantity),
    ...orderbook.asks.map(a => a.quantity)
  )

  const imbalancePercentage = (orderbook.metrics.imbalance * 100).toFixed(1)
  const imbalanceColor = orderbook.metrics.imbalance > 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Order Book: {ticker}
              </CardTitle>
              <CardDescription>
                Last updated: {lastUpdate.toLocaleTimeString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{platform}</Badge>
              <Button onClick={fetchOrderbook} variant="ghost" size="sm">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Spread</p>
              <p className="text-lg font-semibold">
                {orderbook.metrics.spreadPercent.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">
                ${orderbook.metrics.spread.toFixed(3)}
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <p className="text-xs text-gray-500">Bid Depth</p>
              <p className="text-lg font-semibold text-green-600">
                ${orderbook.metrics.bidDepth.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">
                {orderbook.metrics.bidLevels} levels
              </p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <p className="text-xs text-gray-500">Ask Depth</p>
              <p className="text-lg font-semibold text-red-600">
                ${orderbook.metrics.askDepth.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">
                {orderbook.metrics.askLevels} levels
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Imbalance</p>
              <p className={`text-lg font-semibold ${imbalanceColor}`}>
                {imbalancePercentage}%
              </p>
              <p className="text-xs text-gray-500">
                {orderbook.metrics.imbalance > 0 ? 'Buy pressure' : 'Sell pressure'}
              </p>
            </div>
          </div>

          {/* Order Book Visualization */}
          <div className="grid grid-cols-2 gap-4">
            {/* Bids */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Bids
                </h3>
                <span className="text-xs text-gray-500">
                  {orderbook.bids.length} levels
                </span>
              </div>
              <div className="space-y-1">
                {orderbook.bids.slice(0, 15).map((bid, i) => {
                  const widthPercent = (bid.quantity / maxQuantity) * 100
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-16 text-right font-mono">
                        {bid.price.toFixed(3)}
                      </span>
                      <div className="flex-1 bg-green-100 h-6 relative rounded">
                        <div
                          className="bg-green-500 h-full rounded transition-all duration-300"
                          style={{ width: `${widthPercent}%` }}
                        />
                        <span className="absolute right-2 top-0.5 text-xs font-semibold text-green-900">
                          {bid.quantity}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Asks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-red-600 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  Asks
                </h3>
                <span className="text-xs text-gray-500">
                  {orderbook.asks.length} levels
                </span>
              </div>
              <div className="space-y-1">
                {orderbook.asks.slice(0, 15).map((ask, i) => {
                  const widthPercent = (ask.quantity / maxQuantity) * 100
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-16 text-right font-mono">
                        {ask.price.toFixed(3)}
                      </span>
                      <div className="flex-1 bg-red-100 h-6 relative rounded">
                        <div
                          className="bg-red-500 h-full rounded transition-all duration-300"
                          style={{ width: `${widthPercent}%` }}
                        />
                        <span className="absolute right-2 top-0.5 text-xs font-semibold text-red-900">
                          {ask.quantity}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Depth Chart (simplified) */}
          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h4 className="font-semibold text-sm mb-2">Market Depth</h4>
            <div className="flex items-end gap-1 h-24">
              {/* Bid side */}
              <div className="flex-1 flex items-end justify-end gap-0.5">
                {orderbook.bids.slice(0, 20).reverse().map((bid, i) => {
                  const height = (bid.quantity / maxQuantity) * 100
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-green-500 rounded-t transition-all duration-300 hover:bg-green-600"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${bid.price.toFixed(3)} × ${bid.quantity}`}
                    />
                  )
                })}
              </div>

              {/* Center line */}
              <div className="w-0.5 h-full bg-gray-300" />

              {/* Ask side */}
              <div className="flex-1 flex items-end gap-0.5">
                {orderbook.asks.slice(0, 20).map((ask, i) => {
                  const height = (ask.quantity / maxQuantity) * 100
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-red-500 rounded-t transition-all duration-300 hover:bg-red-600"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${ask.price.toFixed(3)} × ${ask.quantity}`}
                    />
                  )
                })}
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Lower Price</span>
              <span>Higher Price</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
