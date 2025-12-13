'use client'

import { useState, useEffect, useCallback } from 'react'
import { mcpClient, MCPMarketData } from '@/lib/api/mcp-client'
import { Market } from '@/types/market'

interface UseMCPMarketsOptions {
  keywords?: string[]
  enabled?: boolean
  refreshInterval?: number
}

interface UseMCPMarketsReturn {
  markets: Market[]
  rawMCPMarkets: MCPMarketData[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * Hook to fetch and manage MCP market data
 * Integrates live data from the prediction-markets-mcp server
 */
export function useMCPMarkets(options: UseMCPMarketsOptions = {}): UseMCPMarketsReturn {
  const {
    keywords = [],
    enabled = true,
    refreshInterval = 30000, // 30 seconds default
  } = options

  const [markets, setMarkets] = useState<Market[]>([])
  const [rawMCPMarkets, setRawMCPMarkets] = useState<MCPMarketData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchMarkets = useCallback(async () => {
    if (!enabled || keywords.length === 0) {
      setMarkets([])
      setRawMCPMarkets([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('[useMCPMarkets] Fetching markets for keywords:', keywords)

      // Fetch from MCP
      const response = await mcpClient.getMarketsBatch(keywords)

      console.log(`[useMCPMarkets] Fetched ${response.markets.length} markets from MCP`)

      setRawMCPMarkets(response.markets)

      // Transform to internal Market format
      const transformedMarkets = mcpClient.transformMarkets(response.markets)
      setMarkets(transformedMarkets)

      console.log(`[useMCPMarkets] Transformed ${transformedMarkets.length} markets`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch MCP markets')
      console.error('[useMCPMarkets] Error fetching markets:', error)
      setError(error)
      setMarkets([])
      setRawMCPMarkets([])
    } finally {
      setIsLoading(false)
    }
  }, [keywords, enabled])

  // Initial fetch
  useEffect(() => {
    fetchMarkets()
  }, [fetchMarkets])

  // Auto-refresh interval
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return

    const interval = setInterval(() => {
      console.log('[useMCPMarkets] Auto-refreshing markets...')
      fetchMarkets()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [fetchMarkets, refreshInterval, enabled])

  return {
    markets,
    rawMCPMarkets,
    isLoading,
    error,
    refresh: fetchMarkets,
  }
}

/**
 * Hook to fetch MCP markets by a single keyword
 */
export function useMCPMarketsByKeyword(keyword: string, options: Omit<UseMCPMarketsOptions, 'keywords'> = {}) {
  return useMCPMarkets({
    ...options,
    keywords: keyword ? [keyword] : [],
  })
}

/**
 * Hook to fetch trending/popular markets from MCP
 */
export function useMCPTrendingMarkets(options: Omit<UseMCPMarketsOptions, 'keywords'> = {}) {
  // Common trending keywords for prediction markets
  const trendingKeywords = [
    'election',
    'trump',
    'biden',
    'president',
    'bitcoin',
    'ethereum',
    'supreme court',
  ]

  return useMCPMarkets({
    ...options,
    keywords: trendingKeywords,
  })
}
