'use client'

import { MiniChartPopup } from './MiniChartPopup'
import { useMarketPriceHistory } from '@/hooks/use-market-price-history'

interface MarketHoverChartProps {
  marketId: string | null | undefined
  platform: 'polymarket' | 'kalshi' | null | undefined
  currentPrice?: number
  priceChange?: number
  enabled?: boolean
}

/**
 * Component that fetches and displays price history chart on hover
 * Only fetches when enabled (e.g., when hovering)
 */
export function MarketHoverChart({
  marketId,
  platform,
  currentPrice,
  priceChange,
  enabled = true
}: MarketHoverChartProps) {
  const { prices, isLoading } = useMarketPriceHistory(marketId, platform, {
    enabled,
    interval: '1h', // Last 24 hours with 1-hour granularity
    debounceMs: 300, // Wait 300ms before fetching
  })

  // Don't render if no market data
  if (!marketId || !platform) {
    return null
  }

  return (
    <MiniChartPopup
      prices={prices}
      isLoading={isLoading}
      currentPrice={currentPrice}
      priceChange={priceChange}
    />
  )
}

