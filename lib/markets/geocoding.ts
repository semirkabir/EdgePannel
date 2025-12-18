
// Basic geocoding functionality using Nominatim (OpenStreetMap)
// Rate limited to 1 request per second as per usage policy

interface GeocodingResult {
    lat: number
    lng: number
    display_name: string
}

const CACHE_duration = 1000 * 60 * 60 * 24; // 24 hours
const cache = new Map<string, { data: GeocodingResult | null, timestamp: number }>();

export async function geocodeLocation(locationName: string): Promise<GeocodingResult | null> {
    const query = locationName.trim().toLowerCase();

    // Check cache
    const cached = cache.get(query);
    if (cached && Date.now() - cached.timestamp < CACHE_duration) {
        return cached.data;
    }

    try {
        // Add a small delay to respect rate limits if making multiple calls
        await new Promise(resolve => setTimeout(resolve, 1000));

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
            {
                headers: {
                    'User-Agent': 'Edge/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Geocoding failed');
        }

        const data = await response.json();

        if (data && data.length > 0) {
            const result = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                display_name: data[0].display_name
            };

            cache.set(query, { data: result, timestamp: Date.now() });
            return result;
        }

        cache.set(query, { data: null, timestamp: Date.now() });
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}
