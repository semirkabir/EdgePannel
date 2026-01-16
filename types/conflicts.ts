/**
 * Global Conflicts Data Types
 * Defines structures for conflict zones, military assets, and OSINT events
 */

export type ConflictRegion = 'ukraine' | 'iran' | 'venezuela' | 'taiwan';

export type ConflictStatus = 'active' | 'escalating' | 'de-escalating' | 'stable';

export type AssetType =
    | 'warship'
    | 'aircraft'
    | 'troops'
    | 'missile'
    | 'protest'
    | 'strike'
    | 'explosion'
    | 'checkpoint'
    | 'naval_zone';

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
}

export interface ConflictEvent {
    id: string;
    title: string;
    description?: string;
    type: 'military' | 'protest' | 'political' | 'humanitarian' | 'cyber';
    lat: number;
    lng: number;
    timestamp: string;
    source: string;
    sourceUrl?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
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
}

export interface FrontLine {
    id: string;
    points: Array<{ lat: number; lng: number }>;
    type: 'contested' | 'controlled' | 'disputed';
    controlledBy?: string;
}

export interface ZoneOverlay {
    id: string;
    type: 'naval_exclusion' | 'no_fly' | 'protest_area' | 'danger';
    polygon: Array<{ lat: number; lng: number }>;
    label?: string;
    opacity?: number;
}

export interface OSINTResponse {
    region: ConflictRegion;
    zone: ConflictZone;
    fetchedAt: string;
    sources: string[];
}
