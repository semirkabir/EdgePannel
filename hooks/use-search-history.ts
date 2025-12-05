'use client'

import { useState, useEffect, useCallback } from 'react'

const SEARCH_HISTORY_KEY = 'edgepannel_search_history'
const MAX_HISTORY_ITEMS = 10

export interface SearchHistoryItem {
  query: string
  timestamp: number
  resultCount?: number
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load history from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (stored) {
        setHistory(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load search history:', error)
    }
    setIsLoaded(true)
  }, [])

  // Save history to localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return
    
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('Failed to save search history:', error)
    }
  }, [history, isLoaded])

  const addSearch = useCallback((query: string, resultCount?: number) => {
    if (!query.trim()) return

    setHistory(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(
        item => item.query.toLowerCase() !== query.toLowerCase()
      )

      // Add new item at the beginning
      const newHistory = [
        { query: query.trim(), timestamp: Date.now(), resultCount },
        ...filtered,
      ].slice(0, MAX_HISTORY_ITEMS)

      return newHistory
    })
  }, [])

  const removeSearch = useCallback((query: string) => {
    setHistory(prev => 
      prev.filter(item => item.query.toLowerCase() !== query.toLowerCase())
    )
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const getRecentSearches = useCallback((limit: number = 5) => {
    return history.slice(0, limit)
  }, [history])

  return {
    history,
    isLoaded,
    addSearch,
    removeSearch,
    clearHistory,
    getRecentSearches,
    historyCount: history.length,
  }
}

