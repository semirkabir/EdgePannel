'use client'

import { useState, useEffect, useCallback } from 'react'
import { Market } from '@/types/market'

const WATCHLIST_STORAGE_KEY = 'edgepannel_watchlist'

export interface WatchlistItem {
  marketId: string
  platform: string
  addedAt: number
  notes?: string
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load watchlist from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY)
      if (stored) {
        setWatchlist(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error)
    }
    setIsLoaded(true)
  }, [])

  // Save watchlist to localStorage when it changes
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return
    
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist))
    } catch (error) {
      console.error('Failed to save watchlist:', error)
    }
  }, [watchlist, isLoaded])

  const addToWatchlist = useCallback((market: Market, notes?: string) => {
    setWatchlist(prev => {
      // Check if already in watchlist
      if (prev.some(item => item.marketId === market.id && item.platform === market.platform)) {
        return prev
      }
      
      return [...prev, {
        marketId: market.id,
        platform: market.platform,
        addedAt: Date.now(),
        notes,
      }]
    })
  }, [])

  const removeFromWatchlist = useCallback((marketId: string, platform: string) => {
    setWatchlist(prev => 
      prev.filter(item => !(item.marketId === marketId && item.platform === platform))
    )
  }, [])

  const isInWatchlist = useCallback((marketId: string, platform: string) => {
    return watchlist.some(item => item.marketId === marketId && item.platform === platform)
  }, [watchlist])

  const updateNotes = useCallback((marketId: string, platform: string, notes: string) => {
    setWatchlist(prev => 
      prev.map(item => 
        item.marketId === marketId && item.platform === platform
          ? { ...item, notes }
          : item
      )
    )
  }, [])

  const clearWatchlist = useCallback(() => {
    setWatchlist([])
  }, [])

  const getWatchlistMarkets = useCallback((allMarkets: Market[]) => {
    return allMarkets.filter(market => 
      watchlist.some(item => item.marketId === market.id && item.platform === market.platform)
    )
  }, [watchlist])

  return {
    watchlist,
    isLoaded,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    updateNotes,
    clearWatchlist,
    getWatchlistMarkets,
    watchlistCount: watchlist.length,
  }
}





