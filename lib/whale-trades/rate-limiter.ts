// Notification Rate Limiter - Prevent notification spam

export class NotificationRateLimiter {
  private notificationTimestamps: number[] = []
  private perMarketTimestamps: Map<string, number> = new Map()

  private readonly DEFAULT_MAX_PER_MINUTE = 10
  private readonly DEFAULT_PER_MARKET_COOLDOWN = 30000 // 30 seconds

  private maxPerMinute: number
  private perMarketCooldownMs: number

  constructor(
    maxPerMinute: number = 10,
    perMarketCooldownMs: number = 30000
  ) {
    this.maxPerMinute = maxPerMinute
    this.perMarketCooldownMs = perMarketCooldownMs
  }

  /**
   * Check if a notification can be sent
   * Returns true if allowed, false if rate limited
   */
  canNotify(): boolean {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Remove timestamps older than 1 minute
    this.notificationTimestamps = this.notificationTimestamps.filter(
      ts => ts > oneMinuteAgo
    )

    // Check if we've exceeded the rate limit
    if (this.notificationTimestamps.length >= this.maxPerMinute) {
      return false
    }

    return true
  }

  /**
   * Check if a notification can be sent for a specific market
   * Implements per-market cooldown to prevent spam for the same market
   */
  canNotifyForMarket(marketId: string, platform: string): boolean {
    // First check global rate limit
    if (!this.canNotify()) {
      return false
    }

    const key = `${platform}:${marketId}`
    const lastNotificationTime = this.perMarketTimestamps.get(key)

    if (lastNotificationTime) {
      const timeSinceLastNotification = Date.now() - lastNotificationTime
      if (timeSinceLastNotification < this.perMarketCooldownMs) {
        // Still in cooldown period for this market
        return false
      }
    }

    return true
  }

  /**
   * Record a notification sent
   * Should be called after successfully sending a notification
   */
  recordNotification(marketId?: string, platform?: string): void {
    const now = Date.now()
    this.notificationTimestamps.push(now)

    // Record per-market notification if market info provided
    if (marketId && platform) {
      const key = `${platform}:${marketId}`
      this.perMarketTimestamps.set(key, now)
    }
  }

  /**
   * Get current notification count in the last minute
   */
  getCurrentCount(): number {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    return this.notificationTimestamps.filter(ts => ts > oneMinuteAgo).length
  }

  /**
   * Get remaining notifications available in current minute
   */
  getRemainingNotifications(): number {
    return Math.max(0, this.maxPerMinute - this.getCurrentCount())
  }

  /**
   * Get time until next notification slot available (ms)
   * Returns 0 if notification can be sent now
   */
  getTimeUntilNextSlot(): number {
    if (this.getCurrentCount() < this.maxPerMinute) {
      return 0
    }

    // Find the oldest timestamp
    const oldestTimestamp = Math.min(...this.notificationTimestamps)
    const oneMinuteFromOldest = oldestTimestamp + 60000
    const now = Date.now()

    return Math.max(0, oneMinuteFromOldest - now)
  }

  /**
   * Get time until market cooldown expires (ms)
   * Returns 0 if notification can be sent now
   */
  getMarketCooldownRemaining(marketId: string, platform: string): number {
    const key = `${platform}:${marketId}`
    const lastNotificationTime = this.perMarketTimestamps.get(key)

    if (!lastNotificationTime) {
      return 0
    }

    const timeSinceLastNotification = Date.now() - lastNotificationTime
    return Math.max(0, this.perMarketCooldownMs - timeSinceLastNotification)
  }

  /**
   * Reset all rate limiting state
   */
  reset(): void {
    this.notificationTimestamps = []
    this.perMarketTimestamps.clear()
  }

  /**
   * Reset rate limit for a specific market
   */
  resetMarket(marketId: string, platform: string): void {
    const key = `${platform}:${marketId}`
    this.perMarketTimestamps.delete(key)
  }

  /**
   * Update max notifications per minute
   */
  setMaxPerMinute(max: number): void {
    this.maxPerMinute = Math.max(1, max)
  }

  /**
   * Update per-market cooldown duration
   */
  setPerMarketCooldown(ms: number): void {
    this.perMarketCooldownMs = Math.max(0, ms)
  }

  /**
   * Get current configuration
   */
  getConfig(): { maxPerMinute: number; perMarketCooldownMs: number } {
    return {
      maxPerMinute: this.maxPerMinute,
      perMarketCooldownMs: this.perMarketCooldownMs,
    }
  }

  /**
   * Clean up old per-market timestamps (called periodically)
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, timestamp] of this.perMarketTimestamps.entries()) {
      // Remove entries older than 5 minutes
      if (now - timestamp > 300000) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.perMarketTimestamps.delete(key))
  }
}

// Global singleton instance
let rateLimiter: NotificationRateLimiter | null = null

export function getRateLimiter(
  maxPerMinute?: number,
  perMarketCooldownMs?: number
): NotificationRateLimiter {
  if (!rateLimiter) {
    rateLimiter = new NotificationRateLimiter(maxPerMinute, perMarketCooldownMs)
  } else {
    if (maxPerMinute !== undefined) {
      rateLimiter.setMaxPerMinute(maxPerMinute)
    }
    if (perMarketCooldownMs !== undefined) {
      rateLimiter.setPerMarketCooldown(perMarketCooldownMs)
    }
  }
  return rateLimiter
}

export function resetRateLimiter(): void {
  rateLimiter = null
}
