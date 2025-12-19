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
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Starfield } from '@/components/edge/Starfield'

// Core capabilities with aggressive positioning
const capabilities = [
  {
    icon: Globe,
    title: 'Global Intelligence',
    stat: '195+',
    label: 'Countries Indexed',
    description: 'Geospatial market data across every prediction market',
  },
  {
    icon: Activity,
    title: 'Whale Detection',
    stat: '$2.1B',
    label: 'Tracked Daily',
    description: 'Real-time tracking of large holder movements',
  },
  {
    icon: BarChart3,
    title: 'Cross-Platform',
    stat: '2',
    label: 'Active Brokers',
    description: 'Unified interface for all prediction markets',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    stat: '<100ms',
    label: 'Response Time',
    description: 'Get notified faster than anyone else',
  },
]

// Live market data for terminal display
const liveMarkets = [
  {
    symbol: 'FEDRATE.Q1',
    title: 'Fed Rate Cut Q1 2025',
    price: 68,
    change: 5.2,
    volume: '142k',
    trend: 'up',
  },
  {
    symbol: 'SP500.ATH',
    title: 'S&P 500 New ATH',
    price: 42,
    change: -3.1,
    volume: '89k',
    trend: 'down',
  },
  {
    symbol: 'LAKERS.2025',
    title: 'Lakers NBA Championship',
    price: 15,
    change: 1.8,
    volume: '56k',
    trend: 'up',
  },
]

// System stats
const systemStats = [
  { label: 'MARKETS_LIVE', value: '1,247' },
  { label: 'VOLUME_24H', value: '$42.3M' },
  { label: 'TRADERS_ACTIVE', value: '15.2K' },
  { label: 'DATA_LATENCY', value: '98ms' },
]

// Live market terminal row component
function LiveMarketRow({ market, delay }: { market: typeof liveMarkets[0]; delay: number }) {
  return (
    <div
      className="grid grid-cols-12 gap-4 py-3 px-4 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
      style={{ animationDelay: `${delay * 100}ms` }}
    >
      {/* Symbol */}
      <div className="col-span-3 font-mono text-sm text-[#00ff7f] group-hover:text-white transition-colors">
        <span className="text-white/50 text-xs">▌</span> {market.symbol}
      </div>

      {/* Title */}
      <div className="col-span-4 font-sans text-sm text-white/80 group-hover:text-white transition-colors truncate">
        {market.title}
      </div>

      {/* Price */}
      <div className="col-span-2 text-right font-mono font-bold text-white">
        {market.price}%
      </div>

      {/* Change */}
      <div className="col-span-2 text-right">
        <span className={cn(
          'text-xs font-mono font-bold inline-flex items-center gap-1',
          market.trend === 'up' ? 'text-[#00ff7f]' : 'text-red-500'
        )}>
          {market.trend === 'up' ? '▲' : '▼'} {Math.abs(market.change)}%
        </span>
      </div>

      {/* Volume */}
      <div className="col-span-1 text-right font-mono text-xs text-white/50">
        {market.volume}
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
      {/* Diagonal accent lines */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#00ff7f]/10 to-transparent -translate-y-12 -translate-x-12 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500" />

      <div className="relative z-10">
        {/* Icon */}
        <div className="w-8 h-8 mb-4 text-[#00ff7f] group-hover:text-white transition-colors">
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
  const [activeLiveMarket, setActiveLiveMarket] = useState(0)

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

  // Cycle through live markets
  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      setActiveLiveMarket((prev) => (prev + 1) % liveMarkets.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [mounted])

  return (
    <div className="min-h-screen bg-black overflow-hidden relative font-mono">
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
            <div className="flex items-center gap-1">
              <span className="text-xl font-black text-white tracking-tighter">EDGE</span>
              <span className="text-xl font-black text-[#00ff7f] tracking-tighter">PANNEL</span>
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
                <h1 className="text-6xl lg:text-8xl font-black leading-tight mb-6 tracking-tighter">
                  <span className="text-white block">PREDICTION</span>
                  <span className="text-white block">MARKETS</span>
                  <span className="block">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff7f] to-[#00ff7f]">INTELLIGENCE</span>
                  </span>
                </h1>

                <p className="text-sm text-white/60 max-w-lg font-mono leading-relaxed mb-8">
                  Connect all brokers. Track whales. Visualize globally.
                  <br />
                  <strong className="text-white">One unified platform.</strong>
                </p>

                {/* CTA Buttons - Aggressive style */}
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Link href="/edge">
                    <Button className="text-xs font-black bg-[#00ff7f] hover:bg-white text-black px-6 py-3 border-2 border-[#00ff7f] hover:border-white transition-all">
                      LAUNCH PLATFORM
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="outline" className="text-xs font-black border-2 border-white/30 text-white hover:border-[#00ff7f] hover:text-[#00ff7f] bg-transparent px-6 py-3 transition-all">
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
                  <div className="text-xs font-mono text-[#00ff7f] uppercase tracking-wider mb-4">
                    <span className="inline-block w-2 h-2 bg-[#00ff7f] mr-2 rounded-full animate-pulse" />
                    System Status
                  </div>
                  {systemStats.map((stat) => (
                    <div key={stat.label} className="flex justify-between items-center text-xs font-mono">
                      <span className="text-white/50">{stat.label}</span>
                      <span className="text-white font-bold">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Market Terminal */}
            <div className={cn(
              'relative transition-all duration-1000 delay-300',
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}>
              <div className="border border-white/20 bg-black/80 backdrop-blur overflow-hidden">
                {/* Terminal header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                  <div className="text-xs font-mono text-[#00ff7f] uppercase tracking-wider">
                    <span className="inline-block w-2 h-2 bg-[#00ff7f] mr-2 rounded-full animate-pulse" />
                    MARKET_FEED
                  </div>
                  <div className="text-xs font-mono text-white/40">live_stream: 1247 markets | latency: 98ms</div>
                </div>

                {/* Market rows */}
                <div className="overflow-x-auto">
                  {liveMarkets.map((market, idx) => (
                    <LiveMarketRow key={idx} market={market} delay={idx} />
                  ))}
                </div>

                {/* Terminal footer */}
                <div className="px-4 py-2 border-t border-white/10 bg-black/40">
                  <div className="text-xs font-mono text-white/40">
                    [{new Date().toLocaleTimeString()}] Ready for input | Press '/' to search
                  </div>
                </div>
              </div>

              {/* Glow effect */}
              <div className="absolute -inset-1 -z-10 bg-gradient-to-r from-[#00ff7f]/10 via-transparent to-transparent blur-2xl opacity-50" />
            </div>
          </div>
        </section>

        {/* Capabilities Grid Section */}
        <section className="relative py-32 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <h2 className="text-5xl lg:text-6xl font-black text-white mb-4 tracking-tighter">
                MARKET CAPABILITIES
              </h2>
              <p className="text-sm text-white/60 font-mono max-w-2xl">
                Advanced tools for traders. Cross-platform intelligence. Real-time insights.
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
                    { num: '01', title: 'Connect', desc: 'Link all your prediction market accounts' },
                    { num: '02', title: 'Track', desc: 'Monitor whales, prices, and volume in real-time' },
                    { num: '03', title: 'Visualize', desc: 'See markets on an interactive 3D globe' },
                    { num: '04', title: 'Execute', desc: 'Trade across all platforms from one dashboard' },
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
                  <span>edgepannel --init</span>
                </div>
                <div className="space-y-2 text-white/60">
                  <div>
                    <span className="text-[#00ff7f]">&gt;</span> Connecting to Polymarket...
                  </div>
                  <div>
                    <span className="text-[#00ff7f]">&gt;</span> Connecting to Kalshi...
                  </div>
                  <div>
                    <span className="text-[#00ff7f]">&gt;</span> Loading 1,247 markets
                  </div>
                  <div>
                    <span className="text-[#00ff7f]">&gt;</span> Initializing whale detection
                  </div>
                  <div className="mt-4">
                    <span className="text-[#00ff7f]">✓ Ready</span> System initialized successfully
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
                  READY TO
                  <br />
                  DOMINATE
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff7f] to-[#00ff7f]">PREDICTION</span>
                  <br />
                  MARKETS?
                </h2>

                <p className="text-sm text-white/60 font-mono max-w-2xl mb-8 leading-relaxed">
                  Join traders using EdgePannel to gain an unfair advantage. Track whales. Monitor all platforms. Make smarter trades.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/register">
                    <Button className="text-xs font-black bg-[#00ff7f] hover:bg-white text-black px-8 py-4 border-2 border-[#00ff7f] hover:border-white transition-all">
                      CREATE ACCOUNT
                    </Button>
                  </Link>
                  <Link href="/edge">
                    <Button variant="outline" className="text-xs font-black border-2 border-white/50 text-white hover:border-[#00ff7f] hover:text-[#00ff7f] bg-transparent px-8 py-4 transition-all">
                      VIEW DEMO
                    </Button>
                  </Link>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 space-y-2 text-xs font-mono text-white/40">
                  <div>✓ Free forever • No credit card required</div>
                  <div>✓ Your own API keys • Full data control</div>
                  <div>✓ Real-time market data • 98ms latency</div>
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
                <div className="text-lg font-black text-white mb-2 tracking-tighter">
                  <span>EDGE</span>
                  <span className="text-[#00ff7f]">PANNEL</span>
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
                  <li><Link href="#" className="hover:text-[#00ff7f] transition-colors">Privacy</Link></li>
                  <li><Link href="#" className="hover:text-[#00ff7f] transition-colors">Terms</Link></li>
                  <li><Link href="#" className="hover:text-[#00ff7f] transition-colors">Contact</Link></li>
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
