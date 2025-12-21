
import { Market, Platform } from '@/types/market'

/**
 * Normalizes market probability to 0-1 range
 */
export function normalizeProbability(probability: number | undefined | null): number {
    if (probability === undefined || probability === null) return 0.5

    // Handle percentage (0-100)
    if (probability > 1) {
        return probability / 100
    }

    // Handle valid range (0-1)
    if (probability >= 0 && probability <= 1) {
        return probability
    }

    return 0.5
}

/**
 * Normalizes market volume ensuring it's a number
 */
export function normalizeVolume(volume: string | number | undefined | null): number {
    if (volume === undefined || volume === null) return 0

    if (typeof volume === 'number') return volume

    // Parse string volume
    try {
        return parseFloat(volume)
    } catch {
        return 0
    }
}

/**
 * Creates a unique ID for a market
 */
export function createMarketId(platform: Platform, id: string | number): string {
    return `${platform}-${id}`
}

/**
 * Formats volume for display (e.g. 1.2M, 500k)
 */
export function formatVolume(volume: number | undefined): string {
    if (!volume) return '$0'

    if (volume >= 1000000) {
        return `$${(volume / 1000000).toFixed(1)}M`
    }

    if (volume >= 1000) {
        return `$${(volume / 1000).toFixed(0)}k`
    }

    return `$${volume.toFixed(0)}`
}

/**
 * Standardizes market object structure
 */
export function standardizeMarket(market: any): Market | null {
    if (!market) return null

    // Basic validation
    if (!market.id || !market.platform || !market.title) return null

    return {
        ...market,
        price: normalizeProbability(market.price),
        probability: normalizeProbability(market.probability || market.price),
        volume24h: normalizeVolume(market.volume24h || market.volume),
        // Ensure critical fields exist
        tags: market.tags || [],
        outcomes: market.outcomes || ['Yes', 'No'],
        rawData: market.rawData || {}
    }
}
