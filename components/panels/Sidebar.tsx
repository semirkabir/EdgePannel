'use client'

import { useState, useMemo, useCallback } from 'react'
import { Market } from '@/types/market'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import * as Tabs from '@radix-ui/react-tabs'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Filter, X } from 'lucide-react'

interface SidebarProps {
  markets: Market[]
  onMarketSelect?: (market: Market) => void
  selectedMarket?: Market | null
  categories?: string[]
}

interface FilterState {
  search: string
  platform: 'all' | 'polymarket' | 'kalshi'
  probabilityMin: number
  probabilityMax: number
  showExpiringSoon: boolean
}

export function Sidebar({ markets, onMarketSelect, selectedMarket, categories = [] }: SidebarProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    platform: 'all',
    probabilityMin: 0,
    probabilityMax: 100,
    showExpiringSoon: false,
  })
  const [showFilters, setShowFilters] = useState(false)

  // Group markets by category
  const marketsByCategory = useMemo(() => {
    const grouped: Record<string, Market[]> = { All: markets }
    
    categories.forEach(cat => {
      grouped[cat] = markets.filter(m => m.normalizedCategory === cat || m.category === cat)
    })
    
    return grouped
  }, [markets, categories])

  // Filter markets based on current filters
  const filteredMarkets = useMemo(() => {
    let filtered = marketsByCategory[activeCategory] || []

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(searchLower) ||
        m.description?.toLowerCase().includes(searchLower) ||
        m.keywords?.some(k => k.includes(searchLower))
      )
    }

    // Platform filter
    if (filters.platform !== 'all') {
      filtered = filtered.filter(m => m.platform === filters.platform)
    }

    // Probability filter
    filtered = filtered.filter(m => {
      if (m.probability === undefined) return true
      const probPercent = m.probability * 100
      return probPercent >= filters.probabilityMin && probPercent <= filters.probabilityMax
    })

    // Expiring soon filter
    if (filters.showExpiringSoon) {
      const now = Date.now()
      const dayInMs = 24 * 60 * 60 * 1000
      filtered = filtered.filter(m => {
        if (!m.endDate) return false
        const endDate = m.endDate instanceof Date ? m.endDate : new Date(m.endDate)
        return endDate.getTime() - now < dayInMs
      })
    }

    return filtered
  }, [marketsByCategory, activeCategory, filters])

  // Virtualization setup
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null)

  const virtualizer = useVirtualizer({
    count: filteredMarkets.length,
    getScrollElement: () => parentRef,
    estimateSize: () => 100,
    overscan: 5,
  })

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      platform: 'all',
      probabilityMin: 0,
      probabilityMax: 100,
      showExpiringSoon: false,
    })
  }, [])

  return (
    <div className="w-80 h-full flex flex-col glass-effect border-r border-border">
      {/* Header with search */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search markets..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-8 pr-8 py-2 bg-background/50 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {filters.search && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-md border border-input hover:bg-accent ${
              showFilters ? 'bg-accent' : ''
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Platform</label>
              <select
                value={filters.platform}
                onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value as any }))}
                className="w-full px-2 py-1 bg-background/50 border border-input rounded-md text-sm"
              >
                <option value="all">All Platforms</option>
                <option value="polymarket">Polymarket</option>
                <option value="kalshi">Kalshi</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Probability: {filters.probabilityMin}% - {filters.probabilityMax}%
              </label>
              <div className="flex gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.probabilityMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, probabilityMin: parseInt(e.target.value) }))}
                  className="flex-1"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.probabilityMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, probabilityMax: parseInt(e.target.value) }))}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="expiring"
                checked={filters.showExpiringSoon}
                onChange={(e) => setFilters(prev => ({ ...prev, showExpiringSoon: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="expiring" className="text-xs text-muted-foreground">
                Expiring in 24h
              </label>
            </div>

            <button
              onClick={clearFilters}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="mt-3 text-xs text-muted-foreground">
          Showing {filteredMarkets.length} of {markets.length} markets
        </div>
      </div>

      {/* Category tabs */}
      <Tabs.Root
        value={activeCategory}
        onValueChange={setActiveCategory}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <Tabs.List className="flex gap-1 px-4 pt-2 border-b border-border overflow-x-auto">
          <Tabs.Trigger
            value="All"
            className="px-3 py-2 text-xs font-medium rounded-t-md border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary transition-colors whitespace-nowrap"
          >
            All ({markets.length})
          </Tabs.Trigger>
          {categories.map(cat => {
            const count = marketsByCategory[cat]?.length || 0
            return (
              <Tabs.Trigger
                key={cat}
                value={cat}
                className="px-3 py-2 text-xs font-medium rounded-t-md border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary transition-colors whitespace-nowrap"
              >
                {cat} ({count})
              </Tabs.Trigger>
            )
          })}
        </Tabs.List>

        {/* Markets list with virtualization */}
        <Tabs.Content value={activeCategory} className="flex-1 overflow-hidden">
          <div
            ref={setParentRef}
            className="h-full overflow-auto"
            style={{ contain: 'strict' }}
          >
            {filteredMarkets.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <p>No markets found</p>
                <p className="text-xs mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const market = filteredMarkets[virtualItem.index]
                  const isSelected = selectedMarket?.id === market.id

                  return (
                    <div
                      key={virtualItem.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <Card
                        className={`m-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-accent'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => onMarketSelect?.(market)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm line-clamp-2">{market.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className="uppercase">{market.platform}</span>
                              {market.isBreakingNews && (
                                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">
                                  BREAKING
                                </span>
                              )}
                              {market.isLivePrediction && (
                                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                                  LIVE
                                </span>
                              )}
                            </div>
                            {market.price !== undefined && (
                              <span className="font-semibold text-foreground">
                                {(market.price * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
