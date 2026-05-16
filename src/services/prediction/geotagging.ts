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
export type GeotagSource = 'sports' | 'country' | 'city' | 'state' | 'pattern' | 'context' | 'event-inherited';

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

﻿// Auto-generated from Natural Earth 110m admin boundaries with manual overrides.
// Regenerate: npx tsx scripts/merge-country-bounds.ts
export const COUNTRY_BOUNDS: Record<string, [minLat: number, minLon: number, maxLat: number, maxLon: number]> = {
  'afghanistan': [29.3, 60.5, 38.5, 74.9],
  'albania': [39.62, 19.3, 42.69, 21.02],
  'algeria': [18.9, -8.7, 37.1, 12],
  'angola': [-17.93, 11.64, -4.44, 24.08],
  'antarctica': [-90, -180, -63.27, 180],
  'argentina': [-55.1, -73.6, -21.8, -53.6],
  'armenia': [38.8, 43.4, 41.3, 46.6],
  'australia': [-43.6, 113.3, -10.7, 153.6],
  'austria': [46.3, 9.5, 49.1, 17.2],
  'azerbaijan': [38.4, 44.7, 41.9, 50.6],
  'bahamas': [23.71, -78.98, 27.04, -77],
  'bangladesh': [20.7, 88, 26.6, 92.7],
  'belarus': [51.32, 23.2, 56.17, 32.69],
  'belgium': [49.5, 2.5, 51.5, 6.4],
  'belize': [15.89, -89.23, 18.5, -88.11],
  'benin': [6.14, 0.77, 12.24, 3.8],
  'bhutan': [26.72, 88.81, 28.3, 92.1],
  'bolivia': [-22.9, -69.6, -9.7, -57.5],
  'bosnia and herzegovina': [42.65, 15.75, 45.23, 19.6],
  'botswana': [-26.83, 19.9, -17.66, 29.43],
  'brazil': [-33.7, -73.9, 5.3, -34.8],
  'brunei': [4.01, 114.2, 5.45, 115.45],
  'bulgaria': [41.23, 22.38, 44.23, 28.56],
  'burkina faso': [9.61, -5.47, 15.12, 2.18],
  'burundi': [-4.5, 29.02, -2.35, 30.75],
  'cambodia': [10.49, 102.35, 14.57, 107.61],
  'cameroon': [1.73, 8.49, 12.86, 16.01],
  'canada': [41.7, -141, 83.1, -52.6],
  'central african republic': [2.27, 14.46, 11.14, 27.37],
  'chad': [7.42, 13.54, 23.41, 23.89],
  'chile': [-55.9, -75.7, -17.5, -66.4],
  'china': [18.2, 73.5, 53.6, 134.8],
  'colombia': [-4.2, -79, 12.5, -66.9],
  'costa rica': [8.23, -85.94, 11.22, -82.55],
  'croatia': [42.48, 13.66, 46.5, 19.39],
  'cuba': [19.8, -84.9, 23.3, -74.1],
  'cyprus': [34.57, 32.26, 35.17, 34],
  'czech republic': [48.5, 12.1, 51.1, 18.9],
  'dem. rep. korea': [37.67, 124.27, 42.99, 130.78],
  'democratic republic of the congo': [-13.26, 12.18, 5.26, 31.17],
  'denmark': [54.5, 8, 57.8, 15.2],
  'djibouti': [10.93, 41.66, 12.7, 43.32],
  'dominican republic': [17.6, -71.95, 19.88, -68.32],
  'ecuador': [-5, -81.1, 1.7, -75.2],
  'egypt': [22, 24.7, 31.7, 36.9],
  'el salvador': [13.15, -90.1, 14.42, -87.72],
  'eq. guinea': [1.01, 9.31, 2.28, 11.29],
  'eritrea': [12.46, 36.32, 18, 43.08],
  'estonia': [57.47, 23.34, 59.61, 28.13],
  'ethiopia': [3.4, 33, 14.9, 47.9],
  'falkland islands': [-52.3, -61.2, -51.1, -57.75],
  'fiji': [-18.29, -180, -16.02, 180],
  'finland': [59.8, 20.5, 70.1, 31.6],
  'fr. s. and antarctic lands': [-49.77, 68.72, -48.62, 70.56],
  'france': [41.3, -5.1, 51.1, 9.6],
  'gabon': [-3.98, 8.8, 2.33, 14.43],
  'gambia': [13.13, -16.84, 13.88, -13.84],
  'georgia': [41, 39.9, 43.6, 46.7],
  'germany': [47.3, 5.9, 55.1, 15],
  'ghana': [4.5, -3.3, 11.2, 1.2],
  'greece': [34.8, 19.3, 41.8, 28.2],
  'greenland': [60.04, -73.3, 83.65, -12.21],
  'guatemala': [13.74, -92.23, 17.82, -88.23],
  'guinea': [7.31, -15.13, 12.59, -7.83],
  'guinea-bissau': [11.04, -16.68, 12.63, -13.7],
  'guyana': [1.27, -61.41, 8.37, -56.54],
  'haiti': [18.03, -74.46, 19.92, -71.62],
  'honduras': [12.98, -89.35, 16.01, -83.15],
  'hungary': [45.7, 16.1, 48.6, 22.9],
  'iceland': [63.5, -24.33, 66.53, -13.61],
  'india': [8.4, 68.1, 37.1, 97.4],
  'indonesia': [-11, 95, 6.1, 141],
  'iran': [25, 44, 39.8, 63.3],
  'iraq': [29, 38.8, 37.4, 48.6],
  'ireland': [51.4, -10.7, 55.4, -5.9],
  'israel': [29.5, 34.2, 33.3, 35.9],
  'italy': [36.6, 6.6, 47.1, 18.5],
  'ivory coast': [4.34, -8.6, 10.52, -2.56],
  'jamaica': [17.7, -78.34, 18.52, -76.2],
  'japan': [24.4, 122.9, 45.6, 154],
  'jordan': [29.2, 34.92, 33.38, 39.2],
  'kazakhstan': [40.6, 46.5, 55.4, 87.3],
  'kenya': [-4.7, 33.9, 5, 41.9],
  'kosovo': [41.8, 20, 43.3, 21.8],
  'kuwait': [28.53, 46.57, 30.06, 48.42],
  'kyrgyzstan': [39.28, 69.46, 43.3, 80.26],
  'laos': [13.88, 100.12, 22.46, 107.56],
  'latvia': [55.62, 21.06, 57.97, 28.18],
  'lebanon': [33, 35.1, 34.7, 36.6],
  'lesotho': [-30.65, 27, -28.65, 29.33],
  'liberia': [4.36, -11.44, 8.54, -7.54],
  'libya': [19.5, 9.3, 33.2, 25.2],
  'lithuania': [53.91, 21.06, 56.37, 26.59],
  'luxembourg': [49.44, 5.67, 50.13, 6.24],
  'macedonia': [40.84, 20.46, 42.32, 22.95],
  'madagascar': [-25.6, 43.25, -12.04, 50.48],
  'malawi': [-16.8, 32.69, -9.23, 35.77],
  'malaysia': [0.8, 99.6, 7.4, 119.3],
  'mali': [10.1, -12.17, 24.97, 4.27],
  'mauritania': [14.62, -17.06, 27.4, -4.92],
  'mexico': [14.5, -118.5, 32.7, -86.7],
  'moldova': [45.49, 26.62, 48.47, 30.02],
  'mongolia': [41.6, 87.75, 52.05, 119.77],
  'montenegro': [41.88, 18.45, 43.52, 20.34],
  'morocco': [27.6, -13.2, 35.9, -1],
  'mozambique': [-26.74, 30.18, -10.32, 40.78],
  'myanmar': [9.93, 92.3, 28.34, 101.18],
  'namibia': [-29.05, 11.73, -16.94, 25.08],
  'nepal': [26.3, 80, 30.5, 88.2],
  'netherlands': [50.7, 3.4, 53.6, 7.2],
  'new caledonia': [-22.4, 164.03, -20.11, 167.12],
  'new zealand': [-47.4, 166.4, -34.4, 178.6],
  'nicaragua': [10.73, -87.67, 15.02, -83.15],
  'niger': [11.66, 0.3, 23.47, 15.9],
  'nigeria': [4.2, 2.7, 13.9, 14.7],
  'north korea': [37.6, 124.2, 43.1, 130.9],
  'northern cyprus': [35, 32.73, 35.67, 34.58],
  'norway': [57.9, 4.6, 71.2, 31.1],
  'oman': [16.65, 52, 26.4, 59.81],
  'pakistan': [23.6, 60.9, 37.1, 77],
  'palestine': [31.2, 34.2, 32.6, 35.6],
  'palestinian territory occupied': [31.2, 34.2, 32.6, 35.6],
  'panama': [7.22, -82.97, 9.61, -77.24],
  'papua new guinea': [-10.65, 141, -2.5, 156.02],
  'paraguay': [-27.55, -62.69, -19.34, -54.29],
  'peru': [-18.4, -81.3, 0, -68.7],
  'philippines': [4.6, 116.9, 21.1, 126.6],
  'poland': [49, 14.1, 54.9, 24.2],
  'portugal': [36.84, -9.53, 42.28, -6.39],
  'puerto rico': [17.95, -67.24, 18.52, -65.59],
  'qatar': [24.4, 50.7, 26.2, 51.7],
  'republic of congo': [-5.04, 11.09, 3.73, 18.45],
  'republic of korea': [34.39, 126.12, 38.61, 129.47],
  'romania': [43.6, 20.2, 48.3, 29.7],
  'russia': [41.2, 19.6, 81.9, 179.9],
  'rwanda': [-2.92, 29.02, -1.13, 30.82],
  'saudi arabia': [16.3, 34.5, 32.2, 55.7],
  'senegal': [12.33, -17.63, 16.6, -11.47],
  'serbia': [42.2, 18.8, 46.2, 23],
  'sierra leone': [6.79, -13.25, 10.05, -10.23],
  'singapore': [1.2, 103.6, 1.5, 104],
  'slovakia': [47.76, 16.88, 49.57, 22.56],
  'slovenia': [45.45, 13.7, 46.85, 16.56],
  'solomon islands': [-10.83, 156.49, -6.6, 162.4],
  'somalia': [-1.68, 40.98, 12.02, 51.13],
  'somaliland': [8, 42.56, 11.46, 48.95],
  'south africa': [-34.9, 16.4, -22.1, 32.9],
  'south korea': [33, 124.5, 38.6, 131.9],
  'south sudan': [3.51, 23.89, 12.25, 35.3],
  'spain': [36, -9.3, 43.8, 3.3],
  'sri lanka': [5.9, 79.5, 9.9, 82],
  'sudan': [8.7, 21.8, 22.2, 38.6],
  'suriname': [1.82, -58.04, 6.03, -53.96],
  'swaziland': [-27.29, 30.68, -25.66, 32.07],
  'sweden': [55, 11, 69.1, 24.2],
  'switzerland': [45.8, 5.9, 47.8, 10.5],
  'syria': [32.3, 35.7, 37.3, 42.4],
  'taiwan': [21.8, 119.3, 25.4, 122.1],
  'tajikistan': [36.74, 67.44, 40.96, 74.98],
  'tanzania': [-11.72, 29.34, -0.95, 40.32],
  'thailand': [5.6, 97.3, 20.5, 105.6],
  'timor-leste': [-9.39, 124.97, -8.27, 127.34],
  'togo': [5.93, -0.05, 11.02, 1.87],
  'trinidad and tobago': [10, -61.95, 10.89, -60.89],
  'tunisia': [30.2, 7.5, 37.5, 11.6],
  'turkey': [35.8, 25.7, 42.1, 44.8],
  'turkmenistan': [35.27, 52.5, 42.75, 66.55],
  'uganda': [-1.44, 29.58, 4.25, 35.04],
  'ukraine': [44.2, 22.1, 52.4, 40.2],
  'united arab emirates': [22.6, 51.5, 26.1, 56.4],
  'united kingdom': [49.9, -8.6, 58.7, 1.8],
  'united states': [24.3963, -125, 49.3844, -66.9346],
  'uruguay': [-35, -58.5, -30.1, -53.1],
  'uzbekistan': [37.2, 55.9, 45.6, 73.2],
  'vanuatu': [-16.6, 166.63, -14.63, 167.84],
  'venezuela': [0.6, -73.4, 12.2, -59.8],
  'vietnam': [8.2, 102.1, 23.4, 109.5],
  'w. sahara': [21, -17.06, 27.66, -8.67],
  'yemen': [12.1, 42.5, 19, 54.5],
  'zambia': [-17.96, 21.89, -8.24, 33.49],
  'zimbabwe': [-22.27, 25.26, -15.51, 32.85],
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

// ── Organization / institution → location mapping ──
// Covers corporations, governments, international bodies that appear in market titles
// but aren't matched by city/country gazetteers.
const ORGANIZATION_LOCATIONS: Record<string, { country: string; city?: string; lat: number; lon: number }> = {
  // US Government / Federal
  'white house': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'pentagon': { country: 'United States', city: 'Arlington', lat: 38.8710, lon: -77.0563 },
  'capitol': { country: 'United States', city: 'Washington', lat: 38.8899, lon: -77.0091 },
  'capitol hill': { country: 'United States', city: 'Washington', lat: 38.8899, lon: -77.0091 },
  'supreme court': { country: 'United States', city: 'Washington', lat: 38.8906, lon: -77.0044 },
  'federal reserve': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'fed': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'fomc': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'sec': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'treasury': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'cia': { country: 'United States', city: 'McLean', lat: 38.9448, lon: -77.1778 },
  'fbi': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'nsa': { country: 'United States', city: 'Fort Meade', lat: 39.1093, lon: -76.7611 },
  'cdc': { country: 'United States', city: 'Atlanta', lat: 33.7490, lon: -84.3880 },
  'nasa': { country: 'United States', city: 'Houston', lat: 29.7604, lon: -95.3698 },
  // International organizations
  'nato': { country: 'Belgium', city: 'Brussels', lat: 50.8503, lon: 4.3517 },
  'un': { country: 'United States', city: 'New York', lat: 40.7489, lon: -73.9680 },
  'united nations': { country: 'United States', city: 'New York', lat: 40.7489, lon: -73.9680 },
  'who': { country: 'Switzerland', city: 'Geneva', lat: 46.2044, lon: 6.1432 },
  'world health organization': { country: 'Switzerland', city: 'Geneva', lat: 46.2044, lon: 6.1432 },
  'imf': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'international monetary fund': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'world bank': { country: 'United States', city: 'Washington', lat: 38.8977, lon: -77.0365 },
  'wto': { country: 'Switzerland', city: 'Geneva', lat: 46.2044, lon: 6.1432 },
  'oecd': { country: 'France', city: 'Paris', lat: 48.8566, lon: 2.3522 },
  'g7': { country: 'Europe', lat: 50.00, lon: 10.00 },
  'g20': { country: 'Europe', lat: 50.00, lon: 10.00 },
  'eu': { country: 'Belgium', city: 'Brussels', lat: 50.8503, lon: 4.3517 },
  'european union': { country: 'Belgium', city: 'Brussels', lat: 50.8503, lon: 4.3517 },
  'ecb': { country: 'Germany', city: 'Frankfurt', lat: 50.1109, lon: 8.6821 },
  'european central bank': { country: 'Germany', city: 'Frankfurt', lat: 50.1109, lon: 8.6821 },
  'african union': { country: 'Ethiopia', city: 'Addis Ababa', lat: 9.0192, lon: 38.7525 },
  'asean': { country: 'Indonesia', city: 'Jakarta', lat: -6.2088, lon: 106.8456 },
  'opec': { country: 'Austria', city: 'Vienna', lat: 48.2082, lon: 16.3738 },
  // Tech companies
  'openai': { country: 'United States', city: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'google': { country: 'United States', city: 'Mountain View', lat: 37.4220, lon: -122.0841 },
  'alphabet': { country: 'United States', city: 'Mountain View', lat: 37.4220, lon: -122.0841 },
  'apple': { country: 'United States', city: 'Cupertino', lat: 37.3230, lon: -122.0322 },
  'microsoft': { country: 'United States', city: 'Redmond', lat: 47.6740, lon: -122.1215 },
  'amazon': { country: 'United States', city: 'Seattle', lat: 47.6062, lon: -122.3321 },
  'meta': { country: 'United States', city: 'Menlo Park', lat: 37.4529, lon: -122.1817 },
  'facebook': { country: 'United States', city: 'Menlo Park', lat: 37.4529, lon: -122.1817 },
  'x': { country: 'United States', city: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'twitter': { country: 'United States', city: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'tesla': { country: 'United States', city: 'Austin', lat: 30.2672, lon: -97.7431 },
  'spacex': { country: 'United States', city: 'Starbase', lat: 25.9972, lon: -97.1561 },
  'bytedance': { country: 'China', city: 'Beijing', lat: 39.9042, lon: 116.4074 },
  'tiktok': { country: 'China', city: 'Beijing', lat: 39.9042, lon: 116.4074 },
  'tsmc': { country: 'Taiwan', city: 'Hsinchu', lat: 24.8039, lon: 121.0197 },
  'samsung': { country: 'South Korea', city: 'Seoul', lat: 37.5665, lon: 126.9780 },
  'huawei': { country: 'China', city: 'Shenzhen', lat: 22.5431, lon: 114.0579 },
  'nvidia': { country: 'United States', city: 'Santa Clara', lat: 37.3541, lon: -121.9552 },
  'intel': { country: 'United States', city: 'Santa Clara', lat: 37.3541, lon: -121.9552 },
  'amd': { country: 'United States', city: 'Santa Clara', lat: 37.3541, lon: -121.9552 },
  'boeing': { country: 'United States', city: 'Arlington', lat: 38.8816, lon: -77.0910 },
  'lockheed': { country: 'United States', city: 'Bethesda', lat: 38.9847, lon: -77.0947 },
  'lockheed martin': { country: 'United States', city: 'Bethesda', lat: 38.9847, lon: -77.0947 },
  'raytheon': { country: 'United States', city: 'Arlington', lat: 38.8816, lon: -77.0910 },
  // Financial institutions
  'blackrock': { country: 'United States', city: 'New York', lat: 40.7128, lon: -74.0060 },
  'goldman sachs': { country: 'United States', city: 'New York', lat: 40.7128, lon: -74.0060 },
  'jp morgan': { country: 'United States', city: 'New York', lat: 40.7128, lon: -74.0060 },
  'jpmorgan': { country: 'United States', city: 'New York', lat: 40.7128, lon: -74.0060 },
  'bank of america': { country: 'United States', city: 'Charlotte', lat: 35.2271, lon: -80.8431 },
  // Energy
  'saudi aramco': { country: 'Saudi Arabia', city: 'Dhahran', lat: 26.2885, lon: 50.1274 },
  'gazprom': { country: 'Russia', city: 'Moscow', lat: 55.7558, lon: 37.6173 },
  // Crypto
  'binance': { country: 'United Arab Emirates', city: 'Dubai', lat: 25.2048, lon: 55.2708 },
  'coinbase': { country: 'United States', city: 'San Francisco', lat: 37.7749, lon: -122.4194 },
};

const CRYPTO_ONLY_RE = /\b(bitcoin|ethereum|solana|btc|eth|sol|doge|crypto|cryptocurrency|memecoin)\b/i;
// Extended explicit location patterns
const EXPLICIT_LOCATION_RE = /\b(?:in|at|from|to)\s+([A-Z][a-zA-Z. -]+?)(?:\s+(?:on|before|after|by|in|at|for|during|next)|[,?.!]|$)/g;
// Conjunction pattern: "X and Y" where both are potential locations
const CONJUNCTION_RE = /\b([A-Z][a-zA-Z]+)\s+and\s+([A-Z][a-zA-Z]+)\b/g;
// Hyphenated pair: "US-China", "Russia-Ukraine"
const HYPHENATED_RE = /\b([A-Z][a-zA-Z]+)-([A-Z][a-zA-Z]+)\b/g;
// Possessive: "Biden's visit", "France's economy"
const POSSESSIVE_RE = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)'s\b/g;
// Apposition: "President Macron, France" or "the French president, Emmanuel Macron"
const APPOSITION_RE = /\b(?:president|prime minister|chancellor|king|queen|leader|foreign minister|defense minister)\s+([A-Z][a-zA-Z]+),?\s+([A-Z][a-zA-Z]+)\b/i;
// Action-target: "invade X", "attack Y", "sanction Z"
const ACTION_TARGET_RE = /\b(?:invade|invades|invasion of|attack|attacks|strike|strikes|sanction|sanctions|bomb|bombs|invading|attacking|striking|sanctioning)\s+([A-Z][a-zA-Z. -]+?)(?:\s|$|[,?.!])/g;
const STATE_CONTEXT_RE = /\b(primary|election|governor|senate|senator|representative|district|ballot|referendum|vote|poll|campaign|caucus|congressional|presidential)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWord(text: string, value: string): boolean {
  return new RegExp(`\\b${escapeRegExp(value.toLowerCase())}\\b`, 'i').test(text);
}

// ── Levenshtein distance for fuzzy country matching ──
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row: number[] = [];
  for (let j = 0; j <= n; j++) row.push(j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j]!;
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      row[j] = Math.min(
        row[j]! + 1,
        row[j - 1]! + 1,
        prev + cost,
      );
      prev = temp;
    }
  }
  return row[n]!;
}

/** Fuzzy country match: returns country if edit distance ≤ 2 from any term. */
function fuzzyCountryMatch(text: string): typeof COUNTRY_DATA[string] | null {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  // Only try fuzzy matching on individual words 3+ chars (too expensive otherwise)
  const candidates = words.filter(w => w.length >= 3 && w.length <= 20);
  for (const country of Object.values(COUNTRY_DATA)) {
    for (const term of countryTerms(country)) {
      for (const candidate of candidates) {
        if (Math.abs(term.length - candidate.length) > 2) continue;
        if (levenshtein(term, candidate) <= 2) return country;
      }
    }
  }
  return null;
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
  // 1. Preposition pattern: "in X", "at Y", "from Z", "to W"
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

  // 2. Action-target pattern: "invade X", "attack Y", "sanction Z"
  ACTION_TARGET_RE.lastIndex = 0;
  while ((match = ACTION_TARGET_RE.exec(text)) !== null) {
    const target = match[1]?.trim();
    if (!target) continue;
    const city = findCity(target);
    if (city) return { ...city, extractedFrom: 'pattern', matchedText: target };
    const state = findState(target);
    if (state) return { ...state, extractedFrom: 'pattern', matchedText: target };
    const country = findCountryByText(target);
    if (country) return { ...country, extractedFrom: 'pattern', matchedText: target };
  }

  // 3. Conjunction pattern: "X and Y" — pick the first that resolves
  CONJUNCTION_RE.lastIndex = 0;
  while ((match = CONJUNCTION_RE.exec(text)) !== null) {
    for (const loc of [match[1], match[2]]) {
      if (!loc) continue;
      const city = findCity(loc);
      if (city) return { ...city, extractedFrom: 'pattern', matchedText: loc };
      const state = findState(loc);
      if (state) return { ...state, extractedFrom: 'pattern', matchedText: loc };
      const country = findCountryByText(loc);
      if (country) return { ...country, extractedFrom: 'pattern', matchedText: loc };
    }
  }

  // 4. Hyphenated pair: "US-China" — pick the second (target) as primary
  HYPHENATED_RE.lastIndex = 0;
  while ((match = HYPHENATED_RE.exec(text)) !== null) {
    for (const loc of [match[2], match[1]]) {
      if (!loc) continue;
      const city = findCity(loc);
      if (city) return { ...city, extractedFrom: 'pattern', matchedText: loc };
      const state = findState(loc);
      if (state) return { ...state, extractedFrom: 'pattern', matchedText: loc };
      const country = findCountryByText(loc);
      if (country) return { ...country, extractedFrom: 'pattern', matchedText: loc };
    }
  }

  // 5. Possessive: "France's economy" → France
  POSSESSIVE_RE.lastIndex = 0;
  while ((match = POSSESSIVE_RE.exec(text)) !== null) {
    const possessor = match[1]?.trim();
    if (!possessor) continue;
    const city = findCity(possessor);
    if (city) return { ...city, extractedFrom: 'pattern', matchedText: possessor };
    const state = findState(possessor);
    if (state) return { ...state, extractedFrom: 'pattern', matchedText: possessor };
    const country = findCountryByText(possessor);
    if (country) return { ...country, extractedFrom: 'pattern', matchedText: possessor };
  }

  // 6. Apposition: "President Macron, France" → France
  const apposMatch = text.match(APPOSITION_RE);
  if (apposMatch?.[2]) {
    const place = apposMatch[2].trim();
    const city = findCity(place);
    if (city) return { ...city, extractedFrom: 'pattern', matchedText: place };
    const state = findState(place);
    if (state) return { ...state, extractedFrom: 'pattern', matchedText: place };
    const country = findCountryByText(place);
    if (country) return { ...country, extractedFrom: 'pattern', matchedText: place };
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

/** Find organization/institution mentions and map to their headquarters location. */
function findOrganization(text: string): PredictionGeotag | null {
  const lower = text.toLowerCase();
  // Try multi-word phrases first (longer matches are more specific)
  const words = lower.split(/\s+/);
  for (let len = Math.min(words.length, 3); len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ').replace(/[.,'?!:;"\u2018\u2019\u201C\u201D\u2013\u2014]/g, '');
      const org = ORGANIZATION_LOCATIONS[phrase];
      if (org) {
        return {
          country: org.country,
          city: org.city,
          lat: org.lat,
          lon: org.lon,
          confidence: 'high',
          extractedFrom: 'context',
          matchedText: phrase,
        };
      }
    }
  }
  return null;
}

// ── Multi-location extraction with context scoring ──
// Instead of returning on first match, extract ALL candidate locations and
// score them by proximity to action verbs, context words, and match quality.

interface LocationCandidate {
  geotag: PredictionGeotag;
  score: number;
}

/** Score a location candidate based on its context in the text. */
function scoreCandidate(text: string, geotag: PredictionGeotag): number {
  const lower = text.toLowerCase();
  const matchedLower = geotag.matchedText.toLowerCase();
  const matchIndex = lower.indexOf(matchedLower);
  if (matchIndex < 0) return 0;

  // Base score from confidence level
  let score = geotag.confidence === 'high' ? 10 : geotag.confidence === 'medium' ? 5 : 2;

  // +5 if near an action verb (invade, attack, elect, sanction, etc.)
  const actionVerbs = ['invade', 'attack', 'strike', 'sanction', 'elect', 'vote', 'bomb', 'annex', 'war', 'conflict', 'ceasefire', 'treaty', 'agreement', 'summit'];
  const contextWindow = lower.slice(Math.max(0, matchIndex - 40), matchIndex + matchedLower.length + 40);
  for (const verb of actionVerbs) {
    if (contextWindow.includes(verb)) { score += 5; break; }
  }

  // +3 if near a subject word (president, government, election)
  const subjectWords = ['president', 'prime minister', 'government', 'election', 'parliament', 'senate', 'congress', 'military', 'army'];
  for (const word of subjectWords) {
    if (contextWindow.includes(word)) { score += 3; break; }
  }

  // +2 if it's a city-level match (more specific than country)
  if (geotag.city) score += 2;

  // +1 for each additional context word nearby
  const nearbyWords = contextWindow.split(/\s+/);
  for (const w of nearbyWords) {
    if (w.length > 4 && !matchedLower.includes(w)) score += 0.5;
  }

  return score;
}

/** Extract ALL location candidates from text and return the best one. */
function extractBestGeotag(text: string): PredictionGeotag | null {
  const candidates: LocationCandidate[] = [];

  // 1. Explicit patterns (highest priority)
  const explicit = findExplicitPattern(text);
  if (explicit) candidates.push({ geotag: explicit, score: scoreCandidate(text, explicit) + 20 });

  // 2. Organization mentions
  const org = findOrganization(text);
  if (org) candidates.push({ geotag: org, score: scoreCandidate(text, org) + 15 });

  // 3. City matches
  const city = findCity(text);
  if (city) candidates.push({ geotag: city, score: scoreCandidate(text, city) + 10 });

  // 4. Sports teams
  const sports = findSportsTeam(text);
  if (sports) candidates.push({ geotag: sports, score: scoreCandidate(text, sports) + 10 });

  // 5. State/region matches
  const state = findState(text);
  if (state) {
    // Georgia disambiguation
    if (state.country === 'United States' && state.region === 'Georgia' && /\b(tbilisi|russia|russian|caucasus|europe|georgian dream)\b/i.test(text)) {
      const countryTag = toCountryGeotag(COUNTRY_DATA.georgia!, 'context', 'georgia');
      candidates.push({ geotag: countryTag, score: scoreCandidate(text, countryTag) + 8 });
    } else {
      candidates.push({ geotag: state, score: scoreCandidate(text, state) + 8 });
    }
  }

  // 6. Country matches with context
  const country = findCountryWithContext(text);
  if (country) candidates.push({ geotag: country, score: scoreCandidate(text, country) + 5 });

  // 7. Fuzzy country match (last resort)
  if (candidates.length === 0) {
    const fuzzy = fuzzyCountryMatch(text);
    if (fuzzy) {
      const fuzzyTag = toCountryGeotag(fuzzy, 'country', fuzzy.name, 'low');
      candidates.push({ geotag: fuzzyTag, score: scoreCandidate(text, fuzzyTag) + 1 });
    }
  }

  if (candidates.length === 0) return null;

  // Return the highest-scoring candidate
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]!.geotag;
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
  if (probe === null) {
    // Geometry not loaded yet — bbox sampling can land in neighbouring countries
    // (e.g. Brazil's bbox fully covers Bolivia). Use the centroid instead.
    const centroid = getCountryCentroid(code);
    return centroid ?? sampleInBbox(bounds, seed);
  }

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

  // Multi-location extraction with context scoring
  const best = extractBestGeotag(text);
  if (best) return best;

  // Fuzzy match as last resort before giving up
  const fuzzy = fuzzyCountryMatch(text);
  if (fuzzy) return toCountryGeotag(fuzzy, 'country', fuzzy.name, 'low');

  // Crypto-only markets have no geographic focus
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
