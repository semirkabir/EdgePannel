// Trade Inference Engine - Infer whale trades from ticker and volume changes

import { WhaleTrade } from '@/types/whale-trade'
import { Market } from '@/types/market'

interface TickerData {
  marketId: string
  platform: 'polymarket' | 'kalshi'
  price: number
  volume: number
  timestamp: number
}

interface MarketState {
  lastPrice: number
  lastVolume: number
  lastUpdate: number
  marketTitle: string
}

export class TradeInferenceEngine {
  private marketStates: Map<string, MarketState> = new Map()

  // Thresholds for whale detection
  private readonly PRICE_CHANGE_THRESHOLD = 0.05  // 5% price change
  private readonly VOLUME_SPIKE_THRESHOLD = 1000   // $1000 volume spike
  private readonly MIN_VOLUME_CHANGE = 500         // Minimum $500 volume change

  /**
   * Infer whale activity from ticker updates
   * Returns a WhaleTrade if whale activity detected, null otherwise
   */
  inferFromTicker(
    ticker: TickerData,
    market?: Market
  ): WhaleTrade | null {
    const key = `${ticker.platform}:${ticker.marketId}`
    const state = this.marketStates.get(key)

    // First time seeing this market - initialize state
    if (!state) {
      this.marketStates.set(key, {
        lastPrice: ticker.price,
        lastVolume: ticker.volume,
        lastUpdate: ticker.timestamp,
        marketTitle: market?.title || 'Unknown Market',
      })
      return null
    }

    // Calculate changes
    const priceChange = Math.abs(ticker.price - state.lastPrice)
    const volumeChange = ticker.volume - state.lastVolume
    const timeDelta = (ticker.timestamp - state.lastUpdate) / 1000 // seconds

    // Update state
    this.marketStates.set(key, {
      lastPrice: ticker.price,
      lastVolume: ticker.volume,
      lastUpdate: ticker.timestamp,
      marketTitle: market?.title || state.marketTitle,
    })

    // Skip if time delta too small (< 1 second) to avoid duplicate detections
    if (timeDelta < 1) {
      return null
    }

    // Check for whale activity
    // Criteria: Large price change AND significant volume spike
    const isSignificantPriceMove = priceChange >= this.PRICE_CHANGE_THRESHOLD
    const isVolumeSpike = volumeChange >= this.VOLUME_SPIKE_THRESHOLD
    const hasMinimumVolume = volumeChange >= this.MIN_VOLUME_CHANGE

    if (isSignificantPriceMove && hasMinimumVolume) {
      // Infer trade direction from price movement
      const tradeType = ticker.price > state.lastPrice ? 'buy' : 'sell'

      // Estimate USD amount from volume change
      const amountUSD = volumeChange

      // Calculate price impact
      const priceImpact = priceChange / state.lastPrice

      const whaleTrade: WhaleTrade = {
        id: `inferred-${ticker.platform}-${ticker.marketId}-${ticker.timestamp}`,
        platform: ticker.platform,
        marketId: ticker.marketId,
        marketTitle: state.marketTitle,
        tradeType,
        outcome: tradeType === 'buy' ? 'Yes' : 'No',
        price: ticker.price,
        amountUSD,
        timestamp: ticker.timestamp,
        priceImpact,
        volumeChange,
        rawData: ticker,
      }

      return whaleTrade
    }

    return null
  }

  /**
   * Infer whale activity from market price/volume updates
   * Convenience method that works with Market objects
   */
  inferFromMarket(market: Market, previousMarket?: Market): WhaleTrade | null {
    if (!market.price || market.volume24h === undefined) {
      return null
    }

    const ticker: TickerData = {
      marketId: market.id,
      platform: market.platform,
      price: market.price,
      volume: market.volume24h,
      timestamp: Date.now(),
    }

    return this.inferFromTicker(ticker, market)
  }

  /**
   * Clear state for a specific market
   */
  clearMarketState(platform: string, marketId: string): void {
    const key = `${platform}:${marketId}`
    this.marketStates.delete(key)
  }

  /**
   * Clear all market states
   */
  clearAllStates(): void {
    this.marketStates.clear()
  }

  /**
   * Get current state for debugging
   */
  getMarketState(platform: string, marketId: string): MarketState | undefined {
    const key = `${platform}:${marketId}`
    return this.marketStates.get(key)
  }

  /**
   * Update thresholds dynamically (for testing or user settings)
   */
  updateThresholds(options: {
    priceChangeThreshold?: number
    volumeSpikeThreshold?: number
    minVolumeChange?: number
  }): void {
    if (options.priceChangeThreshold !== undefined) {
      ;(this as any).PRICE_CHANGE_THRESHOLD = options.priceChangeThreshold
    }
    if (options.volumeSpikeThreshold !== undefined) {
      ;(this as any).VOLUME_SPIKE_THRESHOLD = options.volumeSpikeThreshold
    }
    if (options.minVolumeChange !== undefined) {
      ;(this as any).MIN_VOLUME_CHANGE = options.minVolumeChange
    }
  }
}

// Global singleton instance
let inferenceEngine: TradeInferenceEngine | null = null

export function getInferenceEngine(): TradeInferenceEngine {
  if (!inferenceEngine) {
    inferenceEngine = new TradeInferenceEngine()
  }
  return inferenceEngine
}

export function resetInferenceEngine(): void {
  inferenceEngine = null
}
