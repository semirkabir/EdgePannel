'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Zap, TrendingUp, Newspaper, Flame, Landmark, Activity, ArrowRight, ShieldAlert, BookOpen, Layout, Maximize2, Globe, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { EnrichedMarket } from '@/lib/markets/enrich'
import { useSearch } from '@/hooks/use-search'
import { SearchResults } from './SearchResults'

interface CommandCenterProps {
    isOpen: boolean
    onClose: () => void
    onMarketSelect: (market: EnrichedMarket) => void
}

interface TopicInsight {
    topic: string
    markets: EnrichedMarket[]
    news: any[]
    whaleTrades: any[]
    riskScore: number
    summary: string
}

export function CommandCenter({ isOpen, onClose, onMarketSelect }: CommandCenterProps) {
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [activeTab, setActiveTab] = useState<'all' | 'markets' | 'topics' | 'actions'>('all')
    const [topicInsight, setTopicInsight] = useState<TopicInsight | null>(null)
    const [isInsightLoading, setIsInsightLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const { markets: searchResults, isLoading: isSearchLoading } = useSearch({
        q: query,
        limit: 10
    })

    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setTopicInsight(null)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen])

    // Handle Enter to fetch topic insight or select market
    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (query.length > 2) {
                fetchTopicInsight(query)
            }
        }
        if (e.key === 'Escape') {
            onClose()
        }
    }

    const fetchTopicInsight = async (topic: string) => {
        setIsInsightLoading(true)
        try {
            const res = await fetch(`/api/hub/topic?topic=${encodeURIComponent(topic)}`)
            if (res.ok) {
                const data = await res.json()
                setTopicInsight(data)
                setActiveTab('topics')
            }
        } catch (err) {
            console.error('Failed to fetch topic insight', err)
        } finally {
            setIsInsightLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[10vh] px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Main Container */}
            <div className="relative w-full max-w-4xl bg-[#0a0b0d]/90 border border-white/10 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-300">

                {/* Search Header */}
                <div className="p-4 border-b border-white/10 flex items-center gap-4 bg-white/5">
                    <Search className="w-5 h-5 text-blue-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none text-xl text-white placeholder-gray-500 font-medium"
                        placeholder="Search markets, topics (e.g. 'China'), or commands..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500 px-2 py-1 bg-white/5 rounded border border-white/10">ESC</span>
                        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex min-h-[500px] max-h-[70vh] overflow-hidden">

                    {/* Sidebar Tabs */}
                    <div className="w-48 border-r border-white/5 p-2 flex flex-col gap-1 bg-black/20">
                        <TabButton
                            active={activeTab === 'all'}
                            onClick={() => setActiveTab('all')}
                            icon={<Layout className="w-4 h-4" />}
                            label="All Results"
                        />
                        <TabButton
                            active={activeTab === 'topics'}
                            onClick={() => setActiveTab('topics')}
                            icon={<Zap className="w-4 h-4" />}
                            label="Topic Insights"
                            badge={topicInsight ? "1" : undefined}
                        />
                        <TabButton
                            active={activeTab === 'markets'}
                            onClick={() => setActiveTab('markets')}
                            icon={<TrendingUp className="w-4 h-4" />}
                            label="Prediction Markets"
                            badge={searchResults.length > 0 ? String(searchResults.length) : undefined}
                        />
                        <TabButton
                            active={activeTab === 'actions'}
                            onClick={() => setActiveTab('actions')}
                            icon={<Activity className="w-4 h-4" />}
                            label="Quick Actions"
                        />
                    </div>

                    {/* Results Pane */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                        {/* Loading State */}
                        {(isSearchLoading || isInsightLoading) && (
                            <RadarLoader />
                        )}

                        {/* Flash Card (Topic Insight) */}
                        {activeTab === 'topics' && topicInsight && !isInsightLoading && (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                                        <span className="text-blue-400">#</span>
                                        {topicInsight.topic}
                                    </h2>
                                    <div className="px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-3">
                                        <ShieldAlert className="w-5 h-5 text-orange-400" />
                                        <div>
                                            <div className="text-[10px] uppercase font-bold text-orange-400/70 leading-none">Risk Score</div>
                                            <div className="text-xl font-black text-orange-400 leading-none">{topicInsight.riskScore}/100</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 italic text-sm text-gray-300 leading-relaxed">
                                    {topicInsight.summary}
                                </div>

                                {/* Related Markets Grid */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" /> Leading Markets
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {topicInsight.markets.map(market => (
                                            <button
                                                key={market.id}
                                                onClick={() => onMarketSelect(market)}
                                                className="group flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all text-left"
                                            >
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="text-sm font-bold text-white mb-1 line-clamp-1 group-hover:text-blue-400 transition-colors">{market.title}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase">{market.platform} • {market.category}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-white">{((market.price ?? 0) * 100).toFixed(0)}%</div>
                                                    <div className="text-[10px] text-gray-500 italic">Probability</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* News Segment */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Newspaper className="w-4 h-4" /> Intelligence Feed
                                    </h3>
                                    <div className="space-y-3">
                                        {topicInsight.news.map((n, i) => (
                                            <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-200 leading-tight mb-1">{n.title}</p>
                                                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                        <span>{n.source}</span>
                                                        <span>•</span>
                                                        <span>{new Date(n.publishedDate).toLocaleTimeString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Markets List View */}
                        {(activeTab === 'all' || activeTab === 'markets') && !isSearchLoading && !isInsightLoading && (
                            <div className="space-y-4">
                                {searchResults.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {searchResults.map(market => (
                                            <div
                                                key={market.id}
                                                onClick={() => onMarketSelect(market)}
                                                className="group p-4 hover:bg-blue-500/5 cursor-pointer rounded-xl transition-all flex items-center gap-4 border border-transparent hover:border-blue-500/20"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs">
                                                    {market.platform.slice(0, 1).toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-bold text-white mb-1 line-clamp-1 group-hover:text-blue-400 transition-colors">{market.title}</h4>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{market.platform} • {market.category} • Vol: ${market.volume24h?.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-black text-white">{((market.price ?? 0) * 100).toFixed(0)}%</div>
                                                    <div className="text-[9px] text-gray-500 uppercase font-black">Prob</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    !query && (
                                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                            <div className="p-4 rounded-full bg-white/5 border border-white/10 animate-pulse">
                                                <Layout className="w-8 h-8 text-gray-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold mb-1">Central Intelligence Hub</h3>
                                                <p className="text-sm text-gray-500 max-w-xs">Start typing to scan markets, research topics, or execute terminal commands.</p>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {/* Actions Pane */}
                        {activeTab === 'actions' && (
                            <div className="grid grid-cols-2 gap-4">
                                <ActionButton
                                    icon={<Globe className="w-5 h-5" />}
                                    title="/globe"
                                    desc="Switch to Global View"
                                />
                                <ActionButton
                                    icon={<Maximize2 className="w-5 h-5" />}
                                    title="/map"
                                    desc="Switch to Mercator View"
                                />
                                <ActionButton
                                    icon={<Zap className="w-5 h-5" />}
                                    title="/insights"
                                    desc="Open Analytics Dashboard"
                                />
                                <ActionButton
                                    icon={<ArrowRightLeft className="w-5 h-5" />}
                                    title="/financials"
                                    desc="Open Correlation Engine"
                                />
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer Info */}
                <div className="p-3 bg-black/40 border-t border-white/10 flex justify-between items-center text-[10px] font-mono text-gray-600 uppercase tracking-widest">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> {searchResults.length} Markets</span>
                        <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> Active Feed</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span>Press Enter for Topic Insight</span>
                        <span className="text-blue-500/50">Edge Terminal v1.0.4 - Resolved</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function TabButton({ active, icon, label, onClick, badge }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void, badge?: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all",
                active
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            )}
        >
            <div className="flex items-center gap-3">
                {icon}
                <span className="text-xs font-bold">{label}</span>
            </div>
            {badge && <span className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-bold">{badge}</span>}
        </button>
    )
}

function ActionButton({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <button className="flex flex-col gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-left group">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:bg-blue-500/20 group-hover:border-blue-500/50 transition-all w-fit text-gray-400 group-hover:text-blue-400">
                {icon}
            </div>
            <div>
                <div className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">{title}</div>
                <div className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors uppercase tracking-wider font-bold">{desc}</div>
            </div>
        </button>
    )
}

function RadarLoader() {
    const [coords, setCoords] = React.useState({ lat: '34.0522', lng: '-118.2437' })

    React.useEffect(() => {
        const interval = setInterval(() => {
            setCoords({
                lat: (Math.random() * 180 - 90).toFixed(4),
                lng: (Math.random() * 360 - 180).toFixed(4)
            })
        }, 300)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 py-12 select-none w-full">
            {/* CSS Keyframe Animation inject */}
            <style>{`
                @keyframes radar-sweep {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {/* Radar Container */}
            <div className="relative w-32 h-32 rounded-full border border-[#00ff7f]/25 bg-[#00ff7f]/5 flex items-center justify-center overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,127,0.05)]">
                {/* Grid Lines */}
                <div className="absolute inset-3 rounded-full border border-[#00ff7f]/10" />
                <div className="absolute inset-9 rounded-full border border-[#00ff7f]/10" />
                <div className="absolute inset-16 rounded-full border border-[#00ff7f]/15" />
                <div className="absolute inset-24 rounded-full border border-[#00ff7f]/20" />
                <div className="absolute h-full w-[1px] bg-[#00ff7f]/15" />
                <div className="absolute w-full h-[1px] bg-[#00ff7f]/15" />
                
                {/* Sweeper Vector */}
                <div 
                    className="absolute top-0 left-0 w-full h-full rounded-full origin-center animate-[radar-sweep_3s_linear_infinite]"
                    style={{
                        background: "conic-gradient(from 0deg, rgba(0, 255, 127, 0.4) 0deg, rgba(0, 255, 127, 0.1) 60deg, transparent 180deg)"
                    }}
                />
                
                {/* Blinking Targets */}
                <div className="absolute top-1/4 left-1/3 w-1.5 h-1.5 rounded-full bg-[#00ff7f] animate-ping" />
                <div className="absolute top-2/3 right-1/4 w-1 h-1 rounded-full bg-[#00ff7f] animate-[pulse_1.5s_infinite]" />
                <div className="absolute bottom-1/3 left-1/4 w-1.5 h-1.5 rounded-full bg-[#00ff7f] animate-pulse" />
                
                {/* Center Core */}
                <div className="w-2 h-2 rounded-full bg-[#00ff7f] shadow-[0_0_8px_#00ff7f] border border-white/20" />
            </div>

            {/* Monospace Ticking Coordinates */}
            <div className="text-center space-y-1">
                <p className="text-[#00ff7f] font-mono text-xs tracking-widest uppercase font-black animate-pulse">Scanning Geopolitical Signals...</p>
                <p className="text-gray-500 font-mono text-[9px] tracking-wider">
                    SEC_GRID // LAT: {coords.lat}° // LNG: {coords.lng}°
                </p>
            </div>
        </div>
    )
}
