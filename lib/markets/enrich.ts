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
  groupId?: string  // ID for grouping related markets
  baseQuestion?: string  // The base question without the specific option
  isGrouped?: boolean  // Whether this market is part of a group
}

export interface MarketGroup {
  groupId: string
  baseQuestion: string
  location?: { name: string; coordinates: { lat: number; lng: number } }
  markets: EnrichedMarket[]
  category: string
  totalVolume: number
  isBreakingNews: boolean
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
 * Infer location (coordinates and name) from market data with improved context awareness
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

  // Sort keys by length descending to match "New York" before "York" or "New"
  const locationKeys = Object.keys(LOCATION_COORDINATES).sort((a, b) => b.length - a.length);

  // Helper function to check if a country is mentioned in a relevant context
  const findCountryInContext = (text: string): string | undefined => {
    // High-priority patterns that indicate a country-specific event
    const contextPatterns = [
      // Sports/Competition contexts
      /\b(\w+(?:\s+\w+)?)\s+(?:win|wins|winning|won|to\s+win|defeat|beats?|champion|victory|qualifies?|advances?)\b/gi,
      // Country possessive/attributive
      /\b(\w+(?:\s+\w+)?)'?s?\s+(?:team|election|economy|president|government|military|forces|victory)\b/gi,
      // Direct country mention with action
      /\b(\w+(?:\s+\w+)?)\s+(?:will|does|did|makes?|takes?|gets?|becomes?|reaches?)\b/gi,
      // Country in location/event context
      /\bin\s+(\w+(?:\s+\w+)?)\b/gi,
      /\bfrom\s+(\w+(?:\s+\w+)?)\b/gi,
      /\bat\s+(\w+(?:\s+\w+)?)\b/gi,
    ];

    for (const pattern of contextPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const candidate = match[1].toLowerCase().trim();
        // Check if this candidate is a known location
        if (locationKeys.some(key => key.toLowerCase() === candidate)) {
          return candidate;
        }
      }
    }
    return undefined;
  };

  // 1. FIRST: Check for country-specific contexts (highest priority)
  const contextCountry = findCountryInContext(searchText);
  if (contextCountry && LOCATION_COORDINATES[contextCountry]) {
    const coords = LOCATION_COORDINATES[contextCountry];
    const displayName = contextCountry.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return { name: displayName, coordinates: coords };
  }

  // 2. Direct country/location name matching (high priority)
  for (const name of locationKeys) {
    const nameLower = name.toLowerCase();
    // Create word boundary regex for better matching
    const wordBoundaryPattern = new RegExp(`\\b${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

    if (wordBoundaryPattern.test(searchText)) {
      const coords = LOCATION_COORDINATES[name];
      const displayName = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      return { name: displayName, coordinates: coords };
    }
  }

  // 3. Topic-based overrides (lower priority - only if no country detected)
  // Only apply these if the market is clearly NOT about another country
  const hasNoCountryMention = !locationKeys.some(key =>
    new RegExp(`\\b${key.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(searchText)
  );

  if (hasNoCountryMention) {
    if (searchText.includes('musk') || searchText.includes('tesla') || searchText.includes('xai') || searchText.includes('cybertruck')) {
      return { name: 'Austin', coordinates: LOCATION_COORDINATES['austin'] }
    }
    if (searchText.includes('spacex') || searchText.includes('starship')) {
      return { name: 'Hawthorne', coordinates: LOCATION_COORDINATES['hawthorne'] }
    }
    if (searchText.includes('movie') || searchText.includes('box office') || searchText.includes('cinema') || searchText.includes('avatar') || searchText.includes('film')) {
      return { name: 'Hollywood', coordinates: LOCATION_COORDINATES['hollywood'] }
    }
    // US Politics - only if no other country mentioned
    if ((searchText.includes('senate') || searchText.includes('congress') || searchText.includes('house') || searchText.includes('supreme court') || searchText.includes('biden') || searchText.includes('trump') || searchText.includes('white house')) && searchText.includes('us') || searchText.includes('america')) {
      return { name: 'Washington DC', coordinates: LOCATION_COORDINATES['dc'] }
    }
    if (searchText.includes('inflation') || searchText.includes('cpi') || searchText.includes('pce') || searchText.includes('jobs report')) {
      return { name: 'Washington DC', coordinates: LOCATION_COORDINATES['dc'] }
    }
    if (searchText.includes('tech') || searchText.includes('startup') || searchText.includes('silicon valley') || searchText.includes('venture capital') || searchText.includes('openai') || searchText.includes('google') || searchText.includes('apple')) {
      return { name: 'Silicon Valley', coordinates: LOCATION_COORDINATES['silicon valley'] }
    }
  }

  // 4. Platform fallback
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

/**
 * Extract base question from a market title by removing specific options
 */
export function extractBaseQuestion(title: string): string {
  const lowerTitle = title.toLowerCase();

  // Patterns that indicate this is an option within a larger question
  const optionPatterns = [
    // "X wins/win the..." -> "Who will win the..."
    /^(.*?)\s+(?:wins?|to\s+win|winning)\s+(the\s+)?(.+)$/i,
    // "Will X..." -> "Will _ ..."
    /^will\s+([^?]+)\??$/i,
    // Pattern for multiple choice within same event
    /^(.+?)\s*[-–—:]\s*(.+)$/,
  ];

  // Try to extract base question
  for (const pattern of optionPatterns) {
    const match = title.match(pattern);
    if (match) {
      // For "X wins Y" pattern, convert to "Who will win Y?"
      if (pattern.source.includes('wins?')) {
        const event = match[3] || match[2];
        return `Who will win ${event}?`;
      }
    }
  }

  // If no pattern matched, check if multiple markets from same platform share similar titles
  // This will be handled in the grouping function
  return title;
}

/**
 * Calculate similarity between two market titles
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(title2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Group markets that are options for the same event
 */
export function groupMarkets(markets: EnrichedMarket[]): MarketGroup[] {
  const groups = new Map<string, MarketGroup>();
  const processedMarkets = new Set<string>();

  // Sort markets by platform and category to group similar ones together
  const sortedMarkets = [...markets].sort((a, b) => {
    if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
    return (a.category || '').localeCompare(b.category || '');
  });

  for (let i = 0; i < sortedMarkets.length; i++) {
    const market = sortedMarkets[i];

    if (processedMarkets.has(market.id)) continue;

    // Check if this market should be grouped with others
    const potentialGroup: EnrichedMarket[] = [market];
    const baseQuestion = extractBaseQuestion(market.title);

    // Look for similar markets from the same platform
    for (let j = i + 1; j < sortedMarkets.length; j++) {
      const otherMarket = sortedMarkets[j];

      if (processedMarkets.has(otherMarket.id)) continue;

      // Must be same platform and same category
      if (otherMarket.platform !== market.platform) continue;
      if (otherMarket.category !== market.category) continue;

      // Check for high title similarity (likely same event, different options)
      const similarity = calculateTitleSimilarity(market.title, otherMarket.title);

      // Also check if they have the same base question pattern
      const otherBaseQuestion = extractBaseQuestion(otherMarket.title);
      const sameBaseQuestion = baseQuestion === otherBaseQuestion && baseQuestion !== market.title;

      // Check if titles follow pattern like "X wins [event]" and "Y wins [event]"
      const competitionPattern = /^(.*?)\s+(?:wins?|to\s+win|winning)\s+(.+)$/i;
      const match1 = market.title.match(competitionPattern);
      const match2 = otherMarket.title.match(competitionPattern);
      const sameCompetition = match1 && match2 && match1[2]?.toLowerCase() === match2[2]?.toLowerCase();

      if (similarity > 0.6 || sameBaseQuestion || sameCompetition) {
        potentialGroup.push(otherMarket);
        processedMarkets.add(otherMarket.id);
      }
    }

    processedMarkets.add(market.id);

    // Only create a group if we have multiple markets
    if (potentialGroup.length > 1) {
      const groupId = `group_${market.platform}_${Date.now()}_${i}`;
      const totalVolume = potentialGroup.reduce((sum, m) => sum + (m.volume24h || 0), 0);
      const isBreakingNews = potentialGroup.some(m => m.isBreakingNews);

      // Update markets with group info
      potentialGroup.forEach(m => {
        m.groupId = groupId;
        m.baseQuestion = baseQuestion;
        m.isGrouped = true;
      });

      groups.set(groupId, {
        groupId,
        baseQuestion,
        location: market.location,
        markets: potentialGroup,
        category: market.category || 'Other',
        totalVolume,
        isBreakingNews,
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Get all markets including both grouped and ungrouped
 */
export function getMarketsWithGroups(markets: EnrichedMarket[]): {
  groups: MarketGroup[];
  ungroupedMarkets: EnrichedMarket[];
} {
  const groups = groupMarkets(markets);
  const groupedMarketIds = new Set(
    groups.flatMap(g => g.markets.map(m => m.id))
  );

  const ungroupedMarkets = markets.filter(m => !groupedMarketIds.has(m.id));

  return { groups, ungroupedMarkets };
}



