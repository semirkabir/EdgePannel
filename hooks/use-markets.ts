'use client'

import useSWR from 'swr'
import { Market, MarketComparison } from '@/types/market'

// API response types
interface MarketsResponse {
  markets: Market[]
  breakingNews: Market[]
  livePredictions: Market[]
  categories: string[]
  stats: {
    total: number
    byPlatform: Record<string, number>
    byCategory: Record<string, number>
  }
}

interface ComparisonsResponse {
  comparisons: MarketComparison[]
}

interface ApiKeysResponse {
  apiKeys: Array<{
    platform: string
    isActive: boolean
  }>
}

// Fetcher with error handling
const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
      // Attach extra info to the error object
      ; (error as any).info = await res.json().catch(() => ({}))
      ; (error as any).status = res.status
    throw error
  }

  return res.json()
}

// SWR configuration for markets - reduced polling interval (WebSocket handles real-time updates)
const MARKETS_CONFIG = {
  refreshInterval: 60000, // 60 seconds (reduced from 30s - WebSocket handles real-time)
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 15000, // Dedupe requests within 15 seconds
  errorRetryCount: 3,
  errorRetryInterval: 5000,
}

// SWR configuration for comparisons - refresh every 60 seconds
const COMPARISONS_CONFIG = {
  refreshInterval: 60000, // 60 seconds
  revalidateOnFocus: false,
  dedupingInterval: 10000,
}

// SWR configuration for API keys - less frequent updates
const API_KEYS_CONFIG = {
  refreshInterval: 0, // Don't auto-refresh
  revalidateOnFocus: true,
  dedupingInterval: 30000,
}

/**
 * Hook to fetch all markets data with SWR caching
 */
export function useMarkets() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<MarketsResponse>(
    '/api/markets/all?limit=500',
    fetcher,
    MARKETS_CONFIG
  )

  return {
    markets: data?.markets ?? [],
    breakingNews: data?.breakingNews ?? [],
    livePredictions: data?.livePredictions ?? [],
    categories: data?.categories ?? [],
    stats: data?.stats ?? { total: 0, byPlatform: {}, byCategory: {} },
    isLoading,
    isValidating, // True when revalidating in background
    isError: !!error,
    error,
    refresh: mutate, // Manual refresh function
  }
}

/**
 * Hook to fetch market comparisons with SWR caching
 */
export function useComparisons() {
  const { data, error, isLoading, mutate } = useSWR<ComparisonsResponse>(
    '/api/markets/compare',
    fetcher,
    COMPARISONS_CONFIG
  )

  return {
    comparisons: data?.comparisons ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  }
}

/**
 * Hook to fetch API keys status
 */
export function useApiKeys() {
  const { data, error, isLoading, mutate } = useSWR<ApiKeysResponse>(
    '/api/debug/api-keys',
    fetcher,
    API_KEYS_CONFIG
  )

  return {
    apiKeys: data?.apiKeys ?? [],
    hasPolymarket: data?.apiKeys?.some(k => k.platform === 'polymarket') ?? false,
    hasKalshi: data?.apiKeys?.some(k => k.platform === 'kalshi') ?? false,
    isLoading,
    isError: !!error,
    refresh: mutate,
  }
}

/**
 * Hook to fetch user's saved API keys for settings page
 */
export function useUserApiKeys() {
  const { data, error, isLoading, mutate } = useSWR<{ apiKeys: any[] }>(
    '/api/user/api-keys',
    fetcher,
    API_KEYS_CONFIG
  )

  return {
    apiKeys: data?.apiKeys ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  }
}

/**
 * Prefetch markets data (useful for preloading)
 */
export function prefetchMarkets() {
  return fetcher<MarketsResponse>('/api/markets/all')
}
