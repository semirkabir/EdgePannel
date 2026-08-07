function getMockFREDFeatures(indicators: any[]): GeoJSON.FeatureCollection {
    const values: Record<string, number> = {
        'GDP': 27360.5,    // Billions of USD
        'UNRATE': 3.9,      // Percentage
        'CPIAUCSL': 312.2,  // Index value
        'FEDFUNDS': 5.33    // Percentage
    };

    const changes: Record<string, string> = {
        'GDP': '+3.4% (QoQ)',
        'UNRATE': '+0.1%',
        'CPIAUCSL': '+0.3% (MoM)',
        'FEDFUNDS': '0.00% (Hold)'
    };

    const features = indicators.map(ind => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [ind.lng, ind.lat] },
        properties: {
            type: 'FINANCE',
            subtype: 'MACRO',
            symbol: ind.id,
            title: ind.title,
            price: values[ind.id] || 0,
            change: changes[ind.id] || 'N/A',
            source: 'Mock (FRED Fallback)'
        }
    }));

    return {
        type: 'FeatureCollection' as const,
        features
    };
}

export async function fetchFREDData(): Promise<GeoJSON.FeatureCollection> {
    const indicators = [
        { id: 'GDP', lat: 38.9, lng: -77.0, title: 'US GDP' },
        { id: 'UNRATE', lat: 41.8, lng: -87.6, title: 'US Unemployment' },
        { id: 'CPIAUCSL', lat: 40.7, lng: -74.0, title: 'US CPI (Inflation)' },
        { id: 'FEDFUNDS', lat: 38.8, lng: -77.1, title: 'Fed Funds Rate' }
    ];

    const apiKey = process.env.FRED_API_KEY;

    if (!apiKey) {
        console.warn('FRED_API_KEY is not set, returning realistic mock economic features.');
        return getMockFREDFeatures(indicators);
    }

    try {
        const features = await Promise.all(indicators.map(async (ind) => {
            // FRED API: https://api.stlouisfed.org/fred/series/observations
            const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${ind.id}&api_key=${apiKey}&file_type=json&limit=1&sort_order=desc`;

            const res = await fetch(url);
            if (!res.ok) return null;

            const data = await res.json();
            const value = data.observations?.[0]?.value;

            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [ind.lng, ind.lat] },
                properties: {
                    type: 'FINANCE', // Reusing finance tag for map styling
                    subtype: 'MACRO',
                    symbol: ind.id,
                    title: ind.title,
                    price: value, // Reuse price field for value display
                    change: 'N/A', // Macros usually updated monthly
                    source: 'FRED'
                }
            };
        }));

        return {
            type: 'FeatureCollection',
            features: features.filter(f => f !== null) as any[]
        };
    } catch (e) {
        console.error('FRED API Error, falling back to mock observations:', e);
        return getMockFREDFeatures(indicators);
    }
}
