'use client'

import { useState, useEffect, useRef } from 'react'

interface PricePoint {
  timestamp: Date
  price: number
  volume: number
}

interface UseMarketPriceHistoryOptions {
  enabled?: boolean
  interval?: '1h' | '6h' | '1d'
  debounceMs?: number
  assetId?: string // Optional assetId for Polymarket (tokenId)
}

/**
 * Hook to fetch price history for a market with debouncing
 * Optimized for hover interactions - only fetches when enabled and after debounce
 */
export function useMarketPriceHistory(
  marketId: string | null | undefined,
  platform: 'polymarket' | 'kalshi' | null | undefined,
  options: UseMarketPriceHistoryOptions = {}
) {
  const { enabled = true, interval = '1h', debounceMs = 300, assetId } = options
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Reset state if disabled or no market
    if (!enabled || !marketId || !platform) {
      setPriceHistory([])
      setIsLoading(false)
      setError(null)
      return
    }

    // Debounce the fetch
    debounceTimerRef.current = setTimeout(() => {
      const fetchHistory = async () => {
        setIsLoading(true)
        setError(null)

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController()

        try {
          // Build URL with assetId if available (for Polymarket)
          let url = `/api/markets/history?id=${encodeURIComponent(marketId)}&platform=${platform}&interval=${interval}`
          
          if (assetId && platform === 'polymarket') {
            url += `&assetId=${encodeURIComponent(assetId)}`
          }

          const response = await fetch(url, {
            signal: abortControllerRef.current.signal,
            cache: 'no-store',
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch price history: ${response.statusText}`)
          }

          const data = await response.json()

          if (data.history && Array.isArray(data.history)) {
            // Convert timestamps to Date objects if needed
            const history = data.history.map((point: any) => ({
              timestamp: point.timestamp instanceof Date 
                ? point.timestamp 
                : new Date(point.timestamp),
              price: point.price,
              volume: point.volume || 0,
            }))

            setPriceHistory(history)
          } else {
            setPriceHistory([])
          }
        } catch (err: any) {
          // Don't set error if request was aborted
          if (err.name !== 'AbortError') {
            console.error('[useMarketPriceHistory] Error:', err)
            setError(err)
            setPriceHistory([])
          }
        } finally {
          setIsLoading(false)
          abortControllerRef.current = null
        }
      }

      fetchHistory()
    }, debounceMs)

    // Include assetId in dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, platform, enabled, interval, debounceMs, options.assetId])

  return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [marketId, platform, enabled, interval, debounceMs, assetId])

  return {
    priceHistory,
    isLoading,
    error,
    // Extract just prices for sparkline
    prices: priceHistory.map(p => p.price),
  }
}

