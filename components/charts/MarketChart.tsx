'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PricePoint } from '@/types/market'

interface MarketChartProps {
  data: PricePoint[]
}

export function MarketChart({ data }: MarketChartProps) {
  const chartData = data.map(point => ({
    time: point.timestamp.toLocaleTimeString(),
    price: point.price * 100,
    volume: point.volume,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
        <XAxis
          dataKey="time"
          stroke="rgba(148, 163, 184, 0.5)"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="rgba(148, 163, 184, 0.5)"
          style={{ fontSize: '12px' }}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '4px',
          }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

