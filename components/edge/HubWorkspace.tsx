'use client'

import React, { useState } from 'react'
import { LayoutGrid, Maximize2, Move, Settings2, Trash2, Plus, TrendingUp, Activity, Newspaper, Landmark, Zap } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { WhaleTracker } from '@/components/whales/WhaleTracker'
import { InsightsDashboard } from '@/components/insights/InsightsDashboard'
import { NewsFeed } from '@/components/insights/NewsFeed'
import { MarketRelator } from '@/components/financials/MarketRelator'
import { LiveTicker } from './LiveTicker'

// Assuming MarketType is a type used by MarketRelator or other financial components
// and needs to be defined for potential future use or linting.
type MarketType = 'crypto' | 'stocks' | 'forex' | 'commodities';

type WidgetType = 'whales' | 'movers' | 'news' | 'correlation' | 'summary' | 'ticker'

interface Widget {
    id: string
    type: WidgetType
    x: number
    y: number
    w: number
    h: number
}

export function HubWorkspace() {
    const [widgets, setWidgets] = useState<Widget[]>([
        { id: '1', type: 'ticker', x: 0, y: 0, w: 2, h: 2 },
        { id: '2', type: 'whales', x: 2, y: 0, w: 2, h: 2 },
        { id: '3', type: 'news', x: 0, y: 2, w: 2, h: 2 },
        { id: '4', type: 'correlation', x: 2, y: 2, w: 2, h: 2 },
    ])

    const [isEditing, setIsEditing] = useState(false)

    const removeWidget = (id: string) => {
        setWidgets(widgets.filter(w => w.id !== id))
    }

    return (
        <div className="flex-1 h-full bg-[#0a0b0d] overflow-hidden flex flex-col">
            {/* Workspace Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-blue-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Market Intelligence Workspace</h2>
                    </div>
                    <div className="h-4 w-px bg-white/10" />
                    <span className="text-[10px] font-mono text-gray-500 uppercase">Profile: Analyst_Master_01</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all",
                            isEditing ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                        )}
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        {isEditing ? 'SAVE LAYOUT' : 'EDIT WORKSPACE'}
                    </button>
                    <button className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-500 hover:text-white transition-all">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-4 gap-4 auto-rows-[300px]">
                    {widgets.map(widget => (
                        <div
                            key={widget.id}
                            className={cn(
                                "relative rounded-2xl border border-white/10 bg-black/40 overflow-hidden flex flex-col transition-all group",
                                widget.w === 2 ? "col-span-2" : "col-span-1",
                                widget.h === 2 ? "row-span-2" : "row-span-1",
                                isEditing && "ring-2 ring-blue-500 ring-offset-4 ring-offset-black scale-[0.98]"
                            )}
                        >
                            {/* Widget Header */}
                            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                                <div className="flex items-center gap-2">
                                    {getWidgetIcon(widget.type)}
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getWidgetTitle(widget.type)}</span>
                                </div>
                                {isEditing && (
                                    <button
                                        onClick={() => removeWidget(widget.id)}
                                        className="p-1 hover:bg-red-500/10 rounded transition-colors text-red-500"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Widget Content */}
                            <div className="flex-1 overflow-hidden">
                                {renderWidget(widget.type)}
                            </div>

                            {/* Resize Handle (Visual Only) */}
                            {isEditing && (
                                <div className="absolute bottom-1 right-1 cursor-nwse-resize text-gray-600">
                                    <Maximize2 className="w-3 h-3 rotate-90" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function getWidgetIcon(type: WidgetType) {
    switch (type) {
        case 'whales': return <Zap className="w-3.5 h-3.5 text-blue-400" />
        case 'movers': return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        case 'news': return <Newspaper className="w-3.5 h-3.5 text-orange-400" />
        case 'correlation': return <Landmark className="w-3.5 h-3.5 text-purple-400" />
        case 'summary': return <Landmark className="w-3.5 h-3.5 text-yellow-400" />
        case 'ticker': return <Activity className="w-3.5 h-3.5 text-green-400" />
    }
}

function getWidgetTitle(type: WidgetType) {
    switch (type) {
        case 'whales': return 'Whale Alert Terminal'
        case 'movers': return 'Market Movers'
        case 'news': return 'Intelligence Feed'
        case 'correlation': return 'Cross-Asset Relator'
        case 'summary': return 'Analyst Briefing'
        case 'ticker': return 'Live Trade Stream'
    }
}

function renderWidget(type: WidgetType) {
    switch (type) {
        case 'whales':
            return <div className="h-full transform scale-[0.85] origin-top"><WhaleTracker marketId="All" /></div>
        case 'ticker':
            return <LiveTicker />
        case 'movers':
            return <div className="h-full overflow-y-auto p-4 custom-scrollbar text-white text-xs">
                <div className="space-y-4">
                    {/* Placeholder for Movers since full Insights might be too big */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="text-[10px] text-emerald-400 font-bold mb-1">TOP GAINER</div>
                            <div className="text-sm font-black">BTC/USD</div>
                            <div className="text-xs text-emerald-500">+4.2%</div>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="text-[10px] text-red-400 font-bold mb-1">TOP LOSER</div>
                            <div className="text-sm font-black">ETH/USD</div>
                            <div className="text-xs text-red-500">-2.1%</div>
                        </div>
                    </div>
                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                        <div className="text-[10px] text-blue-400 font-bold mb-2 uppercase">Sentiment Alpha</div>
                        <p className="text-[11px] text-gray-400 italic">&ldquo;Markets are pricing in a 65% probability of a policy shift after the latest news cluster in EMEA.&rdquo;</p>
                    </div>
                </div>
            </div>
        case 'news':
            return <NewsFeed />
        case 'correlation':
            return <div className="h-full transform scale-[0.8] origin-top"><MarketRelator /></div>
        default:
            return <div className="flex items-center justify-center h-full text-gray-600 text-[10px] uppercase font-bold">Module Loading...</div>
    }
}
