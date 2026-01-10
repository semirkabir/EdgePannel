/**
 * Script to fetch county boundaries and centroids using Census TIGERweb API
 * 
 * Uses the TIGERweb REST API to get county information including centroids.
 * 
 * Run with: npx ts-node scripts/fetch-county-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// TIGERweb REST API endpoint for counties (layer 82 in current TIGER)
const TIGER_COUNTIES_URL = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query';

interface CountyFeature {
    attributes: {
        GEOID: string;
        NAME: string;
        STATE: string;
        COUNTY: string;
        CENTLAT: string;
        CENTLON: string;
    };
}

async function fetchCountiesByState(stateFips: string): Promise<CountyFeature[]> {
    const params = new URLSearchParams({
        where: `STATE='${stateFips}'`,
        outFields: 'GEOID,NAME,STATE,COUNTY,CENTLAT,CENTLON',
        returnGeometry: 'false',
        f: 'json'
    });

    const url = `${TIGER_COUNTIES_URL}?${params}`;
    console.log(`Fetching counties for state ${stateFips}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch state ${stateFips}: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.features || [];
    } catch (error) {
        console.error(`Error fetching state ${stateFips}:`, error);
        return [];
    }
}

// All state FIPS codes including DC and PR
const STATE_FIPS = [
    '01', '02', '04', '05', '06', '08', '09', '10', '11', '12',
    '13', '15', '16', '17', '18', '19', '20', '21', '22', '23',
    '24', '25', '26', '27', '28', '29', '30', '31', '32', '33',
    '34', '35', '36', '37', '38', '39', '40', '41', '42', '44',
    '45', '46', '47', '48', '49', '50', '51', '53', '54', '55', '56', '72'
];

async function main(): Promise<void> {
    const outputPath = path.join(process.cwd(), 'lib', 'data', 'county-centroids.ts');

    const allCounties: { geoid: string; name: string; stateFips: string; countyFips: string; lat: number; lng: number }[] = [];

    console.log('Fetching all county data from TIGERweb...\n');

    // Fetch counties for each state
    for (const stateFips of STATE_FIPS) {
        const counties = await fetchCountiesByState(stateFips);

        for (const county of counties) {
            const attrs = county.attributes;
            if (!attrs.GEOID || !attrs.CENTLAT || !attrs.CENTLON) continue;

            allCounties.push({
                geoid: attrs.GEOID,
                name: attrs.NAME,
                stateFips: attrs.STATE,
                countyFips: attrs.COUNTY,
                lat: parseFloat(attrs.CENTLAT),
                lng: parseFloat(attrs.CENTLON)
            });
        }

        console.log(`  State ${stateFips}: ${counties.length} counties`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\nTotal counties fetched: ${allCounties.length}`);

    if (allCounties.length === 0) {
        console.error('No counties fetched. Exiting.');
        return;
    }

    // Generate TypeScript file
    const lines: string[] = [
        '/**',
        ' * US County Centroids - Auto-generated from Census TIGERweb API',
        ' * ',
        ' * Source: U.S. Census Bureau TIGERweb',
        ' * Generated: ' + new Date().toISOString(),
        ' * Total Counties: ' + allCounties.length,
        ' */',
        '',
        'export interface CountyCentroid {',
        '    name: string;',
        '    lat: number;',
        '    lng: number;',
        '}',
        '',
        '/**',
        ' * County centroids keyed by full GEOID (StateFIPS + CountyFIPS)',
        ' * Example: "06037" = Los Angeles County, CA',
        ' */',
        'export const COUNTY_CENTROIDS: Record<string, CountyCentroid> = {'
    ];

    // Sort by GEOID
    allCounties.sort((a, b) => a.geoid.localeCompare(b.geoid));

    for (const county of allCounties) {
        const safeName = county.name.replace(/'/g, "\\'");
        lines.push(`    '${county.geoid}': { name: '${safeName}', lat: ${county.lat.toFixed(6)}, lng: ${county.lng.toFixed(6)} },`);
    }

    lines.push('};');
    lines.push('');

    // Add helper function
    lines.push('/**');
    lines.push(' * Get county centroid by FIPS codes');
    lines.push(' */');
    lines.push('export function getCountyCentroidByFips(stateFips: string, countyFips: string): CountyCentroid | null {');
    lines.push('    const geoid = stateFips.padStart(2, "0") + countyFips.padStart(3, "0");');
    lines.push('    return COUNTY_CENTROIDS[geoid] || null;');
    lines.push('}');
    lines.push('');
    lines.push('/**');
    lines.push(' * Get all counties in a state');
    lines.push(' */');
    lines.push('export function getCountiesByState(stateFips: string): { geoid: string; name: string; lat: number; lng: number }[] {');
    lines.push('    const prefix = stateFips.padStart(2, "0");');
    lines.push('    return Object.entries(COUNTY_CENTROIDS)');
    lines.push('        .filter(([geoid]) => geoid.startsWith(prefix))');
    lines.push('        .map(([geoid, data]) => ({ geoid, ...data }));');
    lines.push('}');
    lines.push('');

    fs.writeFileSync(outputPath, lines.join('\n'));
    console.log(`\nGenerated: ${outputPath}`);
}

main().catch(console.error);
