'use client'

import { useLiveVolume, getEventIdFromMarket } from '@/hooks/use-live-volume'
import { useOpenInterest } from '@/hooks/use-open-interest'
import { cn } from '@/lib/utils/cn'
import { Activity } from 'lucide-react'

interface MarketPopupProps {
  market: any
  volume24h?: number
  platform?: string
}

/**
 * Component to display live volume and open interest in market popup/hover box
 * Shows volume and OI side by side horizontally
 */
export function MarketPopupVolume({ market, volume24h, platform }: MarketPopupProps) {
  // Only fetch live volume for Polymarket markets
  const eventId = platform === 'polymarket' ? getEventIdFromMarket(market) : null
  const { liveVolume, marketVolumes, isLoading } = useLiveVolume(eventId, {
    enabled: !!eventId,
    refreshInterval: 60000, // Refresh every 60 seconds
  })

  // Fetch Open Interest for Polymarket markets
  // Try multiple ways to extract conditionId
  const conditionId = platform === 'polymarket' 
    ? (market?.id || 
       market?.rawData?.conditionId || 
       market?.conditionId ||
       (typeof market?.rawData === 'object' && market?.rawData?.condition_id) ||
       null)
    : null

  // Get the specific market's volume from the markets array (more accurate than event total)
  // The liveVolume API returns event total, but we want the specific market's volume
  const marketSpecificVolume = conditionId && marketVolumes.length > 0
    ? marketVolumes.find(m => m.market.toLowerCase() === conditionId.toLowerCase())?.value ?? null
    : null

  // Debug: Log conditionId extraction (only in dev)
  if (process.env.NODE_ENV === 'development' && platform === 'polymarket') {
    if (conditionId) {
      console.log('[MarketPopup] ConditionId extracted:', conditionId, 'from market:', {
        id: market?.id,
        rawDataConditionId: market?.rawData?.conditionId,
        conditionId: market?.conditionId,
      })
    } else {
      console.warn('[MarketPopup] No conditionId found for market:', market)
    }
  }
  
  const { openInterest, isLoading: isLoadingOI } = useOpenInterest(conditionId || undefined, {
    enabled: !!conditionId && platform === 'polymarket',
    refreshInterval: 60000,
  })

  // Format volume for display
  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`
    return `$${vol.toFixed(0)}`
  }

  // Prefer market-specific volume, then event total, then 24h volume
  const displayVolume = marketSpecificVolume ?? liveVolume ?? volume24h ?? 0
  // Only show as "live" if we have market-specific data (not just event total)
  const isLive = marketSpecificVolume !== null && platform === 'polymarket'

  return (
    <div className="flex gap-1.5 flex-1">
      {/* Live Volume Box */}
      <div className="bg-gray-800/40 rounded p-1.5 border border-gray-700/30 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="text-[9px] text-gray-400 uppercase tracking-wide">
            {isLive ? 'Live Volume' : 'Volume 24h'}
          </div>
          {isLive && !isLoading && (
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Live data" />
          )}
          {isLoading && (
            <Activity className="w-2.5 h-2.5 text-gray-500 animate-spin" />
          )}
        </div>
        <div className={cn(
          "text-xs font-bold",
          isLive ? "text-emerald-300" : "text-white"
        )}>
          {isLoading ? '...' : formatVolume(displayVolume)}
        </div>
        {isLive && volume24h && (
          <div className="text-[8px] text-gray-500 mt-0.5">
            24h: {formatVolume(volume24h)}
          </div>
        )}
      </div>

      {/* Open Interest Box - To the right of volume */}
      {platform === 'polymarket' && (
        <div className="bg-gray-800/40 rounded p-1.5 border border-gray-700/30 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="text-[9px] text-gray-400 uppercase tracking-wide">
              Open Interest
            </div>
            {openInterest && openInterest.totalOI > 0 && !isLoadingOI && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Open Interest" />
            )}
            {isLoadingOI && (
              <Activity className="w-2.5 h-2.5 text-gray-500 animate-spin" />
            )}
          </div>
          <div className={cn(
            "text-xs font-bold",
            openInterest && openInterest.totalOI > 0 ? "text-blue-300" : "text-gray-500"
          )}>
            {isLoadingOI ? '...' : (openInterest && openInterest.totalOI > 0 
              ? formatVolume(openInterest.totalOI) 
              : 'N/A')}
          </div>
          {openInterest && openInterest.totalOI > 0 && (
            <div className="text-[8px] text-gray-500 mt-0.5">
              Y: {formatVolume(openInterest.yesOI)} | N: {formatVolume(openInterest.noOI)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
