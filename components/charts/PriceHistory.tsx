'use client'

import { PricePoint } from '@/types/market'
import { MarketChart } from './MarketChart'

interface PriceHistoryProps {
  priceHistory: PricePoint[]
}

export function PriceHistory({ priceHistory }: PriceHistoryProps) {
  return (
    <div className="w-full">
      <h3 className="text-sm font-medium mb-2">Price History</h3>
      <MarketChart data={priceHistory} />
    </div>
  )
}

