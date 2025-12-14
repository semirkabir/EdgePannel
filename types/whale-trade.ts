// Whale Trade Monitoring Types

export interface WhaleTrade {
  id: string
  platform: 'polymarket' | 'kalshi'
  marketId: string
  marketTitle: string
  tradeType: 'buy' | 'sell'
  outcome: 'Yes' | 'No' | string
  price: number                 // Normalized 0-1
  amountUSD: number            // USD value
  timestamp: number

  // Optional metadata
  priceImpact?: number         // Estimated price impact
  volumeChange?: number        // Volume change that triggered detection

  // Raw data for debugging
  rawData?: any
}

export interface WhaleTradeAlert {
  id: string
  marketId?: string            // undefined = global threshold
  platform?: 'polymarket' | 'kalshi' | 'both'
  thresholdUSD: number

  // Filters
  filters: {
    minAmount: number
    platforms: ('polymarket' | 'kalshi')[]
    tradeDirection?: 'buy' | 'sell' | 'both'
    specificMarkets?: string[]  // Market IDs to monitor
  }

  createdAt: number
  enabled: boolean
}

export interface WhaleNotification {
  id: string
  type: 'whale_trade'
  trade: WhaleTrade
  alert: WhaleTradeAlert
  timestamp: number
  read: boolean
  dismissed: boolean
}

export interface WhaleTradeSettings {
  globalThresholdUSD: number    // Default: 10000
  enableBrowserNotifications: boolean
  enableToasts: boolean
  enableNotificationCenter: boolean
  enableLiveFeed: boolean
  soundEnabled: boolean
  maxNotificationsPerMinute: number  // Rate limiting
  deduplicationWindowMs: number      // Default: 30000 (30s)
}

// Trade deduplication key format: "platform:marketId:timestamp"
export type TradeDeduplicationKey = string

// Unified notification type for NotificationCenter
export type NotificationType = 'price_alert' | 'whale_trade'

// Storage keys
export const STORAGE_KEYS = {
  WHALE_ALERTS: 'edgepannel_whale_alerts',
  WHALE_NOTIFICATIONS: 'edgepannel_whale_notifications',
  WHALE_SETTINGS: 'edgepannel_whale_settings',
  SEEN_TRADES: 'edgepannel_seen_trades',
} as const

// Default settings
export const DEFAULT_WHALE_SETTINGS: WhaleTradeSettings = {
  globalThresholdUSD: 10000,
  enableBrowserNotifications: true,
  enableToasts: true,
  enableNotificationCenter: true,
  enableLiveFeed: true,
  soundEnabled: true,
  maxNotificationsPerMinute: 10,
  deduplicationWindowMs: 30000,
}
