'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { GlobeMap } from '@/components/map/GlobeMap'
import { Sidebar } from '@/components/panels/Sidebar'
import { MarketDetails } from '@/components/panels/MarketDetails'
import { ComparisonPanel } from '@/components/panels/ComparisonPanel'
import { CountryOverlay } from '@/components/map/CountryOverlay'
import { BreakingNews } from '@/components/panels/BreakingNews'
import { Market, MarketComparison } from '@/types/market'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [markets, setMarkets] = useState<Market[]>([])
  const [breakingNews, setBreakingNews] = useState<Market[]>([])
  const [livePredictions, setLivePredictions] = useState<Market[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [comparisons, setComparisons] = useState<MarketComparison[]>([])
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [countryMarkets, setCountryMarkets] = useState<Market[]>([])
  const [apiKeysStatus, setApiKeysStatus] = useState<any>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      checkApiKeys()
    }
  }, [status])

  const checkApiKeys = async () => {
    try {
      const response = await fetch('/api/debug/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeysStatus(data)
        console.log('🔑 API Keys Status:', data)
      }
    } catch (error) {
      console.error('Error checking API keys:', error)
    }
  }

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

  // Reload markets when window regains focus (e.g., returning from settings)
  useEffect(() => {
    const handleFocus = () => {
      if (status === 'authenticated') {
        loadMarkets()
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [status])

  const loadMarkets = async () => {
    try {
      setLoading(true)
      console.log('🔄 Loading markets...')
      
      const response = await fetch('/api/markets/all')
      
      if (!response.ok) {
        console.error('❌ Failed to fetch markets:', response.status)
        setMarkets([])
        setBreakingNews([])
        setLivePredictions([])
        setCategories([])
        return
      }

      const data = await response.json()
      console.log('✅ Markets loaded:', data.stats)
      
      setMarkets(data.markets || [])
      setBreakingNews(data.breakingNews || [])
      setLivePredictions(data.livePredictions || [])
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error loading markets:', error)
      setMarkets([])
      setBreakingNews([])
      setLivePredictions([])
      setCategories([])
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
          {apiKeysStatus && (
            <div className="flex items-center gap-2 text-xs">
              {apiKeysStatus.apiKeys.some((k: any) => k.platform === 'polymarket') ? (
                <span className="text-green-500">✓ Polymarket</span>
              ) : (
                <span className="text-muted-foreground">✗ Polymarket</span>
              )}
              {apiKeysStatus.apiKeys.some((k: any) => k.platform === 'kalshi') ? (
                <span className="text-green-500">✓ Kalshi</span>
              ) : (
                <span className="text-muted-foreground">✗ Kalshi</span>
              )}
            </div>
          )}
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
          categories={categories}
          onMarketSelect={setSelectedMarket}
          selectedMarket={selectedMarket}
        />

        {/* Map */}
        <div className="flex-1 relative">
          <BreakingNews
            breakingNews={breakingNews}
            livePredictions={livePredictions}
            onMarketClick={setSelectedMarket}
          />
          <GlobeMap
            markets={markets}
            breakingNews={breakingNews}
            livePredictions={livePredictions}
            onMarketClick={setSelectedMarket}
            onCountryClick={(countryName, countryMarkets) => {
              setSelectedCountry(countryName)
              setCountryMarkets(countryMarkets)
            }}
            selectedMarket={selectedMarket}
          />
          {selectedCountry && (
            <CountryOverlay
              country={selectedCountry}
              markets={countryMarkets}
              onClose={() => {
                setSelectedCountry(null)
                setCountryMarkets([])
              }}
              onMarketClick={setSelectedMarket}
            />
          )}
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

