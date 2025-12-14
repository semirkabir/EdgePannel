'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { WhaleTrade, WhaleNotification, STORAGE_KEYS } from '@/types/whale-trade'
import { Market } from '@/types/market'
import { useWhaleAlerts } from './use-whale-alerts'
import { getInferenceEngine } from '@/lib/whale-trades/trade-inference'
import { getDispatcher } from '@/lib/notifications/whale-notification-dispatcher'
import { toast } from '@/hooks/use-toast'

interface UseWhaleTradesOptions {
  markets?: Market[]
  enabled?: boolean
}

const MAX_TRADES_IN_MEMORY = 500
const MAX_TRADES_IN_STORAGE = 100

export function useWhaleTrades(options: UseWhaleTradesOptions = {}) {
  const { markets = [], enabled = true } = options

  const [trades, setTrades] = useState<WhaleTrade[]>([])
  const [notifications, setNotifications] = useState<WhaleNotification[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const { alerts, settings, isLoaded: alertsLoaded } = useWhaleAlerts()
  const inferenceEngineRef = useRef(getInferenceEngine())
  const dispatcherRef = useRef(getDispatcher(settings))
  const marketMapRef = useRef<Map<string, Market>>(new Map())

  // Update market map when markets change
  useEffect(() => {
    const map = new Map<string, Market>()
    markets.forEach(market => {
      map.set(`${market.platform}:${market.id}`, market)
    })
    marketMapRef.current = map
  }, [markets])

  // Update dispatcher settings when they change
  useEffect(() => {
    if (alertsLoaded) {
      dispatcherRef.current.updateSettings(settings)
    }
  }, [settings, alertsLoaded])

  // Load notifications from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WHALE_NOTIFICATIONS)
      if (stored) {
        const loadedNotifications = JSON.parse(stored)
        setNotifications(loadedNotifications)
      }
    } catch (error) {
      console.error('Failed to load whale notifications:', error)
    }

    setIsLoaded(true)
  }, [])

  // Save notifications to localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return

    try {
      // Only save the most recent notifications
      const notificationsToSave = notifications.slice(0, MAX_TRADES_IN_STORAGE)
      localStorage.setItem(
        STORAGE_KEYS.WHALE_NOTIFICATIONS,
        JSON.stringify(notificationsToSave)
      )
    } catch (error) {
      console.error('Failed to save whale notifications:', error)
    }
  }, [notifications, isLoaded])

  // Set up toast function for dispatcher
  useEffect(() => {
    dispatcherRef.current.setToastFunction((title, description) => {
      toast.info(title, description)
    })

    dispatcherRef.current.setNotificationCallback((notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, MAX_TRADES_IN_STORAGE))
    })
  }, [])

  /**
   * Process a ticker update and check for whale trades
   */
  const processTicker = useCallback(
    async (
      platform: 'polymarket' | 'kalshi',
      marketId: string,
      price: number,
      volume: number
    ) => {
      if (!enabled || !alertsLoaded) return

      const enabledAlerts = alerts.filter(a => a.enabled)
      if (enabledAlerts.length === 0) return

      setIsProcessing(true)

      try {
        // Get market info
        const marketKey = `${platform}:${marketId}`
        const market = marketMapRef.current.get(marketKey)

        // Infer whale trade from ticker update
        const whaleTrade = inferenceEngineRef.current.inferFromTicker(
          {
            marketId,
            platform,
            price,
            volume,
            timestamp: Date.now(),
          },
          market
        )

        if (whaleTrade) {
          console.log('[useWhaleTrades] Whale trade detected:', whaleTrade)

          // Add to trades list
          setTrades(prev => [whaleTrade, ...prev].slice(0, MAX_TRADES_IN_MEMORY))

          // Check against all enabled alerts
          for (const alert of enabledAlerts) {
            if (matchesAlert(whaleTrade, alert)) {
              console.log('[useWhaleTrades] Trade matches alert, dispatching notification')
              await dispatcherRef.current.dispatch(whaleTrade, alert)
            }
          }
        }
      } catch (error) {
        console.error('[useWhaleTrades] Error processing ticker:', error)
      } finally {
        setIsProcessing(false)
      }
    },
    [enabled, alerts, alertsLoaded]
  )

  /**
   * Process a market update (convenience method)
   */
  const processMarketUpdate = useCallback(
    async (market: Market) => {
      if (!market.price || market.volume24h === undefined) return

      await processTicker(
        market.platform,
        market.id,
        market.price,
        market.volume24h
      )
    },
    [processTicker]
  )

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    )
  }, [])

  /**
   * Mark notification as dismissed
   */
  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, dismissed: true } : n))
    )
  }, [])

  /**
   * Clear all read notifications
   */
  const clearReadNotifications = useCallback(() => {
    setNotifications(prev => prev.filter(n => !n.read))
  }, [])

  /**
   * Clear all dismissed notifications
   */
  const clearDismissedNotifications = useCallback(() => {
    setNotifications(prev => prev.filter(n => !n.dismissed))
  }, [])

  /**
   * Clear all notifications
   */
  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  /**
   * Get recent trades
   */
  const recentTrades = trades.slice(0, 50)

  /**
   * Get unread notifications count
   */
  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length

  /**
   * Get undismissed notifications
   */
  const activeNotifications = notifications.filter(n => !n.dismissed)

  return {
    // State
    trades,
    recentTrades,
    notifications,
    activeNotifications,
    unreadCount,
    isProcessing,
    isLoaded,

    // Actions
    processTicker,
    processMarketUpdate,
    markAsRead,
    dismissNotification,
    clearReadNotifications,
    clearDismissedNotifications,
    clearAllNotifications,
  }
}

/**
 * Check if a whale trade matches an alert's criteria
 */
function matchesAlert(trade: WhaleTrade, alert: any): boolean {
  // Amount threshold
  if (trade.amountUSD < alert.thresholdUSD) {
    return false
  }

  // Minimum amount filter
  if (
    alert.filters.minAmount !== undefined &&
    trade.amountUSD < alert.filters.minAmount
  ) {
    return false
  }

  // Platform filter
  if (
    alert.filters.platforms &&
    alert.filters.platforms.length > 0 &&
    !alert.filters.platforms.includes(trade.platform)
  ) {
    return false
  }

  // Trade direction filter
  if (
    alert.filters.tradeDirection &&
    alert.filters.tradeDirection !== 'both' &&
    alert.filters.tradeDirection !== trade.tradeType
  ) {
    return false
  }

  // Specific markets filter
  if (
    alert.filters.specificMarkets &&
    alert.filters.specificMarkets.length > 0
  ) {
    if (!alert.filters.specificMarkets.includes(trade.marketId)) {
      return false
    }
  }

  // Market-specific alert check
  if (alert.marketId) {
    if (alert.marketId !== trade.marketId) {
      return false
    }
    if (alert.platform && alert.platform !== 'both' && alert.platform !== trade.platform) {
      return false
    }
  }

  return true
}
