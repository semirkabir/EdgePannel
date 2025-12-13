import { Market } from '@/types/market'
import { LOCATION_COORDINATES } from '@/lib/locations'

// Curated category mapping for when API doesn't provide category
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Politics': ['election', 'president', 'senate', 'congress', 'vote', 'candidate', 'democrat', 'republican', 'trump', 'biden', 'political'],
  'Economics': ['gdp', 'inflation', 'unemployment', 'fed', 'interest rate', 'recession', 'economic', 'market', 'dollar', 'currency'],
  'Weather': ['hurricane', 'tornado', 'flood', 'drought', 'temperature', 'rain', 'snow', 'weather', 'climate'],
  'Sports': ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'championship', 'super bowl', 'world cup'],
  'Technology': ['ai', 'artificial intelligence', 'tech', 'software', 'hardware', 'crypto', 'bitcoin', 'ethereum', 'blockchain'],
  'Entertainment': ['oscar', 'grammy', 'movie', 'film', 'tv', 'television', 'celebrity', 'award'],
  'Health': ['covid', 'pandemic', 'disease', 'health', 'medical', 'hospital', 'vaccine'],
  'International': ['war', 'conflict', 'ukraine', 'russia', 'china', 'trade', 'sanction', 'diplomatic'],
}

export interface EnrichedMarket extends Market {
  normalizedCategory: string
  isBreakingNews: boolean
  isLivePrediction: boolean
  keywords: string[]
}

/**
 * Infer category from market title/description using keyword matching
 */
export function inferCategory(market: Market): string {
  if (market.category) {
    const category = market.category.trim()
    if (category.length > 0 && category !== 'undefined') {
      return category
    }
  }

  const searchText = `${market.title} ${market.description || ''}`.toLowerCase()

  let bestCategory = 'Other'
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, keyword) => {
      if (searchText.includes(keyword.toLowerCase())) {
        return acc + 1
      }
      return acc
    }, 0)

    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestCategory
}

/**
 * Infer location (coordinates and name) from market data
 */
export function inferLocation(market: Market): { name: string; coordinates: { lat: number; lng: number } } | undefined {
  // If location already exists, use it
  if (market.location?.coordinates) {
    return {
      name: market.location.city || market.location.country || 'Unknown',
      coordinates: market.location.coordinates
    }
  }

  const searchText = `${market.title} ${market.description || ''}`.toLowerCase()

  // Check specific city/region locations first (more precise)
  for (const [name, coords] of Object.entries(LOCATION_COORDINATES)) {
    if (searchText.includes(name.toLowerCase())) {
      // Return capitalized name for display
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      return { name: displayName, coordinates: coords }
    }
  }

  return undefined
}

/**
 * Enrich a single market with normalized category, location, and metadata
 */
export function enrichMarket(market: Market, allMarkets: Market[] = []): EnrichedMarket {
  const normalizedCategory = inferCategory(market)
  const locationInfo = inferLocation(market)

  // Extract keywords
  const keywords = market.title
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 5)

  const isBreakingNews =
    (market.volume24h && market.volume24h > 5000) ||
    (market.rawData?.created_at &&
      new Date(market.rawData.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000)

  const isLivePrediction =
    market.probability !== undefined &&
    market.probability > 0 && market.probability < 1 &&
    (
      (market.probability > 0.75 || market.probability < 0.25) ||
      (!!market.volume24h && market.volume24h > 500)
    )

  return {
    ...market,
    category: normalizedCategory,
    normalizedCategory,
    location: market.location || (locationInfo ? {
      country: locationInfo.name, // Use matched name as country/region label
      coordinates: locationInfo.coordinates,
    } : undefined),
    isBreakingNews,
    isLivePrediction,
    keywords,
  }
}

/**
 * Enrich an array of markets
 */
export function enrichMarkets(markets: Market[]): EnrichedMarket[] {
  return markets.map(market => enrichMarket(market, markets))
}

/**
 * Get all unique categories
 */
export function getCategories(markets: EnrichedMarket[]): string[] {
  const categories = new Set(markets.map(m => m.normalizedCategory))
  return Array.from(categories).sort()
}

/**
 * Get breaking news markets
 */
export function getBreakingNews(markets: EnrichedMarket[]): EnrichedMarket[] {
  return markets
    .filter(m => m.isBreakingNews)
    .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
    .slice(0, 10)
}

/**
 * Get live prediction markets
 */
export function getLivePredictions(markets: EnrichedMarket[]): EnrichedMarket[] {
  return markets
    .filter(m => m.isLivePrediction)
    .sort((a, b) => Math.abs((b.probability || 0.5) - 0.5) - Math.abs((a.probability || 0.5) - 0.5))
    .slice(0, 10)
}

