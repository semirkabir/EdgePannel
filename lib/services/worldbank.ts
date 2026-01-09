// World Bank Data Service
// API: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-api-documentation

export async function fetchWorldBankData(): Promise<GeoJSON.FeatureCollection> {
    // Indicators: GDP Growth (NY.GDP.MKTP.KD.ZG), Inflation (FP.CPI.TOTL.ZG)
    // We will fetch data for major economies to keep it lightweight: US, CN, JP, DE, IN, GB, FR, BR
    const countries = ['US', 'CN', 'JP', 'DE', 'IN', 'GB', 'FR', 'BR'];
    const countryCoords: Record<string, [number, number]> = {
        'US': [-95.7, 37.1], 'CN': [104.2, 35.9], 'JP': [138.3, 36.2],
        'DE': [10.4, 51.2], 'IN': [78.9, 20.6], 'GB': [-3.4, 55.4],
        'FR': [2.2, 46.2], 'BR': [-51.9, -14.2]
    };

    try {
        const promises = countries.map(async (code) => {
            // Fetch GDP Growth (most recent)
            const url = `http://api.worldbank.org/v2/country/${code}/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&mrnev=1`;
            const res = await fetch(url);
            if (!res.ok) return null;

            const data = await res.json();
            // WB API returns [metadata, [data_objects]]
            const indicator = data[1]?.[0];

            if (!indicator) return null;

            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: countryCoords[code] },
                properties: {
                    type: 'FINANCE',
                    subtype: 'DEVELOPMENT',
                    symbol: `WB:${code}`,
                    title: `GDP Growth: ${indicator.country.value}`,
                    price: indicator.value?.toFixed(2) + '%',
                    change: 'Annual',
                    source: 'World Bank'
                }
            };
        });

        const features = await Promise.all(promises);
        return {
            type: 'FeatureCollection',
            features: features.filter(f => f !== null) as any[]
        };

    } catch (e) {
        console.error('World Bank API error:', e);
        return { type: 'FeatureCollection', features: [] };
    }
}
