'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { GlobeMap } from '@/components/map/GlobeMap'
import { Sidebar } from '@/components/panels/Sidebar'
import { MarketDetails } from '@/components/panels/MarketDetails'
import { ComparisonPanel } from '@/components/panels/ComparisonPanel'
import { Market, MarketComparison } from '@/types/market'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [markets, setMarkets] = useState<Market[]>([])
  const [comparisons, setComparisons] = useState<MarketComparison[]>([])
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      loadMarkets()
      loadComparisons()
    }
  }, [status])

  const loadMarkets = async () => {
    try {
      setLoading(true)
      const [polymarketRes, kalshiRes] = await Promise.allSettled([
        fetch('/api/markets/polymarket'),
        fetch('/api/markets/kalshi'),
      ])

      const allMarkets: Market[] = []

      if (polymarketRes.status === 'fulfilled' && polymarketRes.value.ok) {
        const data = await polymarketRes.value.json()
        allMarkets.push(...(data.markets || []))
      }

      if (kalshiRes.status === 'fulfilled' && kalshiRes.value.ok) {
        const data = await kalshiRes.value.json()
        allMarkets.push(...(data.markets || []))
      }

      // Add mock locations for demonstration
      const marketsWithLocations = allMarkets.map((market, index) => ({
        ...market,
        location: market.location || {
          country: 'United States',
          region: index % 2 === 0 ? 'East Coast' : 'West Coast',
          city: index % 2 === 0 ? 'Washington, DC' : 'San Francisco, CA',
          coordinates: {
            lat: index % 2 === 0 ? 38.9072 : 37.7749,
            lng: index % 2 === 0 ? -77.0369 : -122.4194,
          },
        },
      }))

      setMarkets(marketsWithLocations)
    } catch (error) {
      console.error('Error loading markets:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadComparisons = async () => {
    try {
      const response = await fetch('/api/markets/compare')
      if (response.ok) {
        const data = await response.json()
        setComparisons(data.comparisons || [])
      }
    } catch (error) {
      console.error('Error loading comparisons:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="glass-effect border-b border-border p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Prediction Markets Map</h1>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/settings')}
          >
            Settings
          </Button>
          <span className="text-sm text-muted-foreground">{session.user?.email}</span>
          <Button variant="outline" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          markets={markets}
          onMarketSelect={setSelectedMarket}
          selectedMarket={selectedMarket}
        />

        {/* Map */}
        <div className="flex-1 relative">
          <GlobeMap
            markets={markets}
            onMarketClick={setSelectedMarket}
            selectedMarket={selectedMarket}
          />
        </div>

        {/* Market Details Panel */}
        <MarketDetails
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
        />
      </div>

      {/* Comparison Panel */}
      {comparisons.length > 0 && (
        <ComparisonPanel
          comparisons={comparisons}
          onMarketSelect={(marketId) => {
            const market = markets.find(m => m.id === marketId)
            if (market) setSelectedMarket(market)
          }}
        />
      )}
    </div>
  )
}

