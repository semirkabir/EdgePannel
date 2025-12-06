'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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

// Format time for display
function formatTime(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--:--'
  }
}

export function MarketChart({ data }: MarketChartProps) {
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return []
    }

    return data.map(point => {
      const timestamp = parseTimestamp(point.timestamp)
      return {
        time: formatTime(timestamp),
        fullTime: timestamp.toLocaleString(),
        price: typeof point.price === 'number' ? point.price * 100 : 0,
        volume: point.volume || 0,
      }
    })
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No price history available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
        <XAxis
          dataKey="time"
          stroke="rgba(148, 163, 184, 0.5)"
          style={{ fontSize: '12px' }}
          tick={{ fill: 'rgba(148, 163, 184, 0.7)' }}
        />
        <YAxis
          stroke="rgba(148, 163, 184, 0.5)"
          style={{ fontSize: '12px' }}
          tick={{ fill: 'rgba(148, 163, 184, 0.7)' }}
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '8px',
            padding: '8px 12px',
          }}
          labelStyle={{ color: 'rgba(148, 163, 184, 0.9)' }}
          formatter={(value: number) => [`${value.toFixed(1)}%`, 'Probability']}
          labelFormatter={(_, payload) => payload[0]?.payload?.fullTime || ''}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}


