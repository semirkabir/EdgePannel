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
  const { enabled = true, refreshInterval = 60000 } = options

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
          const error: any = new Error(errorData.error || 'Failed to fetch open interest')
          error.status = response.status
          throw error
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
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 15000,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Don't retry on 404s
        if (error.status === 404) return

        // If 429 (Too Many Requests), wait longer
        if (error.status === 429) {
          console.log('[useOpenInterest] Rate limited, backing off 60s...')
          setTimeout(() => revalidate({ retryCount }), 60000)
          return
        }

        // Standard backoff for other errors
        const timeout = Math.min(5000 * 2 ** retryCount, 30000)
        setTimeout(() => revalidate({ retryCount }), timeout)
      }
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
