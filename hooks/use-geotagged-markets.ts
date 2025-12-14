import { useState, useEffect } from 'react'
import { Market } from '@/types/market'

interface UseGeotaggedMarketsOptions {
  platform?: 'kalshi' | 'polymarket' | 'all'
  category?: string
  country?: string
  region?: string
  confidence?: 'high' | 'medium' | 'low'
  search?: string
  limit?: number
  enabled?: boolean
}

interface GeotaggedMarketsResponse {
  markets: Market[]
  total: number
  hasMore: boolean
}

export function useGeotaggedMarkets(options: UseGeotaggedMarketsOptions = {}) {
  const {
    platform = 'all',
    category,
    country,
    region,
    confidence,
    search,
    limit = 2000,
    enabled = true
  } = options

  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const fetchMarkets = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Build query params
        const params = new URLSearchParams()

        if (platform && platform !== 'all') {
          params.set('platform', platform)
        }

        if (category) {
          params.set('category', category)
        }

        if (country) {
          params.set('country', country)
        }

        if (region) {
          params.set('region', region)
        }

        if (confidence) {
          params.set('confidence', confidence)
        }

        if (search) {
          params.set('search', search)
        }

        params.set('limit', limit.toString())

        const url = `/api/markets/geotagged?${params.toString()}`
        console.log('[useGeotaggedMarkets] Fetching:', url)

        const response = await fetch(url)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))

          if (response.status === 503 && errorData.instructions) {
            // Table doesn't exist - show helpful message
            console.error('[useGeotaggedMarkets] Database table not found:', errorData.message)
            console.error('[useGeotaggedMarkets] Instructions:', errorData.instructions)
            throw new Error('Database not set up. Please run migration first. Check console for details.')
          }

          throw new Error(`Failed to fetch geotagged markets: ${response.statusText}`)
        }

        const data: GeotaggedMarketsResponse = await response.json()

        console.log(`[useGeotaggedMarkets] Fetched ${data.markets.length} of ${data.total} markets`)

        setMarkets(data.markets)
        setTotal(data.total)
        setHasMore(data.hasMore)
      } catch (err: any) {
        console.error('[useGeotaggedMarkets] Error:', err)
        setError(err.message || 'Failed to fetch geotagged markets')
        setMarkets([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchMarkets()
  }, [platform, category, country, region, confidence, search, limit, enabled])

  return {
    markets,
    isLoading,
    error,
    total,
    hasMore
  }
}
