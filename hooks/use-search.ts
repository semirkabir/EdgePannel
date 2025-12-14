'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import useSWR from 'swr'
import { Market } from '@/types/market'
import { EnrichedMarket } from '@/lib/markets/enrich'
import { useMarketWebSocket } from './use-market-websocket'

interface SearchParams {
  q?: string
  platform?: 'kalshi' | 'polymarket' | 'all'
  category?: string
  minProbability?: number
  maxProbability?: number
  limit?: number
  cursor?: string
  offset?: number
  sort?: 'volume' | 'relevance' | 'liquidity'
}

interface SearchResponse {
  markets: EnrichedMarket[]
  pagination: {
    hasMore: boolean
    nextCursor?: string | null
    nextOffset?: number | null
    total: number
  }
}

const fetcher = async (url: string): Promise<SearchResponse> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Search failed')
  }
  return res.json()
}

export function useSearch(params: SearchParams) {
  const [debouncedParams, setDebouncedParams] = useState<SearchParams>(params)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounce search query - use ref for timer to avoid stale closures
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const delay = params.q ? 300 : 0
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedParams(params)
    }, delay)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [params.q, params.platform, params.category, params.minProbability, params.maxProbability, params.limit, params.sort])

  // Build search URL
  const searchUrl = useCallback(() => {
    if (typeof window === 'undefined') return null

    // Use a dummy base for URL construction, then extract relative path + query
    const baseUrl = 'http://localhost'
    const url = new URL('/api/markets/search', baseUrl)

    if (debouncedParams.q) url.searchParams.set('q', debouncedParams.q)
    if (debouncedParams.platform && debouncedParams.platform !== 'all') {
      url.searchParams.set('platform', debouncedParams.platform)
    }
    if (debouncedParams.category) url.searchParams.set('category', debouncedParams.category)
    if (debouncedParams.minProbability !== undefined) {
      url.searchParams.set('minProbability', String(debouncedParams.minProbability))
    }
    if (debouncedParams.maxProbability !== undefined) {
      url.searchParams.set('maxProbability', String(debouncedParams.maxProbability))
    }
    if (debouncedParams.limit) url.searchParams.set('limit', String(debouncedParams.limit))
    if (debouncedParams.cursor) url.searchParams.set('cursor', debouncedParams.cursor)
    if (debouncedParams.offset !== undefined) {
      url.searchParams.set('offset', String(debouncedParams.offset))
    }
    if (debouncedParams.sort) url.searchParams.set('sort', debouncedParams.sort)

    // Return relative path and query string
    return url.pathname + url.search
  }, [debouncedParams])

  const url = searchUrl()
  const { data, error, isLoading, mutate } = useSWR<SearchResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 1000,
    }
  )

  const rawMarkets = data?.markets ?? []

  // WebSocket Integration for Live Search Results
  // Only watch the top 50 to avoid overloading sockets if list is huge
  const marketIds = useMemo(() => {
    return rawMarkets.slice(0, 50).map(m => m.id)
  }, [rawMarkets])

  const { getMarketUpdate } = useMarketWebSocket({
    watchlistMarketIds: marketIds,
    markets: rawMarkets
  })

  // Merge live updates
  const liveMarkets = useMemo(() => {
    if (!rawMarkets.length) return rawMarkets

    return rawMarkets.map(m => {
      const update = getMarketUpdate(m.id)
      if (update) {
        return {
          ...m,
          price: update.price ?? m.price,
          volume24h: update.volume24h ?? m.volume24h,
          probability: update.price ?? m.probability,
        }
      }
      return m
    })
  }, [rawMarkets, getMarketUpdate])

  const loadMore = useCallback(() => {
    if (!data?.pagination.hasMore) return

    // TODO: Implement pagination using SWR infinite if needed
    // For now, simple mutation trigger
    mutate()
  }, [data, mutate])

  return {
    markets: liveMarkets,
    isLoading,
    isError: !!error,
    error,
    hasMore: data?.pagination.hasMore ?? false,
    total: data?.pagination.total ?? 0,
    loadMore,
    refresh: mutate,
  }
}
