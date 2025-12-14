// Whale Notification Dispatcher - Multi-channel notification delivery

import { WhaleTrade, WhaleTradeAlert, WhaleNotification, WhaleTradeSettings } from '@/types/whale-trade'
import { getDeduplicator } from '@/lib/whale-trades/deduplication'
import { getRateLimiter } from '@/lib/whale-trades/rate-limiter'

// Toast function type (will be injected)
type ToastFunction = (title: string, description: string) => void

export class WhaleNotificationDispatcher {
  private toastFn: ToastFunction | null = null
  private onNotificationCreated: ((notification: WhaleNotification) => void) | null = null

  constructor(private settings: WhaleTradeSettings) {}

  /**
   * Set the toast function (injected from React hook)
   */
  setToastFunction(fn: ToastFunction): void {
    this.toastFn = fn
  }

  /**
   * Set notification created callback (for notification center)
   */
  setNotificationCallback(fn: (notification: WhaleNotification) => void): void {
    this.onNotificationCreated = fn
  }

  /**
   * Update settings
   */
  updateSettings(settings: WhaleTradeSettings): void {
    this.settings = settings
  }

  /**
   * Dispatch a whale trade notification through all enabled channels
   */
  async dispatch(trade: WhaleTrade, alert: WhaleTradeAlert): Promise<void> {
    // 1. Deduplication check
    const deduplicator = getDeduplicator(this.settings.deduplicationWindowMs)
    if (deduplicator.isDuplicate(trade)) {
      console.log('[WhaleDispatcher] Duplicate trade detected, skipping:', trade.id)
      return
    }

    // 2. Rate limiting check
    const rateLimiter = getRateLimiter(
      this.settings.maxNotificationsPerMinute,
      30000 // 30s per-market cooldown
    )

    if (!rateLimiter.canNotifyForMarket(trade.marketId, trade.platform)) {
      console.log('[WhaleDispatcher] Rate limited, skipping:', trade.id)
      return
    }

    // 3. Create notification object
    const notification: WhaleNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'whale_trade',
      trade,
      alert,
      timestamp: Date.now(),
      read: false,
      dismissed: false,
    }

    // 4. Record notification sent
    rateLimiter.recordNotification(trade.marketId, trade.platform)

    // 5. Dispatch to all enabled channels in parallel
    const dispatchPromises: Promise<void>[] = []

    if (this.settings.enableToasts) {
      dispatchPromises.push(this.dispatchToast(notification))
    }

    if (this.settings.enableBrowserNotifications) {
      dispatchPromises.push(this.dispatchBrowser(notification))
    }

    if (this.settings.enableNotificationCenter) {
      dispatchPromises.push(this.dispatchNotificationCenter(notification))
    }

    if (this.settings.enableLiveFeed) {
      dispatchPromises.push(this.dispatchLiveFeed(notification))
    }

    // Wait for all dispatches (ignore errors per channel)
    await Promise.allSettled(dispatchPromises)

    console.log('[WhaleDispatcher] Notification dispatched:', {
      trade: trade.id,
      amount: trade.amountUSD,
      market: trade.marketTitle,
    })
  }

  /**
   * Dispatch toast notification
   */
  private async dispatchToast(notification: WhaleNotification): Promise<void> {
    if (!this.toastFn) {
      console.warn('[WhaleDispatcher] Toast function not set')
      return
    }

    const { trade } = notification
    const amountFormatted = this.formatAmount(trade.amountUSD)
    const tradeTypeEmoji = trade.tradeType === 'buy' ? '🟢' : '🔴'

    const title = `${tradeTypeEmoji} Whale Trade Alert`
    const description = `$${amountFormatted} ${trade.tradeType.toUpperCase()} on ${trade.marketTitle.slice(0, 60)}${trade.marketTitle.length > 60 ? '...' : ''}`

    try {
      this.toastFn(title, description)
    } catch (error) {
      console.error('[WhaleDispatcher] Toast dispatch failed:', error)
    }
  }

  /**
   * Dispatch browser notification
   */
  private async dispatchBrowser(notification: WhaleNotification): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    // Check permission
    if (Notification.permission !== 'granted') {
      console.log('[WhaleDispatcher] Browser notification permission not granted')
      return
    }

    const { trade } = notification
    const amountFormatted = this.formatAmount(trade.amountUSD)

    try {
      const browserNotification = new Notification('Whale Trade Alert', {
        body: `$${amountFormatted} ${trade.tradeType.toUpperCase()} on ${trade.marketTitle}`,
        icon: '/icons/whale-icon.png',
        badge: '/icons/badge.png',
        tag: trade.id,
        requireInteraction: false,
        silent: !this.settings.soundEnabled,
      })

      browserNotification.onclick = () => {
        window.focus()
        // TODO: Navigate to market details
        window.dispatchEvent(
          new CustomEvent('whale-trade-click', { detail: trade })
        )
      }
    } catch (error) {
      console.error('[WhaleDispatcher] Browser notification failed:', error)
    }
  }

  /**
   * Dispatch to notification center
   */
  private async dispatchNotificationCenter(
    notification: WhaleNotification
  ): Promise<void> {
    if (this.onNotificationCreated) {
      this.onNotificationCreated(notification)
    }
  }

  /**
   * Dispatch to live feed
   */
  private async dispatchLiveFeed(notification: WhaleNotification): Promise<void> {
    // Live feed will subscribe to notification events via custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('whale-trade-notification', { detail: notification })
      )
    }
  }

  /**
   * Format USD amount with commas
   */
  private formatAmount(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toFixed(0)
  }

  /**
   * Request browser notification permission
   */
  static async requestBrowserPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  /**
   * Get browser notification permission status
   */
  static getBrowserPermission(): NotificationPermission | null {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return null
    }
    return Notification.permission
  }
}

// Global singleton instance
let dispatcher: WhaleNotificationDispatcher | null = null

export function getDispatcher(settings: WhaleTradeSettings): WhaleNotificationDispatcher {
  if (!dispatcher) {
    dispatcher = new WhaleNotificationDispatcher(settings)
  } else {
    dispatcher.updateSettings(settings)
  }
  return dispatcher
}

export function resetDispatcher(): void {
  dispatcher = null
}
