import { create } from 'zustand'

export type LayerType = string

interface CustomLayer {
    id: string
    label: string
    color: string
}

interface LayerState {
    activeLayers: LayerType[]
    customLayers: CustomLayer[]
    toggleLayer: (layer: LayerType) => void
    isLayerActive: (layer: LayerType) => boolean
    setLayerActive: (layer: LayerType, active: boolean) => void
    addCustomLayer: (layer: CustomLayer) => void
    removeCustomLayer: (id: string) => void
}

export const useLayerStore = create<LayerState>((set, get) => ({
    activeLayers: ['PREDICTION', 'NEWS', 'FINANCE'], // 'CUSTOM' removed by default
    customLayers: [],
    toggleLayer: (layer) =>
        set((state) => ({
            activeLayers: state.activeLayers.includes(layer)
                ? state.activeLayers.filter((l) => l !== layer)
                : [...state.activeLayers, layer],
        })),
    isLayerActive: (layer) => get().activeLayers.includes(layer),
    setLayerActive: (layer, active) =>
        set((state) => ({
            activeLayers: active
                ? [...state.activeLayers, layer]
                : state.activeLayers.filter((l) => l !== layer),
        })),
    addCustomLayer: (layer) =>
        set((state) => ({
            customLayers: [...state.customLayers, layer],
            activeLayers: [...state.activeLayers, layer.id] // Auto-activate on add
        })),
    removeCustomLayer: (id) =>
        set((state) => ({
            customLayers: state.customLayers.filter((l) => l.id !== id),
            activeLayers: state.activeLayers.filter((l) => l !== id)
        })),
}))
