'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts'
import { Candlestick } from '@/types/market'

interface CandlestickChartProps {
  data: Candlestick[]
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
function getTimeRangeHours(data: Candlestick[]): number {
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

// Custom candlestick shape
function CandlestickShape(props: any) {
  const { x, y, width, height, payload } = props
  const { open, close, high, low } = payload

  const isUp = close >= open
  const color = isUp ? '#10b981' : '#ef4444'
  const wickColor = isUp ? '#10b98180' : '#ef444480'

  // Scale values (0-1 range to percentage)
  const openScaled = open * 100
  const closeScaled = close * 100
  const highScaled = high * 100
  const lowScaled = low * 100

  // Calculate y positions (inverted because SVG y-axis goes down)
  const yHigh = y - ((highScaled - closeScaled) / 100) * height
  const yLow = y + ((openScaled - lowScaled) / 100) * height
  const yOpen = y - ((openScaled - closeScaled) / 100) * height
  const yClose = y

  const candleHeight = Math.abs(yClose - yOpen)
  const candleY = Math.min(yClose, yOpen)

  return (
    <g>
      {/* Wick (High-Low line) */}
      <line
        x1={x + width / 2}
        y1={yHigh}
        x2={x + width / 2}
        y2={yLow}
        stroke={wickColor}
        strokeWidth={1}
      />
      {/* Body (Open-Close rectangle) */}
      <rect
        x={x + width * 0.2}
        y={candleY}
        width={width * 0.6}
        height={Math.max(candleHeight, 1)}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  )
}

// Custom tooltip component
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  const { open, high, low, close, timestamp } = data
  const isUp = close >= open

  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-xs text-slate-400 mb-2">
        {parseTimestamp(timestamp).toLocaleString()}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-slate-500">Open:</div>
        <div className="text-white font-semibold">{(open * 100).toFixed(1)}%</div>
        <div className="text-slate-500">High:</div>
        <div className="text-emerald-400 font-semibold">{(high * 100).toFixed(1)}%</div>
        <div className="text-slate-500">Low:</div>
        <div className="text-red-400 font-semibold">{(low * 100).toFixed(1)}%</div>
        <div className="text-slate-500">Close:</div>
        <div className={`font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {(close * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  )
}

export function CandlestickChart({ data }: CandlestickChartProps) {
  const { chartData, priceRange, trend } = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { chartData: [], priceRange: [0, 100], trend: 'neutral' }
    }

    const rangeHours = getTimeRangeHours(data)

    // Calculate price range with padding
    const allPrices = data.flatMap(c => [c.high, c.low])
    const minPrice = Math.min(...allPrices) * 100
    const maxPrice = Math.max(...allPrices) * 100
    const padding = (maxPrice - minPrice) * 0.2 || 10
    const yMin = Math.max(0, minPrice - padding)
    const yMax = Math.min(100, maxPrice + padding)

    // Determine trend
    const firstClose = data[0].close
    const lastClose = data[data.length - 1].close
    const trendDirection = lastClose > firstClose ? 'up' : lastClose < firstClose ? 'down' : 'neutral'

    const processedData = data.map(candle => {
      const timestamp = parseTimestamp(candle.timestamp)
      return {
        time: formatTimeForRange(timestamp, rangeHours),
        fullTime: timestamp.toLocaleString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        timestamp: candle.timestamp,
        // For bar chart representation
        value: candle.close * 100,
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
        No candlestick data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
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
          style={{ fontSize: '11px' }}
          tick={{ fill: 'rgba(148, 163, 184, 0.6)' }}
          tickLine={false}
          axisLine={false}
          minTickGap={50}
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

        {/* Candlesticks as bars */}
        <Bar
          dataKey="value"
          shape={<CandlestickShape />}
          isAnimationActive={false}
        >
          {chartData.map((entry, index) => {
            const isUp = entry.close >= entry.open
            return <Cell key={`cell-${index}`} fill={isUp ? '#10b981' : '#ef4444'} />
          })}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  )
}
