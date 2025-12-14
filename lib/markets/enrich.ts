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
  price_movement?: number
  slug?: string
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

  // specific city/region locations first (more precise)
  // Sort keys by length descending to match "New York" before "York" or "New"
  const locationKeys = Object.keys(LOCATION_COORDINATES).sort((a, b) => b.length - a.length);

  // 1. Check for specific topic-based overrides first
  if (searchText.includes('musk') || searchText.includes('tesla') || searchText.includes('xai') || searchText.includes('cybertruck')) {
    return { name: 'Austin', coordinates: LOCATION_COORDINATES['austin'] }
  }
  if (searchText.includes('spacex') || searchText.includes('starship')) {
    return { name: 'Hawthorne', coordinates: LOCATION_COORDINATES['hawthorne'] }
  }
  if (searchText.includes('movie') || searchText.includes('box office') || searchText.includes('cinema') || searchText.includes('avatar') || searchText.includes('film')) {
    return { name: 'Hollywood', coordinates: LOCATION_COORDINATES['hollywood'] }
  }
  if (searchText.includes('senate') || searchText.includes('congress') || searchText.includes('house') || searchText.includes('supreme court') || searchText.includes('biden') || searchText.includes('trump') || searchText.includes('white house') || searchText.includes('election')) {
    return { name: 'Washington DC', coordinates: LOCATION_COORDINATES['dc'] }
  }
  if (searchText.includes('inflation') || searchText.includes('cpi') || searchText.includes('pce') || searchText.includes('jobs report') || searchText.includes('unemployment') || searchText.includes('rates') || searchText.includes('hike') || searchText.includes('cut')) {
    return { name: 'Washington DC', coordinates: LOCATION_COORDINATES['dc'] }
  }
  if (searchText.includes('tech') || searchText.includes('startup') || searchText.includes('silicon valley') || searchText.includes('venture capital') || searchText.includes('ai') || searchText.includes('openai') || searchText.includes('google') || searchText.includes('apple')) {
    return { name: 'Silicon Valley', coordinates: LOCATION_COORDINATES['silicon valley'] }
  }

  // 2. Original geographic matching
  for (const name of locationKeys) {
    // improved matching: check for word boundaries if possible or just inclusion for now
    // Simple inclusion is risky for short words like "US" matching "status", but most keys are distinct enough.
    // We can add boundary checks for short keys later if needed.
    if (searchText.includes(name.toLowerCase())) {
      const coords = LOCATION_COORDINATES[name];
      // Return capitalized name for display
      const displayName = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      return { name: displayName, coordinates: coords }
    }
  }

  // 3. Platform fallback
  if (market.platform === 'kalshi') {
    // If no specific location found, default Kalshi markets to USA as they are US-regulated events
    return { name: 'United States', coordinates: LOCATION_COORDINATES['united states'] }
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



