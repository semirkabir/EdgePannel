import { GeoJSON } from 'geojson';

const GDELT_API_BASE = 'https://api.gdeltproject.org/api/v2/geo/geo';

export type GDELTFeedType = 'CONFLICT' | 'TECH_AI' | 'GEOPOLITICS' | 'DISASTER' | 'GENERAL';

const FEED_QUERIES: Record<GDELTFeedType, string> = {
    CONFLICT: '(Venezuela OR Iran OR Israel OR Gaza OR Taiwan OR Ukraine OR Russia) AND (war OR conflict OR military OR weapon)',
    TECH_AI: '(artificial intelligence OR AI OR cyber OR quantum OR tech)',
    GEOPOLITICS: '(election OR diplomacy OR united nations OR NATO OR geopolitical)',
    DISASTER: '(disaster OR earthquake OR flood OR epidemic OR hurricane)',
    GENERAL: '' // Defaults to top news if empty
};

export async function fetchGdeltFeed(feedType: GDELTFeedType = 'GENERAL'): Promise<GeoJSON.FeatureCollection> {
    const query = FEED_QUERIES[feedType];
    const params = new URLSearchParams({
        query: query,
        format: 'geojson',
        timespan: '24h', // Last 24 hours
        limit: '100'     // Limit to top 100 events
    });

    try {
        const response = await fetch(`${GDELT_API_BASE}?${params.toString()}`);
        if (!response.ok) {
            console.error(`GDELT API error: ${response.status} ${response.statusText}`);
            return { type: 'FeatureCollection', features: [] };
        }
        const data = await response.json();

        // Normalize properties and filter by region
        const features = (data.features || [])
            .filter((f: any) => {
                if (!f.geometry || !f.geometry.coordinates) return false;
                const [lng, lat] = f.geometry.coordinates;
                return isInTargetRegion(lat, lng);
            })
            .map((f: any) => ({
                ...f,
                properties: {
                    ...f.properties,
                    feedType,
                    source: 'GDELT',
                    title: f.properties.name || f.properties.html || 'News Event',
                    url: f.properties.url || f.properties.sourceurl
                }
            }));

        return { type: 'FeatureCollection', features };
    } catch (error) {
        console.error('Failed to fetch GDELT feed:', error);
        return { type: 'FeatureCollection', features: [] };
    }
}

function isInTargetRegion(lat: number, lng: number): boolean {
    // 1. Venezuela: Lat 0 to 13, Lng -74 to -59
    if (lat >= 0 && lat <= 13 && lng >= -74 && lng <= -59) return true;

    // 2. Middle East (Iran, Israel, Gaza, etc): Lat 12 to 42, Lng 25 to 65
    if (lat >= 12 && lat <= 42 && lng >= 25 && lng <= 65) return true;

    // 3. Taiwan/China Coast: Lat 20 to 30, Lng 115 to 125
    if (lat >= 20 && lat <= 30 && lng >= 115 && lng <= 125) return true;

    // 4. Ukraine/Russia (Broad Box): Lat 44 to 75, Lng 20 to 180
    if (lat >= 44 && lat <= 75 && lng >= 20 && lng <= 180) return true;

    return false;
}
