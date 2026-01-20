'use client'

import { useEffect } from 'react'

/**
 * Zero-UI component that preloads heavy assets on mount.
 * Include this in the root layout to start loading textures and data early.
 */
export function PreloadAssets() {
    useEffect(() => {
        // Preload globe textures (starts fetching earth texture from CDN)
        import('@/lib/globe-textures').then(({ preloadGlobeTextures }) => {
            preloadGlobeTextures()
        })

        // Preload GeoJSON (839KB countries data)
        import('@/lib/geojson-loader').then(({ loadGeoJSON }) => {
            loadGeoJSON()
        })
    }, [])

    return null
}
