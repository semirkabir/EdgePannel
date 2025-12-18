'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Zap,
  Bell,
  Star,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Activity,
  DollarSign,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Starfield } from '@/components/edge/Starfield'
import dynamic from 'next/dynamic'

// Video Preview replaced dynamic globe preview

// Feature cards data
const features = [
  {
    icon: Globe,
    title: '3D Globe Visualization',
    description: 'Explore prediction markets on an interactive 3D globe. See where events are happening worldwide with real-time data overlays.',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    icon: TrendingUp,
    title: 'Pluggable Brokers',
    description: 'Connect to any prediction market platform. Currently supporting Polymarket and Kalshi, with more brokers coming soon.',
    color: 'from-green-500 to-emerald-400',
  },
  {
    icon: Zap,
    title: 'Extensible Data Sources',
    description: 'Overlay real-world data on the globe. Weather systems, news events, economic indicators, and custom data sources.',
    color: 'from-yellow-500 to-orange-400',
  },
  {
    icon: Bell,
    title: 'Intelligent Alerts',
    description: 'Set custom alerts for price movements, whale trades, and data events. Get notified when markets hit your targets.',
    color: 'from-purple-500 to-pink-400',
  },
  {
    icon: Activity,
    title: 'Whale Tracking',
    description: 'Monitor large holders and trades in real-time. Identify smart money movements across all platforms.',
    color: 'from-pink-500 to-rose-400',
  },
  {
    icon: BarChart3,
    title: 'Unified Portfolio',
    description: 'Track positions and P&L across all brokers in one dashboard. Cross-platform analytics and arbitrage detection.',
    color: 'from-indigo-500 to-violet-400',
  },
]

// Ticker stats
const tickerStats = [
  { label: 'Active Markets', value: '1,247', change: '+12%' },
  { label: 'Total Volume', value: '$42.3M', change: '+8%' },
  { label: 'Platforms', value: '2', change: null },
  { label: 'Live Traders', value: '15.2K', change: '+15%' },
  { label: 'Market Updates', value: '24/7', change: null },
  { label: 'Avg Response', value: '<100ms', change: null },
]

// Mock trending markets
const trendingMarkets = [
  {
    id: 1,
    platform: 'polymarket',
    category: 'Politics',
    title: 'Will the Fed cut rates in Q1 2025?',
    probability: 0.68,
    change: 5.2,
    volume: 142000,
  },
  {
    id: 2,
    platform: 'kalshi',
    category: 'Economics',
    title: 'S&P 500 to reach new ATH this month?',
    probability: 0.42,
    change: -3.1,
    volume: 89000,
  },
  {
    id: 3,
    platform: 'polymarket',
    category: 'Sports',
    title: 'Lakers to win NBA Championship 2025?',
    probability: 0.15,
    change: 1.8,
    volume: 56000,
  },
]

// Floating stat card component
function FloatingStatCard({ position, delay }: { position: 'top-left' | 'bottom-right'; delay?: string }) {
  const positionClasses = position === 'top-left'
    ? 'top-4 left-4'
    : 'bottom-4 right-4'

  return (
    <div
      className={cn(
        'absolute p-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl animate-float',
        positionClasses
      )}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[#00ff7f]" />
        <span className="text-sm font-mono font-bold text-white tabular-nums">+15.3%</span>
      </div>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">24H Volume</span>
    </div>
  )
}

// Landing market card component
function LandingMarketCard({ market }: { market: typeof trendingMarkets[0] }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/60 backdrop-blur-md p-4 hover:bg-black/70 hover:border-white/20 transition-all duration-300 cursor-pointer">
      {/* Platform badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={cn(
          'text-[10px] font-mono uppercase tracking-wider',
          market.platform === 'polymarket' ? 'text-blue-400' : 'text-green-400'
        )}>
          {market.platform}
        </span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{market.category}</span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-white/90 line-clamp-2 mb-3 group-hover:text-white">
        {market.title}
      </h4>

      {/* Price and stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-2xl font-mono font-bold tabular-nums',
            market.probability >= 0.5 ? 'text-[#00ff7f]' : 'text-[#ff4d4d]'
          )}>
            {Math.round(market.probability * 100)}%
          </span>
          {market.change !== 0 && (
            <span className={cn(
              'flex items-center text-xs font-medium',
              market.change > 0 ? 'text-emerald-400' : 'text-rose-400'
            )}>
              {market.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(market.change)}%
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 font-mono">
          ${(market.volume / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
    </div>
  )
}

// Feature demo card component
function FeatureDemoCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e0f11]/80 backdrop-blur-xl p-6',
        'hover:border-white/20 transition-all duration-500 hover:shadow-lg'
      )}
    >
      {/* Icon and title */}
      <div className="flex items-start gap-4 mb-4">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0',
          feature.color,
          'group-hover:scale-110 transition-transform duration-300'
        )}>
          <feature.icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white mb-1">{feature.title}</h3>
          <p className="text-sm text-gray-400">{feature.description}</p>
        </div>
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
    </div>
  )
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setMounted(true)
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

  return (
    <div className="min-h-screen bg-gray-950 overflow-hidden relative">
      {/* Starfield background */}
      <Starfield starCount={300} />

      {/* Gradient overlay for depth */}
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950/80 pointer-events-none" style={{ zIndex: 2 }} />

      {/* Content layer */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 p-4 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between p-2 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl">
              {/* Logo */}
              <div className="flex items-center gap-0.5 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                <span className="font-serif text-lg italic font-bold text-white tracking-tight">Edge</span>
                <span className="font-sans text-lg font-bold text-white tracking-tighter">Pannel</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Live indicator */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                  <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Live Data</span>
                </div>

                <Link href="/login">
                  <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/10">
                    Sign In
                  </Button>
                </Link>

                <Link href="/register">
                  <Button className="bg-[#00ff7f] hover:bg-[#00cc66] text-black font-bold shadow-[0_0_20px_rgba(0,255,127,0.2)]">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            {/* Centered Hero Content */}
            <div className={cn(
              'text-center mb-12 transition-all duration-1000',
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}>
              {/* Status badges */}
              <div className="inline-flex items-center gap-3 mb-6 flex-wrap justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-dot" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Polymarket</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Kalshi</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0e0f11]/80 backdrop-blur-xl border border-white/5 rounded-full">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">+ More Coming Soon</span>
                </div>
              </div>

              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
                <span className="text-white">One Platform.</span>
                <br />
                <span className="text-white">Every </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff7f] to-blue-400">Market</span>
                <span className="text-white">.</span>
                <br />
                <span className="text-white">Visualized </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Globally</span>
                <span className="text-white">.</span>
              </h1>

              <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
                The unified intelligence platform for prediction markets. Trade across any broker,
                overlay real-world data, and discover insights through geospatial visualization.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/edge">
                  <Button size="lg" className="bg-[#00ff7f] hover:bg-[#00cc66] text-black font-bold px-8 h-14 text-lg shadow-[0_0_30px_rgba(0,255,127,0.3)] rounded-xl">
                    Launch Command Center
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white h-14 px-8 text-lg rounded-xl backdrop-blur-xl">
                    Create Account
                  </Button>
                </Link>
              </div>
            </div>

            {/* Globe Preview Window */}
            <div className={cn(
              'relative max-w-5xl mx-auto transition-all duration-1000 delay-300',
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}>
              {/* Terminal-style frame */}
              <div className="bg-[#0e0f11]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {/* Window header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff4d4d]" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-[#00ff7f]" />
                  </div>
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-widest px-4 py-1 bg-white/5 rounded-full border border-white/10">Intelligence Platform</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                    <span className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Live</span>
                  </div>
                </div>

                {/* Globe embed area - 16:9 aspect ratio */}
                <div className="relative aspect-[16/9] bg-gray-950 overflow-hidden">
                  {/* Hero Video Preview */}
                  <video
                    ref={videoRef}
                    src="/cursorful-video-1766031504324.mp4"
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                  />

                </div>
              </div>

              {/* Glow effect under the window */}
              <div className="absolute -inset-4 -z-10 bg-gradient-to-r from-[#00ff7f]/20 via-blue-500/20 to-[#ff4d4d]/20 blur-3xl rounded-3xl opacity-50" />
            </div>
          </div>
        </section>

        {/* Live Stats Ticker */}
        <section className="relative py-8 border-y border-white/5 bg-black/30 overflow-hidden">
          <div className="flex animate-scroll">
            {[...tickerStats, ...tickerStats].map((stat, i) => (
              <div key={i} className="flex items-center gap-8 px-8 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{stat.label}</span>
                  <span className="text-lg font-mono font-bold text-white tabular-nums">{stat.value}</span>
                  {stat.change && (
                    <span className="text-sm font-medium text-[#00ff7f]">
                      {stat.change}
                    </span>
                  )}
                </div>
                <div className="w-px h-6 bg-white/10" />
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="relative py-24 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-bold uppercase tracking-wider text-blue-400 mb-4">
                <Zap className="w-3 h-3" />
                Platform Capabilities
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                Modular Architecture, Infinite Possibilities
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Built for extensibility. Connect any broker, integrate any data source, visualize everything in real-time.
              </p>
            </div>

            {/* Feature cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature, i) => (
                <FeatureDemoCard key={i} feature={feature} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Trending Markets Preview */}
        <section className="relative py-24 px-6 lg:px-12 bg-gradient-to-b from-transparent to-black/50">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Trending Markets</h2>
                <p className="text-gray-400">Live data from top prediction platforms</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                <span className="text-sm text-emerald-400 font-medium">Updating live</span>
              </div>
            </div>

            {/* Market cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {trendingMarkets.map((market) => (
                <LandingMarketCard key={market.id} market={market} />
              ))}
            </div>

            <div className="text-center">
              <Link href="/edge">
                <Button size="lg" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white rounded-xl">
                  Explore All Markets
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 px-6 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl bg-[#0e0f11]/90 backdrop-blur-xl border border-white/10">
              {/* Grid background pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:2rem_2rem]" />

              {/* Gradient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-r from-[#00ff7f]/20 to-blue-500/20 blur-3xl -translate-y-1/2" />

              <div className="relative p-12 md:p-16 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-6">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Free Access</span>
                </div>

                <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                  See Every Market, From Every Angle
                </h2>

                <p className="text-gray-400 max-w-lg mx-auto mb-8">
                  Connect all your brokers, overlay real-world data, and make decisions with
                  complete intelligence. The platform that brings clarity to prediction markets.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                  <Link href="/register">
                    <Button size="lg" className="bg-[#00ff7f] hover:bg-[#00cc66] text-black font-bold px-8 h-14 text-lg shadow-[0_0_30px_rgba(0,255,127,0.3)] rounded-xl">
                      Create Free Account
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/edge">
                    <Button size="lg" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white h-14 px-8 text-lg rounded-xl">
                      Try Demo First
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Free forever</span>
                  </div>
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

        {/* Footer */}
        <footer className="relative py-12 px-6 lg:px-12 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              {/* Logo */}
              <div className="flex items-center gap-0.5">
                <span className="font-serif text-xl italic font-bold text-white tracking-tight">Edge</span>
                <span className="font-sans text-xl font-bold text-white tracking-tighter">Pannel</span>
              </div>

              {/* Status indicators */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-gray-400">All systems operational</span>
                </div>
                <div className="text-xs text-gray-500">
                  © {new Date().getFullYear()} EdgePannel
                </div>
              </div>

              {/* Links */}
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
                <Link href="#" className="hover:text-white transition-colors">Terms</Link>
                <Link href="#" className="hover:text-white transition-colors">Contact</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
