export async function fetchFREDData(): Promise<GeoJSON.FeatureCollection> {
    const indicators = [
        { id: 'GDP', lat: 38.9, lng: -77.0, title: 'US GDP' },
        { id: 'UNRATE', lat: 41.8, lng: -87.6, title: 'US Unemployment' },
        { id: 'CPIAUCSL', lat: 40.7, lng: -74.0, title: 'US CPI (Inflation)' },
        { id: 'FEDFUNDS', lat: 38.8, lng: -77.1, title: 'Fed Funds Rate' }
    ];

    const apiKey = process.env.FRED_API_KEY;

    if (!apiKey) {
        return { type: 'FeatureCollection', features: [] };
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
        console.error('FRED API Error:', e);
        return { type: 'FeatureCollection', features: [] };
    }
}
