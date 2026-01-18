/**
 * Global Conflicts Data Types
 * Defines structures for conflict zones, military assets, and OSINT events
 */

export type ConflictRegion = 'ukraine' | 'iran' | 'venezuela' | 'taiwan' | 'israel';

export type ConflictStatus = 'active' | 'escalating' | 'de-escalating' | 'stable';

// Alert/threat levels for regions (DEFCON-style)
export type AlertLevel = 'defcon1' | 'critical' | 'elevated' | 'guarded' | 'low';

export type AssetType =
    | 'warship'
    | 'aircraft'
    | 'carrier'
    | 'submarine'
    | 'destroyer'
    | 'frigate'
    | 'patrol_boat'
    | 'troops'
    | 'missile'
    | 'missile_launcher'
    | 'radar'
    | 'sam_site'
    | 'protest'
    | 'strike'
    | 'explosion'
    | 'checkpoint'
    | 'naval_zone'
    | 'nuclear'
    | 'base'
    | 'airbase'
    | 'drone';

export interface ConflictAsset {
    id: string;
    type: AssetType;
    label?: string;
    lat: number;
    lng: number;
    heading?: number; // Direction in degrees (for ships/aircraft)
    lastUpdated: string;
    source?: string;
    confidence: 'high' | 'medium' | 'low';
    nationality?: string; // e.g., 'US', 'CN', 'RU'
    class?: string; // e.g., 'Arleigh Burke', 'Type 055'
}

export interface ConflictEvent {
    id: string;
    title: string;
    description?: string;
    type: 'military' | 'protest' | 'political' | 'humanitarian' | 'cyber' | 'nuclear' | 'naval';
    lat: number;
    lng: number;
    timestamp: string;
    source: string;
    sourceUrl?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
}

// Nuclear facility tracking (primarily Iran)
export interface NuclearFacility {
    id: string;
    name: string;
    type: 'enrichment' | 'research' | 'reactor' | 'storage' | 'conversion';
    lat: number;
    lng: number;
    status: 'active' | 'suspended' | 'construction' | 'destroyed' | 'unknown';
    enrichmentLevel?: string; // e.g., "60%", "20%", "3.67%"
    lastInspected?: string;
    iaeaAccess?: boolean;
    centrifuges?: number;
}

// Territorial control zones (primarily Ukraine/Russia)
export interface ControlZone {
    id: string;
    name: string;
    controlledBy: 'russia' | 'ukraine' | 'contested' | 'israel' | 'hamas' | 'hezbollah';
    polygon: Array<{ lat: number; lng: number }>;
    since?: string;
    confidence: 'high' | 'medium' | 'low';
    population?: number;
}

// Naval fleet/group tracking (Taiwan Strait, Venezuela, Middle East)
export interface NavalGroup {
    id: string;
    name: string;
    nationality: string;
    vessels: ConflictAsset[];
    formation: 'patrol' | 'blockade' | 'exercise' | 'transit' | 'carrier_strike_group' | 'amphibious_ready_group';
    centerLat: number;
    centerLng: number;
    heading?: number;
    estimatedStrength?: string;
}

// Battle/engagement location (Ukraine frontlines)
export interface BattleLocation {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'offensive' | 'defensive' | 'siege' | 'shelling' | 'air_strike';
    intensity: 'heavy' | 'moderate' | 'light';
    lastReported: string;
    source: string;
}

export interface ConflictZone {
    id: ConflictRegion;
    name: string;
    status: ConflictStatus;
    description: string;
    centerLat: number;
    centerLng: number;
    zoomLevel: number;
    lastUpdated: string;
    assets: ConflictAsset[];
    recentEvents: ConflictEvent[];
    frontLines?: FrontLine[];
    zones?: ZoneOverlay[];
    // New enhanced fields
    alertLevel?: AlertLevel;
    controlZones?: ControlZone[];
    nuclearFacilities?: NuclearFacility[];
    navalGroups?: NavalGroup[];
    battleLocations?: BattleLocation[];
}

export interface FrontLine {
    id: string;
    name?: string;
    points: Array<{ lat: number; lng: number }>;
    type: 'contested' | 'controlled' | 'disputed';
    controlledBy?: string;
    lastUpdated?: string;
}

export interface ZoneOverlay {
    id: string;
    type: 'naval_exclusion' | 'no_fly' | 'protest_area' | 'danger' | 'adiz' | 'blockade';
    polygon: Array<{ lat: number; lng: number }>;
    label?: string;
    opacity?: number;
    color?: string;
}

export interface OSINTResponse {
    region: ConflictRegion;
    zone: ConflictZone;
    fetchedAt: string;
    sources: string[];
}
