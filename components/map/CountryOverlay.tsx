'use client'

import { Market } from '@/types/market'

interface CountryOverlayProps {
  country: string
  markets: Market[]
  onClose: () => void
}

export function CountryOverlay({ country, markets, onClose }: CountryOverlayProps) {
  const countryMarkets = markets.filter(
    m => m.location?.country === country
  )

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-effect p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Markets in {country}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          {countryMarkets.map(market => (
            <div
              key={market.id}
              className="p-3 bg-background/50 rounded border border-input hover:bg-accent cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{market.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {market.platform} • {market.location?.city || market.location?.region || ''}
                  </p>
                </div>
                {market.price && (
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {(market.price * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

