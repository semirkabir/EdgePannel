import type { PredictionMarket } from './types';

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

interface CountryData {
  name: string;
  lat: number;
  lon: number;
  demonym?: string;
  aliases?: string[];
  bounds?: [minLat: number, minLon: number, maxLat: number, maxLon: number];
}

interface CityData {
  name: string;
  country: string;
  region?: string;
  lat: number;
  lon: number;
  aliases?: string[];
}

interface StateData {
  name: string;
  abbr: string;
  lat: number;
  lon: number;
  bounds?: [minLat: number, minLon: number, maxLat: number, maxLon: number];
}

const COUNTRY_DATA: Record<string, CountryData> = {
  'united states': { name: 'United States', lat: 39.8283, lon: -98.5795, demonym: 'american', aliases: ['usa', 'us', 'u.s.', 'u.s.a.', 'america'], bounds: [24.3963, -125, 49.3844, -66.9346] },
  'united kingdom': { name: 'United Kingdom', lat: 55.3781, lon: -3.4360, demonym: 'british', aliases: ['uk', 'u.k.', 'britain', 'great britain', 'england'], bounds: [49.9, -8.6, 58.7, 1.8] },
  'russia': { name: 'Russia', lat: 61.5240, lon: 105.3188, demonym: 'russian', aliases: ['russian federation', 'moscow', 'kremlin'], bounds: [41.2, 19.6, 81.9, 179.9] },
  'ukraine': { name: 'Ukraine', lat: 48.3794, lon: 31.1656, demonym: 'ukrainian', aliases: ['kyiv', 'kiev'], bounds: [44.2, 22.1, 52.4, 40.2] },
  'china': { name: 'China', lat: 35.8617, lon: 104.1954, demonym: 'chinese', aliases: ['prc', 'beijing'], bounds: [18.2, 73.5, 53.6, 134.8] },
  'taiwan': { name: 'Taiwan', lat: 23.6978, lon: 120.9605, demonym: 'taiwanese', aliases: ['taipei'], bounds: [21.8, 119.3, 25.4, 122.1] },
  'israel': { name: 'Israel', lat: 31.0461, lon: 34.8516, demonym: 'israeli', aliases: ['jerusalem', 'tel aviv'], bounds: [29.5, 34.2, 33.3, 35.9] },
  'palestine': { name: 'Palestine', lat: 31.9522, lon: 35.2332, demonym: 'palestinian', aliases: ['gaza', 'west bank', 'hamas'], bounds: [31.2, 34.2, 32.6, 35.6] },
  'iran': { name: 'Iran', lat: 32.4279, lon: 53.6880, demonym: 'iranian', aliases: ['tehran'], bounds: [25.0, 44.0, 39.8, 63.3] },
  'qatar': { name: 'Qatar', lat: 25.3548, lon: 51.1839, demonym: 'qatari', aliases: ['doha'], bounds: [24.4, 50.7, 26.2, 51.7] },
  'saudi arabia': { name: 'Saudi Arabia', lat: 23.8859, lon: 45.0792, demonym: 'saudi', aliases: ['riyadh'], bounds: [16.3, 34.5, 32.2, 55.7] },
  'turkey': { name: 'Turkey', lat: 38.9637, lon: 35.2433, demonym: 'turkish', aliases: ['turkiye', 'ankara', 'istanbul'], bounds: [35.8, 25.7, 42.1, 44.8] },
  'india': { name: 'India', lat: 20.5937, lon: 78.9629, demonym: 'indian', aliases: ['delhi', 'new delhi'], bounds: [8.4, 68.1, 37.1, 97.4] },
  'japan': { name: 'Japan', lat: 36.2048, lon: 138.2529, demonym: 'japanese', aliases: ['tokyo'], bounds: [24.4, 122.9, 45.6, 154.0] },
  'south korea': { name: 'South Korea', lat: 35.9078, lon: 127.7669, demonym: 'korean', aliases: ['seoul', 'rok', 's. korea'], bounds: [33.0, 124.5, 38.6, 131.9] },
  'north korea': { name: 'North Korea', lat: 40.3399, lon: 127.5101, demonym: 'north korean', aliases: ['dprk', 'pyongyang', 'n. korea'], bounds: [37.6, 124.2, 43.1, 130.9] },
  'france': { name: 'France', lat: 46.2276, lon: 2.2137, demonym: 'french', aliases: ['paris', 'macron'], bounds: [41.3, -5.1, 51.1, 9.6] },
  'germany': { name: 'Germany', lat: 51.1657, lon: 10.4515, demonym: 'german', aliases: ['berlin'], bounds: [47.3, 5.9, 55.1, 15.0] },
  'italy': { name: 'Italy', lat: 41.8719, lon: 12.5674, demonym: 'italian', aliases: ['rome'], bounds: [36.6, 6.6, 47.1, 18.5] },
  'spain': { name: 'Spain', lat: 40.4637, lon: -3.7492, demonym: 'spanish', aliases: ['madrid'], bounds: [36.0, -9.3, 43.8, 3.3] },
  'poland': { name: 'Poland', lat: 51.9194, lon: 19.1451, demonym: 'polish', aliases: ['warsaw'], bounds: [49.0, 14.1, 54.9, 24.2] },
  'netherlands': { name: 'Netherlands', lat: 52.1326, lon: 5.2913, demonym: 'dutch', aliases: ['holland', 'amsterdam', 'hague'], bounds: [50.7, 3.4, 53.6, 7.2] },
  'belgium': { name: 'Belgium', lat: 50.5039, lon: 4.4699, demonym: 'belgian', aliases: ['brussels'], bounds: [49.5, 2.5, 51.5, 6.4] },
  'sweden': { name: 'Sweden', lat: 60.1282, lon: 18.6435, demonym: 'swedish', aliases: ['stockholm'], bounds: [55.0, 11.0, 69.1, 24.2] },
  'norway': { name: 'Norway', lat: 60.4720, lon: 8.4689, demonym: 'norwegian', aliases: ['oslo'], bounds: [57.9, 4.6, 71.2, 31.1] },
  'denmark': { name: 'Denmark', lat: 56.2639, lon: 9.5018, demonym: 'danish', aliases: ['copenhagen'], bounds: [54.5, 8.0, 57.8, 15.2] },
  'finland': { name: 'Finland', lat: 61.9241, lon: 25.7482, demonym: 'finnish', aliases: ['helsinki'], bounds: [59.8, 20.5, 70.1, 31.6] },
  'ireland': { name: 'Ireland', lat: 53.4129, lon: -8.2439, demonym: 'irish', aliases: ['dublin'], bounds: [51.4, -10.7, 55.4, -5.9] },
  'austria': { name: 'Austria', lat: 47.5162, lon: 14.5501, demonym: 'austrian', aliases: ['vienna'], bounds: [46.3, 9.5, 49.1, 17.2] },
  'switzerland': { name: 'Switzerland', lat: 46.8182, lon: 8.2275, demonym: 'swiss', aliases: ['zurich', 'geneva'], bounds: [45.8, 5.9, 47.8, 10.5] },
  'czech republic': { name: 'Czech Republic', lat: 49.8175, lon: 15.4730, demonym: 'czech', aliases: ['czechia', 'prague'], bounds: [48.5, 12.1, 51.1, 18.9] },
  'hungary': { name: 'Hungary', lat: 47.1625, lon: 19.5033, demonym: 'hungarian', aliases: ['budapest', 'orban'], bounds: [45.7, 16.1, 48.6, 22.9] },
  'romania': { name: 'Romania', lat: 45.9432, lon: 24.9668, demonym: 'romanian', aliases: ['bucharest'], bounds: [43.6, 20.2, 48.3, 29.7] },
  'greece': { name: 'Greece', lat: 39.0742, lon: 21.8243, demonym: 'greek', aliases: ['athens'], bounds: [34.8, 19.3, 41.8, 28.2] },
  'serbia': { name: 'Serbia', lat: 44.0165, lon: 21.0059, demonym: 'serbian', aliases: ['belgrade'], bounds: [42.2, 18.8, 46.2, 23.0] },
  'kosovo': { name: 'Kosovo', lat: 42.6026, lon: 20.9030, demonym: 'kosovar', aliases: ['pristina'], bounds: [41.8, 20.0, 43.3, 21.8] },
  'brazil': { name: 'Brazil', lat: -14.2350, lon: -51.9253, demonym: 'brazilian', aliases: ['brasilia', 'lula', 'bolsonaro'], bounds: [-33.7, -73.9, 5.3, -34.8] },
  'mexico': { name: 'Mexico', lat: 23.6345, lon: -102.5528, demonym: 'mexican', aliases: ['mexico city'], bounds: [14.5, -118.5, 32.7, -86.7] },
  'canada': { name: 'Canada', lat: 56.1304, lon: -106.3468, demonym: 'canadian', aliases: ['ottawa'], bounds: [41.7, -141.0, 83.1, -52.6] },
  'australia': { name: 'Australia', lat: -25.2744, lon: 133.7751, demonym: 'australian', aliases: ['sydney', 'canberra'], bounds: [-43.6, 113.3, -10.7, 153.6] },
  'argentina': { name: 'Argentina', lat: -38.4161, lon: -63.6167, demonym: 'argentine', aliases: ['buenos aires', 'milei'], bounds: [-55.1, -73.6, -21.8, -53.6] },
  'south africa': { name: 'South Africa', lat: -30.5595, lon: 22.9375, demonym: 'south african', aliases: ['pretoria'], bounds: [-34.9, 16.4, -22.1, 32.9] },
  'nigeria': { name: 'Nigeria', lat: 9.0820, lon: 8.6753, demonym: 'nigerian', aliases: ['abuja'], bounds: [4.2, 2.7, 13.9, 14.7] },
  'egypt': { name: 'Egypt', lat: 26.8206, lon: 30.8025, demonym: 'egyptian', aliases: ['cairo'], bounds: [22.0, 24.7, 31.7, 36.9] },
  'pakistan': { name: 'Pakistan', lat: 30.3753, lon: 69.3451, demonym: 'pakistani', aliases: ['islamabad'], bounds: [23.6, 60.9, 37.1, 77.0] },
  'venezuela': { name: 'Venezuela', lat: 6.4238, lon: -66.5897, demonym: 'venezuelan', aliases: ['caracas', 'maduro'], bounds: [0.6, -73.4, 12.2, -59.8] },
  'colombia': { name: 'Colombia', lat: 4.5709, lon: -74.2973, demonym: 'colombian', aliases: ['bogota'], bounds: [-4.2, -79.0, 12.5, -66.9] },
  'chile': { name: 'Chile', lat: -35.6751, lon: -71.5430, demonym: 'chilean', aliases: ['santiago'], bounds: [-55.9, -75.7, -17.5, -66.4] },
  'peru': { name: 'Peru', lat: -9.1900, lon: -75.0152, demonym: 'peruvian', aliases: ['lima'], bounds: [-18.4, -81.3, -0.0, -68.7] },
  'ecuador': { name: 'Ecuador', lat: -1.8312, lon: -78.1834, demonym: 'ecuadorian', aliases: ['quito'], bounds: [-5.0, -81.1, 1.7, -75.2] },
  'bolivia': { name: 'Bolivia', lat: -16.2902, lon: -63.5887, demonym: 'bolivian', aliases: ['la paz'], bounds: [-22.9, -69.6, -9.7, -57.5] },
  'uruguay': { name: 'Uruguay', lat: -32.5228, lon: -55.7658, demonym: 'uruguayan', aliases: ['montevideo'], bounds: [-35.0, -58.5, -30.1, -53.1] },
  'cuba': { name: 'Cuba', lat: 21.5218, lon: -77.7812, demonym: 'cuban', aliases: ['havana'], bounds: [19.8, -84.9, 23.3, -74.1] },
  'georgia': { name: 'Georgia', lat: 42.3154, lon: 43.3569, demonym: 'georgian', aliases: ['tbilisi'], bounds: [41.0, 39.9, 43.6, 46.7] },
  'armenia': { name: 'Armenia', lat: 40.0691, lon: 45.0382, demonym: 'armenian', aliases: ['yerevan'], bounds: [38.8, 43.4, 41.3, 46.6] },
  'azerbaijan': { name: 'Azerbaijan', lat: 40.1431, lon: 47.5769, demonym: 'azerbaijani', aliases: ['baku'], bounds: [38.4, 44.7, 41.9, 50.6] },
  'united arab emirates': { name: 'United Arab Emirates', lat: 23.4241, lon: 53.8478, demonym: 'emirati', aliases: ['uae', 'dubai', 'abu dhabi'], bounds: [22.6, 51.5, 26.1, 56.4] },
  'lebanon': { name: 'Lebanon', lat: 33.8547, lon: 35.8623, demonym: 'lebanese', aliases: ['beirut', 'hezbollah'], bounds: [33.0, 35.1, 34.7, 36.6] },
  'syria': { name: 'Syria', lat: 34.8021, lon: 38.9968, demonym: 'syrian', aliases: ['damascus', 'assad'], bounds: [32.3, 35.7, 37.3, 42.4] },
  'iraq': { name: 'Iraq', lat: 33.2232, lon: 43.6793, demonym: 'iraqi', aliases: ['baghdad'], bounds: [29.0, 38.8, 37.4, 48.6] },
  'afghanistan': { name: 'Afghanistan', lat: 33.9391, lon: 67.7100, demonym: 'afghan', aliases: ['kabul', 'taliban'], bounds: [29.3, 60.5, 38.5, 74.9] },
  'yemen': { name: 'Yemen', lat: 15.5527, lon: 48.5164, demonym: 'yemeni', aliases: ['houthi', 'sanaa'], bounds: [12.1, 42.5, 19.0, 54.5] },
  'sudan': { name: 'Sudan', lat: 12.8628, lon: 30.2176, demonym: 'sudanese', aliases: ['khartoum'], bounds: [8.7, 21.8, 22.2, 38.6] },
  'ethiopia': { name: 'Ethiopia', lat: 9.1450, lon: 40.4897, demonym: 'ethiopian', aliases: ['addis ababa'], bounds: [3.4, 33.0, 14.9, 47.9] },
  'kenya': { name: 'Kenya', lat: -0.0236, lon: 37.9062, demonym: 'kenyan', aliases: ['nairobi'], bounds: [-4.7, 33.9, 5.0, 41.9] },
  'ghana': { name: 'Ghana', lat: 7.9465, lon: -1.0232, demonym: 'ghanaian', aliases: ['accra'], bounds: [4.5, -3.3, 11.2, 1.2] },
  'morocco': { name: 'Morocco', lat: 31.7917, lon: -7.0926, demonym: 'moroccan', aliases: ['rabat'], bounds: [27.6, -13.2, 35.9, -1.0] },
  'algeria': { name: 'Algeria', lat: 28.0339, lon: 1.6596, demonym: 'algerian', aliases: ['algiers'], bounds: [18.9, -8.7, 37.1, 12.0] },
  'tunisia': { name: 'Tunisia', lat: 33.8869, lon: 9.5375, demonym: 'tunisian', aliases: ['tunis'], bounds: [30.2, 7.5, 37.5, 11.6] },
  'libya': { name: 'Libya', lat: 26.3351, lon: 17.2283, demonym: 'libyan', aliases: ['tripoli'], bounds: [19.5, 9.3, 33.2, 25.2] },
  'indonesia': { name: 'Indonesia', lat: -0.7893, lon: 113.9213, demonym: 'indonesian', aliases: ['jakarta'], bounds: [-11.0, 95.0, 6.1, 141.0] },
  'philippines': { name: 'Philippines', lat: 12.8797, lon: 121.7740, demonym: 'filipino', aliases: ['manila'], bounds: [4.6, 116.9, 21.1, 126.6] },
  'thailand': { name: 'Thailand', lat: 15.8700, lon: 100.9925, demonym: 'thai', aliases: ['bangkok'], bounds: [5.6, 97.3, 20.5, 105.6] },
  'vietnam': { name: 'Vietnam', lat: 14.0583, lon: 108.2772, demonym: 'vietnamese', aliases: ['hanoi'], bounds: [8.2, 102.1, 23.4, 109.5] },
  'malaysia': { name: 'Malaysia', lat: 4.2105, lon: 101.9758, demonym: 'malaysian', aliases: ['kuala lumpur'], bounds: [0.8, 99.6, 7.4, 119.3] },
  'singapore': { name: 'Singapore', lat: 1.3521, lon: 103.8198, demonym: 'singaporean', aliases: [], bounds: [1.2, 103.6, 1.5, 104.0] },
  'bangladesh': { name: 'Bangladesh', lat: 23.6850, lon: 90.3563, demonym: 'bangladeshi', aliases: ['dhaka'], bounds: [20.7, 88.0, 26.6, 92.7] },
  'sri lanka': { name: 'Sri Lanka', lat: 7.8731, lon: 80.7718, demonym: 'sri lankan', aliases: ['colombo'], bounds: [5.9, 79.5, 9.9, 82.0] },
  'nepal': { name: 'Nepal', lat: 28.3949, lon: 84.1240, demonym: 'nepali', aliases: ['kathmandu'], bounds: [26.3, 80.0, 30.5, 88.2] },
  'kazakhstan': { name: 'Kazakhstan', lat: 48.0196, lon: 66.9237, demonym: 'kazakh', aliases: ['astana'], bounds: [40.6, 46.5, 55.4, 87.3] },
  'uzbekistan': { name: 'Uzbekistan', lat: 41.3775, lon: 64.5853, demonym: 'uzbek', aliases: ['tashkent'], bounds: [37.2, 55.9, 45.6, 73.2] },
  'new zealand': { name: 'New Zealand', lat: -40.9006, lon: 174.8860, demonym: 'new zealander', aliases: ['wellington'], bounds: [-47.4, 166.4, -34.4, 178.6] },
};

const CITY_DATA: Record<string, CityData> = {
  'washington': { name: 'Washington', country: 'United States', region: 'District of Columbia', lat: 38.9072, lon: -77.0369, aliases: ['dc', 'washington dc', 'white house', 'congress', 'senate', 'fed', 'federal reserve'] },
  'new york': { name: 'New York', country: 'United States', region: 'New York', lat: 40.7128, lon: -74.0060, aliases: ['nyc', 'wall street'] },
  'san francisco': { name: 'San Francisco', country: 'United States', region: 'California', lat: 37.7749, lon: -122.4194, aliases: ['sf', 'openai'] },
  'los angeles': { name: 'Los Angeles', country: 'United States', region: 'California', lat: 34.0522, lon: -118.2437, aliases: ['hollywood'] },
  'baltimore': { name: 'Baltimore', country: 'United States', region: 'Maryland', lat: 39.2904, lon: -76.6122 },
  'cincinnati': { name: 'Cincinnati', country: 'United States', region: 'Ohio', lat: 39.1031, lon: -84.5120 },
  'atlanta': { name: 'Atlanta', country: 'United States', region: 'Georgia', lat: 33.7490, lon: -84.3880 },
  'austin': { name: 'Austin', country: 'United States', region: 'Texas', lat: 30.2672, lon: -97.7431, aliases: ['tesla'] },
  'starbase': { name: 'Starbase', country: 'United States', region: 'Texas', lat: 25.9968, lon: -97.1558, aliases: ['spacex'] },
  'london': { name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  'paris': { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  'berlin': { name: 'Berlin', country: 'Germany', lat: 52.5200, lon: 13.4050 },
  'rome': { name: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964 },
  'madrid': { name: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  'kyiv': { name: 'Kyiv', country: 'Ukraine', lat: 50.4501, lon: 30.5234, aliases: ['kiev'] },
  'moscow': { name: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173 },
  'doha': { name: 'Doha', country: 'Qatar', lat: 25.2854, lon: 51.5310 },
  'jerusalem': { name: 'Jerusalem', country: 'Israel', lat: 31.7683, lon: 35.2137 },
  'gaza': { name: 'Gaza', country: 'Palestine', lat: 31.5000, lon: 34.4667, aliases: ['gaza strip'] },
  'tehran': { name: 'Tehran', country: 'Iran', lat: 35.6892, lon: 51.3890 },
  'tokyo': { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  'taipei': { name: 'Taipei', country: 'Taiwan', lat: 25.0330, lon: 121.5654 },
  'beijing': { name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074 },
  'seoul': { name: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.9780 },
  'delhi': { name: 'Delhi', country: 'India', lat: 28.6139, lon: 77.2090, aliases: ['new delhi'] },
  'sydney': { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  'buenos aires': { name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
};

const US_STATES: Record<string, StateData> = {
  'georgia': { name: 'Georgia', abbr: 'GA', lat: 32.1656, lon: -82.9001, bounds: [30.3, -85.7, 35.0, -80.8] },
  'california': { name: 'California', abbr: 'CA', lat: 36.7783, lon: -119.4179, bounds: [32.5, -124.5, 42.0, -114.1] },
  'texas': { name: 'Texas', abbr: 'TX', lat: 31.9686, lon: -99.9018, bounds: [25.8, -106.7, 36.5, -93.5] },
  'florida': { name: 'Florida', abbr: 'FL', lat: 27.6648, lon: -81.5158, bounds: [24.4, -87.6, 31.0, -80.0] },
  'new york': { name: 'New York', abbr: 'NY', lat: 43.0000, lon: -75.0000, bounds: [40.5, -79.8, 45.1, -71.8] },
  'pennsylvania': { name: 'Pennsylvania', abbr: 'PA', lat: 41.2033, lon: -77.1945, bounds: [39.7, -80.6, 42.5, -74.7] },
  'michigan': { name: 'Michigan', abbr: 'MI', lat: 44.3148, lon: -85.6024, bounds: [41.7, -90.4, 48.3, -82.4] },
  'wisconsin': { name: 'Wisconsin', abbr: 'WI', lat: 43.7844, lon: -88.7879, bounds: [42.5, -92.9, 47.1, -86.8] },
  'nevada': { name: 'Nevada', abbr: 'NV', lat: 38.8026, lon: -116.4194, bounds: [35.0, -120.0, 42.0, -114.0] },
  'arizona': { name: 'Arizona', abbr: 'AZ', lat: 34.0489, lon: -111.0937, bounds: [31.3, -114.8, 37.0, -109.0] },
  'ohio': { name: 'Ohio', abbr: 'OH', lat: 40.4173, lon: -82.9071, bounds: [38.4, -84.8, 42.3, -80.5] },
  'north carolina': { name: 'North Carolina', abbr: 'NC', lat: 35.7596, lon: -79.0193, bounds: [33.8, -84.3, 36.6, -75.5] },
  'iowa': { name: 'Iowa', abbr: 'IA', lat: 41.8780, lon: -93.0977, bounds: [40.4, -96.6, 43.5, -90.1] },
};

const SPORTS_TEAMS: Record<string, CityData> = {
  'ravens': CITY_DATA.baltimore!,
  'baltimore ravens': CITY_DATA.baltimore!,
  'bengals': CITY_DATA.cincinnati!,
  'cincinnati bengals': CITY_DATA.cincinnati!,
  'lakers': CITY_DATA['los angeles']!,
  'dodgers': CITY_DATA['los angeles']!,
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

function countryTerms(country: CountryData): string[] {
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

function toCountryGeotag(country: CountryData, source: GeotagSource, matchedText: string, confidence: GeotagConfidence = 'high'): PredictionGeotag {
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
    country: 'United States',
    region: state.name,
    lat: state.lat,
    lon: state.lon,
    confidence: 'high',
    extractedFrom: 'state',
    matchedText,
  };
}

function findCity(text: string): PredictionGeotag | null {
  const lower = text.toLowerCase();
  for (const city of Object.values(CITY_DATA)) {
    const matched = cityTerms(city).find(term => hasWord(lower, term));
    if (matched) return toCityGeotag(city, 'city', matched);
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

  if (!STATE_CONTEXT_RE.test(text)) return null;
  for (const state of Object.values(US_STATES)) {
    if (hasWord(lower, state.abbr.toLowerCase())) return toStateGeotag(state, state.abbr);
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

function findCountries(text: string): Array<{ country: CountryData; matchedText: string; index: number; context: string }> {
  const lower = text.toLowerCase();
  const matches: Array<{ country: CountryData; matchedText: string; index: number; context: string }> = [];
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
  return Object.values(COUNTRY_DATA).find(country => country.name === location.country)?.bounds;
}

function hashStringToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function spreadGeotag(location: PredictionGeotag, seed: string): PredictionGeotag {
  const bounds = getLocationBounds(location);
  if (!bounds) return location;

  const [minLat, minLon, maxLat, maxLon] = bounds;
  const latPadding = (maxLat - minLat) * 0.08;
  const lonPadding = (maxLon - minLon) * 0.08;
  const safeMinLat = minLat + latPadding;
  const safeMaxLat = maxLat - latPadding;
  const safeMinLon = minLon + lonPadding;
  const safeMaxLon = maxLon - lonPadding;
  const lat = safeMinLat + hashStringToUnit(`${seed}:lat`) * (safeMaxLat - safeMinLat);
  const lon = safeMinLon + hashStringToUnit(`${seed}:lon`) * (safeMaxLon - safeMinLon);

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
    if (state.region === 'Georgia' && countryGeorgiaContext) {
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

