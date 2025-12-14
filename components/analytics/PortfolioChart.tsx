'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { TrendingUp, TrendingDown, BarChart3, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface PortfolioChartProps {
  userId: string
  platform?: 'kalshi' | 'polymarket' | 'combined'
  timeRange?: '24h' | '7d' | '30d' | '90d' | 'all'
  useMockData?: boolean // For testing/demo purposes
}

interface PortfolioSnapshot {
  timestamp: Date | string
  totalValue: number
  totalPnl: number
  positionCount: number
  exposure?: number
  platform?: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function PortfolioChart({
  userId,
  platform = 'combined',
  timeRange = '30d',
  useMockData = false
}: PortfolioChartProps) {
  const [selectedRange, setSelectedRange] = useState(timeRange)
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])

  // Fetch real data from Supabase
  const { data, error, isLoading } = useSWR(
    useMockData ? null : `/api/analytics/portfolio-history?userId=${userId}&platform=${platform}&timeRange=${selectedRange}`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: false
    }
  )

  useEffect(() => {
    if (useMockData || !data || !data.hasData) {
      // Generate mock data for demo/testing or when no real data exists
      const generateMockData = () => {
        const now = Date.now()
        const ranges = {
          '24h': 24,
          '7d': 7 * 24,
          '30d': 30 * 24,
          '90d': 90 * 24,
          'all': 365 * 24
        }

        const hours = ranges[selectedRange as keyof typeof ranges]
        const mockData: PortfolioSnapshot[] = []
        let value = 10000
        let pnl = 0

        for (let i = hours; i >= 0; i -= Math.max(1, Math.floor(hours / 50))) {
          const change = (Math.random() - 0.48) * 100
          value += change
          pnl += change

          mockData.push({
            timestamp: new Date(now - i * 60 * 60 * 1000),
            totalValue: Math.max(0, value),
            totalPnl: pnl,
            positionCount: Math.floor(5 + Math.random() * 10)
          })
        }

        return mockData
      }

      setSnapshots(generateMockData())
    } else if (data.snapshots) {
      // Use real data from Supabase
      setSnapshots(data.snapshots.map((s: any) => ({
        ...s,
        timestamp: new Date(s.timestamp)
      })))
    }
  }, [userId, platform, selectedRange, data, useMockData])

  const loading = isLoading && !useMockData
  const hasRealData = data?.hasData && !useMockData
  const showingMockData = useMockData || !data?.hasData

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <BarChart3 className="w-8 h-8 animate-pulse mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading portfolio data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-red-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-semibold">Failed to load portfolio data</p>
            <p className="text-sm mt-2">Showing demo data instead</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentValue = snapshots[snapshots.length - 1]?.totalValue || 0
  const currentPnl = snapshots[snapshots.length - 1]?.totalPnl || 0
  const startValue = snapshots[0]?.totalValue || currentValue
  const changePercent = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0

  const maxValue = Math.max(...snapshots.map(s => s.totalValue))
  const minValue = Math.min(...snapshots.map(s => s.totalValue))
  const maxPnl = Math.max(...snapshots.map(s => s.totalPnl))
  const minPnl = Math.min(...snapshots.map(s => s.totalPnl))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Portfolio Performance
              {showingMockData && (
                <Badge variant="outline" className="text-xs">
                  Demo Data
                </Badge>
              )}
              {hasRealData && (
                <Badge variant="default" className="text-xs bg-green-600">
                  Live Data
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {hasRealData
                ? `Historical data from ${data.stats?.snapshotCount || 0} snapshots`
                : 'Track your portfolio value over time'}
            </CardDescription>
          </div>
          <Tabs value={selectedRange} onValueChange={(v) => setSelectedRange(v as typeof timeRange)}>
            <TabsList>
              <TabsTrigger value="24h">24H</TabsTrigger>
              <TabsTrigger value="7d">7D</TabsTrigger>
              <TabsTrigger value="30d">30D</TabsTrigger>
              <TabsTrigger value="90d">90D</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {/* Current Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Current Value</p>
            <p className="text-2xl font-semibold">
              ${currentValue.toFixed(2)}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Total P&L</p>
            <p className={`text-2xl font-semibold ${currentPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {currentPnl >= 0 ? '+' : ''}${currentPnl.toFixed(2)}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Change</p>
            <p className={`text-2xl font-semibold flex items-center justify-center gap-1 ${
              changePercent >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {changePercent >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              {Math.abs(changePercent).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Value Chart */}
        <div className="mb-6">
          <h4 className="font-semibold text-sm mb-2">Portfolio Value</h4>
          <div className="h-48 relative">
            <svg width="100%" height="100%" className="overflow-visible">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <line
                  key={ratio}
                  x1="0"
                  y1={`${ratio * 100}%`}
                  x2="100%"
                  y2={`${ratio * 100}%`}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}

              {/* Value line */}
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points={snapshots.map((snapshot, i) => {
                  const x = (i / (snapshots.length - 1)) * 100
                  const y = 100 - ((snapshot.totalValue - minValue) / (maxValue - minValue)) * 90 - 5
                  return `${x}%,${y}%`
                }).join(' ')}
              />

              {/* Fill area */}
              <polygon
                fill="url(#gradient)"
                opacity="0.3"
                points={[
                  ...snapshots.map((snapshot, i) => {
                    const x = (i / (snapshots.length - 1)) * 100
                    const y = 100 - ((snapshot.totalValue - minValue) / (maxValue - minValue)) * 90 - 5
                    return `${x}%,${y}%`
                  }),
                  '100%,100%',
                  '0%,100%'
                ].join(' ')}
              />

              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
              <span>${maxValue.toFixed(0)}</span>
              <span>${((maxValue + minValue) / 2).toFixed(0)}</span>
              <span>${minValue.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* P&L Chart */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Profit & Loss</h4>
          <div className="h-32 relative">
            <svg width="100%" height="100%">
              {/* Zero line */}
              <line
                x1="0"
                y1="50%"
                x2="100%"
                y2="50%"
                stroke="#9ca3af"
                strokeWidth="1"
                strokeDasharray="4"
              />

              {/* P&L bars */}
              {snapshots.map((snapshot, i) => {
                const x = (i / snapshots.length) * 100
                const width = 100 / snapshots.length
                const pnlRatio = (snapshot.totalPnl - minPnl) / (maxPnl - minPnl)
                const height = Math.abs(snapshot.totalPnl) / Math.max(Math.abs(maxPnl), Math.abs(minPnl)) * 45
                const y = snapshot.totalPnl >= 0 ? 50 - height : 50

                return (
                  <rect
                    key={i}
                    x={`${x}%`}
                    y={`${y}%`}
                    width={`${width}%`}
                    height={`${height}%`}
                    fill={snapshot.totalPnl >= 0 ? '#10b981' : '#ef4444'}
                    opacity="0.7"
                  />
                )
              })}
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
