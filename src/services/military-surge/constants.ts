import type { MilitaryFlight, MilitaryOperator } from '@/types';

// Sensitive regions where foreign military concentration is notable
export interface GeoRegion {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
}

export interface OperatorHomeRegions {
  operator: MilitaryOperator;
  country: string;
  homeRegions: string[];
  alertThreshold: number;
}

export interface MilitaryTheater {
  id: string;
  name: string;
  baseIds: string[];
  centerLat: number;
  centerLon: number;
}

export interface SurgeAlert {
  id: string;
  theater: MilitaryTheater;
  type: 'airlift' | 'fighter' | 'reconnaissance';
  currentCount: number;
  baselineCount: number;
  surgeMultiple: number;
  aircraftTypes: Map<string, number>;
  nearbyBases: string[];
  firstDetected: Date;
  lastUpdated: Date;
}

export interface TheaterActivity {
  theaterId: string;
  timestamp: number;
  transportCount: number;
  fighterCount: number;
  reconCount: number;
  totalMilitary: number;
  flightIds: string[];
}

export interface ForeignPresenceAlert {
  id: string;
  operator: MilitaryOperator;
  operatorCountry: string;
  region: GeoRegion;
  aircraftCount: number;
  flights: MilitaryFlight[];
  firstDetected: Date;
}

export interface TheaterPostureSummary {
  theaterId: string;
  theaterName: string;
  shortName: string;
  targetNation: string | null;
  fighters: number;
  tankers: number;
  awacs: number;
  reconnaissance: number;
  transport: number;
  bombers: number;
  drones: number;
  totalAircraft: number;
  destroyers: number;
  frigates: number;
  carriers: number;
  submarines: number;
  patrol: number;
  auxiliaryVessels: number;
  totalVessels: number;
  byOperator: Record<string, number>;
  postureLevel: 'normal' | 'elevated' | 'critical';
  strikeCapable: boolean;
  trend: 'increasing' | 'stable' | 'decreasing';
  changePercent: number;
  summary: string;
  headline: string;
  centerLat: number;
  centerLon: number;
  bounds?: { north: number; south: number; east: number; west: number };
}

export const SENSITIVE_REGIONS: GeoRegion[] = [
  { id: 'persian-gulf', name: 'Persian Gulf', lat: 26.5, lon: 52.0, radiusKm: 600 },
  { id: 'strait-hormuz', name: 'Strait of Hormuz', lat: 26.5, lon: 56.5, radiusKm: 300 },
  { id: 'iran-border', name: 'Iran Border Region', lat: 33.0, lon: 47.0, radiusKm: 400 },
  { id: 'baltics', name: 'Baltic Region', lat: 56.0, lon: 24.0, radiusKm: 400 },
  { id: 'poland-border', name: 'Poland-Belarus Border', lat: 52.5, lon: 23.5, radiusKm: 300 },
  { id: 'black-sea', name: 'Black Sea', lat: 43.5, lon: 34.0, radiusKm: 500 },
  { id: 'kaliningrad', name: 'Kaliningrad Region', lat: 54.7, lon: 20.5, radiusKm: 250 },
  { id: 'taiwan-strait', name: 'Taiwan Strait', lat: 24.5, lon: 119.5, radiusKm: 400 },
  { id: 'south-china-sea', name: 'South China Sea', lat: 14.0, lon: 114.0, radiusKm: 800 },
  { id: 'korean-dmz', name: 'Korean DMZ', lat: 38.0, lon: 127.0, radiusKm: 300 },
  { id: 'japan-sea', name: 'Sea of Japan', lat: 40.0, lon: 135.0, radiusKm: 500 },
  { id: 'alaska-adiz', name: 'Alaska ADIZ', lat: 62.0, lon: -165.0, radiusKm: 600 },
  { id: 'arctic-russia', name: 'Arctic (Russian Side)', lat: 72.0, lon: 70.0, radiusKm: 800 },
  { id: 'east-med', name: 'Eastern Mediterranean', lat: 34.5, lon: 33.0, radiusKm: 500 },
  { id: 'libya-coast', name: 'Libya Coast', lat: 32.5, lon: 15.0, radiusKm: 400 },
  { id: 'horn-africa', name: 'Horn of Africa', lat: 10.0, lon: 45.0, radiusKm: 600 },
  { id: 'sahel', name: 'Sahel Region', lat: 15.0, lon: 5.0, radiusKm: 800 },
  { id: 'venezuela', name: 'Venezuela', lat: 8.0, lon: -66.0, radiusKm: 500 },
];

export const OPERATOR_HOMES: OperatorHomeRegions[] = [
  { operator: 'usaf', country: 'USA', homeRegions: ['alaska-adiz'], alertThreshold: 2 },
  { operator: 'usn', country: 'USA', homeRegions: ['alaska-adiz'], alertThreshold: 2 },
  { operator: 'usmc', country: 'USA', homeRegions: ['alaska-adiz'], alertThreshold: 2 },
  { operator: 'usa', country: 'USA', homeRegions: ['alaska-adiz'], alertThreshold: 2 },
  { operator: 'vks', country: 'Russia', homeRegions: ['kaliningrad', 'arctic-russia', 'black-sea'], alertThreshold: 2 },
  { operator: 'plaaf', country: 'China', homeRegions: ['taiwan-strait', 'south-china-sea'], alertThreshold: 2 },
  { operator: 'plan', country: 'China', homeRegions: ['taiwan-strait', 'south-china-sea'], alertThreshold: 2 },
  { operator: 'iaf', country: 'Israel', homeRegions: ['east-med', 'iran-border'], alertThreshold: 2 },
  { operator: 'raf', country: 'UK', homeRegions: ['baltics', 'black-sea'], alertThreshold: 3 },
  { operator: 'faf', country: 'France', homeRegions: ['sahel', 'east-med', 'libya-coast'], alertThreshold: 3 },
  { operator: 'gaf', country: 'Germany', homeRegions: ['baltics'], alertThreshold: 3 },
];

export const THEATERS: MilitaryTheater[] = [
  {
    id: 'middle-east',
    name: 'Middle East / Persian Gulf',
    baseIds: ['al_udeid', 'ali_al_salem_air_base', 'camp_arifjan', 'camp_buehring', 'kuwait_naval_base',
              'naval_support_activity_bahrain', 'isa_air_base', 'masirah_aira_base', 'rafo_thumrait',
              'al_dhafra_air_base', 'port_of_jebel_ali', 'fujairah_naval_base', 'prince_sultan_air_base',
              'ain_assad_air_base', 'camp_victory', 'naval_support_facility_diego_garcia'],
    centerLat: 27.0,
    centerLon: 50.0,
  },
  {
    id: 'europe-east',
    name: 'Eastern Europe',
    baseIds: ['camp_bondsteel', 'aitos_logistics_center', 'bezmer', 'graf_ignatievo'],
    centerLat: 45.0,
    centerLon: 25.0,
  },
  {
    id: 'europe-west',
    name: 'Western Europe',
    baseIds: ['ramstein', 'spangdahlem', 'usag_stuttgart', 'raf_lakenheath', 'raf_mildenhall', 'aviano'],
    centerLat: 50.0,
    centerLon: 8.0,
  },
  {
    id: 'pacific-west',
    name: 'Western Pacific',
    baseIds: ['kadena_air_base', 'camp_fuji', 'fleet_activities_okinawa', 'yokota', 'misawsa',
              'osan_air_base', 'kunsan_ab', 'us_army_garrison_humphreys', 'andersen_air_force_base'],
    centerLat: 30.0,
    centerLon: 130.0,
  },
  {
    id: 'africa-horn',
    name: 'Horn of Africa',
    baseIds: ['camp_lemonnier', 'contingency_location_garoua', 'niger_air_base_201'],
    centerLat: 10.0,
    centerLon: 40.0,
  },
];

export const SURGE_THRESHOLD = 2.0;
export const BASELINE_WINDOW_HOURS = 48;
export const BASELINE_MIN_SAMPLES = 6;
export const TRANSPORT_CALLSIGN_PATTERNS = [
  /^RCH/i, /^REACH/i, /^MOOSE/i, /^HERKY/i, /^EVAC/i, /^DUSTOFF/i,
];
export const PROXIMITY_RADIUS_KM = 150;
export const CLEANUP_INTERVAL = 60 * 60 * 1000;
export const MAX_HISTORY_HOURS = 72;

export const COUNTRY_TO_ISO: Record<string, string> = {
  'USA': 'US',
  'Russia': 'RU',
  'China': 'CN',
  'Israel': 'IL',
  'Iran': 'IR',
  'UK': 'GB',
  'France': 'FR',
  'Germany': 'DE',
  'Taiwan': 'TW',
  'Ukraine': 'UA',
  'Saudi Arabia': 'SA',
};

export const REGION_AFFECTED_COUNTRIES: Record<string, string[]> = {
  'persian-gulf': ['IR', 'SA'],
  'strait-hormuz': ['IR'],
  'iran-border': ['IR', 'IL'],
  'baltics': ['RU', 'UA'],
  'poland-border': ['RU', 'UA'],
  'black-sea': ['RU', 'UA'],
  'taiwan-strait': ['TW', 'CN'],
  'south-china-sea': ['CN', 'TW'],
  'east-med': ['IL', 'IR'],
  'alaska-adiz': ['RU'],
};

export const TARGET_NATION_CODES: Record<string, string> = {
  'Iran': 'IR',
  'Taiwan': 'TW',
  'North Korea': 'KP',
  'Gaza': 'PS',
  'Yemen': 'YE',
};

interface PostureTheater {
  id: string;
  name: string;
  shortName: string;
  targetNation: string | null;
  regions: string[];
  bounds: { north: number; south: number; east: number; west: number };
  thresholds: { elevated: number; critical: number };
  navalThresholds: { elevated: number; critical: number };
  strikeIndicators: { minTankers: number; minAwacs: number; minFighters: number };
}

export const POSTURE_THEATERS: PostureTheater[] = [
  {
    id: 'iran-theater',
    name: 'Iran Theater',
    shortName: 'IRAN',
    targetNation: 'Iran',
    regions: ['persian-gulf', 'strait-hormuz', 'iran-border'],
    bounds: { north: 42, south: 20, east: 65, west: 30 },
    thresholds: { elevated: 8, critical: 20 },
    navalThresholds: { elevated: 2, critical: 5 },
    strikeIndicators: { minTankers: 2, minAwacs: 1, minFighters: 5 },
  },
  {
    id: 'taiwan-theater',
    name: 'Taiwan Strait',
    shortName: 'TAIWAN',
    targetNation: 'Taiwan',
    regions: ['taiwan-strait', 'south-china-sea'],
    bounds: { north: 30, south: 18, east: 130, west: 115 },
    thresholds: { elevated: 6, critical: 15 },
    navalThresholds: { elevated: 4, critical: 10 },
    strikeIndicators: { minTankers: 1, minAwacs: 1, minFighters: 4 },
  },
  {
    id: 'baltic-theater',
    name: 'Baltic Theater',
    shortName: 'BALTIC',
    targetNation: null,
    regions: ['baltics', 'poland-border', 'kaliningrad'],
    bounds: { north: 65, south: 52, east: 32, west: 10 },
    thresholds: { elevated: 5, critical: 12 },
    navalThresholds: { elevated: 3, critical: 8 },
    strikeIndicators: { minTankers: 1, minAwacs: 1, minFighters: 3 },
  },
  {
    id: 'blacksea-theater',
    name: 'Black Sea',
    shortName: 'BLACK SEA',
    targetNation: null,
    regions: ['black-sea'],
    bounds: { north: 48, south: 40, east: 42, west: 26 },
    thresholds: { elevated: 4, critical: 10 },
    navalThresholds: { elevated: 3, critical: 6 },
    strikeIndicators: { minTankers: 1, minAwacs: 1, minFighters: 3 },
  },
  {
    id: 'korea-theater',
    name: 'Korean Peninsula',
    shortName: 'KOREA',
    targetNation: 'North Korea',
    regions: ['korean-dmz', 'sea-of-japan'],
    bounds: { north: 43, south: 33, east: 132, west: 124 },
    thresholds: { elevated: 5, critical: 12 },
    navalThresholds: { elevated: 3, critical: 8 },
    strikeIndicators: { minTankers: 1, minAwacs: 1, minFighters: 3 },
  },
  {
    id: 'south-china-sea',
    name: 'South China Sea',
    shortName: 'SCS',
    targetNation: null,
    regions: ['south-china-sea', 'spratly-islands'],
    bounds: { north: 25, south: 5, east: 121, west: 105 },
    thresholds: { elevated: 6, critical: 15 },
    navalThresholds: { elevated: 4, critical: 10 },
    strikeIndicators: { minTankers: 1, minAwacs: 1, minFighters: 4 },
  },
  {
    id: 'east-med-theater',
    name: 'Eastern Mediterranean',
    shortName: 'E.MED',
    targetNation: null,
    regions: ['eastern-med', 'levant'],
    bounds: { north: 37, south: 33, east: 37, west: 25 },
    thresholds: { elevated: 4, critical: 10 },
    navalThresholds: { elevated: 3, critical: 6 },
    strikeIndicators: { minTankers: 1, minAwacs: 1, minFighters: 3 },
  },
  {
    id: 'israel-gaza-theater',
    name: 'Israel/Gaza',
    shortName: 'GAZA',
    targetNation: 'Gaza',
    regions: ['israel', 'gaza', 'west-bank'],
    bounds: { north: 33, south: 29, east: 36, west: 33 },
    thresholds: { elevated: 3, critical: 8 },
    navalThresholds: { elevated: 2, critical: 5 },
    strikeIndicators: { minTankers: 1, minAwacs: 1, minFighters: 3 },
  },
  {
    id: 'yemen-redsea-theater',
    name: 'Yemen/Red Sea',
    shortName: 'RED SEA',
    targetNation: 'Yemen',
    regions: ['yemen', 'red-sea', 'bab-el-mandeb'],
    bounds: { north: 22, south: 11, east: 54, west: 32 },
    thresholds: { elevated: 4, critical: 10 },
    navalThresholds: { elevated: 3, critical: 8 },
    strikeIndicators: { minTankers: 1, minAwacs: 1, minFighters: 3 },
  },
];
