'use client'

import { useState, useEffect, useCallback } from 'react'
import { WhaleTradeAlert, WhaleTradeSettings, STORAGE_KEYS, DEFAULT_WHALE_SETTINGS } from '@/types/whale-trade'

export function useWhaleAlerts() {
  const [alerts, setAlerts] = useState<WhaleTradeAlert[]>([])
  const [settings, setSettings] = useState<WhaleTradeSettings>(DEFAULT_WHALE_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load alerts and settings from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      // Load alerts
      const storedAlerts = localStorage.getItem(STORAGE_KEYS.WHALE_ALERTS)
      if (storedAlerts) {
        setAlerts(JSON.parse(storedAlerts))
      }

      // Load settings
      const storedSettings = localStorage.getItem(STORAGE_KEYS.WHALE_SETTINGS)
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings))
      }
    } catch (error) {
      console.error('Failed to load whale alerts:', error)
    }

    setIsLoaded(true)
  }, [])

  // Save alerts to localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEYS.WHALE_ALERTS, JSON.stringify(alerts))
    } catch (error) {
      console.error('Failed to save whale alerts:', error)
    }
  }, [alerts, isLoaded])

  // Save settings to localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEYS.WHALE_SETTINGS, JSON.stringify(settings))
    } catch (error) {
      console.error('Failed to save whale settings:', error)
    }
  }, [settings, isLoaded])

  /**
   * Create a new whale trade alert
   */
  const createAlert = useCallback((
    thresholdUSD: number,
    filters: WhaleTradeAlert['filters'],
    marketId?: string,
    platform?: 'polymarket' | 'kalshi' | 'both'
  ): WhaleTradeAlert => {
    const newAlert: WhaleTradeAlert = {
      id: `whale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      marketId,
      platform,
      thresholdUSD,
      filters,
      createdAt: Date.now(),
      enabled: true,
    }

    setAlerts(prev => [...prev, newAlert])
    return newAlert
  }, [])

  /**
   * Create a global whale alert (applies to all markets)
   */
  const createGlobalAlert = useCallback((
    thresholdUSD: number,
    filters: WhaleTradeAlert['filters']
  ): WhaleTradeAlert => {
    return createAlert(thresholdUSD, filters)
  }, [createAlert])

  /**
   * Create a market-specific whale alert
   */
  const createMarketAlert = useCallback((
    marketId: string,
    platform: 'polymarket' | 'kalshi',
    thresholdUSD: number,
    filters: WhaleTradeAlert['filters']
  ): WhaleTradeAlert => {
    return createAlert(thresholdUSD, filters, marketId, platform)
  }, [createAlert])

  /**
   * Update an existing alert
   */
  const updateAlert = useCallback((
    alertId: string,
    updates: Partial<Omit<WhaleTradeAlert, 'id' | 'createdAt'>>
  ) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, ...updates } : alert
      )
    )
  }, [])

  /**
   * Toggle alert enabled/disabled
   */
  const toggleAlert = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, enabled: !alert.enabled } : alert
      )
    )
  }, [])

  /**
   * Remove an alert
   */
  const removeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }, [])

  /**
   * Clear all alerts
   */
  const clearAllAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  /**
   * Get alerts for a specific market
   */
  const getAlertsForMarket = useCallback((
    marketId: string,
    platform: string
  ): WhaleTradeAlert[] => {
    return alerts.filter(
      alert =>
        alert.enabled &&
        ((alert.marketId === marketId && alert.platform === platform) ||
          !alert.marketId) // Include global alerts
    )
  }, [alerts])

  /**
   * Get all enabled alerts
   */
  const getEnabledAlerts = useCallback((): WhaleTradeAlert[] => {
    return alerts.filter(alert => alert.enabled)
  }, [alerts])

  /**
   * Update settings
   */
  const updateSettings = useCallback((
    updates: Partial<WhaleTradeSettings>
  ) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Reset settings to defaults
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_WHALE_SETTINGS)
  }, [])

  /**
   * Check if there are any enabled alerts
   */
  const hasEnabledAlerts = alerts.some(alert => alert.enabled)

  /**
   * Get count of alerts by type
   */
  const alertCounts = {
    total: alerts.length,
    enabled: alerts.filter(a => a.enabled).length,
    disabled: alerts.filter(a => !a.enabled).length,
    global: alerts.filter(a => !a.marketId).length,
    marketSpecific: alerts.filter(a => a.marketId).length,
  }

  return {
    // State
    alerts,
    settings,
    isLoaded,
    hasEnabledAlerts,
    alertCounts,

    // Alert CRUD operations
    createAlert,
    createGlobalAlert,
    createMarketAlert,
    updateAlert,
    toggleAlert,
    removeAlert,
    clearAllAlerts,
    getAlertsForMarket,
    getEnabledAlerts,

    // Settings operations
    updateSettings,
    resetSettings,
  }
}
