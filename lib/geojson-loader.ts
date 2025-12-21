import { FeatureCollection, Geometry } from 'geojson'

const GEOJSON_URL = '/data/countries.geojson'

export async function loadGeoJSON(): Promise<FeatureCollection> {
    try {
        const response = await fetch(GEOJSON_URL)
        if (!response.ok) {
            throw new Error('Failed to fetch GeoJSON')
        }
        return await response.json()
    } catch (error) {
        console.error('Error loading GeoJSON:', error)
        // Return empty collection as fallback
        return {
            type: 'FeatureCollection',
            features: []
        }
    }
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
