'use client'

import { useState, useEffect } from 'react'
import { useWhaleData, WhaleHolder, WhaleTrade, WhaleAlert } from '@/hooks/use-whale-data'
import { Bell, TrendingUp, Users, DollarSign, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

interface WhaleTrackerProps {
  marketId: string
  marketTitle?: string
  minTradeSize?: number
  holderThreshold?: number
}

export function WhaleTracker({
  marketId,
  marketTitle,
  minTradeSize = 10000,
  holderThreshold = 5
}: WhaleTrackerProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const {
    alerts,
    newAlertCount,
    holders,
    trades,
    loading,
    markAsSeen,
    getRecentAlerts,
    clearAlerts
  } = useWhaleData({
    market: marketId,
    minTradeSize,
    refreshInterval: 10000, // 10 seconds
    alertThreshold: {
      holderPercentage: holderThreshold,
      tradeValue: minTradeSize
    }
  })

  // Show toast notifications for new alerts
  useEffect(() => {
    if (!notificationsEnabled || newAlertCount === 0) return

    const latestAlert = alerts[alerts.length - 1]
    if (!latestAlert) return

    if (latestAlert.type === 'trade') {
      const trade = latestAlert.data as any
      toast.warning(
        `🐋 Whale Trade Detected`,
        {
          description: `$${trade.value.toFixed(0)} ${trade.side} @ ${trade.price.toFixed(2)}`
        }
      )
    } else {
      const holder = latestAlert.data as any
      toast.info(
        `🐋 Large Holder Alert`,
        {
          description: `Wallet holds ${holder.percentage.toFixed(1)}% of market`
        }
      )
    }
  }, [newAlertCount, alerts, notificationsEnabled])

  const recentAlerts = getRecentAlerts(15) // Last 15 minutes

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading whale data...</p>
        </div>
      </div>
    )
  }

  const topHolders = holders.slice(0, 10)
  const recentTrades = trades.slice(0, 20)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            🐋 Whale Tracker
            {newAlertCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {newAlertCount} new
              </Badge>
            )}
          </h2>
          {marketTitle && (
            <p className="text-sm text-gray-500 mt-1">{marketTitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            variant={notificationsEnabled ? "default" : "outline"}
            size="sm"
          >
            <Bell className="w-4 h-4 mr-2" />
            {notificationsEnabled ? 'On' : 'Off'}
          </Button>
          {newAlertCount > 0 && (
            <Button onClick={markAsSeen} variant="outline" size="sm">
              Mark as Seen
            </Button>
          )}
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Holders</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{holders.length}</div>
            <p className="text-xs text-gray-500">
              {holders.filter((h: WhaleHolder) => h.percentage >= holderThreshold).length} whales (&gt;{holderThreshold}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Large Trades</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trades.length}</div>
            <p className="text-xs text-gray-500">
              &gt;${(minTradeSize / 1000).toFixed(0)}k trades detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(trades.reduce((sum: number, t: WhaleTrade) => sum + t.value, 0) / 1000).toFixed(0)}k
            </div>
            <p className="text-xs text-gray-500">
              Whale trade volume
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="holders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holders">Top Holders</TabsTrigger>
          <TabsTrigger value="trades">Recent Trades</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {newAlertCount > 0 && `(${newAlertCount})`}
          </TabsTrigger>
        </TabsList>

        {/* Top Holders */}
        <TabsContent value="holders">
          <Card>
            <CardHeader>
              <CardTitle>Top Position Holders</CardTitle>
              <CardDescription>
                Largest positions in this market
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topHolders.map((holder: WhaleHolder, i: number) => (
                  <div
                    key={holder.address}
                    className={`flex items-center justify-between p-3 border rounded ${holder.percentage >= holderThreshold ? 'bg-orange-50 border-orange-200' : 'hover:bg-gray-50'
                      } transition-colors`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-semibold">
                        #{i + 1}
                      </div>
                      <div>
                        <p className="font-mono text-sm">
                          {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {holder.outcome} Position
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">
                        {holder.percentage.toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {holder.amount.toLocaleString()} shares
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Trades */}
        <TabsContent value="trades">
          <Card>
            <CardHeader>
              <CardTitle>Large Trades</CardTitle>
              <CardDescription>
                Trades over ${(minTradeSize / 1000).toFixed(0)}k
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentTrades.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No large trades detected yet</p>
                  </div>
                ) : (
                  recentTrades.map((trade: WhaleTrade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={trade.side === 'BUY' ? 'default' : 'destructive'}>
                            {trade.side}
                          </Badge>
                          <span className="font-mono text-xs text-gray-500">
                            {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(trade.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          ${trade.value.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          @ {trade.price.toFixed(2)} × {trade.size}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Alerts
                {alerts.length > 0 && (
                  <Button onClick={clearAlerts} variant="ghost" size="sm">
                    Clear All
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Last 15 minutes of activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentAlerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No recent alerts</p>
                  </div>
                ) : (
                  recentAlerts.map((alert: WhaleAlert, i: number) => {
                    const isNew = i >= recentAlerts.length - newAlertCount

                    if (alert.type === 'trade') {
                      const trade = alert.data as any
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 p-3 border rounded ${isNew ? 'bg-yellow-50 border-yellow-200 animate-pulse' : 'hover:bg-gray-50'
                            } transition-colors`}
                        >
                          <div className="flex-shrink-0 text-2xl">🐋</div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">Large Trade Detected</p>
                            <p className="text-xs text-gray-500">
                              ${trade.value.toFixed(0)} {trade.side} @ {trade.price.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-xs text-gray-500">
                            {alert.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      )
                    } else {
                      const holder = alert.data as any
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 p-3 border rounded ${isNew ? 'bg-yellow-50 border-yellow-200 animate-pulse' : 'hover:bg-gray-50'
                            } transition-colors`}
                        >
                          <div className="flex-shrink-0 text-2xl">🏛️</div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">Large Holder Alert</p>
                            <p className="text-xs text-gray-500">
                              {holder.percentage.toFixed(1)}% position ({holder.amount.toLocaleString()} shares)
                            </p>
                          </div>
                          <div className="text-xs text-gray-500">
                            {alert.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      )
                    }
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
