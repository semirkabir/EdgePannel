'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Globe, 
  TrendingUp, 
  Zap, 
  Bell, 
  Star, 
  BarChart3, 
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Play
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// Feature cards data
const features = [
  {
    icon: Globe,
    title: '3D Globe Visualization',
    description: 'Explore prediction markets on an interactive 3D globe. See where events are happening worldwide.',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    icon: TrendingUp,
    title: 'Multi-Platform Data',
    description: 'Aggregate data from Polymarket and Kalshi in one unified interface.',
    color: 'from-green-500 to-emerald-400',
  },
  {
    icon: Zap,
    title: 'Real-Time Updates',
    description: 'Live price feeds and breaking news alerts. Never miss a market movement.',
    color: 'from-yellow-500 to-orange-400',
  },
  {
    icon: Bell,
    title: 'Price Alerts',
    description: 'Set custom alerts for price movements. Get notified when markets hit your targets.',
    color: 'from-purple-500 to-pink-400',
  },
  {
    icon: Star,
    title: 'Watchlist',
    description: 'Track your favorite markets. Add notes and monitor them from one place.',
    color: 'from-pink-500 to-rose-400',
  },
  {
    icon: BarChart3,
    title: 'Portfolio Tracking',
    description: 'Monitor your positions and P&L in real-time. Make informed trading decisions.',
    color: 'from-indigo-500 to-violet-400',
  },
]

const stats = [
  { value: '2', label: 'Platforms' },
  { value: '1000+', label: 'Markets' },
  { value: 'Live', label: 'Data Feed' },
  { value: '24/7', label: 'Access' },
]

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)

  useEffect(() => {
    setMounted(true)
    
    // Auto-rotate features
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % features.length)
    }, 4000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Globe className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">EdgePannel</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button className="gap-2">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 lg:px-12 pt-12 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text */}
            <div className={cn(
              "space-y-8 transition-all duration-1000",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm">Live on Polymarket & Kalshi</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Prediction Markets
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                  Visualized
                </span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg">
                Track, analyze, and trade prediction markets from multiple platforms 
                on an interactive 3D globe. Make smarter decisions with real-time data.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard">
                  <Button size="lg" className="gap-2 w-full sm:w-auto">
                    <Play className="h-4 w-4" />
                    Launch App
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                    Create Account
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-6 pt-8 border-t border-border">
                {stats.map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl font-bold text-primary">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column - Globe Preview */}
            <div className={cn(
              "relative transition-all duration-1000 delay-300",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}>
              <div className="relative aspect-square max-w-lg mx-auto">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-full blur-3xl scale-75" />
                
                {/* Globe placeholder with animated ring */}
                <div className="relative w-full h-full rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 overflow-hidden">
                  {/* Animated longitude lines */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[90%] h-[90%] rounded-full border border-slate-600/50" />
                    <div className="absolute w-[70%] h-[90%] rounded-full border border-slate-600/30" />
                    <div className="absolute w-[45%] h-[90%] rounded-full border border-slate-600/20" />
                  </div>
                  
                  {/* Animated latitude lines */}
                  <div className="absolute inset-0 flex flex-col items-center justify-around py-[15%]">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-full border-t border-slate-600/30" />
                    ))}
                  </div>
                  
                  {/* Animated market dots */}
                  {mounted && [...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-3 h-3 rounded-full bg-primary animate-pulse"
                      style={{
                        top: `${20 + Math.random() * 60}%`,
                        left: `${20 + Math.random() * 60}%`,
                        animationDelay: `${i * 0.3}s`,
                        opacity: 0.6 + Math.random() * 0.4,
                      }}
                    />
                  ))}
                  
                  {/* Center glow */}
                  <div className="absolute inset-0 bg-gradient-radial from-primary/10 to-transparent" />
                </div>
                
                {/* Floating cards */}
                <div className="absolute -top-4 -right-4 p-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-xl animate-bounce" style={{ animationDuration: '3s' }}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium">+12.5%</span>
                  </div>
                </div>
                
                <div className="absolute -bottom-4 -left-4 p-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-xl animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Alert triggered</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-6 lg:px-12 py-24 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400"> Trade Smarter</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Powerful tools and real-time data to help you navigate the world of prediction markets.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className={cn(
                  "group relative p-6 rounded-xl border border-border bg-background/50 backdrop-blur-sm",
                  "hover:border-primary/50 transition-all duration-300",
                  "hover:shadow-lg hover:shadow-primary/5",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{ transitionDelay: `${i * 100}ms` }}
                onMouseEnter={() => setActiveFeature(i)}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                  "bg-gradient-to-br",
                  feature.color,
                  "group-hover:scale-110 transition-transform duration-300"
                )}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
                
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" 
                  style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} 
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 lg:px-12 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-8 md:p-12 rounded-2xl bg-gradient-to-br from-primary/10 via-background to-blue-500/10 border border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Start Trading?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Join thousands of traders using EdgePannel to discover and trade prediction markets.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                  Explore Demo
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Free to use
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Your own API keys
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 lg:px-12 py-8 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">EdgePannel</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} EdgePannel. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

