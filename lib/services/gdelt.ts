import { COUNTRY_CAPITALS } from '@/lib/data/capitals';

export interface GeoJSONFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: Record<string, any>;
}

export interface GeoJSONCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

// Normalize country names from GDELT to our capital cities data
const COUNTRY_NORMALIZATION: Record<string, string> = {
    'united states': 'United States',
    'united kingdom': 'United Kingdom',
    'south korea': 'South Korea',
    'north korea': 'North Korea',
    'south africa': 'South Africa',
    'new zealand': 'New Zealand',
    'saudi arabia': 'Saudi Arabia',
    'united arab emirates': 'United Arab Emirates',
    'hong kong': 'Hong Kong',
    'czech republic': 'Czech Republic',
    'dominican republic': 'Dominican Republic',
    'costa rica': 'Costa Rica',
    'sri lanka': 'Sri Lanka',
    'puerto rico': 'Puerto Rico',
};

function normalizeCountry(sourcecountry: string): string | null {
    if (!sourcecountry) return null;

    const lower = sourcecountry.toLowerCase().trim();

    // Check normalization map first
    if (COUNTRY_NORMALIZATION[lower]) {
        const normalized = COUNTRY_NORMALIZATION[lower];
        return COUNTRY_CAPITALS[normalized] ? normalized : null;
    }

    // Capitalize first letter of each word for simple names
    const capitalized = lower
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    // Check if it exists in our capitals database
    if (COUNTRY_CAPITALS[capitalized]) {
        return capitalized;
    }

    // Direct check
    for (const country of Object.keys(COUNTRY_CAPITALS)) {
        if (country.toLowerCase() === lower) {
            return country;
        }
    }

    return null;
}

// Check if a string is primarily ASCII/English
function isEnglishText(text: string): boolean {
    if (!text) return false;
    // Count ASCII characters vs non-ASCII
    let asciiCount = 0;
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) < 128) asciiCount++;
    }
    return (asciiCount / text.length) > 0.8; // At least 80% ASCII
}

export async function fetchGDELTData(): Promise<GeoJSONCollection> {
    try {
        // Try the GDELT GEO API first (returns ready-to-map GeoJSON with coordinates)
        const geoUrl = 'https://api.gdeltproject.org/api/v2/geo/geo?query=sourcelang:english&format=geojson&maxrecords=400&timespan=24h';
        const geoRes = await fetch(geoUrl);
        if (geoRes.ok) {
            const geoJson = await geoRes.json();
            const featuresRaw = geoJson.features || [];
            let maxCount = 1;

            const parsedFeatures = featuresRaw
                .map((f: any) => {
                    const props = f.properties || {};
                    const coords = f.geometry?.coordinates;
                    if (!coords || !Array.isArray(coords) || coords.length < 2) return null;

                    // Extract title and URL from the HTML field
                    let title = '';
                    let url = '';
                    if (typeof props.html === 'string') {
                        const match = props.html.match(/href=\"([^\"]+)\"[^>]*>([^<]+)<\/a>/i);
                        if (match) {
                            url = match[1];
                            title = match[2];
                        }
                    }
                    if (!title || !url || !isEnglishText(title)) return null;

                    const count = Number(props.count) || 1;
                    if (count > maxCount) maxCount = count;

                    let source = '';
                    try {
                        source = new URL(url).hostname.replace(/^www\./, '');
                    } catch (e) {
                        source = '';
                    }

                    return {
                        type: 'Feature' as const,
                        geometry: {
                            type: 'Point' as const,
                            coordinates: [coords[0], coords[1]] as [number, number],
                        },
                        properties: {
                            type: 'NEWS',
                            title: title.trim(),
                            url,
                            source,
                            country: props.name || '',
                            count,
                            importance: count, // normalize later
                            news: [{
                                title: title.trim(),
                                url,
                                source,
                                imageUrl: props.shareimage || null,
                                seenDate: '',
                                importance: count,
                            }],
                            newsCount: 1,
                            imageUrl: props.shareimage || null,
                        }
                    };
                })
                .filter(Boolean) as GeoJSONFeature[];

            // Normalize importance and limit to top 200 to avoid clutter
            const normalized = parsedFeatures
                .map(f => ({
                    ...f,
                    properties: {
                        ...f.properties,
                        importance: maxCount > 0 ? (f.properties.importance as number) / maxCount : 0.5,
                    }
                }))
                .sort((a, b) => (b.properties.importance as number) - (a.properties.importance as number))
                .slice(0, 200);

            if (normalized.length > 0) {
                console.log(`[GDELT] GEO API returned ${normalized.length} geo-tagged news points`);
                return { type: 'FeatureCollection', features: normalized };
            }
        }

        // Fallback: DOC API grouped by country (capital-city pins)
        const response = await fetch(
            'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:english&mode=artlist&maxrecords=500&format=json&timespan=24h'
        );

        if (response.ok) {
            const data = await response.json();
            const articles = data.articles || [];

            console.log(`[GDELT] Received ${articles.length} articles from DOC API`);

            const groupedNews: Record<string, any[]> = {};

            articles.forEach((article: any) => {
                const title = article.title || '';
                const url = article.url || '';
                const domain = article.domain || article.source || '';
                const seenDate = article.seendate || '';
                const imageUrl = article.socialimage || null;
                const sourceCountry = article.sourcecountry || '';

                const countryKey = normalizeCountry(sourceCountry);

                if (countryKey && title.length > 10 && isEnglishText(title)) {
                    if (!groupedNews[countryKey]) groupedNews[countryKey] = [];

                    if (groupedNews[countryKey].length < 10 &&
                        !groupedNews[countryKey].find(n => n.title === title)) {
                        groupedNews[countryKey].push({
                            title: title.trim(),
                            url: url,
                            imageUrl: imageUrl || null,
                            source: domain.replace('www.', ''),
                            seenDate: seenDate,
                            importance: 0.5 + Math.random() * 0.5
                        });
                    }
                }
            });

            const features = Object.keys(groupedNews).map(country => {
                const newsList = groupedNews[country]
                    .sort((a: any, b: any) => b.importance - a.importance)
                    .slice(0, 5);
                const coords = COUNTRY_CAPITALS[country];

                if (!coords || newsList.length === 0) {
                    return null;
                }

                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: coords as [number, number]
                    },
                    properties: {
                        type: 'NEWS',
                        country: country,
                        title: newsList[0].title,
                        news: newsList,
                        newsCount: newsList.length,
                        importance: newsList[0].importance,
                        isTrending: newsList.length >= 3,
                        imageUrl: newsList[0].imageUrl
                    }
                };
            }).filter(Boolean) as GeoJSONFeature[];

            console.log(`[GDELT] Returning ${features.length} country news clusters (fallback)`);

            return {
                type: 'FeatureCollection',
                features: features
            };
        }

        throw new Error('GDELT API failed (both GEO and DOC)');
    } catch (error) {
        console.error('[GDELT] Failed to fetch data:', error);
        return { type: 'FeatureCollection', features: [] };
    }
}
