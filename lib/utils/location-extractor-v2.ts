/**
 * Smart Location Extraction Engine v2
 *
 * Context-aware location detection that understands:
 * - Sports teams → Home cities
 * - Political figures → Their countries
 * - Multiple locations → Most relevant one
 * - Explicit patterns → "in Paris", "at Tokyo", etc.
 */

import { COUNTRY_COORDINATES, CITY_COORDINATES, US_STATES } from './geo-data'
import { detectSportsTeam, SPORTS_TEAMS } from './sports-teams'

export interface LocationInfo {
  country?: string
  region?: string
  city?: string
  coordinates?: {
    lat: number
    lng: number
  }
  confidence: 'high' | 'medium' | 'low'
  extractedFrom: 'sports' | 'country' | 'city' | 'state' | 'pattern' | 'context'
  matchedText?: string
}

/**
 * Smart location extraction with context awareness
 */
export function extractLocation(title: string, description?: string): LocationInfo | null {
  const text = `${title} ${description || ''}`
  const lowerText = text.toLowerCase()

  console.log(`[Location] Analyzing: "${title.substring(0, 100)}"`)

  // Priority 1: Sports teams (most specific)
  const sportsMatch = detectSportsTeam(text)
  if (sportsMatch) {
    const cityData = CITY_COORDINATES[sportsMatch.city.toLowerCase()]
    if (cityData) {
      console.log(`[Location] ✓ Sports team → ${cityData.name}, ${cityData.country}`)
      return {
        city: cityData.name,
        country: cityData.country,
        region: cityData.region,
        coordinates: { lat: cityData.lat, lng: cityData.lng },
        confidence: 'high',
        extractedFrom: 'sports',
        matchedText: sportsMatch.city
      }
    }
  }

  // Priority 2: Explicit location patterns ("in Paris", "at Tokyo", "from Brazil")
  const patternMatch = extractExplicitPattern(text)
  if (patternMatch) {
    console.log(`[Location] ✓ Pattern → ${patternMatch.matchedText}`)
    return patternMatch
  }

  // Priority 3: City mentions (specific locations)
  const cityMatch = detectCity(text)
  if (cityMatch) {
    console.log(`[Location] ✓ City → ${cityMatch.city}`)
    return cityMatch
  }

  // Priority 4: US State mentions
  const stateMatch = detectUSState(text)
  if (stateMatch) {
    console.log(`[Location] ✓ State → ${stateMatch.region}`)
    return stateMatch
  }

  // Priority 5: Context-aware country detection
  const countryMatch = detectCountryWithContext(text, lowerText)
  if (countryMatch) {
    console.log(`[Location] ✓ Country → ${countryMatch.country}`)
    return countryMatch
  }

  console.log(`[Location] ✗ No location found`)
  return null
}

/**
 * Detect explicit location patterns
 */
function extractExplicitPattern(text: string): LocationInfo | null {
  const patterns = [
    // "in [location]", "at [location]", "from [location]"
    { regex: /\b(?:in|at|from|to)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:on|before|after|by|in|at)|[,?.!]|$)/g, confidence: 'high' as const },
    // "temperature in Dallas", "weather in Paris"
    { regex: /(?:temperature|weather|climate)\s+(?:in|at)\s+([A-Z][a-zA-Z\s]+?)(?:\s|[,?.!]|$)/gi, confidence: 'high' as const },
    // "[Location] election", "[Location] referendum"
    { regex: /\b([A-Z][a-zA-Z\s]+?)\s+(?:election|referendum|vote|primary)/gi, confidence: 'high' as const },
  ]

  for (const { regex, confidence } of patterns) {
    const matches = text.matchAll(regex)
    for (const match of matches) {
      if (match[1]) {
        const location = match[1].trim()

        // Try to geocode the extracted location
        const cityMatch = detectCity(location.toLowerCase())
        if (cityMatch) {
          return { ...cityMatch, confidence, extractedFrom: 'pattern', matchedText: location }
        }

        const countryMatch = detectCountry(location.toLowerCase())
        if (countryMatch) {
          return { ...countryMatch, confidence, extractedFrom: 'pattern', matchedText: location }
        }

        const stateMatch = detectUSState(location.toLowerCase())
        if (stateMatch) {
          return { ...stateMatch, confidence, extractedFrom: 'pattern', matchedText: location }
        }
      }
    }
  }

  return null
}

/**
 * Context-aware country detection
 * Handles markets with multiple countries by picking the most relevant one
 */
function detectCountryWithContext(text: string, lowerText: string): LocationInfo | null {
  const foundCountries: Array<{ country: string; data: any; position: number; context: string }> = []

  // Find all country mentions with their positions
  for (const [key, data] of Object.entries(COUNTRY_COORDINATES)) {
    const variations = [
      key.toLowerCase(),
      data.demonym?.toLowerCase(),
      ...(data.aliases || []).map(a => a.toLowerCase())
    ].filter(Boolean) as string[]

    for (const variation of variations) {
      const regex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      const match = lowerText.match(regex)
      if (match && match.index !== undefined) {
        // Get context around the match
        const start = Math.max(0, match.index - 50)
        const end = Math.min(lowerText.length, match.index + variation.length + 50)
        const context = lowerText.substring(start, end)

        foundCountries.push({
          country: data.name,
          data,
          position: match.index,
          context
        })
        break // Only count each country once
      }
    }
  }

  if (foundCountries.length === 0) {
    return null
  }

  // If only one country, return it
  if (foundCountries.length === 1) {
    const { data } = foundCountries[0]
    return {
      country: data.name,
      coordinates: { lat: data.lat, lng: data.lng },
      confidence: 'high',
      extractedFrom: 'country',
      matchedText: data.name
    }
  }

  // Multiple countries - pick the most relevant one using heuristics
  console.log(`[Location] Found ${foundCountries.length} countries: ${foundCountries.map(c => c.country).join(', ')}`)

  // Heuristic 1: Look for subject indicators
  const subjectKeywords = ['prime minister', 'president', 'election', 'government', 'capital', 'leader', 'minister']
  for (const country of foundCountries) {
    if (subjectKeywords.some(kw => country.context.includes(kw))) {
      console.log(`[Location] → Selected ${country.country} (subject of market)`)
      return {
        country: country.data.name,
        coordinates: { lat: country.data.lat, lng: country.data.lng },
        confidence: 'high',
        extractedFrom: 'context',
        matchedText: country.data.name
      }
    }
  }

  // Heuristic 2: For "X invade Y", pick Y (the target)
  const invasionMatch = lowerText.match(/(\w+)\s+(?:invade|invades|invasion of|attack|attacks)\s+(\w+)/)
  if (invasionMatch) {
    const target = invasionMatch[2]
    const targetCountry = foundCountries.find(c =>
      c.country.toLowerCase().includes(target) ||
      target.includes(c.country.toLowerCase().substring(0, 4))
    )
    if (targetCountry) {
      console.log(`[Location] → Selected ${targetCountry.country} (invasion target)`)
      return {
        country: targetCountry.data.name,
        coordinates: { lat: targetCountry.data.lat, lng: targetCountry.data.lng },
        confidence: 'high',
        extractedFrom: 'context',
        matchedText: targetCountry.data.name
      }
    }
  }

  // Heuristic 3: For "X and Y meet in Z", pick Z (the location)
  const meetingMatch = lowerText.match(/meet\s+(?:next\s+)?(?:in|at)\s+(\w+)/)
  if (meetingMatch) {
    const meetingPlace = meetingMatch[1]
    const meetingCountry = foundCountries.find(c =>
      c.country.toLowerCase().includes(meetingPlace) ||
      meetingPlace.includes(c.country.toLowerCase().substring(0, 4))
    )
    if (meetingCountry) {
      console.log(`[Location] → Selected ${meetingCountry.country} (meeting location)`)
      return {
        country: meetingCountry.data.name,
        coordinates: { lat: meetingCountry.data.lat, lng: meetingCountry.data.lng },
        confidence: 'high',
        extractedFrom: 'context',
        matchedText: meetingCountry.data.name
      }
    }
  }

  // Heuristic 4: Pick the last mentioned country (often the subject)
  const lastCountry = foundCountries[foundCountries.length - 1]
  console.log(`[Location] → Selected ${lastCountry.country} (last mentioned)`)
  return {
    country: lastCountry.data.name,
    coordinates: { lat: lastCountry.data.lat, lng: lastCountry.data.lng },
    confidence: 'medium',
    extractedFrom: 'country',
    matchedText: lastCountry.data.name
  }
}

/**
 * Detect city mentions
 */
function detectCity(text: string): LocationInfo | null {
  const lowerText = text.toLowerCase()

  for (const [key, data] of Object.entries(CITY_COORDINATES)) {
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(lowerText)) {
      return {
        city: data.name,
        country: data.country,
        region: data.region,
        coordinates: { lat: data.lat, lng: data.lng },
        confidence: 'high',
        extractedFrom: 'city',
        matchedText: data.name
      }
    }
  }

  return null
}

/**
 * Detect country mentions (basic, without context)
 */
function detectCountry(text: string): LocationInfo | null {
  for (const [key, data] of Object.entries(COUNTRY_COORDINATES)) {
    const variations = [
      key.toLowerCase(),
      data.demonym?.toLowerCase(),
      ...(data.aliases || []).map(a => a.toLowerCase())
    ].filter(Boolean)

    for (const variation of variations) {
      const regex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(text)) {
        return {
          country: data.name,
          coordinates: { lat: data.lat, lng: data.lng },
          confidence: 'high',
          extractedFrom: 'country',
          matchedText: data.name
        }
      }
    }
  }

  return null
}

/**
 * Detect US state mentions
 */
function detectUSState(text: string): LocationInfo | null {
  const lowerText = text.toLowerCase()

  // Problematic abbreviations that are common words
  const problematicAbbrs = ['in', 'or', 'me', 'hi', 'oh', 'id', 'ok', 'pa', 'ms', 'al', 'ma', 'la', 'de', 'ar', 'co', 'ca', 'wa', 'mi', 'mo']

  for (const [abbr, data] of Object.entries(US_STATES)) {
    // Always check full state name first
    const fullNameRegex = new RegExp(`\\b${data.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (fullNameRegex.test(lowerText)) {
      return {
        country: 'United States',
        region: data.name,
        coordinates: { lat: data.lat, lng: data.lng },
        confidence: 'high',
        extractedFrom: 'state',
        matchedText: data.name
      }
    }

    // Only match abbreviations if NOT in problematic list
    if (!problematicAbbrs.includes(abbr.toLowerCase())) {
      const abbrRegex = new RegExp(`\\b${abbr}\\b`, 'i')
      if (abbrRegex.test(lowerText)) {
        return {
          country: 'United States',
          region: data.name,
          coordinates: { lat: data.lat, lng: data.lng },
          confidence: 'medium',
          extractedFrom: 'state',
          matchedText: abbr
        }
      }
    } else {
      // For problematic abbreviations, only match in political contexts
      const contextRegex = new RegExp(`\\b${abbr}\\s+(primary|election|governor|senate|representative|district|state)`, 'i')
      if (contextRegex.test(lowerText)) {
        return {
          country: 'United States',
          region: data.name,
          coordinates: { lat: data.lat, lng: data.lng },
          confidence: 'high',
          extractedFrom: 'state',
          matchedText: `${abbr} (${data.name})`
        }
      }
    }
  }

  return null
}

/**
 * Batch extract locations
 */
export function batchExtractLocations(
  markets: Array<{ title: string; description?: string; category?: string }>
): Map<number, LocationInfo> {
  const locations = new Map<number, LocationInfo>()

  markets.forEach((market, index) => {
    const location = extractLocation(market.title, market.description)
    if (location) {
      locations.set(index, location)
    }
  })

  return locations
}

/**
 * Enhance location data with market context
 */
export function enrichLocationData(
  location: LocationInfo,
  marketData: { category?: string; tags?: string[] }
): LocationInfo {
  // Confidence boost for matching categories
  if (marketData.category) {
    const category = marketData.category.toLowerCase()

    if (category.includes('sports') && location.extractedFrom === 'sports') {
      location.confidence = 'high'
    }

    if (category.includes('international') && location.country) {
      location.confidence = 'high'
    }

    if (category.includes('us') && location.country === 'United States') {
      location.confidence = 'high'
    }
  }

  return location
}

/**
 * Check if a market category is likely geo-relevant
 */
export function isGeoRelevantCategory(category?: string): boolean {
  if (!category) return false

  const geoCategories = [
    'politics',
    'elections',
    'weather',
    'sports',
    'economics',
    'international',
    'news',
    'geopolitics',
  ]

  return geoCategories.some(cat =>
    category.toLowerCase().includes(cat)
  )
}
