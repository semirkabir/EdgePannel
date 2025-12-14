'use client'

import { useState, useCallback } from 'react'
import { useNotifications } from './use-notifications'

interface Position {
  ticker?: string
  marketId: string
  marketTitle?: string
  size: number
  entryPrice?: number
  currentPrice?: number
  realizedPnl?: number
  unrealizedPnl?: number
}

interface SaveSnapshotParams {
  userId: string
  platform: 'kalshi' | 'polymarket' | 'combined'
  totalValue: number
  totalPnl: number
  totalExposure?: number
  positionCount: number
  positions?: Position[]
}

interface UsePortfolioSnapshotOptions {
  autoSaveInterval?: number // in milliseconds, 0 to disable
  notifyOnSave?: boolean
}

export function usePortfolioSnapshot(options: UsePortfolioSnapshotOptions = {}) {
  const {
    autoSaveInterval = 0, // Disabled by default
    notifyOnSave = false
  } = options

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const { notifySuccess, notifyError } = useNotifications({ enableBrowserNotifications: false })

  const saveSnapshot = useCallback(async (params: SaveSnapshotParams) => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/analytics/save-snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save snapshot')
      }

      const data = await response.json()
      setLastSaved(new Date(data.snapshot.createdAt))

      if (notifyOnSave) {
        notifySuccess(
          'Portfolio Saved',
          `Snapshot saved: $${params.totalValue.toFixed(2)} (${params.positionCount} positions)`,
          { duration: 3000 }
        )
      }

      return data.snapshot
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error'
      setError(errorMessage)

      if (notifyOnSave) {
        notifyError(
          'Save Failed',
          `Failed to save portfolio snapshot: ${errorMessage}`,
          { duration: 5000 }
        )
      }

      throw err
    } finally {
      setSaving(false)
    }
  }, [notifyOnSave, notifySuccess, notifyError])

  const checkSnapshots = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`/api/analytics/save-snapshot?userId=${userId}`)

      if (!response.ok) {
        throw new Error('Failed to check snapshots')
      }

      return await response.json()
    } catch (err: any) {
      console.error('[usePortfolioSnapshot] Error checking snapshots:', err)
      return {
        hasSnapshots: false,
        snapshotCount: 0,
        latestSnapshot: null
      }
    }
  }, [])

  // Auto-save functionality
  // Note: Actual auto-save implementation would require useEffect with interval
  // and portfolio data passed to the hook. This is left as an exercise for the integrator.
  const enableAutoSave = useCallback((
    getPortfolioData: () => Promise<SaveSnapshotParams>
  ) => {
    if (autoSaveInterval <= 0) return () => {}

    const interval = setInterval(async () => {
      try {
        const portfolioData = await getPortfolioData()
        await saveSnapshot(portfolioData)
      } catch (err) {
        console.error('[usePortfolioSnapshot] Auto-save error:', err)
      }
    }, autoSaveInterval)

    return () => clearInterval(interval)
  }, [autoSaveInterval, saveSnapshot])

  return {
    saveSnapshot,
    checkSnapshots,
    enableAutoSave,
    saving,
    error,
    lastSaved
  }
}
