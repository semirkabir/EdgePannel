import { GeoJSON } from 'geojson';

const GDELT_API_BASE = 'https://api.gdeltproject.org/api/v2/geo/geo';

export type GDELTFeedType = 'CONFLICT' | 'TECH_AI' | 'GEOPOLITICS' | 'DISASTER' | 'GENERAL';

const FEED_QUERIES: Record<GDELTFeedType, string> = {
    CONFLICT: 'theme:TERROR OR theme:MILITARY OR theme:ASSASSINATION OR theme:ARMEDCONFLICT',
    TECH_AI: 'theme:ARTIFICIAL_INTELLIGENCE OR theme:QUANTUM_COMPUTING OR theme:CYBER_ATTACK',
    GEOPOLITICS: 'theme:UNITED_NATIONS OR theme:NATO OR theme:DIPLOMACY OR theme:ELECTION',
    DISASTER: 'theme:NATURAL_DISASTER OR theme:EPIDEMIC',
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

        // Normalize properties
        const features = (data.features || []).map((f: any) => ({
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
