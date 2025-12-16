// Test script to verify location detection is working

const LOCATION_COORDINATES = {
  'iran': { lat: 32.4279, lng: 53.6880 },
  'ghana': { lat: 7.9465, lng: -1.0232 },
  'brazil': { lat: -14.2350, lng: -51.9253 },
  'united states': { lat: 39.8283, lng: -98.5795 },
};

function inferLocation(title, description = '') {
  const searchText = `${title} ${description}`.toLowerCase();
  const locationKeys = Object.keys(LOCATION_COORDINATES).sort((a, b) => b.length - a.length);

  // Helper function to check if a country is mentioned in a relevant context
  const findCountryInContext = (text) => {
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

  return undefined;
}

// Test cases
const testCases = [
  { title: 'Iran wins 2026 FIFA World Cup', expected: 'Iran' },
  { title: 'Brazil wins the 2026 FIFA World Cup', expected: 'Brazil' },
  { title: 'Will Ghana win World Cup 2026?', expected: 'Ghana' },
  { title: 'US election 2024', expected: 'United States' },
];

console.log('Testing location detection fixes:\n');
testCases.forEach((test, idx) => {
  const result = inferLocation(test.title);
  const success = result?.name?.toLowerCase() === test.expected.toLowerCase();
  console.log(`Test ${idx + 1}: ${success ? '✓' : '✗'}`);
  console.log(`  Title: "${test.title}"`);
  console.log(`  Expected: ${test.expected}`);
  console.log(`  Got: ${result ? result.name : 'undefined'}`);
  if (result) {
    console.log(`  Coords: lat ${result.coordinates.lat}, lng ${result.coordinates.lng}`);
  }
  console.log('');
});
