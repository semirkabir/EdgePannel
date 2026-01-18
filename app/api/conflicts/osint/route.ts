import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
    ConflictRegion,
    ConflictZone,
    ConflictAsset,
    ConflictEvent,
    OSINTResponse,
    AlertLevel,
    ControlZone,
    NuclearFacility,
    NavalGroup,
    FrontLine,
    ZoneOverlay,
    BattleLocation
} from '@/types/conflicts';

export const dynamic = 'force-dynamic';

/**
 * Conflict zone base configurations with enhanced metadata
 */
const CONFLICT_CONFIGS: Record<ConflictRegion, Omit<ConflictZone, 'assets' | 'recentEvents' | 'lastUpdated'>> = {
    ukraine: {
        id: 'ukraine',
        name: 'Ukraine-Russia War',
        status: 'active',
        description: 'Ongoing military conflict since February 2022. Russian forces occupy Crimea and parts of eastern oblasts.',
        centerLat: 48.3794,
        centerLng: 31.1656,
        zoomLevel: 5,
        alertLevel: 'critical',
    },
    iran: {
        id: 'iran',
        name: 'Iran Nuclear & Political Crisis',
        status: 'escalating',
        description: 'Nuclear program at 60% enrichment. Ongoing protests and regional tensions.',
        centerLat: 32.4279,
        centerLng: 53.688,
        zoomLevel: 5,
        alertLevel: 'elevated',
    },
    venezuela: {
        id: 'venezuela',
        name: 'Venezuela Crisis',
        status: 'active',
        description: 'Political instability with US counter-narcotics naval presence in Caribbean.',
        centerLat: 10.5,
        centerLng: -66.5,
        zoomLevel: 5,
        alertLevel: 'guarded',
    },
    taiwan: {
        id: 'taiwan',
        name: 'Taiwan Strait Tensions',
        status: 'escalating',
        description: 'PLA military exercises, naval encirclement drills, and frequent ADIZ incursions.',
        centerLat: 23.6978,
        centerLng: 120.9605,
        zoomLevel: 6,
        alertLevel: 'elevated',
    },
    israel: {
        id: 'israel',
        name: 'Israel-Gaza Conflict',
        status: 'active',
        description: 'Active military operations in Gaza. Lebanon border exchanges with Hezbollah.',
        centerLat: 31.5,
        centerLng: 34.8,
        zoomLevel: 7,
        alertLevel: 'critical',
    },
};

/**
 * Load region-specific data from JSON files
 */
async function loadRegionData(region: ConflictRegion): Promise<any> {
    const dataPath = path.join(process.cwd(), 'public', 'data', 'conflicts', `${region}-data.json`);

    try {
        const fileContent = await fs.readFile(dataPath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.warn(`[OSINT] No data file found for ${region}, using fallback`);
        return null;
    }
}

/**
 * Transform raw data into ConflictAssets with current timestamp
 */
function processAssets(rawAssets: any[], region: ConflictRegion): ConflictAsset[] {
    const now = new Date().toISOString();

    if (!rawAssets) return [];

    return rawAssets.map((asset: any) => ({
        ...asset,
        lastUpdated: asset.lastUpdated || now,
        source: asset.source || 'Intel Database',
    }));
}

/**
 * Extract all vessels from naval groups as individual assets
 */
function extractNavalAssets(navalGroups: NavalGroup[]): ConflictAsset[] {
    const now = new Date().toISOString();

    if (!navalGroups) return [];

    return navalGroups.flatMap(group =>
        group.vessels.map(vessel => ({
            ...vessel,
            lastUpdated: now,
            source: `${group.name} - ${group.nationality}`,
        }))
    );
}

/**
 * Convert nuclear facilities to assets for map display
 */
function nuclearFacilitiesToAssets(facilities: NuclearFacility[]): ConflictAsset[] {
    const now = new Date().toISOString();

    if (!facilities) return [];

    return facilities.map(facility => ({
        id: facility.id,
        type: 'nuclear' as const,
        label: `${facility.name} (${facility.status})`,
        lat: facility.lat,
        lng: facility.lng,
        lastUpdated: now,
        confidence: facility.iaeaAccess ? 'high' : 'low',
        source: 'IAEA / Intel',
    }));
}

/**
 * Convert battle locations to conflict events
 */
function battleLocationsToEvents(battles: BattleLocation[]): ConflictEvent[] {
    if (!battles) return [];

    return battles.map(battle => ({
        id: battle.id,
        title: battle.name,
        description: `${battle.type} - ${battle.intensity} intensity`,
        type: 'military' as const,
        lat: battle.lat,
        lng: battle.lng,
        timestamp: battle.lastReported,
        source: battle.source,
        severity: battle.intensity === 'heavy' ? 'critical' : battle.intensity === 'moderate' ? 'high' : 'medium',
    }));
}

/**
 * Fetch OSINT events from GDELT for a specific region
 */
async function fetchGDELTEvents(region: ConflictRegion, baseUrl: string): Promise<ConflictEvent[]> {
    const queryTerms: Record<ConflictRegion, string> = {
        ukraine: 'Ukraine war OR Kyiv OR Kharkiv military OR Donetsk',
        iran: 'Iran nuclear OR Tehran IRGC OR Iran protests',
        venezuela: 'Venezuela military OR Maduro OR Caribbean naval',
        taiwan: 'Taiwan China military OR PLA Navy OR Taiwan Strait OR ADIZ',
        israel: 'Israel Gaza OR IDF OR Hamas OR Hezbollah Lebanon',
    };

    try {
        const response = await fetch(
            `${baseUrl}/api/gdelt/news?country=${encodeURIComponent(queryTerms[region])}`,
            { next: { revalidate: 300 } } // Cache for 5 minutes
        );

        if (!response.ok) {
            console.warn(`[OSINT] GDELT fetch failed for ${region}:`, response.status);
            return [];
        }

        const data = await response.json();
        const articles = data.articles || [];

        // Transform GDELT articles to ConflictEvents
        const config = CONFLICT_CONFIGS[region];

        return articles.slice(0, 10).map((article: any, idx: number) => ({
            id: `gdelt-${region}-${idx}-${Date.now()}`,
            title: article.title || 'Unknown Event',
            description: article.domain,
            type: 'military' as const,
            lat: config.centerLat + (Math.random() - 0.5) * 2,
            lng: config.centerLng + (Math.random() - 0.5) * 2,
            timestamp: article.seendate || new Date().toISOString(),
            source: article.domain || 'GDELT',
            sourceUrl: article.url,
            severity: 'medium' as const,
        }));
    } catch (error) {
        console.warn(`[OSINT] Error fetching GDELT for ${region}:`, error);
        return [];
    }
}

/**
 * GET /api/conflicts/osint
 * Returns enriched OSINT data for a specific conflict region
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const region = searchParams.get('region') as ConflictRegion;
        const zoomLevel = parseFloat(searchParams.get('zoom') || '5');

        const validRegions: ConflictRegion[] = ['ukraine', 'iran', 'venezuela', 'taiwan', 'israel'];

        if (!region || !validRegions.includes(region)) {
            return NextResponse.json(
                { error: 'Invalid region. Valid options: ukraine, iran, venezuela, taiwan, israel' },
                { status: 400 }
            );
        }

        const baseUrl = request.nextUrl.origin;
        const config = CONFLICT_CONFIGS[region];

        // Load region-specific data and GDELT events in parallel
        const [regionData, gdeltEvents] = await Promise.all([
            loadRegionData(region),
            fetchGDELTEvents(region, baseUrl),
        ]);

        // Process assets based on region type
        let assets: ConflictAsset[] = [];
        let controlZones: ControlZone[] | undefined;
        let nuclearFacilities: NuclearFacility[] | undefined;
        let navalGroups: NavalGroup[] | undefined;
        let frontLines: FrontLine[] | undefined;
        let zones: ZoneOverlay[] | undefined;
        let battleLocations: BattleLocation[] | undefined;
        let alertLevel: AlertLevel | undefined = config.alertLevel;

        if (regionData) {
            // Base assets from data file
            assets = processAssets(regionData.assets || [], region);

            // Region-specific data handling
            switch (region) {
                case 'ukraine':
                    controlZones = regionData.controlZones;
                    frontLines = regionData.frontLines;
                    battleLocations = regionData.battleLocations;
                    break;

                case 'iran':
                    nuclearFacilities = regionData.nuclearFacilities;
                    zones = regionData.zones;
                    // Add nuclear facilities as assets for map display
                    assets = [...assets, ...nuclearFacilitiesToAssets(regionData.nuclearFacilities || [])];
                    break;

                case 'taiwan':
                    navalGroups = regionData.navalGroups;
                    zones = regionData.zones;
                    alertLevel = regionData.alertLevel || alertLevel;
                    // Extract naval assets from groups
                    assets = [...assets, ...extractNavalAssets(regionData.navalGroups || [])];
                    break;

                case 'venezuela':
                    navalGroups = regionData.navalGroups;
                    zones = regionData.zones;
                    alertLevel = regionData.alertLevel || alertLevel;
                    // Extract naval assets from groups
                    assets = [...assets, ...extractNavalAssets(regionData.navalGroups || [])];
                    break;

                case 'israel':
                    controlZones = regionData.controlZones;
                    navalGroups = regionData.navalGroups;
                    zones = regionData.zones;
                    battleLocations = regionData.battleLocations;
                    alertLevel = regionData.alertLevel || alertLevel;
                    // Extract naval assets
                    assets = [...assets, ...extractNavalAssets(regionData.navalGroups || [])];
                    break;
            }
        }

        // Combine battle location events with GDELT events
        const battleEvents = battleLocationsToEvents(battleLocations || []);
        const recentEvents = [...battleEvents, ...gdeltEvents];

        // Build the zone response
        const zone: ConflictZone = {
            ...config,
            assets,
            recentEvents,
            lastUpdated: new Date().toISOString(),
            alertLevel,
            controlZones,
            nuclearFacilities,
            navalGroups,
            frontLines,
            zones,
            battleLocations,
        };

        // Collect all sources used
        const sources: string[] = ['Static Intel Database'];
        if (gdeltEvents.length > 0) sources.push('GDELT');
        if (nuclearFacilities) sources.push('IAEA Reports');
        if (navalGroups) sources.push('Naval Tracking');
        if (battleLocations) sources.push('ISW / DeepState');

        const response: OSINTResponse = {
            region,
            zone,
            fetchedAt: new Date().toISOString(),
            sources,
        };

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('[OSINT API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch OSINT data' },
            { status: 500 }
        );
    }
}
