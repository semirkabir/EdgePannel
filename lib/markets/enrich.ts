import { Market } from '@/types/market'

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

// Country inference keywords
const COUNTRY_KEYWORDS: Record<string, string[]> = {
  'United States': ['usa', 'us', 'united states', 'america', 'washington', 'new york', 'california', 'texas', 'florida'],
  'United Kingdom': ['uk', 'britain', 'england', 'london', 'british', 'ukraine'],
  'China': ['china', 'chinese', 'beijing', 'shanghai'],
  'Russia': ['russia', 'russian', 'moscow'],
  'Japan': ['japan', 'japanese', 'tokyo'],
  'Germany': ['germany', 'german', 'berlin'],
  'France': ['france', 'french', 'paris'],
  'Canada': ['canada', 'canadian', 'toronto', 'vancouver'],
  'Australia': ['australia', 'australian', 'sydney', 'melbourne'],
  'India': ['india', 'indian', 'mumbai', 'delhi'],
}

// Default coordinates for countries
const COUNTRY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'United States': { lat: 39.8283, lng: -98.5795 },
  'United Kingdom': { lat: 55.3781, lng: -3.4360 },
  'China': { lat: 35.8617, lng: 104.1954 },
  'Russia': { lat: 61.5240, lng: 105.3188 },
  'Japan': { lat: 36.2048, lng: 138.2529 },
  'Germany': { lat: 51.1657, lng: 10.4515 },
  'France': { lat: 46.2276, lng: 2.2137 },
  'Canada': { lat: 56.1304, lng: -106.3468 },
  'Australia': { lat: -25.2744, lng: 133.7751 },
  'India': { lat: 20.5937, lng: 78.9629 },
}

export interface EnrichedMarket extends Market {
  normalizedCategory: string
  isBreakingNews: boolean
  isLivePrediction: boolean
  keywords: string[]
}

/**
 * Infer category from market title/description using keyword matching
 * Uses Polymarket's actual category if available, otherwise infers from keywords
 */
export function inferCategory(market: Market): string {
  // If category already exists from Polymarket API, use it directly
  if (market.category) {
    // Normalize Polymarket categories to match our system
    const category = market.category.trim()
    // Polymarket categories are usually capitalized or have specific formats
    // Return as-is if it looks valid, otherwise try to match
    if (category.length > 0 && category !== 'undefined') {
      return category
    }
  }

  const searchText = `${market.title} ${market.description || ''}`.toLowerCase()
  
  // Find category with most matching keywords
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
 * Infer country from market data
 */
export function inferCountry(market: Market): string | undefined {
  // If location already exists, use it
  if (market.location?.country) {
    return market.location.country
  }

  const searchText = `${market.title} ${market.description || ''}`.toLowerCase()
  
  // Find country with matching keywords
  for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    if (keywords.some(keyword => searchText.includes(keyword.toLowerCase()))) {
      return country
    }
  }

  // Default to US if no match
  return 'United States'
}

/**
 * Get coordinates for a country
 */
export function getCountryCoordinates(country: string): { lat: number; lng: number } | undefined {
  return COUNTRY_COORDINATES[country]
}

/**
 * Enrich a single market with normalized category, location, and metadata
 */
export function enrichMarket(market: Market, allMarkets: Market[] = []): EnrichedMarket {
  const normalizedCategory = inferCategory(market)
  const country = inferCountry(market)
  const coordinates = country ? getCountryCoordinates(country) : undefined

  // Extract keywords from title
  const keywords = market.title
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 5)

  // Determine if breaking news (newly listed or high volume)
  // Use live volume data from order book
  const isBreakingNews = 
    (market.volume24h && market.volume24h > 5000) || // Lower threshold for live data
    (market.rawData?.created_at && 
     new Date(market.rawData.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000) ||
    (market.rawData?.start_date_iso && 
     new Date(market.rawData.start_date_iso).getTime() > Date.now() - 6 * 60 * 60 * 1000) // Last 6 hours

  // Determine if live prediction (high probability delta or recent activity)
  // Use live price data from order book
  const isLivePrediction = 
    market.probability !== undefined &&
    market.probability > 0 && market.probability < 1 && // Valid probability
    (
      (market.probability > 0.75 || market.probability < 0.25) || // Strong signal
      (market.volume24h && market.volume24h > 500) // Active trading
    )

  return {
    ...market,
    category: normalizedCategory,
    normalizedCategory,
    location: market.location || (country ? {
      country,
      coordinates,
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
 * Get all unique categories from enriched markets
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

