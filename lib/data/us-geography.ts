/**
 * US County Centroids Data
 * 
 * Source: U.S. Census Bureau Gazetteer Files
 * https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
 * 
 * This file contains centroid coordinates for all US counties.
 * Format: { "FIPS": { name, state, lat, lng } }
 */

// State FIPS to name mapping
export const STATE_NAMES: Record<string, string> = {
    '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
    '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
    '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
    '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
    '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
    '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
    '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
    '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
    '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
    '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
    '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
    '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
    '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming', '72': 'Puerto Rico',
};

// State centroids (for state-level visualization)
export const STATE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
    '01': { lat: 32.806671, lng: -86.791130 },
    '02': { lat: 61.370716, lng: -152.404419 },
    '04': { lat: 33.729759, lng: -111.431221 },
    '05': { lat: 34.969704, lng: -92.373123 },
    '06': { lat: 36.116203, lng: -119.681564 },
    '08': { lat: 39.059811, lng: -105.311104 },
    '09': { lat: 41.597782, lng: -72.755371 },
    '10': { lat: 39.318523, lng: -75.507141 },
    '11': { lat: 38.897438, lng: -77.026817 },
    '12': { lat: 27.766279, lng: -81.686783 },
    '13': { lat: 33.040619, lng: -83.643074 },
    '15': { lat: 21.094318, lng: -157.498337 },
    '16': { lat: 44.240459, lng: -114.478828 },
    '17': { lat: 40.349457, lng: -88.986137 },
    '18': { lat: 39.849426, lng: -86.258278 },
    '19': { lat: 42.011539, lng: -93.210526 },
    '20': { lat: 38.526600, lng: -96.726486 },
    '21': { lat: 37.668140, lng: -84.670067 },
    '22': { lat: 31.169546, lng: -91.867805 },
    '23': { lat: 44.693947, lng: -69.381927 },
    '24': { lat: 39.063946, lng: -76.802101 },
    '25': { lat: 42.230171, lng: -71.530106 },
    '26': { lat: 43.326618, lng: -84.536095 },
    '27': { lat: 45.694454, lng: -93.900192 },
    '28': { lat: 32.741646, lng: -89.678696 },
    '29': { lat: 38.456085, lng: -92.288368 },
    '30': { lat: 46.921925, lng: -110.454353 },
    '31': { lat: 41.125370, lng: -98.268082 },
    '32': { lat: 38.313515, lng: -117.055374 },
    '33': { lat: 43.452492, lng: -71.563896 },
    '34': { lat: 40.298904, lng: -74.521011 },
    '35': { lat: 34.840515, lng: -106.248482 },
    '36': { lat: 42.165726, lng: -74.948051 },
    '37': { lat: 35.630066, lng: -79.806419 },
    '38': { lat: 47.528912, lng: -99.784012 },
    '39': { lat: 40.388783, lng: -82.764915 },
    '40': { lat: 35.565342, lng: -96.928917 },
    '41': { lat: 44.572021, lng: -122.070938 },
    '42': { lat: 40.590752, lng: -77.209755 },
    '44': { lat: 41.680893, lng: -71.511780 },
    '45': { lat: 33.856892, lng: -80.945007 },
    '46': { lat: 44.299782, lng: -99.438828 },
    '47': { lat: 35.747845, lng: -86.692345 },
    '48': { lat: 31.054487, lng: -97.563461 },
    '49': { lat: 40.150032, lng: -111.862434 },
    '50': { lat: 44.045876, lng: -72.710686 },
    '51': { lat: 37.769337, lng: -78.169968 },
    '53': { lat: 47.400902, lng: -121.490494 },
    '54': { lat: 38.491226, lng: -80.954453 },
    '55': { lat: 44.268543, lng: -89.616508 },
    '56': { lat: 42.755966, lng: -107.302490 },
    '72': { lat: 18.220833, lng: -66.590149 },
};



/**
 * Get state centroid by FIPS code
 */
export function getStateCentroid(stateFips: string): { name: string; lat: number; lng: number } | null {
    const centroid = STATE_CENTROIDS[stateFips];
    const name = STATE_NAMES[stateFips];
    if (centroid && name) {
        return { name, ...centroid };
    }
    return null;
}

/**
 * Visualization configurations per dataset
 */
export interface VisualizationConfig {
    type: 'choropleth' | 'proportional-symbol' | 'dot';
    colorScale: string[]; // Array of colors from min to max
    sizeRange?: [number, number]; // [minRadius, maxRadius] for proportional symbols
    refreshFrequency: string;
    description: string;
}

export const DATASET_VIZ_CONFIG: Record<string, VisualizationConfig> = {
    population: {
        type: 'choropleth',
        colorScale: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e40af', '#1e3a8a'],
        refreshFrequency: 'Annual (estimates) / 10 years (full count)',
        description: 'Population density by region. Darker colors indicate higher population.',
    },
    income: {
        type: 'choropleth',
        colorScale: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#166534', '#14532d'],
        refreshFrequency: 'Annual (ACS)',
        description: 'Median household income by region. Darker green = higher income.',
    },
    poverty: {
        type: 'choropleth',
        colorScale: ['#fef3c7', '#fcd34d', '#f59e0b', '#d97706', '#b45309', '#92400e'],
        refreshFrequency: 'Annual (ACS)',
        description: 'Poverty rate percentage. Darker orange = higher poverty rate.',
    },
    employment: {
        type: 'proportional-symbol',
        colorScale: ['#ecfeff', '#a5f3fc', '#22d3ee', '#0891b2', '#0e7490', '#155e75'],
        sizeRange: [4, 20],
        refreshFrequency: 'Annual (ACS) + Monthly labor surveys',
        description: 'Employment levels. Circle size indicates labor force size.',
    },
    trade: {
        type: 'proportional-symbol',
        colorScale: ['#fce7f3', '#f9a8d4', '#ec4899', '#be185d', '#9d174d', '#831843'],
        sizeRange: [5, 25],
        refreshFrequency: 'Monthly',
        description: 'Export values by port/region. Circle size indicates export volume.',
    },
};
