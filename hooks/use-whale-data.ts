import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'

interface WhaleHolder {
  address: string
  amount: number
  outcome: string
  percentage: number
}

interface WhaleTrade {
  id: string
  market: string
  asset: string
  side: string
  size: number
  price: number
  value: number
  timestamp: string
  trader: string
}

interface WhaleAlert {
  type: 'holder' | 'trade'
  timestamp: Date
  data: WhaleHolder | WhaleTrade
  market: string
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface UseWhaleDataOptions {
  market?: string
  minTradeSize?: number
  refreshInterval?: number
  alertThreshold?: {
    holderPercentage?: number
    tradeValue?: number
  }
}

export function useWhaleData(options: UseWhaleDataOptions = {}) {
  const {
    market,
    minTradeSize = 10000,
    refreshInterval = 10000, // 10 seconds for whale tracking
    alertThreshold = {
      holderPercentage: 5, // Alert if holder has >5%
      tradeValue: 10000 // Alert if trade >$10k
    }
  } = options

  const [alerts, setAlerts] = useState<WhaleAlert[]>([])
  const [newAlertCount, setNewAlertCount] = useState(0)

  // Fetch top holders
  const { data: holdersData, error: holdersError } = useSWR(
    market ? `/api/whales/holders?market=${market}&limit=100` : null,
    fetcher,
    { refreshInterval }
  )

  // Fetch whale trades
  const { data: tradesData, error: tradesError } = useSWR(
    market ? `/api/whales/trades?market=${market}&minSize=${minTradeSize}&limit=50` : null,
    fetcher,
    { refreshInterval }
  )

  // Process holders for alerts
  useEffect(() => {
    if (!holdersData?.holders) return

    const whaleHolders = holdersData.holders.filter((h: WhaleHolder) =>
      h.percentage >= (alertThreshold.holderPercentage || 5)
    )

    const newHolderAlerts: WhaleAlert[] = whaleHolders.map((holder: WhaleHolder) => ({
      type: 'holder' as const,
      timestamp: new Date(),
      data: holder,
      market: market || ''
    }))

    // Only add new alerts (check if holder already exists)
    setAlerts(prev => {
      const existingAddresses = new Set(
        prev
          .filter(a => a.type === 'holder')
          .map(a => (a.data as WhaleHolder).address)
      )

      const trulyNewAlerts = newHolderAlerts.filter(
        alert => !existingAddresses.has((alert.data as WhaleHolder).address)
      )

      if (trulyNewAlerts.length > 0) {
        setNewAlertCount(n => n + trulyNewAlerts.length)
        return [...prev, ...trulyNewAlerts].slice(-100) // Keep last 100 alerts
      }

      return prev
    })
  }, [holdersData, market, alertThreshold.holderPercentage])

  // Process trades for alerts
  useEffect(() => {
    if (!tradesData?.trades) return

    const whaleTrades = tradesData.trades.filter((t: WhaleTrade) =>
      t.value >= (alertThreshold.tradeValue || 10000)
    )

    const newTradeAlerts: WhaleAlert[] = whaleTrades.map((trade: WhaleTrade) => ({
      type: 'trade' as const,
      timestamp: new Date(trade.timestamp),
      data: trade,
      market: market || trade.market
    }))

    // Only add new alerts (check by trade ID)
    setAlerts(prev => {
      const existingTradeIds = new Set(
        prev
          .filter(a => a.type === 'trade')
          .map(a => (a.data as WhaleTrade).id)
      )

      const trulyNewAlerts = newTradeAlerts.filter(
        alert => !existingTradeIds.has((alert.data as WhaleTrade).id)
      )

      if (trulyNewAlerts.length > 0) {
        setNewAlertCount(n => n + trulyNewAlerts.length)
        return [...prev, ...trulyNewAlerts].slice(-100)
      }

      return prev
    })
  }, [tradesData, market, alertThreshold.tradeValue])

  const clearAlerts = useCallback(() => {
    setAlerts([])
    setNewAlertCount(0)
  }, [])

  const markAsSeen = useCallback(() => {
    setNewAlertCount(0)
  }, [])

  const getRecentAlerts = useCallback((minutes: number = 5) => {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000)
    return alerts.filter(alert => alert.timestamp >= cutoff)
  }, [alerts])

  return {
    alerts,
    newAlertCount,
    holders: holdersData?.holders || [],
    trades: tradesData?.trades || [],
    loading: !holdersData && !tradesData,
    error: holdersError || tradesError,
    clearAlerts,
    markAsSeen,
    getRecentAlerts
  }
}
