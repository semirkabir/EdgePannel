'use client'

import { TradeOrder } from '@/types/trading'
import { TradeInterface } from './TradeInterface'
import { Market } from '@/types/market'

interface OrderFormProps {
  market: Market
  onSubmit: (order: TradeOrder) => Promise<void>
}

export function OrderForm({ market, onSubmit }: OrderFormProps) {
  return <TradeInterface market={market} />
}



