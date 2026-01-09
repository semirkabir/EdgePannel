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
        // Use the DOC API which returns actual news articles
        // Query for English news from the last 24 hours, fetch more for better coverage
        const response = await fetch(
            'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:english&mode=artlist&maxrecords=500&format=json&timespan=24h'
        );

        if (!response.ok) {
            throw new Error(`GDELT API failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const articles = data.articles || [];

        console.log(`[GDELT] Received ${articles.length} articles from DOC API`);

        // Group news by country using the sourcecountry field directly
        const groupedNews: Record<string, any[]> = {};

        articles.forEach((article: any) => {
            const title = article.title || '';
            const url = article.url || '';
            const domain = article.domain || article.source || '';
            const seenDate = article.seendate || '';
            const imageUrl = article.socialimage || null;
            const sourceCountry = article.sourcecountry || '';

            // Normalize the country name
            const countryKey = normalizeCountry(sourceCountry);

            // Filter: must have valid country, proper title (10+ chars, English text)
            if (countryKey && title.length > 10 && isEnglishText(title)) {
                if (!groupedNews[countryKey]) groupedNews[countryKey] = [];

                // Avoid duplicate titles and limit per country
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

        const countryCount = Object.keys(groupedNews).length;
        console.log(`[GDELT] Grouped articles into ${countryCount} countries:`, Object.keys(groupedNews));

        // Convert groups to features positioned at capital cities
        const features = Object.keys(groupedNews).map(country => {
            const newsList = groupedNews[country]
                .sort((a, b) => b.importance - a.importance)
                .slice(0, 5);
            const coords = COUNTRY_CAPITALS[country];

            if (!coords || newsList.length === 0) {
                console.log(`[GDELT] Skipping ${country} - no coords or no news`);
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
                    title: newsList[0].title, // Use actual headline as title
                    news: newsList,
                    newsCount: newsList.length,
                    importance: newsList[0].importance,
                    isTrending: newsList.length >= 3,
                    imageUrl: newsList[0].imageUrl
                }
            };
        }).filter(Boolean) as GeoJSONFeature[];

        console.log(`[GDELT] Returning ${features.length} country news clusters`);

        return {
            type: 'FeatureCollection',
            features: features
        };
    } catch (error) {
        console.error('[GDELT] Failed to fetch data:', error);
        return { type: 'FeatureCollection', features: [] };
    }
}
