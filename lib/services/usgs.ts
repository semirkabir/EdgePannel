export async function fetchUSGSEarthquakes(): Promise<GeoJSON.FeatureCollection> {
    // USGS GeoJSON Feed (Past Day, Magnitude 2.5+)
    const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

    try {
        const res = await fetch(USGS_URL);
        if (!res.ok) throw new Error('USGS fetch failed');

        const data = await res.json();

        // Transform to Custom Layer Schema
        const features = data.features.map((f: any) => ({
            ...f,
            properties: {
                type: 'CUSTOM', // Mapped to Custom for now
                subtype: 'ENVIRONMENT',
                title: `Earthquake: ${f.properties.place}`,
                price: 'M ' + f.properties.mag, // Use price field for Magnitude to show on map
                change: new Date(f.properties.time).toLocaleTimeString(),
                source: 'USGS',
                url: f.properties.url
            }
        }));

        return { type: 'FeatureCollection', features };
    } catch (e) {
        console.error('USGS API Error:', e);
        return { type: 'FeatureCollection', features: [] };
    }
}
