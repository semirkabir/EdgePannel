import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Zap, Activity } from 'lucide-react';

interface MarketTickerProps {
    tps: number;
    tpm: number;
    peakTps: number;
    className?: string;
}

export function MarketTicker({ tps, tpm, peakTps, className }: MarketTickerProps) {
    // Smooth the TPS display with slight animation
    const [displayTps, setDisplayTps] = useState(tps);
    const [displayTpm, setDisplayTpm] = useState(tpm);

    useEffect(() => {
        // Smooth transition to new values
        setDisplayTps(tps);
        setDisplayTpm(tpm);
    }, [tps, tpm]);

    // Determine activity level for color coding
    const activityLevel = displayTpm > 100 ? 'high' : displayTpm > 30 ? 'medium' : 'low';
    const activityColor = activityLevel === 'high' ? 'text-green-400' :
        activityLevel === 'medium' ? 'text-yellow-400' : 'text-gray-400';

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 w-full", className)}>
            {/* Metric 1: Trades/Sec */}
            <div className="bg-[#0a0b0d] border border-white/5 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden">
                <div className="flex items-center gap-1.5 mb-1">
                    <div className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        activityLevel === 'high' ? "bg-green-500" :
                            activityLevel === 'medium' ? "bg-yellow-500" : "bg-gray-500"
                    )} />
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Trades/Sec</div>
                </div>
                <div className="flex items-end gap-1.5">
                    <span className={cn(
                        "text-2xl font-black tabular-nums leading-none font-mono transition-colors",
                        activityColor
                    )}>
                        {displayTps.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-gray-600 font-bold mb-1">TPS</span>
                </div>
                {/* Activity bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800">
                    <div
                        className={cn(
                            "h-full transition-all duration-500",
                            activityLevel === 'high' ? "bg-green-500" :
                                activityLevel === 'medium' ? "bg-yellow-500" : "bg-gray-600"
                        )}
                        style={{ width: `${Math.min(100, (displayTps / Math.max(peakTps, 1)) * 100)}%` }}
                    />
                </div>
            </div>

            {/* Metric 2: Trades/Min */}
            <div className="bg-[#0a0b0d] border border-white/5 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Trades/Min</div>
                <div className="flex items-end gap-1.5">
                    <span className="text-2xl font-black text-white tabular-nums leading-none font-mono">
                        {displayTpm.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-600 font-bold mb-1">TPM</span>
                </div>
            </div>

            {/* Metric 3: Peak TPS (Session) */}
            <div className="bg-[#0a0b0d] border border-white/5 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Peak TPS</div>
                <div className="flex items-end gap-1.5">
                    <span className="text-2xl font-black text-orange-400 tabular-nums leading-none font-mono">
                        {peakTps > 0 ? peakTps.toFixed(0) : '--'}
                    </span>
                    <span className="text-[10px] text-gray-600 font-bold mb-1">MAX</span>
                </div>
            </div>

            {/* Activity Status */}
            <div className="bg-[#0a0b0d] border border-white/5 rounded-xl p-3 flex items-center justify-center relative overflow-hidden">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-lg",
                        activityLevel === 'high' ? "bg-green-500/20" :
                            activityLevel === 'medium' ? "bg-yellow-500/20" : "bg-gray-500/20"
                    )}>
                        <Activity className={cn("w-4 h-4", activityColor)} />
                    </div>
                    <div>
                        <div className={cn("text-xs font-bold uppercase", activityColor)}>
                            {activityLevel === 'high' ? 'High Activity' :
                                activityLevel === 'medium' ? 'Normal' : 'Low Activity'}
                        </div>
                        <div className="text-[9px] text-gray-500">Market Flow</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
