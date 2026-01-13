import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { Twitter, ExternalLink, Activity, Info, TrendingUp, TrendingDown } from 'lucide-react';

interface ActivityItem {
    id: string;
    type: 'trade' | 'news' | 'social';
    marketName: string;
    side?: 'buy' | 'sell';
    amount?: number;
    price?: number;
    source?: string;
    content?: string;
    timestamp: Date;
    url?: string;
    sentiment?: 'bullish' | 'bearish' | 'neutral';
}

interface ActivityFeedProps {
    items: ActivityItem[];
    className?: string;
}

function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'now';
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    return `${Math.floor(diffSec / 86400)}d`;
}

function formatAmount(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(0)}`;
}

export function ActivityFeed({ items, className }: ActivityFeedProps) {
    const [activeTab, setActiveTab] = useState<'ALL' | 'WHALES' | 'TOP' | 'RECENT'>('ALL');
    const [, setTick] = useState(0);

    // Force re-render every second to update timestamps
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    // Filter trades based on tab
    const filteredTrades = items.filter(i => {
        if (i.type !== 'trade') return false;
        if (activeTab === 'WHALES') return (i.amount || 0) >= 10000;
        if (activeTab === 'TOP') return (i.amount || 0) >= 5000;
        return true;
    });

    const newsItems = items.filter(i => i.type !== 'trade');

    return (
        <div className={cn("flex flex-col h-full bg-[#0e0f11]", className)}>
            {/* Header */}
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white">Live Activity</h3>
                </div>
                <div className="px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/30 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">
                        {filteredTrades.length} trades
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5">
                {['ALL', 'WHALES', 'TOP', 'RECENT'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={cn(
                            "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors relative",
                            activeTab === tab ? "text-green-400 bg-green-500/5" : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        {tab}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400" />
                        )}
                    </button>
                ))}
            </div>

            {/* List Header */}
            <div className="grid grid-cols-12 gap-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider px-3 py-2 border-b border-white/5 bg-[#0e0f11]/50">
                <div className="col-span-1"></div>
                <div className="col-span-6">Market</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Size</div>
                <div className="col-span-1 text-right">Time</div>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                {filteredTrades.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-gray-500 text-xs">
                        Waiting for trades...
                    </div>
                ) : (
                    filteredTrades.slice(0, 50).map((item, idx) => (
                        <div
                            key={item.id || idx}
                            className={cn(
                                "grid grid-cols-12 gap-1 items-center px-3 py-2 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group",
                                idx === 0 && "bg-green-500/5 animate-pulse-once"
                            )}
                        >
                            <div className="col-span-1">
                                <div className={cn(
                                    "w-5 h-5 rounded text-[9px] font-black flex items-center justify-center",
                                    item.side === 'buy'
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-red-500/20 text-red-400"
                                )}>
                                    {item.side === 'buy' ? (
                                        <TrendingUp className="w-3 h-3" />
                                    ) : (
                                        <TrendingDown className="w-3 h-3" />
                                    )}
                                </div>
                            </div>
                            <div className="col-span-6 min-w-0">
                                <div className="text-[11px] font-bold text-gray-300 truncate group-hover:text-white transition-colors">
                                    {item.marketName}
                                </div>
                            </div>
                            <div className="col-span-2 text-right">
                                <span className={cn(
                                    "text-[11px] font-mono font-bold",
                                    item.side === 'buy' ? "text-green-400" : "text-red-400"
                                )}>
                                    {((item.price || 0) * 100).toFixed(0)}¢
                                </span>
                            </div>
                            <div className="col-span-2 text-right text-[11px] font-mono font-bold text-white">
                                {formatAmount(item.amount || 0)}
                            </div>
                            <div className="col-span-1 text-right text-[9px] text-gray-500 tabular-nums">
                                {formatTimeAgo(item.timestamp)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* OSINT / Social Lower Half */}
            {newsItems.length > 0 && (
                <div className="border-t border-white/10 max-h-[200px] overflow-y-auto">
                    <div className="flex items-center gap-2 bg-[#0a0b0d] px-3 py-2 border-b border-white/5 sticky top-0">
                        <Info className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">OSINT Feed</span>
                    </div>

                    {newsItems.slice(0, 5).map((item, idx) => (
                        <div key={item.id || idx} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors group">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <Info className="w-3.5 h-3.5 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                                            {item.marketName}
                                        </span>
                                        <span className="text-[9px] text-gray-600 tabular-nums whitespace-nowrap ml-2">
                                            {formatTimeAgo(item.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 leading-relaxed mb-2 line-clamp-2">
                                        {item.content}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-bold flex items-center gap-1">
                                            <Twitter className="w-2.5 h-2.5" /> {item.source || 'Twitter'}
                                        </div>
                                        {item.sentiment && (
                                            <div className={cn(
                                                "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                                item.sentiment === 'bullish' ? "bg-green-500/10 text-green-400" :
                                                    item.sentiment === 'bearish' ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"
                                            )}>
                                                {item.sentiment}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
