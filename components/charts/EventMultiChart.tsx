'use client'

import React, { useMemo } from 'react'
import { Market, PricePoint } from '@/types/market'
import { cn } from '@/lib/utils/cn'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts'

interface EventMultiChartProps {
    markets: Market[]
    priceHistories: Record<string, PricePoint[]>
    colors: string[]
    height?: number
}

export function EventMultiChart({
    markets,
    priceHistories,
    colors,
    height = 180
}: EventMultiChartProps) {
    // Transform data for Recharts - merge all histories into a single array
    const chartData = useMemo(() => {
        // Get all unique timestamps
        const timestampMap = new Map<number, Record<string, number>>()

        markets.forEach((market, index) => {
            const history = priceHistories[market.id]
            if (!history) return

            history.forEach(point => {
                const ts = new Date(point.timestamp).getTime()
                if (!timestampMap.has(ts)) {
                    timestampMap.set(ts, { timestamp: ts })
                }
                const entry = timestampMap.get(ts)!
                entry[`price_${index}`] = point.price * 100 // Convert to percentage
            })
        })

        // Sort by timestamp and convert to array
        return Array.from(timestampMap.values())
            .sort((a, b) => a.timestamp - b.timestamp)
    }, [markets, priceHistories])

    // Get outcome labels for legend
    const outcomeLabels = useMemo(() => {
        return markets.map(m => {
            const label = m.rawData?.subtitle || m.title
            return label.length > 20 ? label.substring(0, 20) + '...' : label
        })
    }, [markets])

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null

        const date = new Date(label)
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        })

        return (
            <div className="bg-[#1a1b1e] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
                <div className="text-[10px] text-gray-400 mb-1">{dateStr}</div>
                {payload.map((entry: any, index: number) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 text-xs"
                    >
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-300">{outcomeLabels[parseInt(entry.dataKey.split('_')[1])]}</span>
                        <span className="font-bold text-white ml-auto">{Math.round(entry.value)}%</span>
                    </div>
                ))}
            </div>
        )
    }

    // Format X axis
    const formatXAxis = (timestamp: number) => {
        const date = new Date(timestamp)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-[180px] text-gray-500 text-sm">
                No chart data available
            </div>
        )
    }

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={formatXAxis}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                        tickFormatter={(value) => `${value}%`}
                        width={40}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {markets.map((market, index) => (
                        <Line
                            key={market.id}
                            type="monotone"
                            dataKey={`price_${index}`}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                            name={outcomeLabels[index]}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>

            {/* Inline Legend with current prices */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {markets.slice(0, 5).map((market, index) => {
                    const price = market.price ?? market.probability
                    const pricePercent = price !== undefined ? Math.round(price * 100) : null

                    return (
                        <div
                            key={market.id}
                            className="flex items-center gap-1.5 text-[10px]"
                        >
                            <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: colors[index % colors.length] }}
                            />
                            <span className="text-gray-400 truncate max-w-[80px]">
                                {outcomeLabels[index]}
                            </span>
                            {pricePercent !== null && (
                                <span className="font-bold text-white">{pricePercent}%</span>
                            )}
                        </div>
                    )
                })}
                {markets.length > 5 && (
                    <span className="text-[10px] text-gray-500">+{markets.length - 5} more</span>
                )}
            </div>
        </div>
    )
}
