'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GlobeMap } from '@/components/map/GlobeMap'
import { Sidebar } from '@/components/panels/Sidebar'
import { MarketDetails } from '@/components/panels/MarketDetails'
import { ComparisonPanel } from '@/components/panels/ComparisonPanel'
import { CountryOverlay } from '@/components/map/CountryOverlay'
import { BreakingNews } from '@/components/panels/BreakingNews'
import { WatchlistPanel } from '@/components/panels/WatchlistPanel'
import { PortfolioPanel, PortfolioMiniStats } from '@/components/panels/PortfolioPanel'
import { Market } from '@/types/market'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'
import { AsyncErrorBoundary, CompactErrorBoundary } from '@/components/error-boundary'
import { useMarkets, useComparisons, useApiKeys } from '@/hooks/use-markets'
import { useKeyboardShortcuts, SHORTCUTS } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsDialog } from '@/components/ui/keyboard-shortcuts-dialog'
import { useWatchlist } from '@/hooks/use-watchlist'
import { usePriceAlerts } from '@/hooks/use-price-alerts'
import { 
  SkeletonSidebar, 
  SkeletonBreakingNews, 
  SkeletonGlobe,
  SkeletonDashboard 
} from '@/components/ui/skeleton'
import { RefreshCw, Keyboard, Star, Briefcase } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NotificationCenter, NotificationBell } from '@/components/panels/NotificationCenter'
import { SkipLink } from '@/components/ui/skip-link'

// Check if auth is enabled (can be disabled for development)
const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED !== 'true'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // SWR hooks for data fetching with caching
  const { 
    markets, 
    breakingNews, 
    livePredictions, 
    categories, 
    isLoading: marketsLoading,
    isValidating: marketsValidating,
    refresh: refreshMarkets 
  } = useMarkets()
  
  const { 
    comparisons, 
    isLoading: comparisonsLoading 
  } = useComparisons()
  
  const { 
    hasPolymarket, 
    hasKalshi,
    isLoading: apiKeysLoading 
  } = useApiKeys()

  // Local state for UI interactions
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [countryMarkets, setCountryMarkets] = useState<Market[]>([])
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  // Feature hooks
  const { watchlist, watchlistCount, getWatchlistMarkets } = useWatchlist()
  const { checkAlerts, activeAlertCount, triggeredAlertCount } = usePriceAlerts()
  
  // WebSocket for real-time updates (Polymarket works without keys, Kalshi requires keys)
  // Note: For security, Kalshi WebSocket should use a server-side proxy
  // For now, we'll use it for Polymarket only, or implement server-side WebSocket proxy
  const watchlistMarketIds = watchlist.map(item => item.marketId)

  // URL params for sharing
  const searchParams = useSearchParams()

  // Check for shared market in URL
  useEffect(() => {
    const marketId = searchParams.get('market')
    const platform = searchParams.get('platform')
    
    if (marketId && platform && markets.length > 0) {
      const market = markets.find(m => m.id === marketId && m.platform === platform)
      if (market) {
        setSelectedMarket(market)
      }
    }
  }, [searchParams, markets])

  // Check price alerts whenever markets update
  useEffect(() => {
    if (markets.length > 0) {
      checkAlerts(markets)
    }
  }, [markets, checkAlerts])

  // Auth state handling
  const isAuthenticated = AUTH_ENABLED ? status === 'authenticated' : true
  const isAuthLoading = AUTH_ENABLED ? status === 'loading' : false

  // Navigate between markets
  const selectMarketByIndex = (direction: 'next' | 'prev') => {
    if (markets.length === 0) return
    
    const currentIndex = selectedMarket 
      ? markets.findIndex(m => m.id === selectedMarket.id)
      : -1
    
    let newIndex: number
    if (direction === 'next') {
      newIndex = currentIndex < markets.length - 1 ? currentIndex + 1 : 0
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : markets.length - 1
    }
    
    setSelectedMarket(markets[newIndex])
  }

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      ...SHORTCUTS.SEARCH,
      callback: () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        searchInput?.focus()
      },
    },
    {
      ...SHORTCUTS.CLOSE,
      callback: () => {
        if (showShortcutsDialog) {
          setShowShortcutsDialog(false)
        } else if (showNotifications) {
          setShowNotifications(false)
        } else if (showWatchlist) {
          setShowWatchlist(false)
        } else if (showPortfolio) {
          setShowPortfolio(false)
        } else if (selectedMarket) {
          setSelectedMarket(null)
        } else if (selectedCountry) {
          setSelectedCountry(null)
          setCountryMarkets([])
        }
      },
    },
    {
      ...SHORTCUTS.REFRESH,
      callback: () => refreshMarkets(),
    },
    {
      ...SHORTCUTS.SETTINGS,
      callback: () => router.push('/dashboard/settings'),
    },
    {
      ...SHORTCUTS.HELP,
      callback: () => setShowShortcutsDialog(true),
    },
    {
      ...SHORTCUTS.NEXT_MARKET,
      callback: () => selectMarketByIndex('next'),
    },
    {
      ...SHORTCUTS.PREV_MARKET,
      callback: () => selectMarketByIndex('prev'),
    },
    {
      key: 'w',
      label: 'Watchlist',
      description: 'Open watchlist',
      callback: () => setShowWatchlist(true),
    },
    {
      key: 'p',
      label: 'Portfolio',
      description: 'Open portfolio',
      callback: () => setShowPortfolio(true),
    },
    {
      key: 'n',
      label: 'Notifications',
      description: 'Open notifications',
      callback: () => setShowNotifications(true),
    },
  ], [selectedMarket, selectedCountry, showShortcutsDialog, showWatchlist, showPortfolio, showNotifications, markets, refreshMarkets, router])

  useKeyboardShortcuts(shortcuts)

  // Redirect to login if not authenticated
  if (AUTH_ENABLED && status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  // Show full skeleton while auth is loading
  if (isAuthLoading) {
    return <SkeletonDashboard />
  }

  // Don't render if not authenticated (while redirecting)
  if (AUTH_ENABLED && !session) {
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Skip Links for Accessibility */}
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#market-list">Skip to market list</SkipLink>

      {/* Header */}
      <header className="glass-effect border-b border-border p-4 flex justify-between items-center" role="banner">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">EdgePannel</h1>
          {marketsValidating && !marketsLoading && (
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {/* Portfolio mini stats */}
          <div className="hidden md:block">
            <PortfolioMiniStats markets={markets} />
          </div>

          {/* Watchlist button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowWatchlist(true)}
            className="gap-1 relative"
            title="Watchlist (W)"
          >
            <Star className="h-4 w-4" />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full text-[10px] font-bold flex items-center justify-center text-black">
                {watchlistCount}
              </span>
            )}
            <span className="hidden lg:inline">Watchlist</span>
          </Button>

          {/* Portfolio button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPortfolio(true)}
            className="gap-1"
            title="Portfolio (P)"
          >
            <Briefcase className="h-4 w-4" />
            <span className="hidden lg:inline">Portfolio</span>
          </Button>

          {/* Notification bell */}
          <NotificationBell onClick={() => setShowNotifications(true)} />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* API Keys Status */}
          {!apiKeysLoading && (
            <div className="hidden lg:flex items-center gap-2 text-xs">
              {hasPolymarket ? (
                <span className="text-green-500">✓ Polymarket</span>
              ) : (
                <span className="text-muted-foreground">✗ Polymarket</span>
              )}
              {hasKalshi ? (
                <span className="text-green-500">✓ Kalshi</span>
              ) : (
                <span className="text-muted-foreground">✗ Kalshi</span>
              )}
            </div>
          )}
          
          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshMarkets()}
            disabled={marketsValidating}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${marketsValidating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Keyboard shortcuts button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShortcutsDialog(true)}
            className="gap-2 hidden sm:flex"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/settings')}
            className="hidden md:inline-flex"
          >
            Settings
          </Button>
          
          <span className="text-sm text-muted-foreground hidden lg:block">
            {AUTH_ENABLED ? session?.user?.email : 'Auth Disabled (Dev Mode)'}
          </span>
          
          {AUTH_ENABLED && (
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 flex overflow-hidden" role="main">
        {/* Sidebar */}
        <nav id="market-list" aria-label="Market list">
        <CompactErrorBoundary>
          {marketsLoading ? (
            <SkeletonSidebar />
          ) : (
            <Sidebar
              markets={markets}
              categories={categories}
              onMarketSelect={setSelectedMarket}
              selectedMarket={selectedMarket}
            />
          )}
        </CompactErrorBoundary>
        </nav>

        {/* Map Area */}
        <div className="flex-1 relative">
          {/* Breaking News Banner */}
          <CompactErrorBoundary>
            {marketsLoading ? (
              <SkeletonBreakingNews />
            ) : (
              <BreakingNews
                breakingNews={breakingNews}
                livePredictions={livePredictions}
                onMarketClick={setSelectedMarket}
              />
            )}
          </CompactErrorBoundary>
          
          {/* Globe Map */}
          <AsyncErrorBoundary>
            {marketsLoading ? (
              <SkeletonGlobe />
            ) : (
              <GlobeMap
                markets={markets}
                breakingNews={breakingNews}
                livePredictions={livePredictions}
                onMarketClick={setSelectedMarket}
                onCountryClick={(countryName, markets) => {
                  setSelectedCountry(countryName)
                  setCountryMarkets(markets)
                }}
                selectedMarket={selectedMarket}
              />
            )}
          </AsyncErrorBoundary>
          
          {/* Country Overlay */}
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
        <aside aria-label="Market details">
        <CompactErrorBoundary>
          <MarketDetails
            market={selectedMarket}
            onClose={() => setSelectedMarket(null)}
          />
        </CompactErrorBoundary>
        </aside>
      </main>

      {/* Comparison Panel */}
      {!comparisonsLoading && comparisons.length > 0 && (
        <CompactErrorBoundary>
          <ComparisonPanel
            comparisons={comparisons}
            onMarketSelect={(marketId) => {
              const market = markets.find(m => m.id === marketId)
              if (market) setSelectedMarket(market)
            }}
          />
        </CompactErrorBoundary>
      )}

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog 
        open={showShortcutsDialog} 
        onOpenChange={setShowShortcutsDialog} 
      />

      {/* Watchlist Panel */}
      <WatchlistPanel
        markets={markets}
        onMarketSelect={setSelectedMarket}
        isOpen={showWatchlist}
        onClose={() => setShowWatchlist(false)}
      />

      {/* Portfolio Panel */}
      <PortfolioPanel
        markets={markets}
        onMarketSelect={setSelectedMarket}
        isOpen={showPortfolio}
        onClose={() => setShowPortfolio(false)}
      />

      {/* Notification Center */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onMarketSelect={(marketId, platform) => {
          const market = markets.find(m => m.id === marketId && m.platform === platform)
          if (market) setSelectedMarket(market)
        }}
      />
    </div>
  )
}
