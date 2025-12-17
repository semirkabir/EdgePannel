'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Market } from '@/types/market'

const PORTFOLIO_STORAGE_KEY = 'edgepannel_portfolio'

export interface Position {
  id: string
  marketId: string
  platform: string
  marketTitle: string
  side: 'yes' | 'no'
  quantity: number
  avgPrice: number // Average entry price (0-1)
  createdAt: number
  updatedAt: number
}

export interface PortfolioStats {
  totalPositions: number
  totalInvested: number
  currentValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
}

export function usePortfolio() {
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load positions from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY)
      if (stored) {
        setPositions(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load portfolio:', error)
    }
    setIsLoaded(true)
  }, [])

  // Save positions to localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return
    
    try {
      localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(positions))
    } catch (error) {
      console.error('Failed to save portfolio:', error)
    }
  }, [positions, isLoaded])

  const addPosition = useCallback((
    market: Market,
    side: 'yes' | 'no',
    quantity: number,
    price: number
  ) => {
    setPositions(prev => {
      // Check if position already exists
      const existingIndex = prev.findIndex(
        p => p.marketId === market.id && p.platform === market.platform && p.side === side
      )

      if (existingIndex >= 0) {
        // Update existing position with weighted average price
        const existing = prev[existingIndex]
        const totalQuantity = existing.quantity + quantity
        const newAvgPrice = 
          (existing.avgPrice * existing.quantity + price * quantity) / totalQuantity

        const updated = [...prev]
        updated[existingIndex] = {
          ...existing,
          quantity: totalQuantity,
          avgPrice: newAvgPrice,
          updatedAt: Date.now(),
        }
        return updated
      }

      // Create new position
      const newPosition: Position = {
        id: `${market.id}-${side}-${Date.now()}`,
        marketId: market.id,
        platform: market.platform,
        marketTitle: market.title,
        side,
        quantity,
        avgPrice: price,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      return [...prev, newPosition]
    })
  }, [])

  const updatePosition = useCallback((positionId: string, updates: Partial<Position>) => {
    setPositions(prev =>
      prev.map(position =>
        position.id === positionId
          ? { ...position, ...updates, updatedAt: Date.now() }
          : position
      )
    )
  }, [])

  const closePosition = useCallback((positionId: string, quantity?: number) => {
    setPositions(prev => {
      return prev.map(position => {
        if (position.id !== positionId) return position
        
        if (quantity && quantity < position.quantity) {
          // Partial close
          return {
            ...position,
            quantity: position.quantity - quantity,
            updatedAt: Date.now(),
          }
        }
        
        // Full close - mark for removal
        return null as any
      }).filter(Boolean)
    })
  }, [])

  const removePosition = useCallback((positionId: string) => {
    setPositions(prev => prev.filter(p => p.id !== positionId))
  }, [])

  const clearPortfolio = useCallback(() => {
    setPositions([])
  }, [])

  // Calculate portfolio stats with current market prices
  const calculateStats = useCallback((markets: Market[]): PortfolioStats => {
    let totalInvested = 0
    let currentValue = 0

    positions.forEach(position => {
      const market = markets.find(
        m => m.id === position.marketId && m.platform === position.platform
      )

      const invested = position.quantity * position.avgPrice
      totalInvested += invested

      if (market?.price !== undefined) {
        // For "yes" positions, current value is based on market price
        // For "no" positions, current value is based on (1 - market price)
        const currentPrice = position.side === 'yes' ? market.price : (1 - market.price)
        currentValue += position.quantity * currentPrice
      } else {
        // If no current price, assume break-even
        currentValue += invested
      }
    })

    const unrealizedPnL = currentValue - totalInvested
    const unrealizedPnLPercent = totalInvested > 0 
      ? (unrealizedPnL / totalInvested) * 100 
      : 0

    return {
      totalPositions: positions.length,
      totalInvested,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent,
    }
  }, [positions])

  const getPositionsForMarket = useCallback((marketId: string, platform: string) => {
    return positions.filter(
      p => p.marketId === marketId && p.platform === platform
    )
  }, [positions])

  // Get positions with current P&L calculations
  const getPositionsWithPnL = useCallback((markets: Market[]) => {
    return positions.map(position => {
      const market = markets.find(
        m => m.id === position.marketId && m.platform === position.platform
      )

      const invested = position.quantity * position.avgPrice
      let currentPrice = position.avgPrice // Default to entry price
      let currentValue = invested
      let pnl = 0
      let pnlPercent = 0

      if (market?.price !== undefined) {
        currentPrice = position.side === 'yes' ? market.price : (1 - market.price)
        currentValue = position.quantity * currentPrice
        pnl = currentValue - invested
        pnlPercent = (pnl / invested) * 100
      }

      return {
        ...position,
        currentPrice,
        currentValue,
        invested,
        pnl,
        pnlPercent,
        market,
      }
    })
  }, [positions])

  return {
    positions,
    isLoaded,
    addPosition,
    updatePosition,
    closePosition,
    removePosition,
    clearPortfolio,
    calculateStats,
    getPositionsForMarket,
    getPositionsWithPnL,
    positionCount: positions.length,
  }
}











