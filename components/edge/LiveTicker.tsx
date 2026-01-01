'use client'

import React, { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Circle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Trade {
    id: string
    market: string
    type: 'buy' | 'sell'
    outcome: 'YES' | 'NO'
    amount: number
    price: number
    timestamp: number
}

export function LiveTicker() {
    const [trades, setTrades] = useState<Trade[]>([])

    // Mock live data stream
    useEffect(() => {
        const interval = setInterval(() => {
            const newTrade: Trade = {
                id: Math.random().toString(36).substr(2, 9),
                market: [
                    "Will China invade Taiwan in 2024?",
                    "Bitcoin > $100k by Q1?",
                    "Fed Interest Rate Cut March",
                    "SpaceX Starship Launch Success",
                    "US Election: GOP Nominee"
                ][Math.floor(Math.random() * 5)],
                type: Math.random() > 0.5 ? 'buy' : 'sell',
                outcome: Math.random() > 0.5 ? 'YES' : 'NO',
                amount: Math.floor(Math.random() * 10000) + 100,
                price: Math.random(),
                timestamp: Date.now()
            }

            setTrades(prev => [newTrade, ...prev].slice(0, 50))
        }, 2000)

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="w-full h-full bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col font-mono">
            <div className="p-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Trade Feed</span>
                </div>
                <span className="text-[9px] text-gray-600">NET: TRACE</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                <table className="w-full text-[10px]">
                    <thead className="bg-white/5 text-gray-500 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                            <th className="text-left py-2 px-3 font-medium">TIME</th>
                            <th className="text-left py-2 px-3 font-medium">MARKET</th>
                            <th className="text-right py-2 px-3 font-medium">SIDE</th>
                            <th className="text-right py-2 px-3 font-medium">SIZE</th>
                            <th className="text-right py-2 px-3 font-medium">PRICE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {trades.map(trade => (
                            <tr key={trade.id} className="hover:bg-white/5 transition-colors group">
                                <td className="py-1.5 px-3 text-gray-500 whitespace-nowrap">
                                    {new Date(trade.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </td>
                                <td className="py-1.5 px-3 text-gray-300 font-medium truncate max-w-[120px]" title={trade.market}>
                                    {trade.market}
                                </td>
                                <td className="py-1.5 px-3 text-right">
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                        trade.type === 'buy' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                    )}>
                                        {trade.type} {trade.outcome}
                                    </span>
                                </td>
                                <td className="py-1.5 px-3 text-right text-gray-300">
                                    ${trade.amount.toLocaleString()}
                                </td>
                                <td className="py-1.5 px-3 text-right text-purple-300 font-mono">
                                    {trade.price.toFixed(2)}¢
                                </td>
                            </tr>
                        ))}
                        {trades.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-gray-600 italic">
                                    Connecting to PolyGlobe stream...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
