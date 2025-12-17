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
  image?: string
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
  if (market.category && typeof market.category === 'string') {
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

// Pre-compiled regex patterns for finding country in context
const CONTEXT_PATTERNS = [
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

// Convert LOCATION_COORDINATES keys to a Set for fast lookup
// We also need to handle multi-word locations.
// Let's create a map where we can look up by first word to finding potential matches.
const LOCATION_KEYS = Object.keys(LOCATION_COORDINATES);

// Create a fast lookup map for locations
// Key: first word, Value: array of full location strings starting with that word
// e.g. "united" -> ["united states", "united kingdom"]
const LOCATION_FIRST_WORD_MAP = new Map<string, string[]>();

LOCATION_KEYS.forEach(key => {
  const words = key.toLowerCase().split(/\s+/);
  const firstWord = words[0];
  if (!LOCATION_FIRST_WORD_MAP.has(firstWord)) {
    LOCATION_FIRST_WORD_MAP.set(firstWord, []);
  }
  LOCATION_FIRST_WORD_MAP.get(firstWord)!.push(key);
});

// Sort matches by length descending so we match "New York" before "New"
LOCATION_FIRST_WORD_MAP.forEach(matches => {
  matches.sort((a, b) => b.length - a.length);
});

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

  const searchText = `${market.title} ${market.description || ''}`.toLowerCase();

  // Tokenize text into words (alphanumeric only for matching)
  const tokens = searchText.split(/[^a-z0-9]+/);

  // 1. FIRST: Check for country-specific contexts (highest priority) using regex patterns
  // We keep this because context matters ("wins in Georgia" vs "Georgia wins")
  const findCountryInContext = (text: string): string | undefined => {
    for (const pattern of CONTEXT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const candidate = match[1].toLowerCase().trim();
        if (LOCATION_COORDINATES[candidate]) {
          return candidate;
        }
      }
    }
    return undefined;
  };

  const contextCountry = findCountryInContext(searchText);
  if (contextCountry) {
    const coords = LOCATION_COORDINATES[contextCountry];
    const displayName = contextCountry.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return { name: displayName, coordinates: coords };
  }

  // 2. Direct country/location name matching (high priority)
  // Fast token-based lookup instead of regex loop
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (LOCATION_FIRST_WORD_MAP.has(token)) {
      const candidates = LOCATION_FIRST_WORD_MAP.get(token)!;

      for (const candidate of candidates) {
        const candidateWords = candidate.split(/\s+/);

        // Check if subsequent tokens match
        let match = true;
        if (candidateWords.length > 1) {
          if (i + candidateWords.length > tokens.length) {
            match = false;
          } else {
            for (let j = 1; j < candidateWords.length; j++) {
              if (tokens[i + j] !== candidateWords[j]) {
                match = false;
                break;
              }
            }
          }
        }

        if (match) {
          const coords = LOCATION_COORDINATES[candidate];
          const displayName = candidate.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          return { name: displayName, coordinates: coords };
        }
      }
    }
  }

  // 3. Topic-based overrides
  // We can optimize this by checking for key tokens instead of regexes
  if (searchText.includes('musk') || searchText.includes('tesla') || searchText.includes('xai') || searchText.includes('cybertruck')) {
    return { name: 'Austin', coordinates: LOCATION_COORDINATES['austin'] }
  }
  if (searchText.includes('spacex') || searchText.includes('starship')) {
    return { name: 'Hawthorne', coordinates: LOCATION_COORDINATES['hawthorne'] }
  }
  if (searchText.includes('movie') || searchText.includes('box office') || searchText.includes('cinema') || searchText.includes('avatar') || searchText.includes('film')) {
    return { name: 'Hollywood', coordinates: LOCATION_COORDINATES['hollywood'] }
  }

  // US Politics check
  const hasUS = searchText.includes('us') || searchText.includes('america');
  if ((searchText.includes('senate') || searchText.includes('congress') || searchText.includes('house') || searchText.includes('supreme court') || searchText.includes('biden') || searchText.includes('trump') || searchText.includes('white house')) && hasUS) {
    return { name: 'Washington DC', coordinates: LOCATION_COORDINATES['dc'] }
  }
  if (searchText.includes('inflation') || searchText.includes('cpi') || searchText.includes('pce') || searchText.includes('jobs report')) {
    return { name: 'Washington DC', coordinates: LOCATION_COORDINATES['dc'] }
  }
  if (searchText.includes('tech') || searchText.includes('startup') || searchText.includes('silicon valley') || searchText.includes('venture capital') || searchText.includes('openai') || searchText.includes('google') || searchText.includes('apple')) {
    return { name: 'Silicon Valley', coordinates: LOCATION_COORDINATES['silicon valley'] }
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
    image: market.rawData?.image || market.rawData?.icon,
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

// Patterns that indicate this is an option within a larger question
const BASE_QUESTION_PATTERNS = [
  // "X wins/win the..." -> "Who will win the..."
  /^(.*?)\s+(?:wins?|to\s+win|winning)\s+(the\s+)?(.+)$/i,
  // "Will X..." -> "Will _ ..."
  /^will\s+([^?]+)\??$/i,
  // Pattern for multiple choice within same event
  /^(.+?)\s*[-–—:]\s*(.+)$/,
  // Election patterns: "X wins French Presidential Election" -> "Who wins French Presidential Election"
  /^(.+?)\s+(?:wins?|to\s+win|winning)\s+(.+?\s+(?:presidential|election|primary|referendum|vote|race))$/i,
  // "X to be elected..." -> "Who will be elected..."
  /^(.+?)\s+to\s+be\s+(?:elected|chosen|selected)\s+(.+)$/i,
];

/**
 * Extract base question from a market title by removing specific options
 */
export function extractBaseQuestion(title: string): string {

  // Try to extract base question
  for (const pattern of BASE_QUESTION_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      // For "X wins Y" pattern, convert to "Who will win Y?"
      if (pattern.source.includes('wins?') || pattern.source.includes('winning')) {
        const event = match[3] || match[2] || match[1];
        if (event) {
          return `Who will win ${event}?`;
        }
      }
      // For "X to be elected Y" pattern
      if (pattern.source.includes('elected') || pattern.source.includes('chosen')) {
        const event = match[2] || match[1];
        if (event) {
          return `Who will be elected ${event}?`;
        }
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
 * Group markets by event ID (from rawData.events[0].id or rawData.eventId for Polymarket)
 * This groups all markets that belong to the same event
 */
export function groupMarketsByEvent(markets: EnrichedMarket[]): MarketGroup[] {
  const eventGroups = new Map<string, EnrichedMarket[]>();

  // Group markets by event ID
  for (const market of markets) {
    let eventId: string | null = null;

    // For Polymarket: try multiple ways to get event ID
    if (market.platform === 'polymarket') {
      // Try eventId from rawData (set when fetching from events API)
      // Normalize to string to ensure consistent grouping
      if (market.rawData?.eventId != null) {
        eventId = String(market.rawData.eventId).trim();
      }

      // Fallback to events array
      if (!eventId && market.rawData?.events?.[0]?.id != null) {
        eventId = String(market.rawData.events[0].id).trim();
      }

      // Additional fallback: check if rawData itself has an event structure
      if (!eventId && (market.rawData as any)?.event?.id != null) {
        eventId = String((market.rawData as any).event.id).trim();
      }
    }
    // For Kalshi: use event_ticker or series_ticker
    else if (market.platform === 'kalshi') {
      const ticker = (market.rawData as any)?.event_ticker || (market.rawData as any)?.series_ticker;
      if (ticker) {
        eventId = String(ticker).trim();
      }
    }

    // If no event ID, create a unique ID for this market (single market event)
    if (!eventId || eventId === '') {
      eventId = `single_${market.platform}_${market.id}`;
    }

    if (!eventGroups.has(eventId)) {
      eventGroups.set(eventId, []);
    }
    eventGroups.get(eventId)!.push(market);
  }

  // For markets without eventId, try to group by title similarity (fallback grouping)
  // This handles cases where markets from the same event don't have eventId set
  const ungroupedMarkets = Array.from(eventGroups.entries())
    .filter(([eventId]) => eventId.startsWith('single_'))
    .flatMap(([, markets]) => markets);

  // Group ungrouped markets by title similarity if they're from the same platform
  if (ungroupedMarkets.length > 0) {
    const similarityGroups = new Map<string, EnrichedMarket[]>();

    // Create buckets based on simplified base question
    // This reduces the comparison space from O(N^2) to O(N) for bucketing + O(K^2) for small buckets
    const buckets = new Map<string, EnrichedMarket[]>();

    for (const market of ungroupedMarkets) {
      // Create a simplified key: platform + first 2-3 significant words sorted
      const words = market.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['will', 'what', 'when', 'who', 'does'].includes(w))
        .sort()
        .slice(0, 3)
        .join('_');

      const key = `${market.platform}_${words}`;
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push(market);
    }

    // Process each bucket
    for (const [key, bucketMarkets] of buckets.entries()) {
      if (bucketMarkets.length <= 1) continue;

      // Within each bucket, run the more expensive similarity check
      // Since buckets are small, this is fast
      const processedInBucket = new Set<string>();

      for (let i = 0; i < bucketMarkets.length; i++) {
        const market = bucketMarkets[i];
        if (processedInBucket.has(market.id)) continue;

        const baseQuestion = extractBaseQuestion(market.title);
        const similarMarkets = [market];
        processedInBucket.add(market.id);

        for (let j = i + 1; j < bucketMarkets.length; j++) {
          const otherMarket = bucketMarkets[j];
          if (processedInBucket.has(otherMarket.id)) continue;

          const otherBaseQuestion = extractBaseQuestion(otherMarket.title);
          const similarity = calculateTitleSimilarity(baseQuestion, otherBaseQuestion);

          if (similarity > 0.6) { // Slightly lower threshold since we already bucketed by keywords
            similarMarkets.push(otherMarket);
            processedInBucket.add(otherMarket.id);
          }
        }

        if (similarMarkets.length > 1) {
          const groupKey = `similarity_${key}_${Date.now()}_${i}`;
          similarityGroups.set(groupKey, similarMarkets);
        }
      }
    }

    // Add similarity-based groups to eventGroups
    for (const [key, similarMarkets] of similarityGroups.entries()) {
      const groupId = key;
      eventGroups.set(groupId, similarMarkets);
    }

    // Remove single markets that were grouped
    const allGroupedIds = new Set(Array.from(similarityGroups.values()).flatMap(g => g.map(m => m.id)));

    for (const [eventId, markets] of Array.from(eventGroups.entries())) {
      if (eventId.startsWith('single_') && markets.length === 1) {
        if (allGroupedIds.has(markets[0].id)) {
          eventGroups.delete(eventId);
        }
      }
    }
  }

  // Convert to MarketGroup format
  const groups: MarketGroup[] = [];
  for (const [eventId, eventMarkets] of eventGroups.entries()) {
    if (eventMarkets.length === 0) continue;

    const primaryMarket = eventMarkets[0];

    // Extract base question from event question (preferred) or first market
    const baseQuestion = primaryMarket.rawData?.eventQuestion
      || primaryMarket.rawData?.events?.[0]?.question
      || extractBaseQuestion(primaryMarket.title)
      || primaryMarket.title;

    const totalVolume = eventMarkets.reduce((sum, m) => sum + (m.volume24h || 0), 0);
    const isBreakingNews = eventMarkets.some(m => m.isBreakingNews);

    // Update markets with group info
    eventMarkets.forEach(m => {
      m.groupId = eventId;
      m.baseQuestion = baseQuestion;
      m.isGrouped = true;
    });

    groups.push({
      groupId: eventId,
      baseQuestion,
      location: primaryMarket.location?.coordinates ? {
        name: primaryMarket.location.city || primaryMarket.location.country || 'Unknown',
        coordinates: primaryMarket.location.coordinates
      } : undefined,
      markets: eventMarkets,
      category: primaryMarket.category || 'Other',
      totalVolume,
      isBreakingNews,
    });
  }

  return groups;
}

/**
 * Get all markets including both grouped and ungrouped
 * Uses event-based grouping to group markets by event ID
 */
export function getMarketsWithGroups(markets: EnrichedMarket[]): {
  groups: MarketGroup[];
  ungroupedMarkets: EnrichedMarket[];
} {
  // Use event-based grouping instead of similarity-based grouping
  const groups = groupMarketsByEvent(markets);
  const groupedMarketIds = new Set(
    groups.flatMap(g => g.markets.map(m => m.id))
  );

  // All markets should be in groups (events), but keep this for safety
  const ungroupedMarkets = markets.filter(m => !groupedMarketIds.has(m.id));

  return { groups, ungroupedMarkets };
}
