'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { PricePoint } from '@/types/market'

interface MarketChartProps {
  data: PricePoint[]
}

// Helper to safely parse timestamp to Date
function parseTimestamp(timestamp: Date | string | number): Date {
  if (timestamp instanceof Date) {
    return timestamp
  }
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp)
  }
  return new Date()
}

// Determine time range in hours
function getTimeRangeHours(data: PricePoint[]): number {
  if (!data || data.length === 0) return 0

  const timestamps = data.map(p => parseTimestamp(p.timestamp).getTime())
  const min = Math.min(...timestamps)
  const max = Math.max(...timestamps)

  return (max - min) / (1000 * 60 * 60) // Convert to hours
}

// Format time for display based on the data range
function formatTimeForRange(date: Date, rangeHours: number): string {
  try {
    if (rangeHours < 24) {
      // Less than 24 hours: show time only
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (rangeHours < 168) {
      // Less than 7 days: show day and time
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } else {
      // 7 days or more: show date
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
      })
    }
  } catch {
    return '--:--'
  }
}

// Custom tooltip component
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  const price = data.price
  const time = data.fullTime

  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-xs text-slate-400 mb-1">{time}</div>
      <div className="text-lg font-bold text-white">
        {price.toFixed(1)}%
      </div>
    </div>
  )
}

export function MarketChart({ data }: MarketChartProps) {
  const { chartData, priceRange, trend } = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { chartData: [], priceRange: [0, 100], trend: 'neutral' }
    }

    const rangeHours = getTimeRangeHours(data)
    const prices = data.map(p => (typeof p.price === 'number' ? p.price * 100 : 0))

    // Calculate price range with padding
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const padding = (maxPrice - minPrice) * 0.2 || 10
    const yMin = Math.max(0, minPrice - padding)
    const yMax = Math.min(100, maxPrice + padding)

    // Determine trend
    const firstPrice = prices[0]
    const lastPrice = prices[prices.length - 1]
    const trendDirection = lastPrice > firstPrice ? 'up' : lastPrice < firstPrice ? 'down' : 'neutral'

    const processedData = data.map(point => {
      const timestamp = parseTimestamp(point.timestamp)
      return {
        time: formatTimeForRange(timestamp, rangeHours),
        fullTime: timestamp.toLocaleString(),
        price: typeof point.price === 'number' ? point.price * 100 : 0,
        volume: point.volume || 0,
      }
    })

    return {
      chartData: processedData,
      priceRange: [yMin, yMax],
      trend: trendDirection
    }
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[280px] flex items-center justify-center text-slate-500 text-sm">
        No price history available
      </div>
    )
  }

  // Colors based on trend (like Polymarket)
  const colors = {
    up: {
      stroke: '#10b981',
      fill: '#10b98120',
      gradient: ['#10b98140', '#10b98105']
    },
    down: {
      stroke: '#ef4444',
      fill: '#ef444420',
      gradient: ['#ef444440', '#ef444405']
    },
    neutral: {
      stroke: '#3b82f6',
      fill: '#3b82f620',
      gradient: ['#3b82f640', '#3b82f605']
    }
  }

  const colorScheme = colors[trend as keyof typeof colors]

  return (
    <div className="w-full h-full max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
          margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
      >
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colorScheme.gradient[0]} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={colorScheme.gradient[1]} stopOpacity={0.1}/>
          </linearGradient>
        </defs>

        {/* Subtle grid */}
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(148, 163, 184, 0.1)"
          vertical={false}
        />

        {/* X Axis */}
        <XAxis
          dataKey="time"
          stroke="rgba(148, 163, 184, 0.3)"
          style={{ fontSize: '10px' }}
          tick={{ fill: 'rgba(148, 163, 184, 0.6)' }}
          tickLine={false}
          axisLine={false}
          minTickGap={30}
          interval="preserveStartEnd"
        />

        {/* Y Axis */}
        <YAxis
          stroke="rgba(148, 163, 184, 0.3)"
          style={{ fontSize: '11px' }}
          tick={{ fill: 'rgba(148, 163, 184, 0.6)' }}
          tickLine={false}
          axisLine={false}
          domain={priceRange}
          tickFormatter={(value) => `${Math.round(value)}%`}
          width={40}
        />

        {/* 50% reference line */}
        <ReferenceLine
          y={50}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeDasharray="3 3"
        />

        {/* Tooltip */}
        <Tooltip
          content={<CustomTooltip />}
          cursor={{
            stroke: 'rgba(148, 163, 184, 0.3)',
            strokeWidth: 1,
            strokeDasharray: '5 5'
          }}
        />

        {/* Area with gradient fill */}
        <Area
          type="monotone"
          dataKey="price"
          stroke={colorScheme.stroke}
          strokeWidth={2.5}
          fill="url(#colorPrice)"
          fillOpacity={1}
          dot={false}
          activeDot={{
            r: 5,
            fill: colorScheme.stroke,
            stroke: '#fff',
            strokeWidth: 2,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  )
}
