'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import useSWR from 'swr'
import { Market } from '@/types/market'

interface SearchParams {
  q?: string
  platform?: 'kalshi' | 'polymarket' | 'all'
  category?: string
  minProbability?: number
  maxProbability?: number
  limit?: number
  cursor?: string
  offset?: number
}

interface SearchResponse {
  markets: Market[]
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
  }, [params.q, params.platform, params.category, params.minProbability, params.maxProbability, params.limit])

  // Build search URL
  const searchUrl = useCallback(() => {
    if (!debouncedParams.q && !debouncedParams.platform && !debouncedParams.category) {
      return null // Don't search if no params
    }

    const url = new URL('/api/markets/search', window.location.origin)
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

    return url.toString()
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

  const loadMore = useCallback(() => {
    if (!data?.pagination.hasMore) return

    const nextParams: SearchParams = {
      ...debouncedParams,
      cursor: data.pagination.nextCursor || undefined,
      offset: data.pagination.nextOffset || undefined,
    }

    // TODO: Implement pagination loading
    // This would require appending to existing results
    mutate()
  }, [data, debouncedParams, mutate])

  return {
    markets: data?.markets ?? [],
    isLoading,
    isError: !!error,
    error,
    hasMore: data?.pagination.hasMore ?? false,
    total: data?.pagination.total ?? 0,
    loadMore,
    refresh: mutate,
  }
}

