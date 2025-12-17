'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Market } from '@/types/market'
import { toast } from '@/hooks/use-toast'

const ALERTS_STORAGE_KEY = 'edgepannel_price_alerts'

export type AlertCondition = 'above' | 'below' | 'crosses'

export interface PriceAlert {
  id: string
  marketId: string
  platform: string
  marketTitle: string
  targetPrice: number
  condition: AlertCondition
  createdAt: number
  triggered: boolean
  triggeredAt?: number
}

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const lastPricesRef = useRef<Map<string, number>>(new Map())

  // Load alerts from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(ALERTS_STORAGE_KEY)
      if (stored) {
        setAlerts(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load alerts:', error)
    }
    setIsLoaded(true)
  }, [])

  // Save alerts to localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return
    
    try {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts))
    } catch (error) {
      console.error('Failed to save alerts:', error)
    }
  }, [alerts, isLoaded])

  const createAlert = useCallback((
    market: Market,
    targetPrice: number,
    condition: AlertCondition
  ) => {
    const newAlert: PriceAlert = {
      id: `${market.id}-${Date.now()}`,
      marketId: market.id,
      platform: market.platform,
      marketTitle: market.title,
      targetPrice,
      condition,
      createdAt: Date.now(),
      triggered: false,
    }

    setAlerts(prev => [...prev, newAlert])
    return newAlert
  }, [])

  const removeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }, [])

  const clearTriggeredAlerts = useCallback(() => {
    setAlerts(prev => prev.filter(alert => !alert.triggered))
  }, [])

  const clearAllAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  // Check alerts against current market prices
  const checkAlerts = useCallback((markets: Market[]) => {
    const triggeredAlerts: PriceAlert[] = []

    setAlerts(prev => {
      return prev.map(alert => {
        if (alert.triggered) return alert

        const market = markets.find(
          m => m.id === alert.marketId && m.platform === alert.platform
        )

        if (!market || market.price === undefined) return alert

        const currentPrice = market.price * 100
        const targetPrice = alert.targetPrice
        const key = `${alert.marketId}-${alert.platform}`
        const lastPrice = lastPricesRef.current.get(key)

        let shouldTrigger = false

        switch (alert.condition) {
          case 'above':
            shouldTrigger = currentPrice >= targetPrice
            break
          case 'below':
            shouldTrigger = currentPrice <= targetPrice
            break
          case 'crosses':
            if (lastPrice !== undefined) {
              shouldTrigger = 
                (lastPrice < targetPrice && currentPrice >= targetPrice) ||
                (lastPrice > targetPrice && currentPrice <= targetPrice)
            }
            break
        }

        // Update last price
        lastPricesRef.current.set(key, currentPrice)

        if (shouldTrigger) {
          triggeredAlerts.push(alert)
          return { ...alert, triggered: true, triggeredAt: Date.now() }
        }

        return alert
      })
    })

    // Show notifications for triggered alerts
    triggeredAlerts.forEach(alert => {
      const conditionText = {
        above: 'reached',
        below: 'dropped to',
        crosses: 'crossed',
      }[alert.condition]

      toast.info(
        `🔔 Price Alert Triggered`,
        `${alert.marketTitle.slice(0, 50)}... ${conditionText} ${alert.targetPrice}%`
      )
    })

    return triggeredAlerts
  }, [])

  const getAlertsForMarket = useCallback((marketId: string, platform: string) => {
    return alerts.filter(
      alert => alert.marketId === marketId && alert.platform === platform
    )
  }, [alerts])

  const activeAlerts = alerts.filter(alert => !alert.triggered)
  const triggeredAlerts = alerts.filter(alert => alert.triggered)

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    isLoaded,
    createAlert,
    removeAlert,
    clearTriggeredAlerts,
    clearAllAlerts,
    checkAlerts,
    getAlertsForMarket,
    activeAlertCount: activeAlerts.length,
    triggeredAlertCount: triggeredAlerts.length,
  }
}











