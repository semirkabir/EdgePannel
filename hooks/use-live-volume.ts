import useSWR from 'swr'

interface LiveVolumeData {
  total: number
  markets: Array<{
    market: string
    value: number
  }>
  eventId: number
}

interface UseLiveVolumeOptions {
  enabled?: boolean
  refreshInterval?: number
}

/**
 * Hook to fetch live volume for a Polymarket event
 * @param eventId - The Polymarket event ID
 * @param options - Configuration options
 */
export function useLiveVolume(
  eventId: number | null | undefined,
  options: UseLiveVolumeOptions = {}
) {
  const { enabled = true, refreshInterval = 30000 } = options

  const { data, error, isLoading, mutate } = useSWR<LiveVolumeData>(
    eventId && enabled ? `/api/markets/live-volume?eventId=${eventId}` : null,
    async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch live volume')
      }
      return response.json()
    },
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
    }
  )

  return {
    liveVolume: data?.total ?? null,
    marketVolumes: data?.markets ?? [],
    isLoading,
    error,
    mutate,
  }
}

// Removed getMarketVolumeFromLiveData - not used, code accesses marketVolumes directly

/**
 * Extract event ID from a market object
 */
export function getEventIdFromMarket(market: any): number | null {
  if (!market) return null

  // Try rawData.events[0].id first (most common)
  if (market.rawData?.events?.[0]?.id) {
    const id = market.rawData.events[0].id
    return typeof id === 'number' ? id : parseInt(String(id), 10)
  }

  // Try eventData.eventId
  if (market.eventData?.eventId) {
    const id = market.eventData.eventId
    return typeof id === 'number' ? id : parseInt(String(id), 10)
  }

  // Try eventId directly
  if (market.eventId) {
    const id = market.eventId
    return typeof id === 'number' ? id : parseInt(String(id), 10)
  }

  return null
}

