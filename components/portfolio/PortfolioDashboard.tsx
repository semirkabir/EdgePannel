'use client'

import { useState } from 'react'
import { usePortfolioApi } from '@/hooks/use-portfolio-api'
import { useKalshiRealtime } from '@/hooks/use-kalshi-realtime'
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Briefcase, Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PortfolioDashboardProps {
  polymarketAddress?: string
  kalshiCredentials?: {
    accessKeyId: string
    privateKey: string
  }
}

export function PortfolioDashboard({ polymarketAddress, kalshiCredentials }: PortfolioDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const portfolio = usePortfolioApi({
    polymarketAddress,
    refreshInterval: 30000 // 30 seconds
  })

  // Real-time updates
  const ws = useKalshiRealtime({
    userChannels: kalshiCredentials ? ['fill', 'market_positions'] : [],
    accessKeyId: kalshiCredentials?.accessKeyId,
    privateKey: kalshiCredentials?.privateKey,
    autoConnect: !!kalshiCredentials,
    onMessage: (msg) => {
      if (msg.type === 'fill' || msg.type === 'market_positions') {
        portfolio.refresh()
      }
    }
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await portfolio.refresh()
    setIsRefreshing(false)
  }

  if (portfolio.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading portfolio...</p>
        </div>
      </div>
    )
  }

  const totalPnlPositive = portfolio.combined.totalPnl >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="text-sm text-gray-500">Track your positions across Kalshi and Polymarket</p>
        </div>
        <div className="flex items-center gap-2">
          {kalshiCredentials && (
            <Badge variant={ws.connected ? "default" : "secondary"}>
              <Activity className="w-3 h-3 mr-1" />
              {ws.connected ? 'Live' : 'Disconnected'}
            </Badge>
          )}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {totalPnlPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnlPositive ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnlPositive ? '+' : ''}${portfolio.combined.totalPnl.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500">
              {totalPnlPositive ? 'Profit' : 'Loss'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${portfolio.combined.totalValue.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500">
              Current portfolio value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positions</CardTitle>
            <Briefcase className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio.combined.positionCount}
            </div>
            <p className="text-xs text-gray-500">
              Open positions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio.combined.positionCount > 0
                ? ((portfolio.combined.totalPnl > 0 ? 1 : 0) * 100).toFixed(0)
                : '0'}%
            </div>
            <p className="text-xs text-gray-500">
              Overall performance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Positions by Platform */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Positions</TabsTrigger>
          <TabsTrigger value="kalshi">Kalshi</TabsTrigger>
          <TabsTrigger value="polymarket">Polymarket</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Kalshi Positions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Kalshi
                  <Badge variant="secondary">
                    {portfolio.kalshi.positions.length} positions
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Total P&L: <span className={portfolio.kalshi.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${portfolio.kalshi.totalPnl.toFixed(2)}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {portfolio.kalshi.positions.length === 0 ? (
                    <p className="text-sm text-gray-500">No positions</p>
                  ) : (
                    portfolio.kalshi.positions.slice(0, 5).map((position) => (
                      <div key={position.ticker} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{position.ticker}</p>
                          <p className="text-xs text-gray-500">
                            Position: {position.position} contracts
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-sm ${position.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {position.realizedPnl >= 0 ? '+' : ''}${position.realizedPnl.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Exposure: ${position.marketExposure.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Polymarket Positions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Polymarket
                  <Badge variant="secondary">
                    {portfolio.polymarket.positions.length} positions
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Total Value: ${portfolio.polymarket.totalValue.toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {portfolio.polymarket.positions.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {polymarketAddress ? 'No positions' : 'Add wallet address to view positions'}
                    </p>
                  ) : (
                    portfolio.polymarket.positions.slice(0, 5).map((position) => (
                      <div key={position.market} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm truncate" title={position.market}>
                            {position.market.slice(0, 20)}...
                          </p>
                          <p className="text-xs text-gray-500">
                            Size: {position.size}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-sm ${position.cashPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {position.cashPnl >= 0 ? '+' : ''}${position.cashPnl.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {position.percentPnl >= 0 ? '+' : ''}{position.percentPnl.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kalshi">
          <Card>
            <CardHeader>
              <CardTitle>Kalshi Positions</CardTitle>
              <CardDescription>
                {portfolio.kalshi.positions.length} open position(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {portfolio.kalshi.positions.map((position) => (
                  <div key={position.ticker} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium">{position.ticker}</p>
                      <div className="flex gap-4 text-xs text-gray-500 mt-1">
                        <span>Position: {position.position}</span>
                        <span>Traded: ${position.totalTraded}</span>
                        <span>Fees: ${position.feesPaid}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${position.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {position.realizedPnl >= 0 ? '+' : ''}${position.realizedPnl.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Exposure: ${position.marketExposure.toFixed(0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="polymarket">
          <Card>
            <CardHeader>
              <CardTitle>Polymarket Positions</CardTitle>
              <CardDescription>
                {portfolio.polymarket.positions.length} open position(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {portfolio.polymarket.positions.map((position, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium truncate" title={position.market}>
                        {position.market}
                      </p>
                      <div className="flex gap-4 text-xs text-gray-500 mt-1">
                        <span>Size: {position.size}</span>
                        <span>Entry: ${position.avgEntryPrice.toFixed(2)}</span>
                        <span>Current: ${position.currentValue.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${position.cashPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {position.cashPnl >= 0 ? '+' : ''}${position.cashPnl.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {position.percentPnl >= 0 ? '+' : ''}{position.percentPnl.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
