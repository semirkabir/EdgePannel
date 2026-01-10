/**
 * Census.gov Data Service
 * 
 * Serves Census data with proper geographic centroids and visualization metadata.
 * Supports zoom-based loading: state level at high altitude, county on zoom.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    STATE_CENTROIDS,
    STATE_NAMES,
    DATASET_VIZ_CONFIG
} from '@/lib/data/us-geography';
import { COUNTY_CENTROIDS, getCountyCentroidByFips } from '@/lib/data/county-centroids';

export type CensusDataset = 'population' | 'income' | 'poverty' | 'employment' | 'trade';
export type CensusGeography = 'state' | 'county';

// In-memory cache
const dataCache: Map<string, { data: GeoJSON.FeatureCollection; loadedAt: number }> = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Dataset configurations for Census API
 */
const DATASET_CONFIGS: Record<CensusDataset, {
    endpoint: string;
    year: string;
    variables: string[];
    valueKey: string;
    transform: (row: any[], headers: string[]) => any;
}> = {
    population: {
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B01003_001E'],
        valueKey: 'population',
        transform: (row, headers) => ({
            population: parseInt(row[headers.indexOf('B01003_001E')]) || 0,
            name: row[headers.indexOf('NAME')],
        }),
    },
    income: {
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B19013_001E', 'B19301_001E'],
        valueKey: 'medianIncome',
        transform: (row, headers) => ({
            medianIncome: parseInt(row[headers.indexOf('B19013_001E')]) || 0,
            perCapitaIncome: parseInt(row[headers.indexOf('B19301_001E')]) || 0,
            name: row[headers.indexOf('NAME')],
        }),
    },
    poverty: {
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B17001_002E', 'B01003_001E'],
        valueKey: 'povertyRate',
        transform: (row, headers) => {
            const povertyCount = parseInt(row[headers.indexOf('B17001_002E')]) || 0;
            const totalPop = parseInt(row[headers.indexOf('B01003_001E')]) || 1;
            return {
                povertyCount,
                povertyRate: parseFloat(((povertyCount / totalPop) * 100).toFixed(1)),
                name: row[headers.indexOf('NAME')],
            };
        },
    },
    employment: {
        endpoint: 'acs/acs5',
        year: '2022',
        variables: ['NAME', 'B23025_002E', 'B23025_005E'],
        valueKey: 'employees',
        transform: (row, headers) => {
            const laborForce = parseInt(row[headers.indexOf('B23025_002E')]) || 0;
            const unemployed = parseInt(row[headers.indexOf('B23025_005E')]) || 0;
            return {
                employees: laborForce - unemployed,
                laborForce,
                unemployed,
                unemploymentRate: laborForce > 0 ? parseFloat(((unemployed / laborForce) * 100).toFixed(1)) : 0,
                name: row[headers.indexOf('NAME')],
            };
        },
    },
    trade: {
        endpoint: 'acs/acs5', // Trade uses different API, placeholder
        year: '2022',
        variables: ['NAME', 'B01003_001E'],
        valueKey: 'exportValue',
        transform: (row, headers) => ({
            exportValue: 0, // Would need trade-specific API
            name: row[headers.indexOf('NAME')],
        }),
    },
};

/**
 * Fetch Census data with proper geographic centroids
 */
export async function fetchCensusData(
    dataset: CensusDataset,
    geography: CensusGeography = 'state'
): Promise<GeoJSON.FeatureCollection> {
    const cacheKey = `${dataset}-${geography}`;

    // Check memory cache
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
        console.log(`[Census] Returning cached data for ${cacheKey}`);
        return cached.data;
    }

    // Try static files first
    const staticData = await loadStaticFile(dataset, geography);
    if (staticData) {
        dataCache.set(cacheKey, { data: staticData, loadedAt: Date.now() });
        return staticData;
    }

    // Fallback: fetch from Census API
    console.log(`[Census] Fetching ${dataset} at ${geography} level from API...`);
    const apiData = await fetchFromCensusAPI(dataset, geography);

    if (apiData.features.length > 0) {
        dataCache.set(cacheKey, { data: apiData, loadedAt: Date.now() });
    }

    return apiData;
}

/**
 * Load from static JSON file
 */
async function loadStaticFile(
    dataset: CensusDataset,
    geography: CensusGeography
): Promise<GeoJSON.FeatureCollection | null> {
    try {
        const filename = `${dataset}-${geography}.json`;
        const filepath = path.join(process.cwd(), 'public', 'data', 'census', filename);

        if (!fs.existsSync(filepath)) {
            return null;
        }

        const content = fs.readFileSync(filepath, 'utf-8');
        return JSON.parse(content) as GeoJSON.FeatureCollection;
    } catch (error) {
        console.error(`[Census] Error loading static file:`, error);
        return null;
    }
}

/**
 * Fetch from Census API
 */
async function fetchFromCensusAPI(
    dataset: CensusDataset,
    geography: CensusGeography
): Promise<GeoJSON.FeatureCollection> {
    const apiKey = process.env.CENSUS_API_KEY;

    if (!apiKey) {
        console.warn('[Census] No API key configured');
        return { type: 'FeatureCollection', features: [] };
    }

    const config = DATASET_CONFIGS[dataset];
    if (!config) {
        return { type: 'FeatureCollection', features: [] };
    }

    try {
        const vars = config.variables.join(',');
        const geo = geography === 'county' ? 'county:*&in=state:*' : 'state:*';
        const url = `https://api.census.gov/data/${config.year}/${config.endpoint}?get=${vars}&for=${geo}&key=${apiKey}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[Census] API Error: ${response.status}`);
            return { type: 'FeatureCollection', features: [] };
        }

        const rawData = await response.json();
        const headers = rawData[0];
        const stateIdx = headers.indexOf('state');
        const countyIdx = headers.indexOf('county');

        // Get visualization config
        const vizConfig = DATASET_VIZ_CONFIG[dataset];

        // Calculate min/max for normalization
        const rows = rawData.slice(1);
        const values = rows.map((row: any[]) => {
            const transformed = config.transform(row, headers);
            return transformed[config.valueKey] || 0;
        }).filter((v: number) => v > 0);

        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);

        const features: GeoJSON.Feature[] = rows
            .filter((row: any[]) => STATE_CENTROIDS[row[stateIdx]])
            .map((row: any[]) => {
                const stateFips = row[stateIdx];
                const countyFips = countyIdx >= 0 ? row[countyIdx] : null;

                // Get proper centroid
                let coords: [number, number];
                let regionName: string;
                let countyName: string | null = null;

                if (geography === 'county' && countyFips) {
                    const countyCentroid = getCountyCentroidByFips(stateFips, countyFips);
                    if (countyCentroid) {
                        coords = [countyCentroid.lng, countyCentroid.lat];
                        countyName = countyCentroid.name;
                        regionName = countyCentroid.name;
                    } else {
                        // Fallback: offset from state centroid based on county FIPS
                        const stateCentroid = STATE_CENTROIDS[stateFips];
                        const countyNum = parseInt(countyFips) || 0;
                        // Use a grid pattern based on county number
                        const gridRow = Math.floor(countyNum / 20);
                        const gridCol = countyNum % 20;
                        const offsetLat = (gridRow - 5) * 0.15;
                        const offsetLng = (gridCol - 10) * 0.2;
                        coords = [stateCentroid.lng + offsetLng, stateCentroid.lat + offsetLat];
                        // Parse county name from NAME field (format: "County Name, State")
                        const nameField = (row as any[])[headers.indexOf('NAME')] as string;
                        const nameParts = nameField?.split(',') || [];
                        countyName = nameParts[0]?.trim() || `County ${countyFips}`;
                        regionName = countyName || `County ${countyFips}`;
                    }
                } else {
                    const stateCentroid = STATE_CENTROIDS[stateFips];
                    coords = [stateCentroid.lng, stateCentroid.lat];
                    regionName = STATE_NAMES[stateFips] || `State ${stateFips}`;
                }

                const transformed = config.transform(row, headers);
                const value = transformed[config.valueKey] || 0;

                // Calculate normalized value (0-1) for color/size scaling
                const normalizedValue = maxValue > minValue
                    ? (value - minValue) / (maxValue - minValue)
                    : 0.5;

                // Determine color from scale
                const colorIndex = Math.min(
                    Math.floor(normalizedValue * (vizConfig.colorScale.length - 1)),
                    vizConfig.colorScale.length - 1
                );
                const color = vizConfig.colorScale[colorIndex];

                // Determine size for proportional symbols
                let size = 8;
                if (vizConfig.type === 'proportional-symbol' && vizConfig.sizeRange) {
                    const [minSize, maxSize] = vizConfig.sizeRange;
                    size = minSize + (normalizedValue * (maxSize - minSize));
                }

                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: coords,
                    },
                    properties: {
                        // Core identifiers
                        type: 'CENSUS',
                        dataset,
                        geography,
                        stateFips,
                        stateName: STATE_NAMES[stateFips],
                        countyFips,
                        countyName,
                        regionName,

                        // Data values
                        ...transformed,

                        // Visualization metadata
                        vizType: vizConfig.type,
                        color,
                        size,
                        normalizedValue,
                        refreshFrequency: vizConfig.refreshFrequency,

                        // For click/panel
                        isCensus: true,
                    },
                };
            });

        return {
            type: 'FeatureCollection',
            features,
            // Add metadata
            // @ts-ignore
            metadata: {
                dataset,
                geography,
                featureCount: features.length,
                valueRange: { min: minValue, max: maxValue },
                vizConfig,
                generatedAt: new Date().toISOString(),
            }
        };
    } catch (error) {
        console.error(`[Census] Failed to fetch ${dataset}:`, error);
        return { type: 'FeatureCollection', features: [] };
    }
}

/**
 * Get dataset info for UI
 */
export function getCensusDatasetInfo(dataset: CensusDataset) {
    const vizConfig = DATASET_VIZ_CONFIG[dataset];
    const config = DATASET_CONFIGS[dataset];

    return {
        ...vizConfig,
        valueKey: config?.valueKey,
        year: config?.year,
    };
}

/**
 * Get all available datasets
 */
export function getAvailableCensusDatasets() {
    return Object.entries(DATASET_VIZ_CONFIG).map(([id, config]) => ({
        id: id as CensusDataset,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        ...config,
    }));
}

/**
 * Get available geographies
 */
export function getAvailableGeographies() {
    return [
        { id: 'state' as CensusGeography, label: 'State Level', description: '52 regions' },
        { id: 'county' as CensusGeography, label: 'County Level', description: '~3,200 regions' },
    ];
}
