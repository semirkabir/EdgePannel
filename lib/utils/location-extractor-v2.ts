/**
 * Smart Location Extraction Engine v2
 *
 * Context-aware location detection that understands:
 * - Sports teams → Home cities
 * - Political figures → Their countries
 * - Multiple locations → Most relevant one
 * - Explicit patterns → "in Paris", "at Tokyo", etc.
 */

import nlp from 'compromise'
// import { GoogleGenerativeAI } from "@google/generative-ai" // Removed
import { COUNTRY_COORDINATES, CITY_COORDINATES, US_STATES } from './geo-data'
import { detectSportsTeam, SPORTS_TEAMS } from './sports-teams'
import { detectPoliticalEntity, POLITICAL_ENTITIES } from './political-entities'

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
 * Smart location extraction with context awareness (Regex/Heuristic)
 */
export function extractLocationRegex(title: string, description?: string): LocationInfo | null {
  const text = `${title} ${description || ''}`
  const lowerText = text.toLowerCase()

  console.log(`[Location] Analyzing: "${title.substring(0, 100)}"`)

  // Priority 0: Exclusions (Crypto matches should NOT be geotagged)
  if (/\b(bitcoin|ethereum|solana|btc|eth|sol|crypto|cryptocurrency|doge)\b/i.test(text)) {
    console.log(`[Location] ✗ Crypto exclusion (Skipping map)`)
    return null
  }

  // Priority 1: Explicit location patterns ("in [Location]", "at [Location]")
  const patternMatch = extractExplicitPattern(text)
  if (patternMatch) {
    console.log(`[Location] ✓ Pattern → ${patternMatch.matchedText}`)
    return patternMatch
  }

  // Priority 1.5: Special Topic Rules (e.g. Movies -> Hollywood)
  if (/\b(movie|film|cinema|box office|academy award|oscar|hollywood|best picture|best actor|best actress|best director|opening weekend)\b/i.test(text)) {
    const laData = CITY_COORDINATES['los angeles']
    if (laData) {
      console.log(`[Location] ✓ Special Topic (Movie) → Los Angeles`)
      return {
        city: laData.name,
        country: laData.country,
        region: laData.region,
        coordinates: { lat: laData.lat, lng: laData.lng },
        confidence: 'high',
        extractedFrom: 'pattern',
        matchedText: 'Movie/Hollywood Context'
      }
    }
  }

  // Priority 1.6: Tech/AI Rules (e.g. OpenAI -> SF)
  if (/\b(openai|sam altman|chatgpt|gpt-4|gpt-5|sora)\b/i.test(text)) {
    const sfData = CITY_COORDINATES['san francisco']
    if (sfData) {
      console.log(`[Location] ✓ Special Topic (OpenAI) → San Francisco`)
      return {
        city: sfData.name,
        country: sfData.country,
        region: sfData.region,
        coordinates: { lat: sfData.lat, lng: sfData.lng },
        confidence: 'high',
        extractedFrom: 'pattern',
        matchedText: 'OpenAI Context'
      }
    }
  }

  // Priority 1.7: Economics/Fed Rules (e.g. Fed/Interest Rates -> Washington DC)
  if (/\b(fed|federal reserve|interest rates?|fomc|inflation|cpi|pce)\b/i.test(text)) {
    const dcData = CITY_COORDINATES['washington']
    if (dcData) {
      console.log(`[Location] ✓ Special Topic (Fed/Econ) → Washington DC`)
      return {
        city: dcData.name,
        country: dcData.country,
        region: dcData.region,
        coordinates: { lat: dcData.lat, lng: dcData.lng },
        confidence: 'high',
        extractedFrom: 'pattern',
        matchedText: 'Fed/Economics Context'
      }
    }
  }

  // Priority 1.8: Tech/Microsoft Rules (e.g. Microsoft -> Redmond)
  if (/\b(microsoft|satya nadella|windows|xbox|surface)\b/i.test(text)) {
    const redmondData = CITY_COORDINATES['redmond']
    if (redmondData) {
      console.log(`[Location] ✓ Special Topic (Microsoft) → Redmond`)
      return {
        city: redmondData.name,
        country: redmondData.country,
        region: redmondData.region,
        coordinates: { lat: redmondData.lat, lng: redmondData.lng },
        confidence: 'high',
        extractedFrom: 'pattern',
        matchedText: 'Microsoft Context'
      }
    }
  }

  // Priority 1.9: Tech/Apple Rules (e.g. Apple -> Cupertino)
  if (/\b(apple|tim cook|iphone|macbook|ios|vision pro)\b/i.test(text)) {
    const cupertinoData = CITY_COORDINATES['cupertino']
    if (cupertinoData) {
      console.log(`[Location] ✓ Special Topic (Apple) → Cupertino`)
      return {
        city: cupertinoData.name,
        country: cupertinoData.country,
        region: cupertinoData.region,
        coordinates: { lat: cupertinoData.lat, lng: cupertinoData.lng },
        confidence: 'high',
        extractedFrom: 'pattern',
        matchedText: 'Apple Context'
      }
    }
  }

  // Priority 2: City mentions (specific coordinates)
  // Check for cities BEFORE politicians to catch "Trump in NYC" -> NYC
  const cityMatch = detectCity(text)
  if (cityMatch) {
    console.log(`[Location] ✓ City → ${cityMatch.city}`)
    return cityMatch
  }

  // Priority 3: US State mentions
  // Check states before politicians to catch "Biden in Michigan" -> Michigan
  const stateMatch = detectUSState(text)
  if (stateMatch) {
    console.log(`[Location] ✓ State → ${stateMatch.region}`)
    return stateMatch
  }

  // Priority 4: Sports teams
  // Specific to home stadiums/cities
  const sportsMatch = detectSportsTeam(text)
  if (sportsMatch && isSportsContext(lowerText)) {
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

  // Priority 5: Political entities
  // These provide a "Default Home Location" for the subject (e.g. Trump -> FL)
  // Used as a fallback if no specific event location is found
  const politicalMatch = detectPoliticalEntity(text)
  if (politicalMatch) {
    // Check for explicit city override (e.g. Newsom -> Sacramento)
    if (politicalMatch.city) {
      const cityKey = politicalMatch.city.toLowerCase()
      // Check if city exists in our database, or try to find it if it's a "display name" vs key issue
      // Assuming keys are lowercase names or we can find by name
      let cityData = CITY_COORDINATES[cityKey] // direct key match

      if (!cityData) {
        // try finding by name value 
        const foundKey = Object.keys(CITY_COORDINATES).find(k => CITY_COORDINATES[k].name.toLowerCase() === cityKey)
        if (foundKey) cityData = CITY_COORDINATES[foundKey]
      }

      if (cityData) {
        console.log(`[Location] ✓ Political entity city override → ${politicalMatch.entity} (${cityData.name})`)
        return {
          city: cityData.name,
          country: cityData.country,
          region: cityData.region,
          coordinates: { lat: cityData.lat, lng: cityData.lng },
          confidence: 'high',
          extractedFrom: 'pattern',
          matchedText: politicalMatch.entity
        }
      }
    }

    // If US politician with a state, use state coordinates
    if (politicalMatch.country === 'United States' && politicalMatch.state) {
      const stateData = Object.values(US_STATES).find(s => s.name === politicalMatch.state)
      if (stateData) {
        console.log(`[Location] ✓ Political entity → ${politicalMatch.entity} (${politicalMatch.state})`)
        return {
          country: 'United States',
          region: stateData.name,
          coordinates: { lat: stateData.lat, lng: stateData.lng },
          confidence: 'high',
          extractedFrom: 'pattern', // Keeping 'pattern' or maybe 'context'
          matchedText: politicalMatch.entity
        }
      }
    }

    // Otherwise use country coordinates
    const countryData = Object.values(COUNTRY_COORDINATES).find(c => c.name === politicalMatch.country)
    if (countryData) {
      console.log(`[Location] ✓ Political entity → ${politicalMatch.entity} (${politicalMatch.country})`)
      return {
        country: countryData.name,
        coordinates: { lat: countryData.lat, lng: countryData.lng },
        confidence: 'high',
        extractedFrom: 'pattern',
        matchedText: politicalMatch.entity
      }
    }
  }

  // Priority 6: Context-aware country detection
  // General mentions of countries
  const countryMatch = detectCountryWithContext(text, lowerText)
  if (countryMatch) {
    console.log(`[Location] ✓ Country → ${countryMatch.country}`)
    return countryMatch
  }

  console.log(`[Location] ✗ No location found`)
  return null
}

/**
 * Check if text has sports context keywords
 * Helps avoid false positives from partial team name matches
 */
function isSportsContext(lowerText: string): boolean {
  const sportsKeywords = [
    'vs', 'vs.', 'versus', 'v.', 'v ',
    'game', 'match', 'playoff', 'championship', 'season', 'finals',
    'win', 'wins', 'winning', 'won', 'lose', 'defeat',
    'spread', 'odds', 'over', 'under', 'total', 'points',
    'score', 'nfl', 'nba', 'mlb', 'nhl', 'league',
    'team', 'super bowl', 'stanley cup', 'world series',
    'conference', 'division', 'regular season'
  ]

  return sportsKeywords.some(keyword => lowerText.includes(keyword))
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

  // Heuristic 1: For "X and Y meet in/at Z", pick Z (the location)
  // This must come FIRST to avoid picking the wrong country
  const meetingMatch = lowerText.match(/meet\s+(?:next\s+)?(?:in|at)\s+([a-z\s]+?)(?:\s|$|[,?.!])/)
  if (meetingMatch) {
    const meetingPlace = meetingMatch[1].trim()
    const meetingCountry = foundCountries.find(c =>
      c.country.toLowerCase() === meetingPlace ||
      c.country.toLowerCase().includes(meetingPlace) ||
      meetingPlace.includes(c.country.toLowerCase())
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

  // Heuristic 2: For "X invade Y", pick Y (the target)
  const invasionMatch = lowerText.match(/([a-z]+)\s+(?:invade|invades|invasion of|attack|attacks|strike|strikes)\s+([a-z\s]+?)(?:\s|$|[,?.!])/)
  if (invasionMatch) {
    const target = invasionMatch[2].trim()
    const targetCountry = foundCountries.find(c =>
      c.country.toLowerCase() === target ||
      c.country.toLowerCase().includes(target) ||
      target.includes(c.country.toLowerCase())
    )
    if (targetCountry) {
      console.log(`[Location] → Selected ${targetCountry.country} (invasion/strike target)`)
      return {
        country: targetCountry.data.name,
        coordinates: { lat: targetCountry.data.lat, lng: targetCountry.data.lng },
        confidence: 'high',
        extractedFrom: 'context',
        matchedText: targetCountry.data.name
      }
    }
  }

  // Heuristic 3: Look for subject indicators (political context)
  const subjectKeywords = ['prime minister', 'president', 'election', 'government', 'capital', 'leader', 'minister', 'parliament', 'senate', 'congress']
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
    ].filter((v): v is string => typeof v === 'string')

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

  // Problematic abbreviations that are common words (but allow "in" for Indiana in context)
  const problematicAbbrs = ['or', 'me', 'hi', 'oh', 'id', 'ok', 'pa', 'ms', 'al', 'ma', 'la', 'de', 'ar', 'co', 'ca', 'wa', 'mi', 'mo']

  // Enhanced political/state context patterns
  const stateContextKeywords = [
    'primary', 'election', 'governor', 'senate', 'senator', 'representative', 'district',
    'state', 'legislature', 'assembly', 'ballot', 'vote', 'poll', 'campaign',
    'caucus', 'referendum', 'attorney general', 'secretary of state', 'house race',
    'congressional', 'midterm', 'general election', 'runoff', 'recall'
  ]

  // Check for explicit US state patterns first
  const explicitStatePatterns = [
    /\b([\w\s]+?)\s+(governor|senate|senator|primary|election|state\s+election|state\s+legislature)/gi,
    /\bwin\s+([\w\s]+?)(?:\s+in\s+\d{4}|\?)/gi,
    /\b([\w\s]+?)\s+(?:ballot|referendum|proposition)/gi
  ]

  for (const pattern of explicitStatePatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        const potentialState = match[1].trim().toLowerCase()

        // Try to match this to a state
        for (const [abbr, data] of Object.entries(US_STATES)) {
          if (data.name.toLowerCase() === potentialState ||
            abbr.toLowerCase() === potentialState) {
            return {
              country: 'United States',
              region: data.name,
              coordinates: { lat: data.lat, lng: data.lng },
              confidence: 'high',
              extractedFrom: 'state',
              matchedText: data.name
            }
          }
        }
      }
    }
  }

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

    // Special handling for "IN" - only match if followed by context or if it's clearly Indiana
    if (abbr.toLowerCase() === 'in') {
      // Match "Indiana" or "IN" in political context
      const indianaContextRegex = new RegExp(`\\b(indiana|in)\\s+(${stateContextKeywords.join('|')})`, 'i')
      if (indianaContextRegex.test(lowerText)) {
        return {
          country: 'United States',
          region: data.name,
          coordinates: { lat: data.lat, lng: data.lng },
          confidence: 'high',
          extractedFrom: 'state',
          matchedText: data.name
        }
      }
      continue
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
      const contextRegex = new RegExp(`\\b${abbr}\\s+(${stateContextKeywords.join('|')})`, 'i')
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

/**
 * Smart Batch Location Extraction (Async with LLM)
 * - Tries Regex first (free, fast)
 * - Batches remaining items for Gemini LLM (to save requests/time)
 * - Rate limits LLM calls to respect free tier (15 RPM -> ~4s delay)
 */
export async function batchExtractLocationsSmart(
  markets: Array<{ id?: string; title: string; description?: string }>
): Promise<Map<number, LocationInfo>> {
  const results = new Map<number, LocationInfo>()
  const locationCache = new Map<string, LocationInfo | null>()

  // 1. Prepare items for LLM (Filter out obvious exclusions OR easy Regex wins)
  markets.forEach((market, index) => {
    // Quick check for Crypto/Exclusions only - saves LLM from obvious junk
    if (/\\b(bitcoin|ethereum|solana|btc|eth|sol|crypto|cryptocurrency|doge)\\b/i.test(market.title)) {
      return // Skip crypto entirely
    }

    const cacheKey = `${market.title}|${market.description || ''}`
    let regexResult: LocationInfo | null = null

    if (locationCache.has(cacheKey)) {
      regexResult = locationCache.get(cacheKey) || null
    } else {
      // TRY REGEX/HEURISTIC FIRST (Free & Fast & Accurate for known entities)
      regexResult = extractLocationRegex(market.title, market.description)

      // Fallback: Try "compromise" NLP if regex failed
      if (!regexResult) {
        try {
          const doc = nlp(market.title)

          // Look for recognized places
          const places = doc.places().json()
          if (places && places.length > 0) {
            const placeName = places[0].text
            // Try to match this place name against our known coordinates
            const cityMatch = detectCity(placeName)
            if (cityMatch) {
              regexResult = cityMatch
              console.log(`[Location] 🧠 NLP (Compromise) matched city: ${placeName}`)
            } else {
              // Try country match
              const countryMatch = detectCountry(placeName)
              if (countryMatch) {
                regexResult = countryMatch
                console.log(`[Location] 🧠 NLP (Compromise) matched country: ${placeName}`)
              }
            }
          }
        } catch (e) {
          // NLP error, ignore
        }
      }

      // Cache the result
      locationCache.set(cacheKey, regexResult)
    }

    if (regexResult && (regexResult.confidence === 'high' || regexResult.confidence === 'medium')) {
      // If we found a match locally, USE IT!
      // But if it's a broad region (Country/State), apply randomization so dots don't stack
      let coords = regexResult.coordinates
      if (coords && !regexResult.city) {
        // It's a broad region (no specific city), so fuzz the coordinates slightly
        // +/- 1.5 degree is roughly ~150km, good for separating dots in a country
        coords = {
          lat: coords.lat + (Math.random() - 0.5) * 3.0,
          lng: coords.lng + (Math.random() - 0.5) * 3.0
        }
      }

      results.set(index, {
        ...regexResult,
        coordinates: coords // Use randomized coords if applicable
      })
      return
    }

    // LLM Disabled by user request. Local only.
    // matches that fail Regex + NLP are simply not geotagged.
  })

  // Log summary
  console.log(`[Location] ⚡ Processed ${markets.length} items locally. Found ${results.size} locations.`)
  return results
}

/**
 * Legacy sync batch extractor (deprecated in favor of smart one)
 */
export function batchExtractLocations(
  markets: Array<{ title: string; description?: string; category?: string }>
): Map<number, LocationInfo> {
  const locations = new Map<number, LocationInfo>()

  markets.forEach((market, index) => {
    const location = extractLocationRegex(market.title, market.description)
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

  // Distribute country-level markets randomly across the country
  // This prevents all "US Election" markets from stacking on the geographic center of the US
  // Apply this to ANY location that is just a country (no city/region), regardless of extraction method
  const isCountryLevel = location.country && !location.city && (!location.region || location.region === location.country)

  if (isCountryLevel) {
    // Find country data to get bounds
    const countryEntry = Object.values(COUNTRY_COORDINATES).find(c => c.name === location.country)

    if (countryEntry && countryEntry.bounds) {
      const [minLat, minLng, maxLat, maxLng] = countryEntry.bounds

      // Generate random coordinates within bounds
      // Add a slight buffer (5%) from edges to ensure we don't put points right on the border/ocean
      const latBuffer = (maxLat - minLat) * 0.05
      const lngBuffer = (maxLng - minLng) * 0.05

      const safeMinLat = minLat + latBuffer
      const safeMaxLat = maxLat - latBuffer
      const safeMinLng = minLng + lngBuffer
      const safeMaxLng = maxLng - lngBuffer

      const randomLat = safeMinLat + Math.random() * (safeMaxLat - safeMinLat)
      const randomLng = safeMinLng + Math.random() * (safeMaxLng - safeMinLng)

      location.coordinates = {
        lat: Number(randomLat.toFixed(4)),
        lng: Number(randomLng.toFixed(4))
      }

      console.log(`[Location] 🎲 Spread ${location.country} market to ${randomLat.toFixed(2)}, ${randomLng.toFixed(2)}`)
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

/**
 * Main Location Extraction Entry Point (Async for compatibility, but purely local)
 * Tries heuristics first, then falls back to NLP.
 */
export async function extractLocation(title: string, description?: string): Promise<LocationInfo | null> {
  // 1. Try Regex/Heuristic
  let location = extractLocationRegex(title, description)

  // 2. Try NLP (Compromise)
  if (!location) {
    try {
      const doc = nlp(title)
      const places = doc.places().json()
      if (places && places.length > 0) {
        const placeName = places[0].text
        const cityMatch = detectCity(placeName)
        if (cityMatch) return cityMatch

        const countryMatch = detectCountry(placeName)
        if (countryMatch) return countryMatch
      }
    } catch (e) {
      // ignore
    }
  }

  // Randomize if broad region
  if (location && location.coordinates && !location.city) {
    location.coordinates = {
      lat: location.coordinates.lat + (Math.random() - 0.5) * 4.0,
      lng: location.coordinates.lng + (Math.random() - 0.5) * 4.0
    }
  }

  return location
}
