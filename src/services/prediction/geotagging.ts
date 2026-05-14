import type { PredictionMarket } from './types';
import {
  COUNTRY_DATA,
  CITY_INDEX,
  US_STATES,
  INTERNATIONAL_REGIONS,
} from '../../generated/geo-data';
import type { CityData, StateData, RegionData } from '../../generated/geo-data';
import {
  isCoordinateInCountry,
  nameToCountryCode,
  getCountryCentroid,
} from '../country-geometry';

export type GeotagConfidence = 'high' | 'medium' | 'low';
export type GeotagSource = 'sports' | 'country' | 'city' | 'state' | 'pattern' | 'context';

export interface PredictionGeotag {
  country: string;
  region?: string;
  city?: string;
  lat: number;
  lon: number;
  confidence: GeotagConfidence;
  extractedFrom: GeotagSource;
  matchedText: string;
}

// Bounds for countries used by spreadGeotag to avoid clustering at centroids
export const COUNTRY_BOUNDS: Record<string, [minLat: number, minLon: number, maxLat: number, maxLon: number]> = {
  'united states': [24.3963, -125, 49.3844, -66.9346],
  'united kingdom': [49.9, -8.6, 58.7, 1.8],
  'russia': [41.2, 19.6, 81.9, 179.9],
  'ukraine': [44.2, 22.1, 52.4, 40.2],
  'china': [18.2, 73.5, 53.6, 134.8],
  'taiwan': [21.8, 119.3, 25.4, 122.1],
  'israel': [29.5, 34.2, 33.3, 35.9],
  'palestine': [31.2, 34.2, 32.6, 35.6],
  'palestinian territory occupied': [31.2, 34.2, 32.6, 35.6],
  'iran': [25.0, 44.0, 39.8, 63.3],
  'qatar': [24.4, 50.7, 26.2, 51.7],
  'saudi arabia': [16.3, 34.5, 32.2, 55.7],
  'turkey': [35.8, 25.7, 42.1, 44.8],
  'india': [8.4, 68.1, 37.1, 97.4],
  'japan': [24.4, 122.9, 45.6, 154.0],
  'south korea': [33.0, 124.5, 38.6, 131.9],
  'north korea': [37.6, 124.2, 43.1, 130.9],
  'france': [41.3, -5.1, 51.1, 9.6],
  'germany': [47.3, 5.9, 55.1, 15.0],
  'italy': [36.6, 6.6, 47.1, 18.5],
  'spain': [36.0, -9.3, 43.8, 3.3],
  'poland': [49.0, 14.1, 54.9, 24.2],
  'netherlands': [50.7, 3.4, 53.6, 7.2],
  'belgium': [49.5, 2.5, 51.5, 6.4],
  'sweden': [55.0, 11.0, 69.1, 24.2],
  'norway': [57.9, 4.6, 71.2, 31.1],
  'denmark': [54.5, 8.0, 57.8, 15.2],
  'finland': [59.8, 20.5, 70.1, 31.6],
  'ireland': [51.4, -10.7, 55.4, -5.9],
  'austria': [46.3, 9.5, 49.1, 17.2],
  'switzerland': [45.8, 5.9, 47.8, 10.5],
  'czech republic': [48.5, 12.1, 51.1, 18.9],
  'hungary': [45.7, 16.1, 48.6, 22.9],
  'romania': [43.6, 20.2, 48.3, 29.7],
  'greece': [34.8, 19.3, 41.8, 28.2],
  'serbia': [42.2, 18.8, 46.2, 23.0],
  'kosovo': [41.8, 20.0, 43.3, 21.8],
  'brazil': [-33.7, -73.9, 5.3, -34.8],
  'mexico': [14.5, -118.5, 32.7, -86.7],
  'canada': [41.7, -141.0, 83.1, -52.6],
  'australia': [-43.6, 113.3, -10.7, 153.6],
  'argentina': [-55.1, -73.6, -21.8, -53.6],
  'south africa': [-34.9, 16.4, -22.1, 32.9],
  'nigeria': [4.2, 2.7, 13.9, 14.7],
  'egypt': [22.0, 24.7, 31.7, 36.9],
  'pakistan': [23.6, 60.9, 37.1, 77.0],
  'venezuela': [0.6, -73.4, 12.2, -59.8],
  'colombia': [-4.2, -79.0, 12.5, -66.9],
  'chile': [-55.9, -75.7, -17.5, -66.4],
  'peru': [-18.4, -81.3, -0.0, -68.7],
  'ecuador': [-5.0, -81.1, 1.7, -75.2],
  'bolivia': [-22.9, -69.6, -9.7, -57.5],
  'uruguay': [-35.0, -58.5, -30.1, -53.1],
  'cuba': [19.8, -84.9, 23.3, -74.1],
  'georgia': [41.0, 39.9, 43.6, 46.7],
  'armenia': [38.8, 43.4, 41.3, 46.6],
  'azerbaijan': [38.4, 44.7, 41.9, 50.6],
  'united arab emirates': [22.6, 51.5, 26.1, 56.4],
  'lebanon': [33.0, 35.1, 34.7, 36.6],
  'syria': [32.3, 35.7, 37.3, 42.4],
  'iraq': [29.0, 38.8, 37.4, 48.6],
  'afghanistan': [29.3, 60.5, 38.5, 74.9],
  'yemen': [12.1, 42.5, 19.0, 54.5],
  'sudan': [8.7, 21.8, 22.2, 38.6],
  'ethiopia': [3.4, 33.0, 14.9, 47.9],
  'kenya': [-4.7, 33.9, 5.0, 41.9],
  'ghana': [4.5, -3.3, 11.2, 1.2],
  'morocco': [27.6, -13.2, 35.9, -1.0],
  'algeria': [18.9, -8.7, 37.1, 12.0],
  'tunisia': [30.2, 7.5, 37.5, 11.6],
  'libya': [19.5, 9.3, 33.2, 25.2],
  'indonesia': [-11.0, 95.0, 6.1, 141.0],
  'philippines': [4.6, 116.9, 21.1, 126.6],
  'thailand': [5.6, 97.3, 20.5, 105.6],
  'vietnam': [8.2, 102.1, 23.4, 109.5],
  'malaysia': [0.8, 99.6, 7.4, 119.3],
  'singapore': [1.2, 103.6, 1.5, 104.0],
  'bangladesh': [20.7, 88.0, 26.6, 92.7],
  'sri lanka': [5.9, 79.5, 9.9, 82.0],
  'nepal': [26.3, 80.0, 30.5, 88.2],
  'kazakhstan': [40.6, 46.5, 55.4, 87.3],
  'uzbekistan': [37.2, 55.9, 45.6, 73.2],
  'new zealand': [-47.4, 166.4, -34.4, 178.6],
};

const _chicago: CityData = { name: 'Chicago', country: 'United States', region: 'Illinois', lat: 41.8781, lon: -87.6298 };
const _houston: CityData = { name: 'Houston', country: 'United States', region: 'Texas', lat: 29.7604, lon: -95.3698 };
const _philly: CityData = { name: 'Philadelphia', country: 'United States', region: 'Pennsylvania', lat: 39.9526, lon: -75.1652 };
const _dallas: CityData = { name: 'Dallas', country: 'United States', region: 'Texas', lat: 32.7767, lon: -96.7970 };
const _sf: CityData = { name: 'San Francisco', country: 'United States', region: 'California', lat: 37.7749, lon: -122.4194 };
const _la: CityData = { name: 'Los Angeles', country: 'United States', region: 'California', lat: 34.0522, lon: -118.2437 };
const _baltimore: CityData = { name: 'Baltimore', country: 'United States', region: 'Maryland', lat: 39.2904, lon: -76.6122 };
const _cincy: CityData = { name: 'Cincinnati', country: 'United States', region: 'Ohio', lat: 39.1031, lon: -84.5120 };
const _boston: CityData = { name: 'Boston', country: 'United States', region: 'Massachusetts', lat: 42.3601, lon: -71.0589 };
const _ny: CityData = { name: 'New York', country: 'United States', region: 'New York', lat: 40.7128, lon: -74.0060 };
const _miami: CityData = { name: 'Miami', country: 'United States', region: 'Florida', lat: 25.7617, lon: -80.1918 };
const _gb: CityData = { name: 'Green Bay', country: 'United States', region: 'Wisconsin', lat: 44.5133, lon: -88.0133 };
const _kc: CityData = { name: 'Kansas City', country: 'United States', region: 'Missouri', lat: 39.0997, lon: -94.5786 };
const _seattle: CityData = { name: 'Seattle', country: 'United States', region: 'Washington', lat: 47.6062, lon: -122.3321 };
const _denver: CityData = { name: 'Denver', country: 'United States', region: 'Colorado', lat: 39.7392, lon: -104.9903 };
const _pitt: CityData = { name: 'Pittsburgh', country: 'United States', region: 'Pennsylvania', lat: 40.4406, lon: -79.9959 };
const _minny: CityData = { name: 'Minneapolis', country: 'United States', region: 'Minnesota', lat: 44.9778, lon: -93.2650 };
const _nash: CityData = { name: 'Nashville', country: 'United States', region: 'Tennessee', lat: 36.1627, lon: -86.7816 };
const _atla: CityData = { name: 'Atlanta', country: 'United States', region: 'Georgia', lat: 33.7490, lon: -84.3880 };
const _det: CityData = { name: 'Detroit', country: 'United States', region: 'Michigan', lat: 42.3314, lon: -83.0458 };
const _buff: CityData = { name: 'Buffalo', country: 'United States', region: 'New York', lat: 42.8864, lon: -78.8784 };
const _clev: CityData = { name: 'Cleveland', country: 'United States', region: 'Ohio', lat: 41.4993, lon: -81.6944 };
const _indy: CityData = { name: 'Indianapolis', country: 'United States', region: 'Indiana', lat: 39.7684, lon: -86.1581 };
const _jax: CityData = { name: 'Jacksonville', country: 'United States', region: 'Florida', lat: 30.3322, lon: -81.6557 };
const _no: CityData = { name: 'New Orleans', country: 'United States', region: 'Louisiana', lat: 29.9511, lon: -90.0715 };
const _tb: CityData = { name: 'Tampa', country: 'United States', region: 'Florida', lat: 27.9506, lon: -82.4572 };
const _char: CityData = { name: 'Charlotte', country: 'United States', region: 'North Carolina', lat: 35.2271, lon: -80.8431 };
const _az: CityData = { name: 'Phoenix', country: 'United States', region: 'Arizona', lat: 33.4484, lon: -112.0740 };
const _vegas: CityData = { name: 'Las Vegas', country: 'United States', region: 'Nevada', lat: 36.1699, lon: -115.1398 };
const _london_uk: CityData = { name: 'London', country: 'United Kingdom', region: 'England', lat: 51.5074, lon: -0.1278 };
const _manchester: CityData = { name: 'Manchester', country: 'United Kingdom', region: 'England', lat: 53.4808, lon: -2.2426 };
const _liverpool: CityData = { name: 'Liverpool', country: 'United Kingdom', region: 'England', lat: 53.4084, lon: -2.9916 };
const _madrid_es: CityData = { name: 'Madrid', country: 'Spain', region: 'Community of Madrid', lat: 40.4168, lon: -3.7038 };
const _barca: CityData = { name: 'Barcelona', country: 'Spain', region: 'Catalonia', lat: 41.3874, lon: 2.1686 };
const _munich_de: CityData = { name: 'Munich', country: 'Germany', region: 'Bavaria', lat: 48.1351, lon: 11.5820 };
const _paris_fr: CityData = { name: 'Paris', country: 'France', region: 'Île-de-France', lat: 48.8566, lon: 2.3522 };
const _milan_it: CityData = { name: 'Milan', country: 'Italy', region: 'Lombardy', lat: 45.4642, lon: 9.1900 };
const _turin: CityData = { name: 'Turin', country: 'Italy', region: 'Piedmont', lat: 45.0703, lon: 7.6869 };
const _lisbon_pt: CityData = { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lon: -9.1393 };
const _amsterdam_nl: CityData = { name: 'Amsterdam', country: 'Netherlands', region: 'North Holland', lat: 52.3676, lon: 4.9041 };
const _dortmund: CityData = { name: 'Dortmund', country: 'Germany', region: 'North Rhine-Westphalia', lat: 51.5136, lon: 7.4653 };

const SPORTS_TEAMS: Record<string, CityData> = {
  'ravens': _baltimore, 'baltimore ravens': _baltimore,
  'bengals': _cincy, 'cincinnati bengals': _cincy,
  'lakers': _la, 'dodgers': _la,
  'bears': _chicago, 'chicago bears': _chicago,
  'bulls': _chicago, 'chicago bulls': _chicago,
  'cubs': _chicago, 'chicago cubs': _chicago,
  'white sox': _chicago, 'chicago white sox': _chicago,
  'blackhawks': _chicago, 'chicago blackhawks': _chicago,
  'texans': _houston, 'houston texans': _houston,
  'rockets': _houston, 'houston rockets': _houston,
  'astros': _houston, 'houston astros': _houston,
  'eagles': _philly, 'philadelphia eagles': _philly,
  'phillies': _philly, 'philadelphia phillies': _philly,
  '76ers': _philly, 'sixers': _philly, 'philadelphia 76ers': _philly,
  'cowboys': _dallas, 'dallas cowboys': _dallas,
  'mavericks': _dallas, 'dallas mavericks': _dallas, 'mavs': _dallas,
  'rangers': _dallas, 'texas rangers': _dallas,
  '49ers': _sf, 'niners': _sf, 'san francisco 49ers': _sf,
  'warriors': _sf, 'golden state warriors': _sf,
  'giants': _ny, 'new york giants': _ny,
  'yankees': _ny, 'new york yankees': _ny,
  'mets': _ny, 'new york mets': _ny,
  'knicks': _ny, 'new york knicks': _ny,
  'jets': _ny, 'new york jets': _ny,
  'dolphins': _miami, 'miami dolphins': _miami,
  'heat': _miami, 'miami heat': _miami,
  'packers': _gb, 'green bay packers': _gb,
  'chiefs': _kc, 'kansas city chiefs': _kc,
  'royals': _kc, 'kansas city royals': _kc,
  'seahawks': _seattle, 'seattle seahawks': _seattle,
  'mariners': _seattle, 'seattle mariners': _seattle,
  'broncos': _denver, 'denver broncos': _denver,
  'nuggets': _denver, 'denver nuggets': _denver,
  'avalanche': _denver, 'colorado avalanche': _denver,
  'steelers': _pitt, 'pittsburgh steelers': _pitt,
  'pirates': _pitt, 'pittsburgh pirates': _pitt,
  'penguins': _pitt, 'pittsburgh penguins': _pitt,
  'vikings': _minny, 'minnesota vikings': _minny,
  'twins': _minny, 'minnesota twins': _minny,
  'timberwolves': _minny, 'minnesota timberwolves': _minny,
  'titans': _nash, 'tennessee titans': _nash,
  'predators': _nash, 'nashville predators': _nash,
  'falcons': _atla, 'atlanta falcons': _atla,
  'braves': _atla, 'atlanta braves': _atla,
  'hawks': _atla, 'atlanta hawks': _atla,
  'lions': _det, 'detroit lions': _det,
  'tigers': _det, 'detroit tigers': _det,
  'red wings': _det, 'detroit red wings': _det,
  'pistons': _det, 'detroit pistons': _det,
  'bills': _buff, 'buffalo bills': _buff,
  'browns': _clev, 'cleveland browns': _clev,
  'guardians': _clev, 'cleveland guardians': _clev,
  'cavaliers': _clev, 'cleveland cavaliers': _clev,
  'colts': _indy, 'indianapolis colts': _indy,
  'pacers': _indy, 'indiana pacers': _indy,
  'jaguars': _jax, 'jacksonville jaguars': _jax,
  'saints': _no, 'new orleans saints': _no,
  'pelicans': _no, 'new orleans pelicans': _no,
  'bucks': _cincy,
  'buccaneers': _tb, 'tampa bay buccaneers': _tb,
  'rays': _tb, 'tampa bay rays': _tb,
  'lightning': _tb, 'tampa bay lightning': _tb,
  'panthers': _char, 'carolina panthers': _char,
  'cardinals': _az, 'arizona cardinals': _az,
  'diamondbacks': _az, 'arizona diamondbacks': _az,
  'suns': _az, 'phoenix suns': _az,
  'raiders': _vegas, 'las vegas raiders': _vegas,
  'golden knights': _vegas, 'vegas golden knights': _vegas,
  'arsenal': _london_uk, 'gunners': _london_uk,
  'chelsea': _london_uk,
  'tottenham': _london_uk, 'spurs': _london_uk,
  'west ham': _london_uk,
  'man city': _manchester, 'manchester city': _manchester,
  'man united': _manchester, 'manchester united': _manchester,
  'man utd': _manchester,
  'liverpool fc': _liverpool,
  'everton': _liverpool,
  'real madrid': _madrid_es,
  'atletico madrid': _madrid_es, 'athletico madrid': _madrid_es,
  'barcelona': _barca, 'fc barcelona': _barca, 'barca': _barca,
  'bayern': _munich_de, 'bayern munich': _munich_de, 'bayern münchen': _munich_de,
  'dortmund': _dortmund, 'borussia dortmund': _dortmund, 'bvb': _dortmund,
  'psg': _paris_fr, 'paris saint-germain': _paris_fr,
  'inter milan': _milan_it, 'inter': _milan_it,
  'ac milan': _milan_it,
  'juventus': _turin, 'juve': _turin,
  'benfica': _lisbon_pt,
  'porto': _lisbon_pt, 'fc porto': _lisbon_pt,
  'ajax': _amsterdam_nl,
  'celtics': _ny, 'boston celtics': _boston,
  'red sox': _boston, 'boston red sox': _boston,
  'bruins': _boston, 'boston bruins': _boston,
  'patriots': _boston, 'new england patriots': _boston,
};

// Hard overrides for aliases that the generated dataset applies to the wrong city,
// and for major cities that are missing from the capital-only dataset.
const MANUAL_CITY_OVERRIDES: Record<string, CityData> = {
  // Washington D.C. aliases (dataset attaches these to Washington, Aruba / UK / CT)
  'dc': { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369 },
  'washington dc': { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369 },
  'white house': { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369 },
  'congress': { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369 },
  'senate': { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369 },
  'fed': { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369 },
  'federal reserve': { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369 },
  // Corporate / brand aliases that the dataset misplaces
  'openai': { name: 'San Francisco', country: 'United States', region: 'California', lat: 37.7749, lon: -122.4194 },
  'tesla': { name: 'Austin', country: 'United States', region: 'Texas', lat: 30.2672, lon: -97.7431 },
  // Missing capitals / major cities
  'new york': { name: 'New York', country: 'United States', region: 'New York', lat: 40.7128, lon: -74.0060 },
  'nyc': { name: 'New York', country: 'United States', region: 'New York', lat: 40.7128, lon: -74.0060 },
  'gaza': { name: 'Gaza', country: 'Palestinian Territory Occupied', region: 'Gaza', lat: 31.5017, lon: 34.4668 },
  'gaza city': { name: 'Gaza', country: 'Palestinian Territory Occupied', region: 'Gaza', lat: 31.5017, lon: 34.4668 },
  'zurich': { name: 'Zurich', country: 'Switzerland', region: 'Zurich', lat: 47.3769, lon: 8.5417 },
  'zürich': { name: 'Zurich', country: 'Switzerland', region: 'Zurich', lat: 47.3769, lon: 8.5417 },
  'montreal': { name: 'Montreal', country: 'Canada', region: 'Quebec', lat: 45.5017, lon: -73.5673 },
  'montréal': { name: 'Montreal', country: 'Canada', region: 'Quebec', lat: 45.5017, lon: -73.5673 },
  'bangalore': { name: 'Bangalore', country: 'India', region: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  'bengaluru': { name: 'Bangalore', country: 'India', region: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  'astana': { name: 'Astana', country: 'Kazakhstan', region: 'Astana', lat: 51.1605, lon: 71.4704 },
  'nur-sultan': { name: 'Astana', country: 'Kazakhstan', region: 'Astana', lat: 51.1605, lon: 71.4704 },
  'nursultan': { name: 'Astana', country: 'Kazakhstan', region: 'Astana', lat: 51.1605, lon: 71.4704 },
  'dallas-fort worth': { name: 'Dallas-Fort Worth', country: 'United States', region: 'Texas', lat: 32.7767, lon: -96.7970 },
  'dfw': { name: 'Dallas-Fort Worth', country: 'United States', region: 'Texas', lat: 32.7767, lon: -96.7970 },
  'dallas fort worth': { name: 'Dallas-Fort Worth', country: 'United States', region: 'Texas', lat: 32.7767, lon: -96.7970 },
  'starbase': { name: 'Starbase', country: 'United States', region: 'Texas', lat: 25.9972, lon: -97.1561 },
  'spacex': { name: 'Starbase', country: 'United States', region: 'Texas', lat: 25.9972, lon: -97.1561 },
};

const CRYPTO_ONLY_RE = /\b(bitcoin|ethereum|solana|btc|eth|sol|doge|crypto|cryptocurrency|memecoin)\b/i;
const EXPLICIT_LOCATION_RE = /\b(?:in|at|from|to)\s+([A-Z][a-zA-Z. -]+?)(?:\s+(?:on|before|after|by|in|at|for|during|next)|[,?.!]|$)/g;
const STATE_CONTEXT_RE = /\b(primary|election|governor|senate|senator|representative|district|ballot|referendum|vote|poll|campaign|caucus|congressional|presidential)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWord(text: string, value: string): boolean {
  return new RegExp(`\\b${escapeRegExp(value.toLowerCase())}\\b`, 'i').test(text);
}

function countryTerms(country: typeof COUNTRY_DATA[string]): string[] {
  return [country.name, country.demonym, ...(country.aliases ?? [])]
    .filter((term): term is string => Boolean(term))
    .map(term => term.toLowerCase());
}

function cityTerms(city: CityData): string[] {
  return [city.name, ...(city.aliases ?? [])].map(term => term.toLowerCase());
}

function toCityGeotag(city: CityData, source: GeotagSource, matchedText: string): PredictionGeotag {
  return {
    country: city.country,
    region: city.region,
    city: city.name,
    lat: city.lat,
    lon: city.lon,
    confidence: 'high',
    extractedFrom: source,
    matchedText,
  };
}

function toCountryGeotag(country: typeof COUNTRY_DATA[string], source: GeotagSource, matchedText: string, confidence: GeotagConfidence = 'high'): PredictionGeotag {
  return {
    country: country.name,
    lat: country.lat,
    lon: country.lon,
    confidence,
    extractedFrom: source,
    matchedText,
  };
}

function toStateGeotag(state: StateData, matchedText: string): PredictionGeotag {
  return {
    country: state.country,
    region: state.name,
    lat: state.lat,
    lon: state.lon,
    confidence: 'high',
    extractedFrom: 'state',
    matchedText,
  };
}

function toRegionGeotag(region: RegionData, matchedText: string): PredictionGeotag {
  return {
    country: region.country,
    region: region.name,
    lat: region.lat,
    lon: region.lon,
    confidence: 'high',
    extractedFrom: 'state',
    matchedText,
  };
}

// O(1) city lookup using the generated index + manual overrides
function findCity(text: string): PredictionGeotag | null {
  const lower = text.toLowerCase();
  // Try multi-word phrases first (longer matches are more specific)
  const words = lower.split(/\s+/);
  for (let len = Math.min(words.length, 4); len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ').replace(/[.,'?!:;"\u2018\u2019\u201C\u201D\u2013\u2014]/g, '');

      // 1. Check manual overrides first (fixes aliases attached to wrong cities)
      const manual = MANUAL_CITY_OVERRIDES[phrase];
      if (manual) {
        return toCityGeotag(manual, 'city', phrase);
      }

      const entries = CITY_INDEX[phrase];
      if (entries && entries.length > 0) {
        // Prefer entries whose region is mentioned in the text
        const withRegion = entries.find(e => e.region && hasWord(lower, e.region.toLowerCase()));
        // Next prefer entries whose country is mentioned in the text
        const withCountry = entries.find(e => hasWord(lower, e.country.toLowerCase()));
        const entry = withRegion || withCountry || entries[0]!;
        const matched = cityTerms(entry).find(term => hasWord(lower, term)) || entry.name.toLowerCase();
        return toCityGeotag(entry, 'city', matched);
      }
    }
  }
  return null;
}

function findCountryByText(text: string): PredictionGeotag | null {
  const lower = text.toLowerCase();
  for (const country of Object.values(COUNTRY_DATA)) {
    const matched = countryTerms(country).find(term => hasWord(lower, term));
    if (matched) return toCountryGeotag(country, 'country', matched);
  }
  return null;
}

function findState(text: string): PredictionGeotag | null {
  const lower = text.toLowerCase();
  for (const state of Object.values(US_STATES)) {
    if (hasWord(lower, state.name.toLowerCase())) return toStateGeotag(state, state.name);
  }

  if (STATE_CONTEXT_RE.test(text)) {
    for (const state of Object.values(US_STATES)) {
      if (hasWord(lower, state.abbr.toLowerCase())) return toStateGeotag(state, state.abbr);
    }
  }

  for (const region of Object.values(INTERNATIONAL_REGIONS)) {
    const terms = [region.name, ...(region.aliases ?? [])].map(t => t.toLowerCase());
    const matched = terms.find(term => hasWord(lower, term));
    if (matched) return toRegionGeotag(region, matched);
  }

  return null;
}

function findExplicitPattern(text: string): PredictionGeotag | null {
  EXPLICIT_LOCATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EXPLICIT_LOCATION_RE.exec(text)) !== null) {
    const location = match[1]?.trim();
    if (!location) continue;
    const city = findCity(location);
    if (city) return { ...city, extractedFrom: 'pattern', matchedText: location };
    const state = findState(location);
    if (state) return { ...state, extractedFrom: 'pattern', matchedText: location };
    const country = findCountryByText(location);
    if (country) return { ...country, extractedFrom: 'pattern', matchedText: location };
  }
  return null;
}

function findSportsTeam(text: string): PredictionGeotag | null {
  const lower = text.toLowerCase();
  if (!/\b(vs|vs\.|versus|game|match|win|wins|spread|championship|season|playoff)\b/i.test(text)) return null;
  for (const [team, city] of Object.entries(SPORTS_TEAMS)) {
    if (hasWord(lower, team)) return toCityGeotag(city, 'sports', team);
  }
  return null;
}

function findCountries(text: string): Array<{ country: typeof COUNTRY_DATA[string]; matchedText: string; index: number; context: string }> {
  const lower = text.toLowerCase();
  const matches: Array<{ country: typeof COUNTRY_DATA[string]; matchedText: string; index: number; context: string }> = [];
  for (const country of Object.values(COUNTRY_DATA)) {
    for (const term of countryTerms(country)) {
      const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
      const match = lower.match(regex);
      if (!match || match.index === undefined) continue;
      const start = Math.max(0, match.index - 60);
      const end = Math.min(lower.length, match.index + term.length + 60);
      matches.push({ country, matchedText: term, index: match.index, context: lower.slice(start, end) });
      break;
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

function findCountryWithContext(text: string): PredictionGeotag | null {
  const lower = text.toLowerCase();
  const matches = findCountries(text);
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const only = matches[0]!;
    return toCountryGeotag(only.country, 'country', only.matchedText);
  }

  const meetingMatch = lower.match(/\bmeet(?:s|ing)?\s+(?:next\s+)?(?:in|at)\s+([a-z .-]+?)(?:\s|$|[,?.!])/);
  if (meetingMatch?.[1]) {
    const place = meetingMatch[1].trim();
    const meetingCountry = matches.find(({ country }) => countryTerms(country).some(term => hasWord(place, term)));
    if (meetingCountry) return toCountryGeotag(meetingCountry.country, 'context', meetingCountry.matchedText);
  }

  const targetPatterns = [
    /\b(?:invade|invades|invasion of|attack|attacks|strike|strikes|annex|annexes)\s+([a-z .-]+?)(?:\s|$|[,?.!])/,
    /\bwar\s+(?:with|against|in)\s+([a-z .-]+?)(?:\s|$|[,?.!])/,
  ];
  for (const pattern of targetPatterns) {
    const targetMatch = lower.match(pattern);
    if (!targetMatch?.[1]) continue;
    const target = targetMatch[1].trim();
    const targetCountry = matches.find(({ country }) => countryTerms(country).some(term => hasWord(target, term)));
    if (targetCountry) return toCountryGeotag(targetCountry.country, 'context', targetCountry.matchedText);
  }

  const subjectWords = ['prime minister', 'president', 'election', 'government', 'parliament', 'referendum', 'senate'];
  const subjectCountry = matches.find(match => subjectWords.some(word => match.context.includes(word)));
  if (subjectCountry) return toCountryGeotag(subjectCountry.country, 'context', subjectCountry.matchedText);

  const last = matches[matches.length - 1]!;
  return toCountryGeotag(last.country, 'country', last.matchedText, 'medium');
}

function getLocationBounds(location: PredictionGeotag): [number, number, number, number] | undefined {
  if (location.city) return undefined;
  if (location.region && location.country === 'United States') {
    return Object.values(US_STATES).find(state => state.name === location.region)?.bounds;
  }
  if (location.region) {
    const intlRegion = Object.values(INTERNATIONAL_REGIONS).find(r => r.name === location.region && r.country === location.country);
    if (intlRegion?.bounds) return intlRegion.bounds;
  }
  return COUNTRY_BOUNDS[location.country.toLowerCase()];
}

function hashStringToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function sampleInBbox(
  bounds: [number, number, number, number],
  seed: string,
): { lat: number; lon: number } {
  const [minLat, minLon, maxLat, maxLon] = bounds;
  const latPadding = (maxLat - minLat) * 0.08;
  const lonPadding = (maxLon - minLon) * 0.08;
  const safeMinLat = minLat + latPadding;
  const safeMaxLat = maxLat - latPadding;
  const safeMinLon = minLon + lonPadding;
  const safeMaxLon = maxLon - lonPadding;
  const lat = safeMinLat + hashStringToUnit(`${seed}:lat`) * (safeMaxLat - safeMinLat);
  const lon = safeMinLon + hashStringToUnit(`${seed}:lon`) * (safeMaxLon - safeMinLon);
  return { lat, lon };
}

// Samples a deterministic point that lies inside the actual country polygon.
// Uses rejection sampling: try up to 8 perturbed seeds within the bbox and keep
// the first one inside the country. Falls back to bbox-uniform sampling when
// the polygon dataset hasn't loaded yet, and to the country centroid when no
// perturbation lands inside (small islands / very thin shapes).
export function sampleInsideCountry(
  countryName: string,
  seed: string,
  bounds: [number, number, number, number],
): { lat: number; lon: number } {
  const code = nameToCountryCode(countryName);
  if (!code) return sampleInBbox(bounds, seed);

  // Probe whether geometry is loaded at all; isCoordinateInCountry returns
  // null for "not loaded". If unknown, just use bbox sampling.
  const probe = isCoordinateInCountry(
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
    code,
  );
  if (probe === null) return sampleInBbox(bounds, seed);

  for (let i = 0; i < 8; i++) {
    const candidate = sampleInBbox(bounds, `${seed}:r${i}`);
    if (isCoordinateInCountry(candidate.lat, candidate.lon, code) === true) {
      return candidate;
    }
  }

  const centroid = getCountryCentroid(code);
  if (centroid) return centroid;
  return sampleInBbox(bounds, seed);
}

export function spreadGeotag(location: PredictionGeotag, seed: string): PredictionGeotag {
  const bounds = getLocationBounds(location);
  if (!bounds) return location;

  // For country-level geotags, prefer rejection sampling against the real
  // polygon so the point doesn't land in the ocean or a neighbouring country.
  // Sub-national regions (US states / international regions) still use plain
  // bbox sampling because per-region polygons aren't available here.
  const useCountryPolygon = !location.city && !location.region;

  const { lat, lon } = useCountryPolygon
    ? sampleInsideCountry(location.country, seed, bounds)
    : sampleInBbox(bounds, seed);

  return {
    ...location,
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
  };
}

export function extractPredictionGeotag(title: string, description = ''): PredictionGeotag | null {
  const text = `${title} ${description}`.trim();
  if (!text) return null;

  const explicit = findExplicitPattern(text);
  if (explicit) return explicit;

  const city = findCity(text);
  if (city) return city;

  const sports = findSportsTeam(text);
  if (sports) return sports;

  const state = findState(text);
  if (state) {
    const countryGeorgiaContext = /\b(tbilisi|russia|russian|caucasus|europe|georgian dream)\b/i.test(text);
    if (state.country === 'United States' && state.region === 'Georgia' && countryGeorgiaContext) {
      return toCountryGeotag(COUNTRY_DATA.georgia!, 'context', 'georgia');
    }
    return state;
  }

  const country = findCountryWithContext(text);
  if (country) return country;

  if (CRYPTO_ONLY_RE.test(text)) return null;

  return null;
}

export function geotagPredictionMarket(market: PredictionMarket, seed = market.eventId || market.eventSlug || market.slug || market.url || market.title): (PredictionMarket & PredictionGeotag) | null {
  const geotag = extractPredictionGeotag(market.title);
  if (!geotag) return null;
  const spread = spreadGeotag(geotag, seed);
  return {
    ...market,
    ...spread,
  };
}
