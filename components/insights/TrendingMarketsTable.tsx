import React, { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { TrendingUp, TrendingDown, Flame, ExternalLink } from 'lucide-react';

interface TrendingMarket {
    id: string;
    title: string;
    platform?: string;
    category?: string;
    price: number;
    volume24h: number;
    liquidity?: number;
    priceChangePercent: number;
    priceHistory: number[];
    outcomeCount: number;
    endDate?: string;
}

interface TrendingMarketsTableProps {
    markets: TrendingMarket[];
    onMarketSelect: (market: any) => void;
    className?: string;
}

function formatVolume(volume: number): string {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume.toFixed(0)}`;
}

export function TrendingMarketsTable({ markets, onMarketSelect, className }: TrendingMarketsTableProps) {
    const [hoveredMarketId, setHoveredMarketId] = useState<string | null>(null);

    return (
        <div className={cn("w-full h-full flex flex-col", className)}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white">Trending Markets</h3>
                    <span className="text-[10px] text-gray-500 font-mono">({markets.length})</span>
                </div>
                <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">By 24h Volume</div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 py-2 border-b border-white/5 bg-[#0e0f11]">
                <div className="col-span-5">Market</div>
                <div className="col-span-2 text-center">Weekly</div>
                <div className="col-span-2 text-right">Yes Price</div>
                <div className="col-span-1 text-right">24h</div>
                <div className="col-span-2 text-right">Volume</div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {markets.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-xs">
                        Loading markets...
                    </div>
                ) : (
                    markets.map((market, idx) => (
                        <div
                            key={market.id || idx}
                            onClick={() => onMarketSelect(market)}
                            onMouseEnter={() => setHoveredMarketId(market.id)}
                            onMouseLeave={() => setHoveredMarketId(null)}
                            className={cn(
                                "grid grid-cols-12 gap-2 items-center px-3 py-3 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 group",
                                hoveredMarketId === market.id && "bg-white/5"
                            )}
                        >
                            {/* Market Name + Platform + Category */}
                            <div className="col-span-5 flex items-start gap-3 overflow-hidden">
                                <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-500/10 shrink-0 mt-0.5">
                                    <span className="text-[9px] font-black text-blue-500">P</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-gray-200 truncate group-hover:text-white transition-colors">
                                        {market.title}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-bold px-1 py-0.5 bg-purple-500/20 text-purple-300 rounded uppercase tracking-wider">
                                            {market.category || 'General'}
                                        </span>
                                        {/* Probability bar */}
                                        <div className="flex items-center gap-1 flex-1 max-w-[100px]">
                                            <div className="h-1 flex-1 bg-gray-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 rounded-full transition-all"
                                                    style={{ width: `${Math.min(100, Math.max(0, market.price * 100))}%` }}
                                                />
                                            </div>
                                            <span className="text-[9px] text-gray-400 tabular-nums font-mono">
                                                {(market.price * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Chart (Sparkline) */}
                            <div className="col-span-2 h-8 flex items-center justify-center">
                                {market.priceHistory && market.priceHistory.length > 0 && (
                                    <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none" className="overflow-visible">
                                        <path
                                            d={(() => {
                                                const max = Math.max(...market.priceHistory);
                                                const min = Math.min(...market.priceHistory);
                                                const range = max - min || 1;
                                                return market.priceHistory.map((p, i) => {
                                                    const x = (i / (market.priceHistory.length - 1)) * 100;
                                                    const y = 40 - ((p - min) / range) * 36;
                                                    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                                                }).join(' ');
                                            })()}
                                            fill="none"
                                            stroke={market.priceChangePercent >= 0 ? "#10b981" : "#ef4444"}
                                            strokeWidth="1.5"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    </svg>
                                )}
                            </div>

                            {/* Yes Price (displayed as cents) */}
                            <div className="col-span-2 text-right">
                                <div className={cn(
                                    "text-sm font-bold tabular-nums font-mono",
                                    market.price >= 0.5 ? "text-green-400" : "text-white"
                                )}>
                                    {(market.price * 100).toFixed(1)}¢
                                </div>
                                <div className="text-[9px] text-gray-500 tabular-nums font-mono">
                                    No: {((1 - market.price) * 100).toFixed(1)}¢
                                </div>
                            </div>

                            {/* 24h Change */}
                            <div className="col-span-1 text-right">
                                <div className={cn(
                                    "text-xs font-bold tabular-nums flex items-center justify-end gap-0.5",
                                    market.priceChangePercent >= 0 ? "text-green-400" : "text-red-400"
                                )}>
                                    {market.priceChangePercent >= 0 ? (
                                        <TrendingUp className="w-2.5 h-2.5" />
                                    ) : (
                                        <TrendingDown className="w-2.5 h-2.5" />
                                    )}
                                    {Math.abs(market.priceChangePercent).toFixed(1)}%
                                </div>
                            </div>

                            {/* Volume */}
                            <div className="col-span-2 text-right">
                                <div className="text-xs font-bold text-gray-300 tabular-nums font-mono">
                                    {formatVolume(market.volume24h)}
                                </div>
                                {market.liquidity && market.liquidity > 0 && (
                                    <div className="text-[9px] text-gray-600 tabular-nums">
                                        Liq: {formatVolume(market.liquidity)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <button className="py-3 text-[10px] font-bold uppercase tracking-widest text-center text-gray-500 hover:text-white transition-colors border-t border-white/5 flex items-center justify-center gap-2 hover:bg-white/5">
                View All Markets <ExternalLink className="w-3 h-3" />
            </button>
        </div>
    );
}
