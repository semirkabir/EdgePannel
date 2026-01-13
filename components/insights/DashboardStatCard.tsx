import React from 'react';
import { cn } from '@/lib/utils/cn';

interface DashboardStatCardProps {
    title: string;
    value: string;
    subValue?: string;
    subValueColor?: string;
    icon?: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    chartData?: number[];
    className?: string;
    loading?: boolean;
}

export function DashboardStatCard({
    title,
    value,
    subValue,
    subValueColor = 'text-gray-500',
    icon,
    trend,
    trendValue,
    chartData,
    className,
    loading = false
}: DashboardStatCardProps) {
    return (
        <div className={cn(
            "relative p-4 rounded-xl bg-[#0e0f11]/50 border border-white/5 overflow-hidden group hover:border-white/10 transition-all",
            className
        )}>
            {/* Background Gradient Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {icon && <div className="text-gray-400">{icon}</div>}
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{title}</span>
                </div>
                {loading && <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />}
            </div>

            {/* Main Value */}
            <div className="relative mb-1">
                <span className="text-2xl font-black text-white tracking-tight">{value}</span>
            </div>

            {/* Sub Value / Trend */}
            <div className="relative flex items-center justify-between">
                {subValue && (
                    <span className={cn("text-xs font-medium", subValueColor)}>
                        {subValue}
                    </span>
                )}

                {trend && trendValue && (
                    <div className={cn(
                        "flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded",
                        trend === 'up' ? "text-green-400 bg-green-500/10" :
                            trend === 'down' ? "text-red-400 bg-red-500/10" : "text-gray-400 bg-white/5"
                    )}>
                        <span>{trendValue}</span>
                    </div>
                )}
            </div>

            {/* Simple Sparkline Visualization if chartData provided */}
            {chartData && chartData.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-8 opacity-20 group-hover:opacity-30 transition-opacity">
                    <svg className="w-full h-full" preserveAspectRatio="none">
                        <path
                            d={`M0,${32 - (chartData[0] / Math.max(...chartData)) * 32} ${chartData.map((d, i) => `L${(i / (chartData.length - 1)) * 100}%,${32 - (d / Math.max(...chartData)) * 32}`).join(' ')}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-yellow-500"
                        />
                        <path
                            d={`M0,${32 - (chartData[0] / Math.max(...chartData)) * 32} ${chartData.map((d, i) => `L${(i / (chartData.length - 1)) * 100}%,${32 - (d / Math.max(...chartData)) * 32}`).join(' ')} V32 H0 Z`}
                            fill="currentColor"
                            className="text-yellow-500"
                            fillOpacity="0.2"
                        />
                    </svg>
                </div>
            )}
        </div>
    );
}
