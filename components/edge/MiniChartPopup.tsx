'use client'

import { Sparkline } from '@/components/ui/Sparkline'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface MiniChartPopupProps {
  prices: number[]
  isLoading?: boolean
  currentPrice?: number
  priceChange?: number
  className?: string
}

/**
 * Mini chart popup component for hover tooltips
 * Shows a compact sparkline with price info
 */
export function MiniChartPopup({
  prices,
  isLoading = false,
  currentPrice,
  priceChange,
  className
}: MiniChartPopupProps) {
  // Need at least 2 points for a chart
  const hasData = prices && prices.length >= 2

  if (isLoading) {
    return (
      <div className={cn(
        "bg-gray-900/95 border border-gray-700/50 rounded-lg p-2 shadow-lg backdrop-blur-sm",
        className
      )}>
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-gray-400 animate-spin" />
          <span className="text-xs text-gray-400">Loading chart...</span>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return null
  }

  // Calculate price change if not provided
  const calculatedChange = priceChange !== undefined 
    ? priceChange 
    : prices.length >= 2 
      ? prices[prices.length - 1] - prices[0]
      : 0

  const isPositive = calculatedChange >= 0
  const changePercent = prices.length >= 2 && prices[0] !== 0
    ? ((calculatedChange / prices[0]) * 100)
    : 0

  return (
    <div className={cn(
      "bg-gray-900/95 border border-gray-700/50 rounded-lg p-2 shadow-lg backdrop-blur-sm",
      className
    )}>
      {/* Chart */}
      <div className="mb-1.5">
        <Sparkline
          data={prices}
          width={120}
          height={24}
          color={isPositive ? '#10b981' : '#ef4444'}
        />
      </div>

      {/* Price Info */}
      <div className="flex items-center justify-between gap-2">
        {currentPrice !== undefined && (
          <span className="text-xs font-bold text-white tabular-nums">
            {Math.round(currentPrice * 100)}¢
          </span>
        )}
        {calculatedChange !== 0 && (
          <span className={cn(
            "text-[10px] font-semibold tabular-nums",
            isPositive ? "text-emerald-400" : "text-red-400"
          )}>
            {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

