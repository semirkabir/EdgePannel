import { XMLParser } from 'fast-xml-parser';

export async function fetchSECFilings(): Promise<GeoJSON.FeatureCollection> {
    // SEC Latest Filings RSS Feed
    const RSS_URL = 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=8-K&company=&dateb=&owner=include&start=0&count=20&output=atom';

    // Mapping some major CIKs or company names to coordinates manually for demo
    // In production, we'd need a huge company-to-HQ-location database
    const locationMap: Record<string, [number, number]> = {
        'APPLE INC': [-122.0, 37.3], // Cupertino
        'MICROSOFT CORP': [-122.1, 47.6], // Redmond
        'TESLA, INC.': [-97.7, 30.2], // Austin
        'AMAZON COM INC': [-122.3, 47.6], // Seattle
        'GOOGLE LLC': [-122.0, 37.4], // Mountain View
        'META PLATFORMS': [-122.1, 37.4], // Menlo Park
        'NVIDIA CORP': [-121.9, 37.3], // Santa Clara
        'JPMORGAN CHASE': [-74.0, 40.7], // NYC
        'GOLDMAN SACHS': [-74.0, 40.7], // NYC
    };

    try {
        const res = await fetch(RSS_URL, {
            headers: {
                'User-Agent': 'EdgePannel_Terminal/1.0 (skabir@example.com)' // SEC requires User-Agent
            }
        });

        if (!res.ok) throw new Error('SEC fetch failed');

        const xml = await res.text();
        const parser = new XMLParser();
        const feed = parser.parse(xml);

        // Atom feed structure: feed.entry[]
        const entries = feed.feed?.entry || [];
        const features: any[] = [];

        for (const entry of entries) {
            const title = entry.title || '';
            // Simple lookup match
            const company = Object.keys(locationMap).find(c => title.toUpperCase().includes(c));

            if (company && locationMap[company]) {
                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: locationMap[company] },
                    properties: {
                        type: 'FINANCE',
                        subtype: 'FILING',
                        symbol: 'SEC:8K',
                        title: `SEC Filing: ${company}`,
                        price: '8-K', // Using price field for type of filing
                        change: 'Recent',
                        url: entry.link?.['@_href'],
                        source: 'SEC EDGAR'
                    }
                });
            }
        }

        // Return dummy data if no matches found to ensure map isn't empty in demo
        if (features.length === 0) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-74.0, 40.7] },
                properties: { type: 'FINANCE', subtype: 'FILING', symbol: 'XXX', title: 'Sample SEC Filing (Major Bank)', price: '8-K', source: 'SEC' }
            });
        }

        return { type: 'FeatureCollection', features };

    } catch (e) {
        console.error('SEC API error:', e);
        return { type: 'FeatureCollection', features: [] };
    }
}
