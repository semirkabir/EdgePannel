'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Globe,
  Activity,
  BarChart3,
  ArrowRight,
  Bell,
  CheckCircle2,
  Search,
  Loader,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Starfield } from '@/components/edge/Starfield'
import { LandingGlobe } from '@/components/landing/LandingGlobe'

// Core capabilities with aggressive positioning
const capabilities = [
  {
    icon: Globe,
    title: 'Global Intelligence',
    stat: '195+',
    label: 'Countries Indexed',
    description: 'Geospatial intelligence across prediction, financial, and news layers',
  },
  {
    icon: Activity,
    title: 'Real-Time News',
    stat: '24/7',
    label: 'Global Coverage',
    description: 'Live geopolitical updates mapped instantaneously to affected regions',
  },
  {
    icon: BarChart3,
    title: 'Multi-Asset Terminal',
    stat: 'All',
    label: 'Unified View',
    description: 'Monitor prediction markets, stocks, calmness indices, and commodities',
  },
  {
    icon: Bell,
    title: 'Custom Layers',
    stat: '∞',
    label: 'User Data',
    description: 'Map your own assets: Oil mills, mines, supply chains, and private infrastructure',
  },
]

// Live market data for terminal display - Mixed Feed
const liveMarkets: any[] = [
  {
    symbol: 'BTC.100K',
    title: 'Bitcoin reaches $100,000 in 2024',
    type: 'PREDICTION',
    price: 64,
    change: 2.4,
    volume: '8.4M',
    trend: 'up',
  },
  {
    symbol: 'NEWS.BREAK',
    title: 'BREAKING: New Trade Agreement Signed in Pacific Region',
    type: 'NEWS',
    price: null,
    change: null,
    volume: 'LIVE',
    trend: 'neutral',
  },
  {
    symbol: 'SPX.5500',
    title: 'S&P 500 Year-End Target',
    type: 'FINANCE',
    price: 58,
    change: 0.8,
    volume: '12.2M',
    trend: 'up',
  },
  {
    symbol: 'CRUDE.OIL',
    title: 'Brent Crude Oil Spot Price',
    type: 'COMMODITY',
    price: 82.40,
    change: -1.5,
    volume: 'Active',
    trend: 'down',
  },
]

// System stats - Dynamic real-time metrics
const systemStats = [
  { label: 'MARKETS_TRACKED', value: '2.5K+', trend: 'up' },
  { label: 'DATA_SOURCES', value: '47', trend: 'stable' },
  { label: 'LIVE_FEEDS', value: '18', trend: 'up' },
  { label: 'SYSTEM_UPTIME', value: '99.8%', trend: 'stable' },
]

// Live market terminal row component
function LiveMarketRow({ market, delay }: { market: any; delay: number }) {
  const isNews = market.type === 'NEWS';
  return (
    <div
      className="grid grid-cols-12 gap-4 py-3 px-4 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
      style={{ animationDelay: `${delay * 100}ms` }}
    >
      {/* Symbol */}
      <div className="col-span-3 font-mono text-sm group-hover:text-white transition-colors">
        <span className={cn(
          "text-xs mr-2",
          isNews ? "text-blue-400" : "text-[#00ff7f]"
        )}>
          {isNews ? 'Found' : 'Vol'}
        </span>
        <span className={cn(
          isNews ? "text-blue-300" : "text-[#00ff7f]"
        )}>{market.symbol}</span>
      </div>

      {/* Title */}
      <div className="col-span-12 sm:col-span-5 font-sans text-sm text-white/80 group-hover:text-white transition-colors truncate">
        {market.title}
      </div>

      {/* Price/Status */}
      <div className="hidden sm:block col-span-2 text-right font-mono font-bold text-white">
        {isNews ? 'Active' : `${market.price}%`}
      </div>

      {/* Change/Trend */}
      <div className="hidden sm:block col-span-2 text-right">
        <span className={cn(
          'text-xs font-mono font-bold inline-flex items-center gap-1',
          market.trend === 'up' ? 'text-[#00ff7f]' : market.trend === 'down' ? 'text-red-500' : 'text-blue-400'
        )}>
          {market.trend === 'up' ? '▲' : market.trend === 'down' ? '▼' : '●'} {market.change ? `${Math.abs(market.change)}%` : 'NOW'}
        </span>
      </div>
    </div>
  )
}

// Capability stat card component
function CapabilityCard({ capability, index }: { capability: typeof capabilities[0]; index: number }) {
  const Icon = capability.icon
  return (
    <div
      className="relative overflow-hidden bg-black border border-white/10 p-6 hover:border-white/30 transition-all duration-300 group"
      style={{
        transform: index % 2 === 0 ? 'skewY(-2deg)' : 'skewY(2deg)',
      }}
    >
      {/* Diagonal accent lines - color varies by index roughly */}
      <div className={cn(
        "absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-transparent to-transparent -translate-y-12 -translate-x-12 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500",
        index === 0 ? "from-[#00ff7f]/10" : index === 1 ? "from-blue-500/10" : "from-purple-500/10"
      )} />

      <div className="relative z-10">
        {/* Icon */}
        <div className={cn(
          "w-8 h-8 mb-4 transition-colors group-hover:text-white",
          index === 0 ? "text-[#00ff7f]" : index === 1 ? "text-blue-400" : index === 2 ? "text-purple-400" : "text-yellow-400"
        )}>
          <Icon className="w-full h-full" />
        </div>

        {/* Big stat */}
        <div className="mb-2">
          <div className="text-3xl font-black text-white font-mono">{capability.stat}</div>
          <div className="text-xs text-white/50 uppercase tracking-widest font-mono">{capability.label}</div>
        </div>

        {/* Title and description */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <h3 className="text-sm font-bold text-white mb-1">{capability.title}</h3>
          <p className="text-xs text-white/50 leading-relaxed">{capability.description}</p>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [topMarkets, setTopMarkets] = useState<any[]>([])
  const [liveStats, setLiveStats] = useState({
    totalMarkets: '2,500+',
    totalVolume: '$50M+',
    tradersActive: '15.2K',
    lastIndexed: 'Just now'
  })
  const [isLoadingTopMarkets, setIsLoadingTopMarkets] = useState(true)
  const [activeLiveMarket, setActiveLiveMarket] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date().toLocaleTimeString())

    // Update time every second for live terminal feel
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(() => { })
          } else {
            videoRef.current?.pause()
          }
        })
      },
      { threshold: 0.3 }
    )

    if (videoRef.current) {
      observer.observe(videoRef.current)
    }

    return () => observer.disconnect()
  }, [mounted])

  // Cycle through live markets
  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      const count = topMarkets.length > 0 ? topMarkets.length : liveMarkets.length
      setActiveLiveMarket((prev) => (prev + 1) % count)
    }, 3000)
    return () => clearInterval(interval)
  }, [mounted, topMarkets.length])

  // Fetch top markets by volume
  useEffect(() => {
    if (!mounted) return

    const fetchTopMarkets = async () => {
      try {
        const response = await fetch('/api/markets/analytics?limit=3&platform=polymarket')
        if (!response.ok) throw new Error('Failed to fetch top markets')
        const data = await response.json()

        if (data.highestVolume && Array.isArray(data.highestVolume)) {
          const formatted = data.highestVolume.map((m: any) => ({
            symbol: m.ticker || (m.slug ? m.slug.split('-')[0].toUpperCase() : 'MARKET'),
            title: m.title,
            price: Math.round(m.currentPrice * 100),
            change: parseFloat(m.priceChangePercent.toFixed(1)),
            volume: m.volume24h > 1000000
              ? `${(m.volume24h / 1000000).toFixed(1)}M`
              : m.volume24h > 1000
                ? `${(m.volume24h / 1000).toFixed(0)}k`
                : m.volume24h.toString(),
            trend: m.priceChangePercent >= 0 ? 'up' : 'down'
          }))
          setTopMarkets(formatted)
        }

        if (data.summary) {
          // Calculate hours ago for last indexed
          let lastIndexedStr = 'Just now';
          if (data.summary.lastSyncAt) {
            const lastSync = new Date(data.summary.lastSyncAt);
            const hoursAgo = Math.floor((new Date().getTime() - lastSync.getTime()) / (1000 * 60 * 60));
            if (hoursAgo === 0) {
              const minsAgo = Math.floor((new Date().getTime() - lastSync.getTime()) / (1000 * 60));
              lastIndexedStr = minsAgo <= 1 ? 'Just now' : `${minsAgo}m ago`;
            } else {
              lastIndexedStr = `${hoursAgo}h ago`;
            }
          }

          setLiveStats({
            totalMarkets: data.summary.totalMarkets.toLocaleString(),
            totalVolume: `$${(data.summary.totalVolume / 1000000).toFixed(1)}M`,
            tradersActive: data.summary.activeTraders ? `${(data.summary.activeTraders / 1000).toFixed(1)}K` : '72.4K',
            lastIndexed: lastIndexedStr
          })
        }
      } catch (error) {
        console.error('Error fetching top markets:', error)
      } finally {
        setIsLoadingTopMarkets(false)
      }
    }

    fetchTopMarkets()
  }, [mounted])

  // Handle search API calls with debouncing
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/markets/search?q=${encodeURIComponent(query)}&limit=8`)
      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()
      setSearchResults(data.markets || [])
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Handle search input change with debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)
  }

  // Handle keyboard shortcut for search (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !showSearch) {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
        setSearchQuery('')
        setSearchResults([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSearch])

  return (
    <div className="min-h-screen bg-black overflow-x-hidden relative font-mono">
      {/* Starfield background */}
      <Starfield starCount={300} />

      {/* Grid background overlay */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" style={{ zIndex: 1 }} />

      {/* Gradient overlay for depth */}
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" style={{ zIndex: 2 }} />

      {/* Content layer */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* Brutal Navigation Bar */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-sm">
          <div className="max-w-full px-6 lg:px-12 py-4 flex items-center justify-between">
            {/* Logo - Aggressive styling */}
            <div className="flex items-center gap-0.5">
              <span className="font-serif text-xl italic font-bold text-white tracking-tight">Edge</span>
              <span className="font-sans text-xl font-bold text-[#00ff7f] tracking-tighter">Pannel</span>
            </div>

            <div className="flex items-center gap-4">
              {/* Live indicator with pulse */}
              <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#00ff7f]">
                <span className="w-2 h-2 rounded-full bg-[#00ff7f] animate-pulse" />
                <span>LIVE</span>
              </div>

              <Link href="/login">
                <Button variant="ghost" className="text-xs font-mono text-white/60 hover:text-white border-0 bg-transparent hover:bg-white/5">
                  SIGN IN
                </Button>
              </Link>

              <Link href="/register">
                <Button className="text-xs font-mono font-black bg-[#00ff7f] hover:bg-white text-black px-4 py-2 border border-[#00ff7f] hover:border-white transition-all">
                  GET ACCESS
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Neo-Brutalist Hero Section */}
        <section className="relative pt-24 pb-32 px-6 lg:px-12 mt-12">
          <div className="max-w-7xl mx-auto">
            {/* Asymmetrical grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
              {/* Left: Aggressive headline */}
              <div className={cn(
                'lg:col-span-2 transition-all duration-1000',
                mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
              )}>
                <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black leading-tight mb-6 tracking-tighter">
                  <span className="text-white block">GLOBAL</span>
                  <span className="text-white block">INTELLIGENCE</span>
                  <span className="block">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff7f] to-[#00ff7f]">TERMINAL</span>
                  </span>
                </h1>

                <p className="text-xs sm:text-sm text-white/60 max-w-lg font-mono leading-relaxed mb-8">
                  The ultimate situational awareness tool.
                  <br />
                  <strong className="text-white">News. Finance. Politics. Prediction Markets.</strong>
                  <br />
                  Map user data, track whales, and visualize the world in real-time.
                </p>

                {/* CTA Buttons - Aggressive style */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4">
                  <Link href="/edge" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto text-xs font-black bg-[#00ff7f] hover:bg-white text-black px-6 py-3 border-2 border-[#00ff7f] hover:border-white transition-all">
                      LAUNCH TERMINAL
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto text-xs font-black border-2 border-white/30 text-white hover:border-[#00ff7f] hover:text-[#00ff7f] bg-transparent px-6 py-3 transition-all">
                      CREATE ACCOUNT
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right: System status */}
              <div className={cn(
                'transition-all duration-1000 delay-200',
                mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
              )}>
                <div className="border border-white/20 bg-black/60 backdrop-blur p-4 space-y-3">
                  <div className="text-xs font-mono text-[#00ff7f] uppercase tracking-wider mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                      <span className="inline-block w-2 h-2 bg-[#00ff7f] mr-2 rounded-full animate-pulse" />
                      System Status
                    </span>
                    <span className="text-[10px] text-white/30">{currentTime}</span>
                  </div>
                  <div className="space-y-3">
                    {systemStats.map((stat, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-mono group hover:bg-white/5 px-2 py-1 -mx-2 transition-colors">
                        <span className="text-white/50 group-hover:text-white/70 transition-colors">
                          {stat.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold">{stat.value}</span>
                          {stat.trend === 'up' && (
                            <span className="text-[#00ff7f] text-[10px]">▲</span>
                          )}
                          {stat.trend === 'stable' && (
                            <span className="text-blue-400 text-[10px]">●</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Globe - full viewport width, outside max-w-7xl */}
          <div className={cn(
            'relative transition-all duration-1000 delay-300',
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          )}>
            {/* Globe container - edge to edge */}
            <div className="relative h-[500px] lg:h-[650px] -mx-6 lg:-mx-12">
              <LandingGlobe className="w-full h-full" />
            </div>

            {/* Subtle status indicator */}
            <div className="absolute bottom-4 right-4 z-20">
              <div className="flex items-center gap-2 text-xs font-mono text-[#00ff7f]/60">
                <span className="inline-block w-1.5 h-1.5 bg-[#00ff7f] rounded-full animate-pulse" />
                LIVE
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Grid Section */}
        <section className="relative py-32 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <h2 className="text-5xl lg:text-6xl font-black text-white mb-4 tracking-tighter">
                INTELLIGENCE LAYERS
              </h2>
              <p className="text-sm text-white/60 font-mono max-w-2xl">
                Multi-domain awareness. Correlate news, financial data, and prediction markets on a single map.
              </p>
            </div>

            {/* Capability cards grid - asymmetrical */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {capabilities.map((capability, i) => (
                <CapabilityCard key={i} capability={capability} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Data Flow Visualization Section */}
        <section className="relative py-32 px-6 lg:px-12 border-y border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left: Feature list */}
              <div className="space-y-6">
                <h2 className="text-4xl font-black text-white tracking-tighter">
                  HOW IT WORKS
                </h2>
                <div className="space-y-4">
                  {[
                    { num: '01', title: 'Connect', desc: 'Plug into global data streams: News, Finance, Prediction Markets' },
                    { num: '02', title: 'Layer', desc: 'Toggle data layers on the 3D globe to find correlations' },
                    { num: '03', title: 'Customize', desc: 'Add your own private data points (factories, assets, POIs)' },
                    { num: '04', title: 'Act', desc: 'Execute trades or make decisions based on holistic intelligence' },
                  ].map((step) => (
                    <div key={step.num} className="flex gap-4 group cursor-pointer">
                      <div className="text-lg font-black text-[#00ff7f] group-hover:text-white transition-colors">
                        {step.num}
                      </div>
                      <div>
                        <h3 className="font-black text-white group-hover:text-[#00ff7f] transition-colors">
                          {step.title}
                        </h3>
                        <p className="text-xs text-white/50 font-mono mt-1">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Code block aesthetic */}
              <div className="border border-white/20 bg-black/60 backdrop-blur p-6 font-mono text-xs leading-relaxed">
                <div className="text-[#00ff7f] mb-4">
                  <span className="text-white/50">$ </span>
                  <span>edgepannel --init-all-layers</span>
                </div>
                <div className="space-y-2 text-white/60">
                  <div>
                    <span className="text-[#00ff7f]">&gt;</span> Syncing Global News Feed... [OK]
                  </div>
                  <div>
                    <span className="text-[#00ff7f]">&gt;</span> Connecting Financial Tickers... [OK]
                  </div>
                  <div>
                    <span className="text-[#00ff7f]">&gt;</span> Loading Prediction Markets... [1,247 OK]
                  </div>
                  <div>
                    <span className="text-[#00ff7f]">&gt;</span> Importing User Custom Data... [READY]
                  </div>
                  <div className="mt-4">
                    <span className="text-[#00ff7f]">✓ Terminal Active</span> Full spectrum dominance established
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section - Aggressive */}
        <section className="relative py-32 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="relative border-2 border-white/30 bg-black/80 backdrop-blur p-12 lg:p-16">
              {/* Diagonal accent */}
              <div className="absolute -top-px -right-px w-32 h-32 border-r-2 border-t-2 border-[#00ff7f]/30" />
              <div className="absolute -bottom-px -left-px w-32 h-32 border-l-2 border-b-2 border-[#00ff7f]/30" />

              <div className="relative z-10 max-w-3xl">
                <h2 className="text-5xl lg:text-6xl font-black text-white mb-6 tracking-tighter leading-tight">
                  READY FOR
                  <br />
                  GLOBAL
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff7f] to-[#00ff7f]">DOMINANCE?</span>
                </h2>

                <p className="text-sm text-white/60 font-mono max-w-2xl mb-8 leading-relaxed">
                  Join the new standard of intelligence. Don&apos;t just predict the market—visualize the world that drives it.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/register">
                    <Button className="text-xs font-black bg-[#00ff7f] hover:bg-white text-black px-8 py-4 border-2 border-[#00ff7f] hover:border-white transition-all">
                      CREATE ACCOUNT
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>No credit card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Your own API keys</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brutalist Footer */}
        <footer className="relative border-t-2 border-white/20 bg-black px-6 lg:px-12 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-0.5 mb-2">
                  <span className="font-serif text-lg italic font-bold text-white tracking-tight">Edge</span>
                  <span className="font-sans text-lg font-bold text-[#00ff7f] tracking-tighter">Pannel</span>
                </div>
                <p className="text-xs text-white/40 font-mono">Prediction market intelligence platform</p>
              </div>

              {/* Product */}
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4">Product</h4>
                <ul className="space-y-2 text-xs text-white/60 font-mono">
                  <li><Link href="/edge" className="hover:text-[#00ff7f] transition-colors">Platform</Link></li>
                  <li><Link href="#" className="hover:text-[#00ff7f] transition-colors">API</Link></li>
                  <li><Link href="#" className="hover:text-[#00ff7f] transition-colors">Docs</Link></li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4">Company</h4>
                <ul className="space-y-2 text-xs text-white/60 font-mono">
                  <li><Link href="#" className="hover:text-[#00ff7f] transition-colors">About</Link></li>
                  <li><Link href="#" className="hover:text-[#00ff7f] transition-colors">Twitter</Link></li>
                  <li><Link href="#" className="hover:text-[#00ff7f] transition-colors">Discord</Link></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4">Legal</h4>
                <ul className="space-y-2 text-xs text-white/60 font-mono">
                  <li><Link href="/privacy" className="hover:text-[#00ff7f] transition-colors">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-[#00ff7f] transition-colors">Terms</Link></li>
                  <li><Link href="/contact" className="hover:text-[#00ff7f] transition-colors">Contact</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-white/40 font-mono">
              <div>© {new Date().getFullYear()} EdgePannel. All systems operational.</div>
              <div className="flex items-center gap-2 mt-4 md:mt-0">
                <span className="w-2 h-2 rounded-full bg-[#00ff7f] animate-pulse" />
                <span>Live</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
