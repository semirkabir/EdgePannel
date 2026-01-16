import { NextRequest, NextResponse } from 'next/server';
import {
    ConflictRegion,
    ConflictZone,
    ConflictAsset,
    ConflictEvent,
    OSINTResponse
} from '@/types/conflicts';

export const dynamic = 'force-dynamic';

/**
 * Conflict zone base configurations
 */
const CONFLICT_CONFIGS: Record<ConflictRegion, Omit<ConflictZone, 'assets' | 'recentEvents' | 'lastUpdated'>> = {
    ukraine: {
        id: 'ukraine',
        name: 'Ukraine-Russia War',
        status: 'active',
        description: 'Ongoing military conflict since February 2022',
        centerLat: 48.3794,
        centerLng: 31.1656,
        zoomLevel: 5,
        frontLines: [
            {
                id: 'eastern-front',
                points: [
                    { lat: 49.0, lng: 38.5 },
                    { lat: 48.5, lng: 38.0 },
                    { lat: 48.0, lng: 37.5 },
                    { lat: 47.5, lng: 37.0 },
                    { lat: 47.0, lng: 36.5 },
                ],
                type: 'contested',
            },
        ],
    },
    iran: {
        id: 'iran',
        name: 'Iran Political Crisis',
        status: 'escalating',
        description: 'Ongoing protests and government instability',
        centerLat: 32.4279,
        centerLng: 53.688,
        zoomLevel: 5,
    },
    venezuela: {
        id: 'venezuela',
        name: 'Venezuela Crisis',
        status: 'active',
        description: 'Political instability and military presence',
        centerLat: 6.4238,
        centerLng: -66.5897,
        zoomLevel: 5,
        zones: [
            {
                id: 'caribbean-naval',
                type: 'naval_exclusion',
                polygon: [
                    { lat: 12.5, lng: -70.0 },
                    { lat: 12.5, lng: -62.0 },
                    { lat: 10.5, lng: -62.0 },
                    { lat: 10.5, lng: -70.0 },
                ],
                label: 'Naval Activity Zone',
                opacity: 0.3,
            },
        ],
    },
    taiwan: {
        id: 'taiwan',
        name: 'Taiwan Strait Tensions',
        status: 'active',
        description: 'PLA military exercises and ADIZ incursions',
        centerLat: 23.6978,
        centerLng: 120.9605,
        zoomLevel: 6,
        zones: [
            {
                id: 'taiwan-strait',
                type: 'naval_exclusion',
                polygon: [
                    { lat: 25.5, lng: 119.0 },
                    { lat: 25.5, lng: 122.0 },
                    { lat: 22.0, lng: 122.0 },
                    { lat: 22.0, lng: 119.0 },
                ],
                label: 'Taiwan Strait',
                opacity: 0.2,
            },
        ],
    },
};

/**
 * Static asset positions (updated based on known deployments)
 */
function getStaticAssets(region: ConflictRegion): ConflictAsset[] {
    const now = new Date().toISOString();

    switch (region) {
        case 'ukraine':
            return [
                { id: 'ua-1', type: 'explosion', lat: 48.45, lng: 37.8, label: 'Recent Strike Zone', lastUpdated: now, confidence: 'high' },
                { id: 'ua-2', type: 'checkpoint', lat: 50.45, lng: 30.52, label: 'Kyiv', lastUpdated: now, confidence: 'high' },
                { id: 'ua-3', type: 'explosion', lat: 49.98, lng: 36.25, label: 'Kharkiv Region', lastUpdated: now, confidence: 'medium' },
                { id: 'ua-4', type: 'troops', lat: 48.02, lng: 37.8, label: 'Donetsk Front', lastUpdated: now, confidence: 'medium' },
            ];

        case 'iran':
            return [
                { id: 'ir-1', type: 'protest', lat: 35.6892, lng: 51.389, label: 'Tehran', lastUpdated: now, confidence: 'high' },
                { id: 'ir-2', type: 'protest', lat: 32.6546, lng: 51.668, label: 'Isfahan', lastUpdated: now, confidence: 'medium' },
                { id: 'ir-3', type: 'protest', lat: 29.5918, lng: 52.5836, label: 'Shiraz', lastUpdated: now, confidence: 'medium' },
                { id: 'ir-4', type: 'checkpoint', lat: 35.75, lng: 51.41, label: 'Government District', lastUpdated: now, confidence: 'high' },
            ];

        case 'venezuela':
            return [
                { id: 've-1', type: 'warship', lat: 11.8, lng: -66.5, heading: 270, label: 'Naval Patrol', lastUpdated: now, confidence: 'medium' },
                { id: 've-2', type: 'warship', lat: 11.5, lng: -65.0, heading: 180, label: 'Coast Guard', lastUpdated: now, confidence: 'medium' },
                { id: 've-3', type: 'troops', lat: 10.48, lng: -66.9, label: 'Caracas Military', lastUpdated: now, confidence: 'high' },
                { id: 've-4', type: 'checkpoint', lat: 7.77, lng: -72.22, label: 'Colombia Border', lastUpdated: now, confidence: 'high' },
            ];

        case 'taiwan':
            return [
                { id: 'tw-1', type: 'warship', lat: 24.5, lng: 119.5, heading: 90, label: 'PLA Navy Frigate', lastUpdated: now, confidence: 'high' },
                { id: 'tw-2', type: 'warship', lat: 23.8, lng: 120.2, heading: 45, label: 'PLA Navy Destroyer', lastUpdated: now, confidence: 'high' },
                { id: 'tw-3', type: 'warship', lat: 23.0, lng: 121.5, heading: 315, label: 'PLA Navy Patrol', lastUpdated: now, confidence: 'medium' },
                { id: 'tw-4', type: 'aircraft', lat: 24.2, lng: 120.8, heading: 180, label: 'ADIZ Incursion', lastUpdated: now, confidence: 'high' },
                { id: 'tw-5', type: 'missile', lat: 24.8, lng: 118.5, label: 'Fujian Launchers', lastUpdated: now, confidence: 'medium' },
            ];

        default:
            return [];
    }
}

/**
 * Fetch OSINT events from GDELT for a specific region
 */
async function fetchGDELTEvents(region: ConflictRegion, baseUrl: string): Promise<ConflictEvent[]> {
    const queryTerms: Record<ConflictRegion, string> = {
        ukraine: 'Ukraine war OR Kyiv OR Kharkiv military',
        iran: 'Iran protests OR Tehran unrest OR IRGC',
        venezuela: 'Venezuela military OR Maduro OR Caracas',
        taiwan: 'Taiwan China military OR PLA Navy OR Taiwan Strait',
    };

    try {
        const response = await fetch(
            `${baseUrl}/api/gdelt/news?country=${encodeURIComponent(queryTerms[region])}`,
            { next: { revalidate: 300 } } // Cache for 5 minutes
        );

        if (!response.ok) {
            console.error(`[OSINT] GDELT fetch failed for ${region}:`, response.status);
            return [];
        }

        const data = await response.json();
        const articles = data.articles || [];

        // Transform GDELT articles to ConflictEvents
        // Note: GDELT doesn't provide lat/lng, so we use region center
        const config = CONFLICT_CONFIGS[region];

        return articles.slice(0, 10).map((article: any, idx: number) => ({
            id: `gdelt-${region}-${idx}-${Date.now()}`,
            title: article.title || 'Unknown Event',
            description: article.domain,
            type: 'military' as const,
            lat: config.centerLat + (Math.random() - 0.5) * 2, // Spread around center
            lng: config.centerLng + (Math.random() - 0.5) * 2,
            timestamp: article.seendate || new Date().toISOString(),
            source: article.domain || 'GDELT',
            sourceUrl: article.url,
            severity: 'medium' as const,
        }));
    } catch (error) {
        console.error(`[OSINT] Error fetching GDELT for ${region}:`, error);
        return [];
    }
}

/**
 * GET /api/conflicts/osint
 * Returns OSINT data for a specific conflict region
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const region = searchParams.get('region') as ConflictRegion;

        if (!region || !CONFLICT_CONFIGS[region]) {
            return NextResponse.json(
                { error: 'Invalid region. Valid options: ukraine, iran, venezuela, taiwan' },
                { status: 400 }
            );
        }

        const baseUrl = request.nextUrl.origin;
        const config = CONFLICT_CONFIGS[region];

        // Fetch data in parallel
        const [assets, events] = await Promise.all([
            Promise.resolve(getStaticAssets(region)),
            fetchGDELTEvents(region, baseUrl),
        ]);

        const zone: ConflictZone = {
            ...config,
            assets,
            recentEvents: events,
            lastUpdated: new Date().toISOString(),
        };

        const response: OSINTResponse = {
            region,
            zone,
            fetchedAt: new Date().toISOString(),
            sources: ['GDELT', 'Static Intel'],
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
