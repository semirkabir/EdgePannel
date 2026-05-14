#!/usr/bin/env node
/**
 * Build script: downloads dr5hn countries-states-cities database,
 * filters to important cities, and generates src/generated/geo-data.ts
 *
 * Run: node scripts/generate-geo-data.mjs
 */

import https from 'https';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'src', 'generated', 'geo-data.ts');

const RELEASE_URL = 'https://github.com/dr5hn/countries-states-cities-database/releases/download/v3.2-export.2/json-countries%2Bstates%2Bcities.json.gz';

// Cities we want to preserve from our manual list (with aliases).
// Format: cityName -> { country: expectedCountry, aliases: [...] }
// Aliases are ONLY applied when the database city is in the expected country.
const EXTRA_CITY_ALIASES = {
  'Washington': { country: 'United States', aliases: ['dc', 'washington dc', 'white house', 'congress', 'senate', 'fed', 'federal reserve'] },
  'New York': { country: 'United States', aliases: ['nyc', 'wall street', 'manhattan'] },
  'San Francisco': { country: 'United States', aliases: ['sf', 'openai'] },
  'Los Angeles': { country: 'United States', aliases: ['hollywood', 'la'] },
  'Delhi': { country: 'India', aliases: ['new delhi'] },
  'Kyiv': { country: 'Ukraine', aliases: ['kiev'] },
  'Gaza': { country: 'Palestinian Territory Occupied', aliases: ['gaza strip', 'gaza city'] },
  'Austin': { country: 'United States', aliases: ['tesla'] },
  'Starbase': { country: 'United States', aliases: ['spacex'] },
  'Barcelona': { country: 'Spain', aliases: ['barca'] },
  'St. Petersburg': { country: 'Russia', aliases: ['saint petersburg', 'leningrad'] },
  'Lisbon': { country: 'Portugal', aliases: ['lisboa'] },
  'Vienna': { country: 'Austria', aliases: ['wien'] },
  'Zurich': { country: 'Switzerland', aliases: ['zürich'] },
  'Prague': { country: 'Czech Republic', aliases: ['praha'] },
  'Munich': { country: 'Germany', aliases: ['münchen'] },
  'Milan': { country: 'Italy', aliases: ['milano'] },
  'Montreal': { country: 'Canada', aliases: ['montréal'] },
  'Bangalore': { country: 'India', aliases: ['bengaluru'] },
  'Chennai': { country: 'India', aliases: ['madras'] },
  'Kolkata': { country: 'India', aliases: ['calcutta'] },
  'Mumbai': { country: 'India', aliases: ['bombay'] },
  'Ho Chi Minh City': { country: 'Vietnam', aliases: ['saigon'] },
  'Guangzhou': { country: 'China', aliases: ['canton'] },
  'Astana': { country: 'Kazakhstan', aliases: ['nur-sultan', 'nursultan'] },
  'Hong Kong': { country: 'China', aliases: ['hk'] },
  'St. Louis': { country: 'United States', aliases: ['st louis', 'saint louis'] },
  'Dallas-Fort Worth': { country: 'United States', aliases: ['dfw', 'dallas fort worth'] },
};

// Hard-coded cities that are missing from the dr5hn dataset.
// These are injected after the database is processed.
const EXTRA_CITIES = [
  { name: 'New York', country: 'United States', region: 'New York', lat: 40.7128, lon: -74.0060, aliases: ['nyc', 'wall street', 'manhattan'] },
  { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369, aliases: ['dc', 'washington dc', 'white house', 'congress', 'senate', 'fed', 'federal reserve'] },
  { name: 'Austin', country: 'United States', region: 'Texas', lat: 30.2672, lon: -97.7431, aliases: ['tesla'] },
  { name: 'Gaza', country: 'Palestinian Territory Occupied', region: 'Gaza', lat: 31.5017, lon: 34.4668, aliases: ['gaza strip', 'gaza city'] },
  { name: 'Zurich', country: 'Switzerland', region: 'Zurich', lat: 47.3769, lon: 8.5417, aliases: ['zürich'] },
  { name: 'Montreal', country: 'Canada', region: 'Quebec', lat: 45.5017, lon: -73.5673, aliases: ['montréal'] },
  { name: 'Bangalore', country: 'India', region: 'Karnataka', lat: 12.9716, lon: 77.5946, aliases: ['bengaluru'] },
  { name: 'Astana', country: 'Kazakhstan', region: 'Astana', lat: 51.1605, lon: 71.4704, aliases: ['nur-sultan', 'nursultan'] },
  { name: 'Dallas-Fort Worth', country: 'United States', region: 'Texas', lat: 32.7767, lon: -96.7970, aliases: ['dfw', 'dallas fort worth'] },
  { name: 'Starbase', country: 'United States', region: 'Texas', lat: 25.9972, lon: -97.1561, aliases: ['spacex'] },
  { name: 'St. Petersburg', country: 'Russia', region: 'Saint Petersburg', lat: 59.9343, lon: 30.3351, aliases: ['saint petersburg', 'leningrad'] },
  { name: 'Hong Kong', country: 'China', region: 'Hong Kong', lat: 22.3193, lon: 114.1694, aliases: ['hk'] },
];

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'edgepannel-geo-generator' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchBuffer(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function fetchJson(url) {
  const buf = await fetchBuffer(url);
  let text;
  try { text = zlib.gunzipSync(buf).toString('utf8'); }
  catch { text = buf.toString('utf8'); }
  return JSON.parse(text);
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[.,']/g, '').trim();
}

async function main() {
  console.log('[generate-geo-data] Downloading dataset...');
  const data = await fetchJson(RELEASE_URL);

  if (!Array.isArray(data)) {
    throw new Error('Expected array of countries, got: ' + typeof data);
  }

  console.log(`[generate-geo-data] Loaded ${data.length} countries`);

  // Extract country capitals and state capitals
  const countryCapitals = new Set();
  const stateCapitals = new Set();
  for (const country of data) {
    if (country.capital) countryCapitals.add(country.capital.toLowerCase());
    for (const state of (country.states || [])) {
      if (state.capital) stateCapitals.add(state.capital.toLowerCase());
    }
  }

  // Build country data
  const countryData = {};
  for (const c of data) {
    const lat = parseFloat(c.latitude);
    const lon = parseFloat(c.longitude);
    if (isNaN(lat) || isNaN(lon)) continue;
    const aliases = [];
    if (c.capital) aliases.push(c.capital.toLowerCase());
    if (c.native) aliases.push(c.native.toLowerCase());
    const demonym = (c.nationality || '').toLowerCase().replace(/people$/, '').trim();
    countryData[c.name] = {
      name: c.name,
      lat,
      lon,
      demonym: demonym || undefined,
      aliases: aliases.length > 0 ? aliases : undefined,
    };
  }

  // Filter and index cities
  const cityMap = new Map(); // key: "name|country" -> CityData
  const cityIndex = new Map(); // key: normalized name -> [CityData]

  function addCity(name, countryName, stateName, lat, lon, aliases = []) {
    if (isNaN(lat) || isNaN(lon)) return;
    const key = `${name}|${countryName}|${stateName || ''}`;
    if (cityMap.has(key)) return;

    const entry = {
      name,
      country: countryName,
      region: stateName || undefined,
      lat,
      lon,
      aliases: aliases.length > 0 ? aliases : undefined,
    };

    cityMap.set(key, entry);

    const normalized = normalizeName(name);
    if (!cityIndex.has(normalized)) cityIndex.set(normalized, []);
    cityIndex.get(normalized).push(entry);

    for (const alias of aliases) {
      const aliasNorm = normalizeName(alias);
      if (!cityIndex.has(aliasNorm)) cityIndex.set(aliasNorm, []);
      cityIndex.get(aliasNorm).push(entry);
    }
  }

  const extraNames = new Set(Object.keys(EXTRA_CITY_ALIASES));

  for (const country of data) {
    const countryName = country.name;
    for (const state of (country.states || [])) {
      const stateName = state.name;
      for (const city of (state.cities || [])) {
        const cityName = city.name;
        const cityLower = cityName.toLowerCase();
        const isCapital = countryCapitals.has(cityLower) || stateCapitals.has(cityLower);
        const extraSpec = EXTRA_CITY_ALIASES[cityName];
        const extraAliases = extraSpec && (!extraSpec.country || extraSpec.country === countryName)
          ? extraSpec.aliases
          : undefined;

        if (isCapital || extraAliases) {
          const lat = parseFloat(city.latitude);
          const lon = parseFloat(city.longitude);
          addCity(cityName, countryName, stateName, lat, lon, extraAliases || []);
          extraNames.delete(cityName);
        }
      }
    }
  }

  // Inject hard-coded cities that are missing from the dataset
  for (const city of EXTRA_CITIES) {
    addCity(city.name, city.country, city.region, city.lat, city.lon, city.aliases || []);
  }

  // Warn about any extra aliases that were never applied (wrong country name or missing city)
  const remainingExtra = [...extraNames].filter(name => {
    const spec = EXTRA_CITY_ALIASES[name];
    return !EXTRA_CITIES.some(c => c.name === name);
  });
  if (remainingExtra.length > 0) {
    console.log(`[generate-geo-data] Warning: could not find these extra cities in dataset (check country name): ${remainingExtra.join(', ')}`);
  }

  console.log(`[generate-geo-data] Filtered to ${cityMap.size} cities`);

  // Sort city entries for deterministic output
  const sortedCities = [...cityMap.values()].sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country);
    return a.name.localeCompare(b.name);
  });

  // Build the CITY_INDEX as a plain object for easy serialization
  const cityIndexObj = {};
  for (const [key, entries] of cityIndex) {
    const seen = new Set();
    const deduped = [];
    for (const e of entries) {
      const k = `${e.name}|${e.country}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(e);
    }
    cityIndexObj[key] = deduped;
  }

  // Generate TypeScript
  const ts = `// Auto-generated by scripts/generate-geo-data.mjs
// Source: dr5hn/countries-states-cities-database (ODbL-1.0)
// Generated: ${new Date().toISOString()}
// Cities: ${sortedCities.length} (capitals + manually curated)

export interface CountryData {
  name: string;
  lat: number;
  lon: number;
  demonym?: string;
  aliases?: string[];
}

export interface CityData {
  name: string;
  country: string;
  region?: string;
  lat: number;
  lon: number;
  aliases?: string[];
}

export interface StateData {
  name: string;
  abbr: string;
  lat: number;
  lon: number;
  country: string;
  bounds?: [minLat: number, minLon: number, maxLat: number, maxLon: number];
}

export interface RegionData {
  name: string;
  country: string;
  lat: number;
  lon: number;
  aliases?: string[];
  bounds?: [minLat: number, minLon: number, maxLat: number, maxLon: number];
}

export const COUNTRY_DATA: Record<string, CountryData> = {
${Object.values(countryData).sort((a, b) => a.name.localeCompare(b.name)).map(c => {
  const aliasStr = c.aliases ? `, aliases: [${c.aliases.map(a => `'${a.replace(/'/g, "\\'")}'`).join(', ')}]` : '';
  const demStr = c.demonym ? `, demonym: '${c.demonym.replace(/'/g, "\\'")}'` : '';
  return `  '${c.name.toLowerCase()}': { name: '${c.name.replace(/'/g, "\\'")}', lat: ${c.lat}, lon: ${c.lon}${demStr}${aliasStr} }`;
}).join(',\n')},
};

// O(1) lookup index: normalized city name -> array of matching cities (handles duplicates across countries)
export const CITY_INDEX: Record<string, CityData[]> = {
${Object.entries(cityIndexObj).sort(([a], [b]) => a.localeCompare(b)).map(([key, entries]) => {
  const entryStrs = entries.map(e => {
    const regionStr = e.region ? `, region: '${e.region.replace(/'/g, "\\'")}'` : '';
    const aliasStr = e.aliases ? `, aliases: [${e.aliases.map(a => `'${a.replace(/'/g, "\\'")}'`).join(', ')}]` : '';
    return `{ name: '${e.name.replace(/'/g, "\\'")}', country: '${e.country.replace(/'/g, "\\'")}'${regionStr}, lat: ${e.lat}, lon: ${e.lon}${aliasStr} }`;
  });
  return `  '${key}': [${entryStrs.join(', ')}]`;
}).join(',\n')},
};

export const US_STATES: Record<string, StateData> = {
  'alabama': { name: 'Alabama', abbr: 'AL', lat: 32.3182, lon: -86.9023, country: 'United States', bounds: [30.2, -88.5, 35.0, -84.9] },
  'alaska': { name: 'Alaska', abbr: 'AK', lat: 64.2008, lon: -152.4937, country: 'United States', bounds: [51.0, -179.2, 71.4, -129.0] },
  'arizona': { name: 'Arizona', abbr: 'AZ', lat: 34.0489, lon: -111.0937, country: 'United States', bounds: [31.3, -114.8, 37.0, -109.0] },
  'arkansas': { name: 'Arkansas', abbr: 'AR', lat: 34.7465, lon: -92.2896, country: 'United States', bounds: [33.0, -94.6, 36.5, -89.6] },
  'california': { name: 'California', abbr: 'CA', lat: 36.7783, lon: -119.4179, country: 'United States', bounds: [32.5, -124.5, 42.0, -114.1] },
  'colorado': { name: 'Colorado', abbr: 'CO', lat: 39.5501, lon: -105.7821, country: 'United States', bounds: [37.0, -109.1, 41.0, -102.0] },
  'connecticut': { name: 'Connecticut', abbr: 'CT', lat: 41.6032, lon: -73.0877, country: 'United States', bounds: [40.9, -73.7, 42.1, -71.8] },
  'delaware': { name: 'Delaware', abbr: 'DE', lat: 38.9058, lon: -75.5093, country: 'United States', bounds: [38.4, -75.8, 39.8, -75.0] },
  'florida': { name: 'Florida', abbr: 'FL', lat: 27.6648, lon: -81.5158, country: 'United States', bounds: [24.4, -87.6, 31.0, -80.0] },
  'georgia': { name: 'Georgia', abbr: 'GA', lat: 32.1656, lon: -82.9001, country: 'United States', bounds: [30.3, -85.7, 35.0, -80.8] },
  'hawaii': { name: 'Hawaii', abbr: 'HI', lat: 19.8987, lon: -155.6931, country: 'United States', bounds: [18.7, -160.3, 22.4, -154.7] },
  'idaho': { name: 'Idaho', abbr: 'ID', lat: 44.0682, lon: -114.7420, country: 'United States', bounds: [42.0, -117.2, 49.0, -111.0] },
  'illinois': { name: 'Illinois', abbr: 'IL', lat: 40.3495, lon: -88.9861, country: 'United States', bounds: [36.9, -91.5, 42.5, -87.5] },
  'indiana': { name: 'Indiana', abbr: 'IN', lat: 40.2672, lon: -86.1349, country: 'United States', bounds: [37.8, -88.1, 41.8, -84.8] },
  'iowa': { name: 'Iowa', abbr: 'IA', lat: 41.8780, lon: -93.0977, country: 'United States', bounds: [40.4, -96.6, 43.5, -90.1] },
  'kansas': { name: 'Kansas', abbr: 'KS', lat: 39.0119, lon: -98.4842, country: 'United States', bounds: [37.0, -102.0, 40.0, -94.6] },
  'kentucky': { name: 'Kentucky', abbr: 'KY', lat: 37.8393, lon: -84.2700, country: 'United States', bounds: [36.5, -89.6, 39.1, -81.9] },
  'louisiana': { name: 'Louisiana', abbr: 'LA', lat: 30.9843, lon: -91.9623, country: 'United States', bounds: [28.9, -94.0, 33.0, -88.7] },
  'maine': { name: 'Maine', abbr: 'ME', lat: 45.2538, lon: -69.4455, country: 'United States', bounds: [42.9, -71.1, 47.5, -66.9] },
  'maryland': { name: 'Maryland', abbr: 'MD', lat: 39.0458, lon: -76.6413, country: 'United States', bounds: [37.9, -79.5, 39.7, -75.0] },
  'massachusetts': { name: 'Massachusetts', abbr: 'MA', lat: 42.4072, lon: -71.3824, country: 'United States', bounds: [41.2, -73.5, 42.9, -69.9] },
  'michigan': { name: 'Michigan', abbr: 'MI', lat: 44.3148, lon: -85.6024, country: 'United States', bounds: [41.7, -90.4, 48.3, -82.4] },
  'minnesota': { name: 'Minnesota', abbr: 'MN', lat: 46.7296, lon: -94.6859, country: 'United States', bounds: [43.5, -97.2, 49.4, -89.5] },
  'mississippi': { name: 'Mississippi', abbr: 'MS', lat: 32.3547, lon: -89.3985, country: 'United States', bounds: [30.1, -91.7, 35.0, -88.1] },
  'missouri': { name: 'Missouri', abbr: 'MO', lat: 37.9643, lon: -91.8318, country: 'United States', bounds: [35.9, -95.8, 40.7, -89.1] },
  'montana': { name: 'Montana', abbr: 'MT', lat: 46.8797, lon: -110.3626, country: 'United States', bounds: [44.3, -116.0, 49.0, -104.0] },
  'nebraska': { name: 'Nebraska', abbr: 'NE', lat: 41.4925, lon: -99.9018, country: 'United States', bounds: [39.9, -104.1, 43.0, -95.3] },
  'nevada': { name: 'Nevada', abbr: 'NV', lat: 38.8026, lon: -116.4194, country: 'United States', bounds: [35.0, -120.0, 42.0, -114.0] },
  'new hampshire': { name: 'New Hampshire', abbr: 'NH', lat: 43.9654, lon: -71.5606, country: 'United States', bounds: [42.7, -72.6, 45.3, -70.6] },
  'new jersey': { name: 'New Jersey', abbr: 'NJ', lat: 40.0583, lon: -74.4057, country: 'United States', bounds: [38.9, -75.6, 41.4, -73.9] },
  'new mexico': { name: 'New Mexico', abbr: 'NM', lat: 34.5199, lon: -105.8701, country: 'United States', bounds: [31.3, -109.1, 37.0, -103.0] },
  'new york': { name: 'New York', abbr: 'NY', lat: 43.0000, lon: -75.0000, country: 'United States', bounds: [40.5, -79.8, 45.1, -71.8] },
  'north carolina': { name: 'North Carolina', abbr: 'NC', lat: 35.7596, lon: -79.0193, country: 'United States', bounds: [33.8, -84.3, 36.6, -75.5] },
  'north dakota': { name: 'North Dakota', abbr: 'ND', lat: 47.5515, lon: -101.0020, country: 'United States', bounds: [45.9, -104.1, 49.0, -96.5] },
  'ohio': { name: 'Ohio', abbr: 'OH', lat: 40.4173, lon: -82.9071, country: 'United States', bounds: [38.4, -84.8, 42.3, -80.5] },
  'oklahoma': { name: 'Oklahoma', abbr: 'OK', lat: 35.4676, lon: -97.5164, country: 'United States', bounds: [33.6, -103.0, 37.0, -94.4] },
  'oregon': { name: 'Oregon', abbr: 'OR', lat: 43.8041, lon: -120.5542, country: 'United States', bounds: [42.0, -124.6, 46.3, -116.5] },
  'pennsylvania': { name: 'Pennsylvania', abbr: 'PA', lat: 41.2033, lon: -77.1945, country: 'United States', bounds: [39.7, -80.6, 42.5, -74.7] },
  'rhode island': { name: 'Rhode Island', abbr: 'RI', lat: 41.5801, lon: -71.4774, country: 'United States', bounds: [41.1, -71.9, 42.0, -71.1] },
  'south carolina': { name: 'South Carolina', abbr: 'SC', lat: 33.8191, lon: -80.7014, country: 'United States', bounds: [32.0, -83.4, 35.2, -78.5] },
  'south dakota': { name: 'South Dakota', abbr: 'SD', lat: 43.9695, lon: -99.9018, country: 'United States', bounds: [42.5, -104.1, 46.0, -96.4] },
  'tennessee': { name: 'Tennessee', abbr: 'TN', lat: 35.5175, lon: -86.5804, country: 'United States', bounds: [34.9, -90.3, 36.7, -81.6] },
  'texas': { name: 'Texas', abbr: 'TX', lat: 31.9686, lon: -99.9018, country: 'United States', bounds: [25.8, -106.7, 36.5, -93.5] },
  'utah': { name: 'Utah', abbr: 'UT', lat: 39.3200, lon: -111.0937, country: 'United States', bounds: [37.0, -114.1, 42.0, -109.0] },
  'vermont': { name: 'Vermont', abbr: 'VT', lat: 44.5588, lon: -72.5778, country: 'United States', bounds: [42.7, -73.4, 45.0, -71.5] },
  'virginia': { name: 'Virginia', abbr: 'VA', lat: 37.4316, lon: -79.5267, country: 'United States', bounds: [36.5, -83.7, 39.5, -75.2] },
  'washington': { name: 'Washington', abbr: 'WA', lat: 47.7511, lon: -120.7401, country: 'United States', bounds: [45.5, -124.8, 49.0, -116.9] },
  'west virginia': { name: 'West Virginia', abbr: 'WV', lat: 38.4680, lon: -80.9696, country: 'United States', bounds: [37.2, -82.6, 40.6, -77.7] },
  'wisconsin': { name: 'Wisconsin', abbr: 'WI', lat: 43.7844, lon: -88.7879, country: 'United States', bounds: [42.5, -92.9, 47.1, -86.8] },
  'wyoming': { name: 'Wyoming', abbr: 'WY', lat: 43.0759, lon: -107.2903, country: 'United States', bounds: [41.0, -111.1, 45.0, -104.0] },
};

export const INTERNATIONAL_REGIONS: Record<string, RegionData> = {
  'ontario': { name: 'Ontario', country: 'Canada', lat: 51.2538, lon: -85.3232, bounds: [42.0, -95.2, 56.9, -74.3] },
  'quebec': { name: 'Quebec', country: 'Canada', lat: 52.9399, lon: -73.5491, aliases: ['québec'], bounds: [45.0, -79.8, 62.6, -57.1] },
  'british columbia': { name: 'British Columbia', country: 'Canada', lat: 53.7267, lon: -127.6476, aliases: ['bc'], bounds: [48.3, -139.1, 60.0, -114.8] },
  'alberta': { name: 'Alberta', country: 'Canada', lat: 55.0000, lon: -115.0000, bounds: [49.0, -120.0, 60.0, -110.0] },
  'manitoba': { name: 'Manitoba', country: 'Canada', lat: 53.7609, lon: -98.8136, bounds: [49.0, -102.0, 60.0, -88.9] },
  'saskatchewan': { name: 'Saskatchewan', country: 'Canada', lat: 52.9399, lon: -106.4509, bounds: [49.0, -110.0, 60.0, -101.3] },
  'nova scotia': { name: 'Nova Scotia', country: 'Canada', lat: 44.6820, lon: -63.7443, bounds: [43.4, -66.5, 47.0, -59.7] },
  'new brunswick': { name: 'New Brunswick', country: 'Canada', lat: 46.5653, lon: -66.4619, bounds: [44.6, -69.1, 48.1, -64.0] },
  'england': { name: 'England', country: 'United Kingdom', lat: 52.3555, lon: -1.1743, bounds: [49.9, -8.6, 55.8, 1.8] },
  'scotland': { name: 'Scotland', country: 'United Kingdom', lat: 56.4907, lon: -4.2026, bounds: [54.6, -8.7, 58.7, -0.7] },
  'wales': { name: 'Wales', country: 'United Kingdom', lat: 52.1307, lon: -3.7837, bounds: [51.3, -5.5, 53.4, -2.6] },
  'northern ireland': { name: 'Northern Ireland', country: 'United Kingdom', lat: 54.7877, lon: -6.4923, aliases: ['ulster'], bounds: [53.9, -8.2, 55.4, -5.4] },
  'bavaria': { name: 'Bavaria', country: 'Germany', lat: 48.7904, lon: 11.4979, aliases: ['bayern'], bounds: [47.3, 8.9, 50.6, 13.8] },
  'brandenburg': { name: 'Brandenburg', country: 'Germany', lat: 52.4127, lon: 13.7427, bounds: [51.3, 11.2, 53.6, 14.8] },
  'hesse': { name: 'Hesse', country: 'Germany', lat: 50.6866, lon: 9.0284, aliases: ['hessen'], bounds: [49.4, 7.8, 51.7, 10.3] },
  'saxony': { name: 'Saxony', country: 'Germany', lat: 51.1045, lon: 13.2017, aliases: ['sachsen'], bounds: [50.1, 11.8, 51.7, 14.9] },
  'new south wales': { name: 'New South Wales', country: 'Australia', lat: -33.8688, lon: 151.2093, aliases: ['nsw'], bounds: [-37.5, 140.9, -28.2, 153.6] },
  'victoria': { name: 'Victoria', country: 'Australia', lat: -37.4713, lon: 144.7852, aliases: ['vic'], bounds: [-39.2, 140.9, -33.9, 149.3] },
  'queensland': { name: 'Queensland', country: 'Australia', lat: -20.9176, lon: 142.7028, aliases: ['qld'], bounds: [-29.2, 137.9, -9.4, 153.6] },
  'western australia': { name: 'Western Australia', country: 'Australia', lat: -27.6728, lon: 121.6283, aliases: ['wa'], bounds: [-35.2, 112.9, -13.5, 129.0] },
  'south australia': { name: 'South Australia', country: 'Australia', lat: -30.0002, lon: 136.2092, aliases: ['sa'], bounds: [-38.1, 129.0, -26.0, 141.0] },
  'maharashtra': { name: 'Maharashtra', country: 'India', lat: 19.7515, lon: 75.7139, bounds: [16.0, 72.6, 22.0, 80.9] },
  'karnataka': { name: 'Karnataka', country: 'India', lat: 15.3173, lon: 75.7139, bounds: [11.6, 74.0, 17.5, 78.8] },
  'tamil nadu': { name: 'Tamil Nadu', country: 'India', lat: 11.1271, lon: 78.6569, bounds: [8.1, 76.2, 13.7, 80.3] },
  'uttar pradesh': { name: 'Uttar Pradesh', country: 'India', lat: 26.8467, lon: 80.9462, bounds: [23.9, 77.1, 30.5, 84.7] },
  'gujarat': { name: 'Gujarat', country: 'India', lat: 22.3099, lon: 72.1362, bounds: [20.1, 68.2, 24.7, 74.7] },
  'rajasthan': { name: 'Rajasthan', country: 'India', lat: 27.3913, lon: 73.4265, bounds: [23.0, 69.3, 30.2, 78.2] },
  'west bengal': { name: 'West Bengal', country: 'India', lat: 22.9868, lon: 87.8550, bounds: [21.4, 85.8, 27.2, 88.9] },
  'punjab': { name: 'Punjab', country: 'India', lat: 31.1471, lon: 75.3412, bounds: [29.5, 73.8, 32.5, 77.0] },
  'kerala': { name: 'Kerala', country: 'India', lat: 10.8505, lon: 76.2711, bounds: [8.3, 74.7, 12.8, 77.9] },
  'madhya pradesh': { name: 'Madhya Pradesh', country: 'India', lat: 23.4713, lon: 77.9360, bounds: [21.6, 74.0, 26.9, 82.5] },
  'sao paulo state': { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6339, aliases: ['são paulo state', 'sao paulo'], bounds: [-25.3, -53.1, -19.8, -44.2] },
  'rio de janeiro state': { name: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lon: -43.1729, aliases: ['rio de janeiro', 'rio state'], bounds: [-23.4, -44.9, -20.7, -41.0] },
  'minas gerais': { name: 'Minas Gerais', country: 'Brazil', lat: -18.5122, lon: -44.5550, bounds: [-22.2, -51.0, -14.2, -39.8] },
  'bahia': { name: 'Bahia', country: 'Brazil', lat: -12.5797, lon: -41.7007, bounds: [-15.0, -46.6, -8.5, -37.3] },
  'jalisco': { name: 'Jalisco', country: 'Mexico', lat: 20.6597, lon: -103.3497, bounds: [19.5, -105.7, 22.0, -100.7] },
  'nuevo leon': { name: 'Nuevo León', country: 'Mexico', lat: 25.5924, lon: -99.9932, aliases: ['nuevo león'], bounds: [23.6, -101.2, 27.7, -99.0] },
  'yucatan': { name: 'Yucatán', country: 'Mexico', lat: 20.7099, lon: -89.0943, aliases: ['yucatán'], bounds: [19.5, -90.6, 21.6, -87.5] },
  'guangdong': { name: 'Guangdong', country: 'China', lat: 23.3417, lon: 113.4248, bounds: [20.2, 109.6, 25.5, 117.3] },
  'guangxi': { name: 'Guangxi', country: 'China', lat: 23.8295, lon: 108.7880, bounds: [20.5, 104.5, 26.5, 112.0] },
  'sichuan': { name: 'Sichuan', country: 'China', lat: 30.6171, lon: 102.7103, bounds: [26.0, 97.3, 34.0, 108.5] },
  'zhejiang': { name: 'Zhejiang', country: 'China', lat: 29.5508, lon: 121.0178, bounds: [27.2, 118.0, 31.2, 122.8] },
  'hubei': { name: 'Hubei', country: 'China', lat: 30.6927, lon: 112.3986, bounds: [29.0, 108.2, 33.3, 116.1] },
  'fujian': { name: 'Fujian', country: 'China', lat: 26.0745, lon: 117.9812, bounds: [23.3, 115.8, 28.3, 120.7] },
  'hunan': { name: 'Hunan', country: 'China', lat: 27.6104, lon: 111.7088, bounds: [24.6, 108.8, 30.1, 114.3] },
  'hong kong': { name: 'Hong Kong', country: 'China', lat: 22.3193, lon: 114.1694, aliases: ['hk'], bounds: [22.15, 113.84, 22.56, 114.41] },
  'macau': { name: 'Macau', country: 'China', lat: 22.1987, lon: 113.5439, aliases: ['macao'], bounds: [22.1, 113.52, 22.22, 113.60] },
  'ile-de-france': { name: 'Île-de-France', country: 'France', lat: 48.8566, lon: 2.3522, aliases: ['paris region', 'idf'], bounds: [48.1, 1.4, 49.0, 3.6] },
  "provence-alpes-cote d'azur": { name: "Provence-Alpes-Côte d'Azur", country: 'France', lat: 43.9352, lon: 6.0679, aliases: ['paca', 'french riviera', "côte d'azur", "cote d'azur", 'riviera'], bounds: [42.9, 5.0, 44.7, 7.7] },
  'occitanie': { name: 'Occitanie', country: 'France', lat: 43.8096, lon: 2.2650, bounds: [42.3, -0.5, 45.2, 4.7] },
  'lombardy': { name: 'Lombardy', country: 'Italy', lat: 45.6625, lon: 9.5228, aliases: ['lombardia'], bounds: [45.0, 8.5, 46.6, 11.5] },
  'lazio': { name: 'Lazio', country: 'Italy', lat: 41.7716, lon: 12.7800, bounds: [40.8, 11.5, 42.8, 14.1] },
  'veneto': { name: 'Veneto', country: 'Italy', lat: 45.7306, lon: 11.8763, bounds: [45.0, 10.7, 46.7, 13.0] },
  'catalonia': { name: 'Catalonia', country: 'Spain', lat: 41.6526, lon: 1.7517, aliases: ['catalunya', 'cataluña'], bounds: [40.5, -0.8, 42.9, 3.3] },
  'andalusia': { name: 'Andalusia', country: 'Spain', lat: 37.5443, lon: -4.7278, aliases: ['andalucía'], bounds: [36.7, -7.5, 38.7, -1.6] },
  'basque country': { name: 'Basque Country', country: 'Spain', lat: 43.0536, lon: -2.5296, aliases: ['euskadi', 'pais vasco'], bounds: [42.4, -3.5, 43.5, -1.7] },
  'castile and leon': { name: 'Castile and León', country: 'Spain', lat: 41.8332, lon: -4.3956, aliases: ['castilla y león'], bounds: [40.1, -7.0, 43.2, -1.8] },
  'crimea': { name: 'Crimea', country: 'Ukraine', lat: 45.2888, lon: 33.9555, bounds: [44.4, 32.5, 46.2, 36.6] },
  'donbas': { name: 'Donbas', country: 'Ukraine', lat: 48.0066, lon: 37.8088, aliases: ['donbass'], bounds: [47.0, 36.7, 49.0, 39.2] },
  'kashmir': { name: 'Kashmir', country: 'India', lat: 34.0857, lon: 74.7973, bounds: [32.5, 73.8, 36.0, 76.8] },
  'tibet': { name: 'Tibet', country: 'China', lat: 31.2654, lon: 89.4830, aliases: ['xz', 'xizang'], bounds: [26.0, 78.0, 36.0, 99.0] },
  'xinjiang': { name: 'Xinjiang', country: 'China', lat: 41.1129, lon: 85.0016, bounds: [34.2, 73.5, 49.2, 96.4] },
};
`;

  fs.writeFileSync(OUT_PATH, ts, 'utf8');
  console.log(`[generate-geo-data] Wrote ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
