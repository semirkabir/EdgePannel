import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EnrichedMarket } from '@/lib/markets/enrich'

interface ResearchNote {
    id: string
    content: string
    timestamp: number
}

interface ResearchStore {
    pinnedMarkets: EnrichedMarket[]
    notes: ResearchNote[]
    summary: string
    pinMarket: (market: EnrichedMarket) => void
    unpinMarket: (marketId: string) => void
    addNote: (content: string) => void
    deleteNote: (id: string) => void
    setSummary: (summary: string) => void
    clearAll: () => void
}

export const useResearchStore = create<ResearchStore>()(
    persist(
        (set) => ({
            pinnedMarkets: [],
            notes: [],
            summary: '',
            pinMarket: (market) => set((state) => ({
                pinnedMarkets: state.pinnedMarkets.find(m => m.id === market.id)
                    ? state.pinnedMarkets
                    : [...state.pinnedMarkets, market]
            })),
            unpinMarket: (marketId) => set((state) => ({
                pinnedMarkets: state.pinnedMarkets.filter(m => m.id !== marketId)
            })),
            addNote: (content) => set((state) => ({
                notes: [{ id: Math.random().toString(36).substr(2, 9), content, timestamp: Date.now() }, ...state.notes]
            })),
            deleteNote: (id) => set((state) => ({
                notes: state.notes.filter(n => n.id !== id)
            })),
            setSummary: (summary) => set({ summary }),
            clearAll: () => set({ pinnedMarkets: [], notes: [], summary: '' })
        }),
        {
            name: 'edge-research-storage'
        }
    )
)
