import { FeatureCollection, Geometry } from 'geojson'

const GEOJSON_URL = '/data/countries.geojson'

// Module-level cache to prevent repeated fetches
let cachedGeoJSON: FeatureCollection | null = null
let fetchPromise: Promise<FeatureCollection> | null = null

export async function loadGeoJSON(): Promise<FeatureCollection> {
    // Return cached data immediately
    if (cachedGeoJSON) {
        return cachedGeoJSON
    }

    // Dedupe concurrent requests - return existing promise if fetch in progress
    if (fetchPromise) {
        return fetchPromise
    }

    fetchPromise = (async () => {
        try {
            const response = await fetch(GEOJSON_URL)
            if (!response.ok) {
                throw new Error('Failed to fetch GeoJSON')
            }
            cachedGeoJSON = await response.json()
            return cachedGeoJSON!
        } catch (error) {
            console.error('Error loading GeoJSON:', error)
            // Return empty collection as fallback
            return {
                type: 'FeatureCollection',
                features: []
            }
        } finally {
            fetchPromise = null
        }
    })()

    return fetchPromise!
}

export interface CountryData {
    name: string
    iso_a2: string
    geometry: Geometry
}

export function parseCountries(data: FeatureCollection): CountryData[] {
    return data.features.map(feature => ({
        name: feature.properties?.NAME || 'Unknown',
        iso_a2: feature.properties?.ISO_A2 || '',
        geometry: feature.geometry
    }))
}
