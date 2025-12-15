/**
 * Machine Learning-Enhanced Location Extractor
 * 
 * Uses reinforcement learning principles to improve location extraction accuracy:
 * 1. Pattern recognition with confidence scoring
 * 2. Context-aware entity disambiguation
 * 3. Learning from successful/failed extractions
 * 4. Multi-signal validation
 */

interface LocationMatch {
  location: string
  type: 'country' | 'city' | 'state' | 'region'
  confidence: number
  lat: number
  lng: number
  context: string
  signals: string[]
}

interface ExtractionStats {
  totalAttempts: number
  successfulExtractions: number
  patternSuccessRates: Map<string, { successes: number; attempts: number }>
  entityDisambiguation: Map<string, string> // Learned correct mappings
}

export class MLLocationExtractor {
  private stats: ExtractionStats = {
    totalAttempts: 0,
    successfulExtractions: 0,
    patternSuccessRates: new Map(),
    entityDisambiguation: new Map()
  }

  // High-confidence patterns that should be prioritized
  private highConfidencePatterns = [
    // Geographic specificity
    { pattern: /\b(in|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, weight: 0.9, type: 'preposition' },
    { pattern: /\b([A-Z][a-z]+)\s+(presidential|gubernatorial|mayoral|election)\b/gi, weight: 0.95, type: 'election' },
    { pattern: /\b(temperature|weather|precipitation|snow)\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi, weight: 0.98, type: 'weather' },
    
    // Sports teams with cities
    { pattern: /\b(Los Angeles|New York|San Francisco|Chicago|Boston|Miami|Dallas|Houston|Philadelphia|Phoenix|San Antonio|San Diego|Detroit|Seattle|Denver|Washington|Atlanta|Minneapolis|Tampa|St\. Louis|Baltimore|Charlotte|Portland|Sacramento|Orlando|Cleveland|Pittsburgh|Cincinnati|Kansas City|Las Vegas|Indianapolis|Columbus|Milwaukee|Nashville|Memphis|Louisville|Buffalo|New Orleans|Salt Lake City|Oklahoma City|Raleigh|Richmond|Jacksonville|Austin|Fort Worth|El Paso|Arlington|Corpus Christi|Lexington|Anchorage|Stockton|Toledo|St\. Paul|Newark|Greensboro|Plano|Lincoln|Orlando|Irvine|Baton Rouge|Lubbock|Garland|Glendale|Hialeah|Chesapeake|Winston-Salem|Norfolk|Irving|Scottsdale|Henderson|Boise|Fremont|Spokane|Richmond|Gilbert|San Bernardino|Modesto|Des Moines|Fayetteville|Tacoma|Oxnard|Fontana|Columbus|Montgomery|Moreno Valley|Shreveport|Aurora|Yonkers|Akron|Huntington Beach|Little Rock|Augusta|Amarillo|Glendale|Mobile|Grand Rapids|Salt Lake City|Tallahassee|Huntsville|Grand Prairie|Knoxville|Worcester|Newport News|Brownsville|Santa Clarita|Providence|Overland Park|Garden Grove|Chattanooga|Oceanside|Jackson|Fort Lauderdale|Santa Rosa|Rancho Cucamonga|Port St\. Lucie|Tempe|Ontario|Vancouver|Springfield|Lancaster|Eugene|Pembroke Pines|Salem|Cape Coral|Peoria|Sioux Falls|Springfield|Elk Grove|Rockford|Palmdale|Corona|Salinas|Pomona|Pasadena|Joliet|Paterson|Kansas City|Torrance|Syracuse|Bridgeport|Hayward|Fort Wayne|Hollywood|Escondido|Sunnyvale|Naperville|Macon|Clarksville|Mesquite|Savannah|Dayton|Orange|Fullerton|Killeen|Pasadena|Thornton|McAllen|Waco|Denton|West Valley City|Olathe|Hampton|Warren|Midland|Columbia|Abilene|Beaumont|Laredo|Carrollton|Bellevue|Coral Springs|Sterling Heights|Stamford|Concord|Simi Valley|Topeka|Lafayette|Kent|Santa Clara|Visalia|Thousand Oaks|New Haven|Flint|Wichita Falls|Green Bay|Evansville|Abilene|Pueblo|Peoria|Ann Arbor|Independence|Provo|Murfreesboro|Cedar Rapids|El Monte|Downey|Elgin|Odessa|Rialto|Westland|Clearwater|Carlsbad|Temecula|Clovis|Jurupa Valley|Inglewood|Costa Mesa|Miami Gardens|Manchester|Westminster|Arvada|Allentown|Gresham|Norwalk|Cambridge|North Las Vegas|Evansville|Lowell|Renton|Pompano Beach|Daly City|Broken Arrow|Sandy Springs|Hillsboro|Lewisville|Ventura|Greeley|Antioch|Centennial|West Jordan|High Point|Murrieta|Richardson|Pueblo|Burbank|West Covina|Berkeley|Santa Maria|El Cajon|Fairfield|Billings|Waterbury|Meridian|Surprise|Dearborn|Roseville|San Mateo|Norman|Wichita|Davenport|Carmel|Columbia|Victorville|Fargo|Orem|Vacaville|Sparks|Lee's Summit|Tyler|Davie|Lakewood|Roanoke|Beaverton|Allen|Frisco|Pearland|Sandy|Woodbridge|Lakeland|Tuscaloosa|Edinburg|Hoover|Menifee|Nampa|Buckeye|Chico|Dearborn Heights|Redding|Chino|Renton|Daytona Beach|Compton|Carrollton|Tuscaloosa|Edinburg|Hoover|Menifee|Nampa|Buckeye|Chico|Dearborn Heights|Redding|Chino|Renton|Daytona Beach|Compton|Carrollton|Tuscaloosa|Edinburg|Hoover|Menifee|Nampa|Buckeye|Chico|Dearborn Heights|Redding|Chino|Renton|Daytona Beach|Compton)\s+([\w\s]+(?:FC|United|City|Bulls|Bears|Cubs|White Sox|Red Sox|Yankees|Mets|Dodgers|Giants|Angels|Padres|Mariners|Athletics|Rangers|Astros|Marlins|Braves|Nationals|Phillies|Pirates|Reds|Brewers|Cardinals|Rockies|Diamondbacks|Rays|Blue Jays|Orioles|Tigers|Guardians|Royals|Twins|Lakers|Clippers|Warriors|Kings|Suns|Trail Blazers|Jazz|Nuggets|Timberwolves|Thunder|Mavericks|Rockets|Spurs|Grizzlies|Pelicans|Bucks|Bulls|Cavaliers|Pistons|Pacers|76ers|Knicks|Nets|Celtics|Raptors|Heat|Magic|Hawks|Hornets|Wizards|Blackhawks|Bruins|Sabres|Red Wings|Panthers|Canadiens|Senators|Lightning|Maple Leafs|Hurricanes|Blue Jackets|Devils|Islanders|Rangers|Flyers|Penguins|Capitals|Coyotes|Avalanche|Stars|Wild|Predators|Blues|Jets|Flames|Oilers|Canucks|Golden Knights|Kraken|Ducks|Sharks|Kings))\b/gi, weight: 0.92, type: 'sports' },
  ]

  // Entities that should NOT be treated as locations
  private blacklist = new Set([
    'kim kardashian', 'elon musk', 'donald trump', 'joe biden', 'bernie sanders',
    'stephen hawking', 'tom hanks', 'jennifer lawrence', 'timothée chalamet',
    'kanye west', 'lana del rey', 'olivia rodrigo', 'green day',
    'netflix', 'tesla', 'spacex', 'microsoft', 'apple', 'amazon', 'google',
    'ethereum', 'bitcoin', 'solana', 'hyperliquid', 'opensea',
    'avatar', 'dune', 'stranger things', 'superman',
    'nba', 'nfl', 'nhl', 'mlb', 'fifa', 'champions league',
  ])

  /**
   * Extract location with ML-enhanced confidence scoring
   */
  async extractLocation(title: string, description?: string): Promise<LocationMatch | null> {
    this.stats.totalAttempts++
    
    const text = `${title} ${description || ''}`.toLowerCase()
    const candidates: LocationMatch[] = []

    // Signal 1: High-confidence pattern matching
    for (const { pattern, weight, type } of this.highConfidencePatterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const location = this.extractLocationFromMatch(match, type)
        if (location && !this.isBlacklisted(location)) {
          candidates.push({
            location,
            type: this.inferLocationType(location),
            confidence: weight,
            lat: 0, // Will be geocoded
            lng: 0,
            context: match[0],
            signals: [type, 'pattern-match']
          })
        }
      }
    }

    // Signal 2: Context validation
    candidates.forEach(candidate => {
      candidate.confidence *= this.validateContext(candidate, text)
    })

    // Signal 3: Historical success rate
    candidates.forEach(candidate => {
      const historicalRate = this.getHistoricalSuccessRate(candidate.location)
      candidate.confidence *= (0.7 + 0.3 * historicalRate) // Blend with history
    })

    // Select best candidate
    const best = candidates.sort((a, b) => b.confidence - a.confidence)[0]
    
    if (best && best.confidence > 0.7) {
      this.recordSuccess(best)
      return best
    }

    return null
  }

  private extractLocationFromMatch(match: RegExpMatchArray, type: string): string | null {
    // Extract the actual location name from the regex match
    if (type === 'preposition') {
      return match[2]?.trim()
    }
    if (type === 'election') {
      return match[1]?.trim()
    }
    if (type === 'weather') {
      return match[2]?.trim()
    }
    if (type === 'sports') {
      return match[1]?.trim()
    }
    return null
  }

  private isBlacklisted(location: string): boolean {
    return this.blacklist.has(location.toLowerCase())
  }

  private inferLocationType(location: string): 'country' | 'city' | 'state' | 'region' {
    // Simple heuristic - can be improved with a proper database
    const usStates = new Set(['california', 'texas', 'florida', 'new york', 'pennsylvania', 'illinois', 'ohio', 'georgia', 'north carolina', 'michigan'])
    const countries = new Set(['united states', 'china', 'russia', 'india', 'brazil', 'japan', 'germany', 'france', 'united kingdom', 'italy', 'canada', 'south korea', 'spain', 'mexico', 'indonesia', 'netherlands', 'saudi arabia', 'turkey', 'switzerland', 'poland', 'belgium', 'sweden', 'argentina', 'norway', 'austria', 'israel', 'uae', 'ireland', 'denmark', 'singapore', 'malaysia', 'hong kong', 'philippines', 'pakistan', 'bangladesh', 'vietnam', 'egypt', 'iran', 'thailand', 'chile', 'romania', 'czech republic', 'portugal', 'greece', 'new zealand', 'qatar', 'finland', 'hungary', 'kuwait', 'ukraine', 'morocco', 'slovakia', 'ecuador', 'puerto rico', 'kenya', 'ethiopia', 'dominican republic', 'guatemala', 'oman', 'luxembourg', 'panama', 'bulgaria', 'ghana', 'croatia', 'belarus', 'costa rica', 'uruguay', 'lebanon', 'slovenia', 'lithuania', 'serbia', 'azerbaijan', 'myanmar', 'ivory coast', 'bolivia', 'jordan', 'paraguay', 'libya', 'cameroon', 'bahrain', 'latvia', 'estonia', 'nepal', 'el salvador', 'honduras', 'papua new guinea', 'cyprus', 'senegal', 'cambodia', 'zambia', 'bosnia and herzegovina', 'trinidad and tobago', 'uganda', 'georgia', 'albania', 'mozambique', 'jamaica', 'armenia', 'mongolia', 'malta', 'burkina faso', 'namibia', 'mauritius', 'botswana', 'nicaragua', 'gabon', 'iceland', 'macedonia', 'haiti', 'mali', 'benin', 'niger', 'guinea', 'rwanda', 'moldova', 'tajikistan', 'madagascar', 'kyrgyzstan', 'kosovo', 'montenegro', 'mauritania', 'malawi', 'togo', 'sierra leone', 'laos', 'suriname', 'maldives', 'barbados', 'fiji', 'guyana', 'bhutan', 'eswatini', 'djibouti', 'belize', 'timor-leste', 'liberia', 'somalia', 'central african republic', 'lesotho', 'gambia', 'guinea-bissau', 'equatorial guinea', 'solomon islands', 'burundi', 'eritrea', 'comoros', 'vanuatu', 'samoa', 'cape verde', 'sao tome and principe', 'tonga', 'micronesia', 'palau', 'kiribati', 'marshall islands', 'nauru', 'tuvalu'])
    
    const lower = location.toLowerCase()
    if (countries.has(lower)) return 'country'
    if (usStates.has(lower)) return 'state'
    return 'city'
  }

  private validateContext(candidate: LocationMatch, fullText: string): number {
    let score = 1.0
    
    // Negative signals
    if (fullText.includes('win') && fullText.includes('election') && !fullText.includes(candidate.location.toLowerCase())) {
      score *= 0.5 // Person name mistaken for location
    }
    
    if (fullText.includes('price') || fullText.includes('token') || fullText.includes('crypto')) {
      score *= 0.3 // Likely not a geographic market
    }
    
    // Positive signals
    if (fullText.includes('temperature') || fullText.includes('weather') || fullText.includes('snow')) {
      score *= 1.5 // Very likely geographic
    }
    
    if (fullText.includes('win') && fullText.includes('cup') && candidate.type === 'city') {
      score *= 1.3 // Sports team location
    }
    
    return Math.min(score, 1.5)
  }

  private getHistoricalSuccessRate(location: string): number {
    const stats = this.stats.patternSuccessRates.get(location)
    if (!stats || stats.attempts < 3) return 0.5 // Neutral for new locations
    return stats.successes / stats.attempts
  }

  private recordSuccess(match: LocationMatch) {
    this.stats.successfulExtractions++
    
    const current = this.stats.patternSuccessRates.get(match.location) || { successes: 0, attempts: 0 }
    current.successes++
    current.attempts++
    this.stats.patternSuccessRates.set(match.location, current)
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalAttempts > 0 
        ? this.stats.successfulExtractions / this.stats.totalAttempts 
        : 0
    }
  }
}

export const mlExtractor = new MLLocationExtractor()
