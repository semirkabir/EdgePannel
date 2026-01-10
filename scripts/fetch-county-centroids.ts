/**
 * Script to fetch and parse US County Centroids from Census Gazetteer
 * 
 * Downloads the 2023 Gazetteer file and extracts county centroids.
 * Outputs a TypeScript file with all county centroids.
 * 
 * Run with: npx ts-node scripts/fetch-county-centroids.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as readline from 'readline';

// Gazetteer file URL (tab-delimited text)
const GAZETTEER_URL = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_counties_national.txt';

interface CountyCentroid {
    geoid: string;      // State FIPS + County FIPS (e.g., "01001")
    name: string;       // County name
    stateFips: string;  // State FIPS code
    countyFips: string; // County FIPS code
    lat: number;
    lng: number;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`Downloading from ${url}...`);

        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirect
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    file.close();
                    downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
                    return;
                }
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded to ${destPath}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { }); // Delete partial file
            reject(err);
        });
    });
}

async function parseGazetteerFile(filePath: string): Promise<CountyCentroid[]> {
    const counties: CountyCentroid[] = [];

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let isFirstLine = true;
    let headers: string[] = [];

    for await (const line of rl) {
        if (isFirstLine) {
            // Parse header row
            headers = line.split('\t').map(h => h.trim());
            isFirstLine = false;
            console.log('Headers:', headers);
            continue;
        }

        const values = line.split('\t');

        // Find column indices
        const geoidIdx = headers.findIndex(h => h === 'GEOID');
        const nameIdx = headers.findIndex(h => h === 'NAME');
        const latIdx = headers.findIndex(h => h === 'INTPTLAT');
        const lngIdx = headers.findIndex(h => h === 'INTPTLONG');

        if (geoidIdx === -1 || nameIdx === -1 || latIdx === -1 || lngIdx === -1) {
            console.error('Could not find expected columns');
            continue;
        }

        const geoid = values[geoidIdx]?.trim();
        const name = values[nameIdx]?.trim();
        const lat = parseFloat(values[latIdx]?.trim() || '0');
        const lng = parseFloat(values[lngIdx]?.trim() || '0');

        if (!geoid || geoid.length < 5) continue;

        counties.push({
            geoid,
            name,
            stateFips: geoid.substring(0, 2),
            countyFips: geoid.substring(2),
            lat,
            lng
        });
    }

    return counties;
}

function generateTypeScriptFile(counties: CountyCentroid[], outputPath: string): void {
    const lines: string[] = [
        '/**',
        ' * US County Centroids - Auto-generated from Census Gazetteer',
        ' * ',
        ' * Source: U.S. Census Bureau 2023 Gazetteer Files',
        ' * Generated: ' + new Date().toISOString(),
        ' * Total Counties: ' + counties.length,
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

    // Sort counties by GEOID
    counties.sort((a, b) => a.geoid.localeCompare(b.geoid));

    for (const county of counties) {
        // Escape single quotes in names
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

    // Add state-grouped lookup
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
    console.log(`Generated TypeScript file: ${outputPath}`);
    console.log(`Total counties: ${counties.length}`);
}

async function main(): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp');
    const outputPath = path.join(process.cwd(), 'lib', 'data', 'county-centroids.ts');

    // Create temp directory
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const gazetteerPath = path.join(tempDir, 'counties_gazetteer.txt');

    try {
        // Download Gazetteer file
        await downloadFile(GAZETTEER_URL, gazetteerPath);

        // Parse the file
        const counties = await parseGazetteerFile(gazetteerPath);

        if (counties.length === 0) {
            console.error('No counties parsed from file');
            return;
        }

        // Generate TypeScript file
        generateTypeScriptFile(counties, outputPath);

        console.log('\nDone! Update lib/services/census.ts to use the new county centroids.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Clean up temp file
        if (fs.existsSync(gazetteerPath)) {
            fs.unlinkSync(gazetteerPath);
        }
        if (fs.existsSync(tempDir)) {
            fs.rmdirSync(tempDir);
        }
    }
}

main();
