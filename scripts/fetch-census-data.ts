/**
 * Census Data Pre-Fetcher Script
 * 
 * Run this script to fetch Census data from the API and save as static JSON files.
 * This should be run once during deployment or yearly when new Census data is released.
 * 
 * Usage: npx ts-node scripts/fetch-census-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const CENSUS_API_KEY = process.env.CENSUS_API_KEY || '';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data', 'census');

// State FIPS codes with centroids
const STATE_CENTROIDS: Record<string, { name: string; lat: number; lng: number }> = {
    '01': { name: 'Alabama', lat: 32.806671, lng: -86.791130 },
    '02': { name: 'Alaska', lat: 61.370716, lng: -152.404419 },
    '04': { name: 'Arizona', lat: 33.729759, lng: -111.431221 },
    '05': { name: 'Arkansas', lat: 34.969704, lng: -92.373123 },
    '06': { name: 'California', lat: 36.116203, lng: -119.681564 },
    '08': { name: 'Colorado', lat: 39.059811, lng: -105.311104 },
    '09': { name: 'Connecticut', lat: 41.597782, lng: -72.755371 },
    '10': { name: 'Delaware', lat: 39.318523, lng: -75.507141 },
    '11': { name: 'District of Columbia', lat: 38.897438, lng: -77.026817 },
    '12': { name: 'Florida', lat: 27.766279, lng: -81.686783 },
    '13': { name: 'Georgia', lat: 33.040619, lng: -83.643074 },
    '15': { name: 'Hawaii', lat: 21.094318, lng: -157.498337 },
    '16': { name: 'Idaho', lat: 44.240459, lng: -114.478828 },
    '17': { name: 'Illinois', lat: 40.349457, lng: -88.986137 },
    '18': { name: 'Indiana', lat: 39.849426, lng: -86.258278 },
    '19': { name: 'Iowa', lat: 42.011539, lng: -93.210526 },
    '20': { name: 'Kansas', lat: 38.526600, lng: -96.726486 },
    '21': { name: 'Kentucky', lat: 37.668140, lng: -84.670067 },
    '22': { name: 'Louisiana', lat: 31.169546, lng: -91.867805 },
    '23': { name: 'Maine', lat: 44.693947, lng: -69.381927 },
    '24': { name: 'Maryland', lat: 39.063946, lng: -76.802101 },
    '25': { name: 'Massachusetts', lat: 42.230171, lng: -71.530106 },
    '26': { name: 'Michigan', lat: 43.326618, lng: -84.536095 },
    '27': { name: 'Minnesota', lat: 45.694454, lng: -93.900192 },
    '28': { name: 'Mississippi', lat: 32.741646, lng: -89.678696 },
    '29': { name: 'Missouri', lat: 38.456085, lng: -92.288368 },
    '30': { name: 'Montana', lat: 46.921925, lng: -110.454353 },
    '31': { name: 'Nebraska', lat: 41.125370, lng: -98.268082 },
    '32': { name: 'Nevada', lat: 38.313515, lng: -117.055374 },
    '33': { name: 'New Hampshire', lat: 43.452492, lng: -71.563896 },
    '34': { name: 'New Jersey', lat: 40.298904, lng: -74.521011 },
    '35': { name: 'New Mexico', lat: 34.840515, lng: -106.248482 },
    '36': { name: 'New York', lat: 42.165726, lng: -74.948051 },
    '37': { name: 'North Carolina', lat: 35.630066, lng: -79.806419 },
    '38': { name: 'North Dakota', lat: 47.528912, lng: -99.784012 },
    '39': { name: 'Ohio', lat: 40.388783, lng: -82.764915 },
    '40': { name: 'Oklahoma', lat: 35.565342, lng: -96.928917 },
    '41': { name: 'Oregon', lat: 44.572021, lng: -122.070938 },
    '42': { name: 'Pennsylvania', lat: 40.590752, lng: -77.209755 },
    '44': { name: 'Rhode Island', lat: 41.680893, lng: -71.511780 },
    '45': { name: 'South Carolina', lat: 33.856892, lng: -80.945007 },
    '46': { name: 'South Dakota', lat: 44.299782, lng: -99.438828 },
    '47': { name: 'Tennessee', lat: 35.747845, lng: -86.692345 },
    '48': { name: 'Texas', lat: 31.054487, lng: -97.563461 },
    '49': { name: 'Utah', lat: 40.150032, lng: -111.862434 },
    '50': { name: 'Vermont', lat: 44.045876, lng: -72.710686 },
    '51': { name: 'Virginia', lat: 37.769337, lng: -78.169968 },
    '53': { name: 'Washington', lat: 47.400902, lng: -121.490494 },
    '54': { name: 'West Virginia', lat: 38.491226, lng: -80.954453 },
    '55': { name: 'Wisconsin', lat: 44.268543, lng: -89.616508 },
    '56': { name: 'Wyoming', lat: 42.755966, lng: -107.302490 },
    '72': { name: 'Puerto Rico', lat: 18.220833, lng: -66.590149 },
};

interface DatasetConfig {
    name: string;
    endpoint: string;
    year: string;
    variables: string[];
    geography: 'state' | 'county';
    transformer: (data: any[], headers: string[]) => any[];
}

const DATASETS: Record<string, DatasetConfig> = {
    'population-state': {
        name: 'Population (State)',
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B01003_001E'],
        geography: 'state',
        transformer: (data, headers) => {
            const nameIdx = headers.indexOf('NAME');
            const popIdx = headers.indexOf('B01003_001E');
            const stateIdx = headers.indexOf('state');
            return data.map(row => ({
                population: parseInt(row[popIdx]) || 0,
                name: row[nameIdx],
                state: row[stateIdx],
            }));
        },
    },
    'population-county': {
        name: 'Population (County)',
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B01003_001E'],
        geography: 'county',
        transformer: (data, headers) => {
            const nameIdx = headers.indexOf('NAME');
            const popIdx = headers.indexOf('B01003_001E');
            const stateIdx = headers.indexOf('state');
            const countyIdx = headers.indexOf('county');
            return data.map(row => ({
                population: parseInt(row[popIdx]) || 0,
                name: row[nameIdx],
                state: row[stateIdx],
                county: row[countyIdx],
            }));
        },
    },
    'income-state': {
        name: 'Income (State)',
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B19013_001E', 'B19301_001E'],
        geography: 'state',
        transformer: (data, headers) => {
            const nameIdx = headers.indexOf('NAME');
            const medianIdx = headers.indexOf('B19013_001E');
            const perCapitaIdx = headers.indexOf('B19301_001E');
            const stateIdx = headers.indexOf('state');
            return data.map(row => ({
                name: row[nameIdx],
                medianIncome: parseInt(row[medianIdx]) || 0,
                perCapitaIncome: parseInt(row[perCapitaIdx]) || 0,
                state: row[stateIdx],
            }));
        },
    },
    'income-county': {
        name: 'Income (County)',
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B19013_001E', 'B19301_001E'],
        geography: 'county',
        transformer: (data, headers) => {
            const nameIdx = headers.indexOf('NAME');
            const medianIdx = headers.indexOf('B19013_001E');
            const perCapitaIdx = headers.indexOf('B19301_001E');
            const stateIdx = headers.indexOf('state');
            const countyIdx = headers.indexOf('county');
            return data.map(row => ({
                name: row[nameIdx],
                medianIncome: parseInt(row[medianIdx]) || 0,
                perCapitaIncome: parseInt(row[perCapitaIdx]) || 0,
                state: row[stateIdx],
                county: row[countyIdx],
            }));
        },
    },
    'employment-state': {
        name: 'Employment (State)',
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B23025_002E', 'B23025_005E'],
        geography: 'state',
        transformer: (data, headers) => {
            const nameIdx = headers.indexOf('NAME');
            const laborIdx = headers.indexOf('B23025_002E');
            const unemplIdx = headers.indexOf('B23025_005E');
            const stateIdx = headers.indexOf('state');
            return data.map(row => {
                const laborForce = parseInt(row[laborIdx]) || 0;
                const unemployed = parseInt(row[unemplIdx]) || 0;
                return {
                    name: row[nameIdx],
                    employees: laborForce - unemployed,
                    laborForce,
                    unemploymentRate: laborForce > 0 ? ((unemployed / laborForce) * 100).toFixed(1) : '0',
                    state: row[stateIdx],
                };
            });
        },
    },
    'employment-county': {
        name: 'Employment (County)',
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B23025_002E', 'B23025_005E'],
        geography: 'county',
        transformer: (data, headers) => {
            const nameIdx = headers.indexOf('NAME');
            const laborIdx = headers.indexOf('B23025_002E');
            const unemplIdx = headers.indexOf('B23025_005E');
            const stateIdx = headers.indexOf('state');
            const countyIdx = headers.indexOf('county');
            return data.map(row => {
                const laborForce = parseInt(row[laborIdx]) || 0;
                const unemployed = parseInt(row[unemplIdx]) || 0;
                return {
                    name: row[nameIdx],
                    employees: laborForce - unemployed,
                    laborForce,
                    unemploymentRate: laborForce > 0 ? ((unemployed / laborForce) * 100).toFixed(1) : '0',
                    state: row[stateIdx],
                    county: row[countyIdx],
                };
            });
        },
    },
};

async function fetchDataset(config: DatasetConfig): Promise<any[]> {
    const baseUrl = 'https://api.census.gov/data';
    const vars = config.variables.join(',');
    const geo = config.geography === 'county' ? 'county:*&in=state:*' : 'state:*';

    const url = `${baseUrl}/${config.year}/${config.endpoint}?get=${vars}&for=${geo}&key=${CENSUS_API_KEY}`;

    console.log(`Fetching ${config.name}...`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const headers = data[0];
    const rows = data.slice(1);

    return config.transformer(rows, headers);
}

async function fetchCountyCentroids(): Promise<Map<string, { lat: number; lng: number }>> {
    // Use Census Gazetteer files for county centroids
    // https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
    console.log('Fetching county centroids from Census Gazetteer...');

    const url = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_counties_national.zip';

    // For now, we'll use approximate centroids based on state centroids with small offsets
    // In production, you'd want to download and parse the gazetteer file
    console.log('Note: Using approximate county centroids. For production, parse the Gazetteer file.');

    return new Map();
}

function createGeoJSON(data: any[], dataset: string, geography: 'state' | 'county'): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];

    for (const item of data) {
        let coords: [number, number] | null = null;
        let stateName = '';

        if (geography === 'state') {
            const centroid = STATE_CENTROIDS[item.state];
            if (centroid) {
                coords = [centroid.lng, centroid.lat];
                stateName = centroid.name;
            }
        } else {
            // For counties, use state centroid with a small random offset
            // In production, use actual county centroids from Gazetteer
            const stateCentroid = STATE_CENTROIDS[item.state];
            if (stateCentroid) {
                // Create deterministic offset based on county FIPS
                const countyNum = parseInt(item.county) || 0;
                const offsetLat = ((countyNum % 100) - 50) * 0.02;
                const offsetLng = ((countyNum % 50) - 25) * 0.03;
                coords = [stateCentroid.lng + offsetLng, stateCentroid.lat + offsetLat];
                stateName = stateCentroid.name;
            }
        }

        if (!coords) continue;

        const datasetType = dataset.split('-')[0]; // 'population', 'income', 'employment'

        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: coords,
            },
            properties: {
                type: 'CENSUS',
                dataset: datasetType,
                geography,
                stateFips: item.state,
                stateName,
                countyFips: item.county || null,
                ...item,
            },
        });
    }

    return {
        type: 'FeatureCollection',
        features,
    };
}

async function main() {
    if (!CENSUS_API_KEY) {
        console.error('Error: CENSUS_API_KEY environment variable not set');
        console.log('Set it in your .env file or run with: CENSUS_API_KEY=your_key npx ts-node scripts/fetch-census-data.ts');
        process.exit(1);
    }

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created directory: ${OUTPUT_DIR}`);
    }

    const metadata: Record<string, any> = {
        generatedAt: new Date().toISOString(),
        source: 'U.S. Census Bureau',
        apiYear: '2022',
        datasets: {},
    };

    for (const [key, config] of Object.entries(DATASETS)) {
        try {
            const data = await fetchDataset(config);
            const geojson = createGeoJSON(data, key, config.geography);

            const filename = `${key}.json`;
            const filepath = path.join(OUTPUT_DIR, filename);

            fs.writeFileSync(filepath, JSON.stringify(geojson, null, 2));
            console.log(`✓ Saved ${filename} (${geojson.features.length} features)`);

            metadata.datasets[key] = {
                filename,
                featureCount: geojson.features.length,
                geography: config.geography,
            };

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`✗ Failed to fetch ${key}:`, error);
        }
    }

    // Save metadata
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
    );
    console.log('\n✓ Saved metadata.json');
    console.log('\nDone! Census data saved to:', OUTPUT_DIR);
}

main().catch(console.error);
