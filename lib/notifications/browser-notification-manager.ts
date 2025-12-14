// Browser Notification Manager - Native browser notification handling

import { WhaleTrade } from '@/types/whale-trade'

export class BrowserNotificationManager {
  private permissionStatus: NotificationPermission = 'default'

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permissionStatus = Notification.permission
    }
  }

  /**
   * Request browser notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[BrowserNotificationManager] Notifications not supported')
      return false
    }

    if (this.permissionStatus === 'granted') {
      return true
    }

    if (this.permissionStatus === 'denied') {
      console.warn('[BrowserNotificationManager] Notification permission denied')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      this.permissionStatus = permission
      return permission === 'granted'
    } catch (error) {
      console.error('[BrowserNotificationManager] Failed to request permission:', error)
      return false
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window
  }

  /**
   * Check if permission is granted
   */
  isGranted(): boolean {
    return this.permissionStatus === 'granted'
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    return this.permissionStatus
  }

  /**
   * Show a whale trade notification
   */
  async show(trade: WhaleTrade, options?: {
    onClick?: () => void
    soundEnabled?: boolean
  }): Promise<Notification | null> {
    if (!this.isSupported()) {
      console.warn('[BrowserNotificationManager] Notifications not supported')
      return null
    }

    if (!this.isGranted()) {
      console.warn('[BrowserNotificationManager] Permission not granted')
      return null
    }

    try {
      const amountFormatted = this.formatAmount(trade.amountUSD)
      const tradeTypeEmoji = trade.tradeType === 'buy' ? '🟢' : '🔴'

      const notification = new Notification('🐋 Whale Trade Alert', {
        body: `${tradeTypeEmoji} $${amountFormatted} ${trade.tradeType.toUpperCase()} on ${trade.marketTitle}`,
        icon: '/icons/whale-icon.png',
        badge: '/icons/badge.png',
        tag: `whale-${trade.id}`, // Prevents duplicate notifications
        requireInteraction: false,
        silent: !(options?.soundEnabled ?? true),
        timestamp: trade.timestamp,
        data: {
          trade,
          type: 'whale_trade',
        },
      })

      // Handle click event
      notification.onclick = () => {
        window.focus()
        if (options?.onClick) {
          options.onClick()
        } else {
          // Default: dispatch custom event for navigation
          window.dispatchEvent(
            new CustomEvent('whale-trade-click', { detail: trade })
          )
        }
        notification.close()
      }

      return notification
    } catch (error) {
      console.error('[BrowserNotificationManager] Failed to show notification:', error)
      return null
    }
  }

  /**
   * Format USD amount with abbreviations
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
   * Test notification (useful for settings UI)
   */
  async showTestNotification(): Promise<Notification | null> {
    if (!this.isSupported()) {
      return null
    }

    if (!this.isGranted()) {
      const granted = await this.requestPermission()
      if (!granted) return null
    }

    try {
      const notification = new Notification('🐋 Whale Alert Test', {
        body: 'Whale trade notifications are working! You\'ll be alerted when large trades are detected.',
        icon: '/icons/whale-icon.png',
        badge: '/icons/badge.png',
        requireInteraction: false,
        silent: false,
      })

      return notification
    } catch (error) {
      console.error('[BrowserNotificationManager] Test notification failed:', error)
      return null
    }
  }
}

// Global singleton instance
let browserNotificationManager: BrowserNotificationManager | null = null

export function getBrowserNotificationManager(): BrowserNotificationManager {
  if (!browserNotificationManager) {
    browserNotificationManager = new BrowserNotificationManager()
  }
  return browserNotificationManager
}

export function resetBrowserNotificationManager(): void {
  browserNotificationManager = null
}
