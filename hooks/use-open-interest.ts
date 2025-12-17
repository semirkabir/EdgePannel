import useSWR from 'swr'

interface OpenInterestData {
  market: string
  yesOI: number
  noOI: number
  totalOI: number
  timestamp: string
}

interface UseOpenInterestOptions {
  enabled?: boolean
  refreshInterval?: number
}

/**
 * Hook to fetch Open Interest for a Polymarket market
 * @param marketId - The market condition ID
 * @param options - Configuration options
 */
export function useOpenInterest(
  marketId: string | null | undefined,
  options: UseOpenInterestOptions = {}
) {
  const { enabled = true, refreshInterval = 30000 } = options

  const { data, error, isLoading, mutate } = useSWR<OpenInterestData | null>(
    marketId && enabled ? `/api/markets/open-interest?marketId=${marketId}` : null,
    async (url: string) => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          // If 500 error, return null instead of throwing - allows graceful degradation
          if (response.status === 500) {
            const errorText = await response.text().catch(() => 'Unknown error')
            console.warn('[useOpenInterest] Server error (500):', errorText.substring(0, 200))
            return null
          }
          const errorData = await response.json().catch(() => ({}))
          console.warn('[useOpenInterest] API error:', response.status, errorData)
          throw new Error(errorData.error || 'Failed to fetch open interest')
        }
        const json = await response.json()
        // Handle case where openInterest is null (market not found in subgraph)
        if (process.env.NODE_ENV === 'development') {
          console.log('[useOpenInterest] Response for', marketId, ':', json.openInterest ? 'Found' : 'Not found')
        }
        return json.openInterest || null
      } catch (err: any) {
        console.error('[useOpenInterest] Fetch error:', err.message)
        return null
      }
    },
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000,
    }
  )

  return {
    openInterest: data,
    isLoading,
    error,
    mutate,
  }
}

// Removed useMultipleOpenInterest - not used anywhere in the codebase

