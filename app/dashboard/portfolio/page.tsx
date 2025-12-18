'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Wallet, TrendingUp, BarChart3, Activity } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard'
import { PortfolioChart } from '@/components/analytics/PortfolioChart'
import { PnLHistory } from '@/components/analytics/PnLHistory'
import { WhaleTracker } from '@/components/whales/WhaleTracker'
import { MarketDepth } from '@/components/market/MarketDepth'
import { TradeFeed } from '@/components/market/TradeFeed'

export default function PortfolioPage() {
  const router = useRouter()
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  const [selectedTicker, setSelectedTicker] = useState<string>('')

  // TODO: Get these from user session/settings
  const userId = 'demo-user-123'
  const polymarketAddress = process.env.NEXT_PUBLIC_DEMO_POLYMARKET_ADDRESS || ''
  const kalshiCredentials = {
    accessKeyId: process.env.NEXT_PUBLIC_KALSHI_API_KEY_ID || '',
    privateKey: process.env.KALSHI_PRIVATE_KEY || ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/edge')}
                className="text-gray-300 hover:text-white hover:bg-white/5"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Globe
              </Button>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Portfolio</h1>
                  <p className="text-xs text-gray-400">Track your positions & performance</p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-gray-400">Total Value</p>
                <p className="text-lg font-semibold text-white">Loading...</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">24h P&L</p>
                <p className="text-lg font-semibold text-green-400">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-5 bg-gray-900/50 border border-white/10 p-1 rounded-lg backdrop-blur-sm">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300 flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300 flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="whales"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300 flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Whale Tracker
            </TabsTrigger>
            <TabsTrigger
              value="markets"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Market Depth
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300 flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Trade Feed
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <PortfolioDashboard
              polymarketAddress={polymarketAddress}
              kalshiCredentials={kalshiCredentials.accessKeyId && kalshiCredentials.privateKey ? kalshiCredentials : undefined}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Portfolio Performance Chart */}
            <PortfolioChart
              userId={userId}
              platform="combined"
              timeRange="30d"
              useMockData={false} // Set to true for demo without database
            />

            {/* P&L History */}
            <PnLHistory
              userId={userId}
              platform="combined"
            />
          </TabsContent>

          {/* Whale Tracker Tab */}
          <TabsContent value="whales" className="space-y-6">
            <Card className="p-6 bg-gray-900/50 border-white/10">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Whale Activity Monitor</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Track large trades and positions in specific markets
                </p>

                {/* Market ID Input */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Enter Polymarket market ID (e.g., 0x1234...)"
                    className="flex-1 px-4 py-3 bg-gray-950 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                    value={selectedMarket}
                    onChange={(e) => setSelectedMarket(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      if (selectedMarket) {
                        // Market is now being tracked
                        console.log('Tracking market:', selectedMarket)
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!selectedMarket}
                  >
                    Track Market
                  </Button>
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">Examples:</span>
                  <button
                    onClick={() => setSelectedMarket('demo-market-btc-100k')}
                    className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded border border-white/10 transition-colors"
                  >
                    BTC $100k Demo
                  </button>
                  <button
                    onClick={() => setSelectedMarket('demo-market-elections')}
                    className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded border border-white/10 transition-colors"
                  >
                    Elections Demo
                  </button>
                </div>
              </div>

              {selectedMarket ? (
                <WhaleTracker
                  marketId={selectedMarket}
                  marketTitle="Selected Market"
                  minTradeSize={10000}
                  holderThreshold={5}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Enter a market ID above to start tracking whale activity</p>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Market Depth Tab */}
          <TabsContent value="markets" className="space-y-6">
            <Card className="p-6 bg-gray-900/50 border-white/10">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Order Book Depth</h2>
                <p className="text-sm text-gray-400 mb-4">
                  View real-time order book and market depth
                </p>

                {/* Ticker Input */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Enter ticker symbol (e.g., KXBTC-24DEC31-T100000)"
                    className="flex-1 px-4 py-3 bg-gray-950 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                    value={selectedTicker}
                    onChange={(e) => setSelectedTicker(e.target.value)}
                  />
                  <select
                    className="px-4 py-3 bg-gray-950 border border-white/10 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors"
                  >
                    <option value="kalshi">Kalshi</option>
                    <option value="polymarket">Polymarket</option>
                  </select>
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">Kalshi Examples:</span>
                  <button
                    onClick={() => setSelectedTicker('KXBTC-24DEC31-T100000')}
                    className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded border border-white/10 transition-colors"
                  >
                    BTC $100k
                  </button>
                  <button
                    onClick={() => setSelectedTicker('KXETH-24DEC31-T5000')}
                    className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded border border-white/10 transition-colors"
                  >
                    ETH $5k
                  </button>
                </div>
              </div>

              {selectedTicker ? (
                <MarketDepth
                  ticker={selectedTicker}
                  platform="kalshi"
                  refreshInterval={5000}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Enter a ticker symbol above to view market depth</p>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Trade Feed Tab */}
          <TabsContent value="trades" className="space-y-6">
            <TradeFeed
              ticker={selectedTicker || undefined}
              platform="kalshi"
              maxTrades={100}
              autoScroll={true}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
