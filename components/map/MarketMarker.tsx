'use client'

import { Market } from '@/types/market'

interface MarketMarkerProps {
  market: Market
  onClick?: () => void
  isSelected?: boolean
}

export function MarketMarker({ market, onClick, isSelected }: MarketMarkerProps) {
  const color = market.platform === 'polymarket' ? '#3b82f6' : '#10b981'
  
  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
        isSelected ? 'scale-125 z-10' : 'hover:scale-110'
      }`}
      onClick={onClick}
      style={{
        left: market.location?.coordinates?.lng,
        top: market.location?.coordinates?.lat,
      }}
    >
      <div
        className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
        style={{
          backgroundColor: color,
          boxShadow: isSelected ? `0 0 20px ${color}` : undefined,
        }}
      />
      {isSelected && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap glass-effect px-3 py-1 rounded text-sm">
          {market.title}
        </div>
      )}
    </div>
  )
}


