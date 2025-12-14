/**
 * Location Extraction and Geocoding Utilities
 *
 * Extracts location information from market titles and descriptions,
 * then geocodes them to coordinates for map display.
 */

import { COUNTRY_COORDINATES, CITY_COORDINATES, US_STATES } from './geo-data'

export interface LocationInfo {
  country?: string
  region?: string
  city?: string
  coordinates?: {
    lat: number
    lng: number
  }
  confidence: 'high' | 'medium' | 'low'
  extractedFrom: 'country' | 'city' | 'state' | 'region' | 'pattern' | 'none'
}

/**
 * Extract location from market title and description
 */
export function extractLocation(title: string, description?: string): LocationInfo | null {
  const text = `${title} ${description || ''}`.toLowerCase()

  // Try city detection first (most specific and reliable)
  const cityMatch = detectCity(text)
  if (cityMatch) {
    return cityMatch
  }

  // Try US state detection (before country to catch state-specific markets)
  const stateMatch = detectUSState(text)
  if (stateMatch) {
    return stateMatch
  }

  // Try pattern-based extraction (e.g., "in Paris", "temperature in Dallas")
  const patternMatch = extractLocationPattern(text)
  if (patternMatch) {
    return patternMatch
  }

  // Try country detection last (least specific, but still useful)
  const countryMatch = detectCountry(text)
  if (countryMatch) {
    return countryMatch
  }

  return null
}

/**
 * Detect country mentions
 */
function detectCountry(text: string): LocationInfo | null {
  // Check for country names and common variations
  for (const [country, data] of Object.entries(COUNTRY_COORDINATES)) {
    const variations = [
      country.toLowerCase(),
      data.demonym?.toLowerCase(),
      ...(data.aliases || []).map(a => a.toLowerCase())
    ].filter(Boolean)

    for (const variation of variations) {
      // Word boundary matching to avoid false positives
      const regex = new RegExp(`\\b${variation}\\b`, 'i')
      if (regex.test(text)) {
        return {
          country: data.name,
          coordinates: {
            lat: data.lat,
            lng: data.lng
          },
          confidence: 'high',
          extractedFrom: 'country'
        }
      }
    }
  }

  return null
}

/**
 * Detect city mentions
 */
function detectCity(text: string): LocationInfo | null {
  for (const [city, data] of Object.entries(CITY_COORDINATES)) {
    const regex = new RegExp(`\\b${city.toLowerCase()}\\b`, 'i')
    if (regex.test(text)) {
      return {
        city: data.name,
        country: data.country,
        region: data.region,
        coordinates: {
          lat: data.lat,
          lng: data.lng
        },
        confidence: 'high',
        extractedFrom: 'city'
      }
    }
  }

  return null
}

/**
 * Detect US state mentions
 */
function detectUSState(text: string): LocationInfo | null {
  // Problematic 2-letter abbreviations that are common English words
  const problematicAbbrs = ['in', 'or', 'me', 'hi', 'oh', 'id', 'ok', 'pa', 'ms', 'al', 'ma', 'la', 'de', 'ar', 'co', 'ca', 'wa', 'mi', 'mo']

  for (const [abbr, data] of Object.entries(US_STATES)) {
    // Always check full state name first (highest priority)
    const fullNameRegex = new RegExp(`\\b${data.name.toLowerCase()}\\b`, 'i')

    if (fullNameRegex.test(text)) {
      return {
        country: 'United States',
        region: data.name,
        coordinates: {
          lat: data.lat,
          lng: data.lng
        },
        confidence: 'high',
        extractedFrom: 'state'
      }
    }

    // Only match abbreviations if NOT in the problematic list
    // or if they appear in specific political/geographic contexts
    if (!problematicAbbrs.includes(abbr.toLowerCase())) {
      const abbrRegex = new RegExp(`\\b${abbr}\\b`, 'i')

      if (abbrRegex.test(text)) {
        return {
          country: 'United States',
          region: data.name,
          coordinates: {
            lat: data.lat,
            lng: data.lng
          },
          confidence: 'medium',
          extractedFrom: 'state'
        }
      }
    } else {
      // For problematic abbreviations, only match in political contexts
      const contextRegex = new RegExp(`\\b${abbr}\\s+(primary|election|governor|senate|representative|district|state)`, 'i')

      if (contextRegex.test(text)) {
        return {
          country: 'United States',
          region: data.name,
          coordinates: {
            lat: data.lat,
            lng: data.lng
          },
          confidence: 'high',
          extractedFrom: 'state'
        }
      }
    }
  }

  return null
}

/**
 * Extract location using patterns (e.g., "in Paris", "at NYC", "temperature in Dallas")
 */
function extractLocationPattern(text: string): LocationInfo | null {
  // Common patterns: "in [location]", "at [location]", "[metric] in [location]"
  const patterns = [
    /\bin\s+([A-Z][a-zA-Z\s]+?)(?:\s+on|\s+before|\s+after|\s+by|\?|$)/,
    /\bat\s+([A-Z][a-zA-Z\s]+?)(?:\s+on|\s+before|\s+after|\s+by|\?|$)/,
    /temperature\s+in\s+([A-Z][a-zA-Z\s]+?)(?:\s+on|\?|$)/i,
    /weather\s+in\s+([A-Z][a-zA-Z\s]+?)(?:\s+on|\?|$)/i,
    /\b([A-Z][a-zA-Z\s]+?)\s+(?:election|vote|referendum)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const location = match[1].trim()

      // Try to geocode the extracted location
      const cityMatch = detectCity(location.toLowerCase())
      if (cityMatch) {
        return { ...cityMatch, confidence: 'medium' }
      }

      const countryMatch = detectCountry(location.toLowerCase())
      if (countryMatch) {
        return { ...countryMatch, confidence: 'medium' }
      }

      const stateMatch = detectUSState(location.toLowerCase())
      if (stateMatch) {
        return { ...stateMatch, confidence: 'medium' }
      }
    }
  }

  return null
}

/**
 * Batch extract locations from multiple markets
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
 * Check if a market is likely to have a location based on its category
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

/**
 * Enhance location data with additional context
 */
export function enrichLocationData(
  location: LocationInfo,
  marketData: { category?: string; tags?: string[] }
): LocationInfo {
  // Add confidence boost if category matches location type
  if (marketData.category) {
    const category = marketData.category.toLowerCase()

    if (category.includes('international') && location.country) {
      location.confidence = 'high'
    }

    if (category.includes('us') && location.country === 'United States') {
      location.confidence = 'high'
    }
  }

  return location
}
