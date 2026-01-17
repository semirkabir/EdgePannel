import { create } from 'zustand'

export type LayerType = string
export type CensusDatasetType = 'population' | 'income' | 'poverty' | 'employment' | 'trade' | null;
export type CensusGeographyType = 'state' | 'county';

interface CustomLayer {
    id: string
    label: string
    color: string
}

interface LayerState {
    activeLayers: LayerType[]
    customLayers: CustomLayer[]
    selectedCensusDataset: CensusDatasetType
    censusGeography: CensusGeographyType
    toggleLayer: (layer: LayerType) => void
    isLayerActive: (layer: LayerType) => boolean
    setLayerActive: (layer: LayerType, active: boolean) => void
    addCustomLayer: (layer: CustomLayer) => void
    removeCustomLayer: (id: string) => void
    setCensusDataset: (dataset: CensusDatasetType) => void
    setCensusGeography: (geography: CensusGeographyType) => void
}

export const useLayerStore = create<LayerState>((set, get) => ({
    activeLayers: ['PREDICTION', 'NEWS', 'FINANCE', 'CONFLICTS'], // 'CUSTOM' removed by default
    customLayers: [],
    selectedCensusDataset: null,
    censusGeography: 'state', // Default to state-level for performance
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
    setCensusDataset: (dataset) =>
        set((state) => ({
            selectedCensusDataset: dataset,
            // Auto-enable CENSUS layer when a dataset is selected
            activeLayers: dataset && !state.activeLayers.includes('CENSUS')
                ? [...state.activeLayers, 'CENSUS']
                : state.activeLayers
        })),
    setCensusGeography: (geography) =>
        set({ censusGeography: geography }),
}))
