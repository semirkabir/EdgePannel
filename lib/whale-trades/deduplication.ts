// Trade Deduplication - Prevent duplicate notifications for the same trade

import { WhaleTrade, TradeDeduplicationKey } from '@/types/whale-trade'

export class TradeDeduplicator {
  private cache: Map<TradeDeduplicationKey, number> = new Map()
  private readonly DEFAULT_TTL = 30000 // 30 seconds

  private ttl: number

  constructor(ttlMs: number = 30000) {
    this.ttl = ttlMs
  }

  /**
   * Check if a trade is a duplicate
   * Returns true if duplicate, false if new
   */
  isDuplicate(trade: WhaleTrade): boolean {
    const key = this.generateKey(trade)
    const cachedTimestamp = this.cache.get(key)

    if (cachedTimestamp) {
      const age = Date.now() - cachedTimestamp
      if (age < this.ttl) {
        // Still within TTL window - it's a duplicate
        return true
      }
    }

    // Not a duplicate - add to cache
    this.cache.set(key, Date.now())
    this.cleanupExpired()
    return false
  }

  /**
   * Generate deduplication key for a trade
   * Format: "platform:marketId:timestamp"
   */
  private generateKey(trade: WhaleTrade): TradeDeduplicationKey {
    // Round timestamp to nearest second to catch near-duplicate events
    const roundedTimestamp = Math.floor(trade.timestamp / 1000) * 1000
    return `${trade.platform}:${trade.marketId}:${roundedTimestamp}`
  }

  /**
   * Clean up expired entries from cache
   * Called automatically after each isDuplicate check
   */
  private cleanupExpired(): void {
    const now = Date.now()
    const keysToDelete: TradeDeduplicationKey[] = []

    for (const [key, timestamp] of this.cache.entries()) {
      if (now - timestamp >= this.ttl) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Manually mark a trade as seen
   */
  markAsSeen(trade: WhaleTrade): void {
    const key = this.generateKey(trade)
    this.cache.set(key, Date.now())
  }

  /**
   * Clear all deduplication cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size (for monitoring)
   */
  getCacheSize(): number {
    return this.cache.size
  }

  /**
   * Update TTL duration
   */
  setTTL(ttlMs: number): void {
    this.ttl = ttlMs
  }

  /**
   * Get current TTL
   */
  getTTL(): number {
    return this.ttl
  }

  /**
   * Check if a specific trade key exists in cache
   */
  has(trade: WhaleTrade): boolean {
    const key = this.generateKey(trade)
    return this.cache.has(key)
  }

  /**
   * Remove a specific trade from cache
   */
  remove(trade: WhaleTrade): void {
    const key = this.generateKey(trade)
    this.cache.delete(key)
  }
}

// Global singleton instance
let deduplicator: TradeDeduplicator | null = null

export function getDeduplicator(ttlMs?: number): TradeDeduplicator {
  if (!deduplicator) {
    deduplicator = new TradeDeduplicator(ttlMs)
  } else if (ttlMs !== undefined) {
    deduplicator.setTTL(ttlMs)
  }
  return deduplicator
}

export function resetDeduplicator(): void {
  deduplicator = null
}
