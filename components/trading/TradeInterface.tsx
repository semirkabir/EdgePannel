'use client'

import { useState } from 'react'
import { Market } from '@/types/market'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

interface TradeInterfaceProps {
  market: Market
}

export function TradeInterface({ market }: TradeInterfaceProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: market.platform,
          marketId: market.id,
          side,
          quantity: parseFloat(quantity),
          price: orderType === 'limit' ? parseFloat(price) : undefined,
          orderType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Trade failed')
      }

      toast.success('Order placed successfully!', `${side.toUpperCase()} ${quantity} @ ${orderType === 'limit' ? price : 'market price'}`)
      setQuantity('')
      setPrice('')
    } catch (error: any) {
      toast.error('Trade failed', error.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={side === 'buy' ? 'default' : 'outline'}
          onClick={() => setSide('buy')}
          className="flex-1"
        >
          Buy
        </Button>
        <Button
          type="button"
          variant={side === 'sell' ? 'default' : 'outline'}
          onClick={() => setSide('sell')}
          className="flex-1"
        >
          Sell
        </Button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Order Type</label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as 'limit' | 'market')}
          className="w-full px-3 py-2 bg-background border border-input rounded-md"
        >
          <option value="limit">Limit</option>
          <option value="market">Market</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Quantity</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          min="0.01"
          step="0.01"
          className="w-full px-3 py-2 bg-background border border-input rounded-md"
        />
      </div>

      {orderType === 'limit' && (
        <div>
          <label className="block text-sm font-medium mb-2">Price</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min="0"
            max="1"
            step="0.01"
            className="w-full px-3 py-2 bg-background border border-input rounded-md"
          />
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Placing Order...' : `Place ${side === 'buy' ? 'Buy' : 'Sell'} Order`}
      </Button>
    </form>
  )
}

