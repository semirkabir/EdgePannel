'use client'

import useSWR from 'swr'

interface GeoJSONFeatureCollection {
    type: 'FeatureCollection'
    features: any[]
}

const EMPTY_COLLECTION: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] }

// Shared fetcher for layer data
const layerFetcher = async (url: string): Promise<GeoJSONFeatureCollection> => {
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(`Failed to fetch layer: ${url}`)
    }
    return res.json()
}

// SWR configuration for layers - cache aggressively, refresh periodically
const LAYER_CONFIG = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000, // Dedupe within 30 seconds
    errorRetryCount: 2,
    errorRetryInterval: 5000,
}

/**
 * Hook for fetching news layer data with SWR caching
 */
export function useNewsLayer(enabled: boolean) {
    const { data, error, isLoading } = useSWR<GeoJSONFeatureCollection>(
        enabled ? '/api/layers/news' : null,
        layerFetcher,
        {
            ...LAYER_CONFIG,
            refreshInterval: 5 * 60 * 1000 // 5 minutes
        }
    )

    return {
        data: data ?? EMPTY_COLLECTION,
        isLoading,
        error
    }
}

/**
 * Hook for fetching finance layer data with SWR caching
 */
export function useFinanceLayer(enabled: boolean) {
    const { data, error, isLoading } = useSWR<GeoJSONFeatureCollection>(
        enabled ? '/api/layers/finance' : null,
        layerFetcher,
        LAYER_CONFIG
    )

    return {
        data: data ?? EMPTY_COLLECTION,
        isLoading,
        error
    }
}

/**
 * Hook for fetching custom layer data with SWR caching
 */
export function useCustomLayer(enabled: boolean) {
    const { data, error, isLoading } = useSWR<GeoJSONFeatureCollection>(
        enabled ? '/api/layers/custom' : null,
        layerFetcher,
        LAYER_CONFIG
    )

    return {
        data: data ?? EMPTY_COLLECTION,
        isLoading,
        error
    }
}

/**
 * Hook for fetching census layer data with SWR caching
 */
export function useCensusLayer(enabled: boolean, dataset: string | null, geography: string) {
    const { data, error, isLoading } = useSWR<GeoJSONFeatureCollection>(
        enabled && dataset ? `/api/layers/census?dataset=${dataset}&geography=${geography}` : null,
        layerFetcher,
        LAYER_CONFIG
    )

    return {
        data: data ?? EMPTY_COLLECTION,
        isLoading,
        error
    }
}

/**
 * Hook for fetching USNI Navy Fleet layer data with SWR caching
 */
export function useUSNILayer(enabled: boolean) {
    const { data, error, isLoading } = useSWR<GeoJSONFeatureCollection>(
        enabled ? '/api/layers/usni' : null,
        layerFetcher,
        LAYER_CONFIG
    )

    return {
        data: data ?? EMPTY_COLLECTION,
        isLoading,
        error
    }
}

/**
 * Hook for fetching Celestrak satellite layer data with SWR caching
 */
export function useCelestrakLayer(enabled: boolean) {
    const { data, error, isLoading } = useSWR<GeoJSONFeatureCollection>(
        enabled ? '/api/layers/satellites' : null,
        layerFetcher,
        LAYER_CONFIG
    )

    return {
        data: data ?? EMPTY_COLLECTION,
        isLoading,
        error
    }
}

/**
 * Hook for fetching GPS Jamming layer data with SWR caching
 */
export function useGpsJamLayer(enabled: boolean) {
    const { data, error, isLoading } = useSWR<GeoJSONFeatureCollection>(
        enabled ? '/api/layers/gpsjam' : null,
        layerFetcher,
        LAYER_CONFIG
    )

    return {
        data: data ?? EMPTY_COLLECTION,
        isLoading,
        error
    }
}

