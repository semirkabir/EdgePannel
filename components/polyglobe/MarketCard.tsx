import { useState, useEffect, useRef } from 'react'
import { EnrichedMarket } from '@/lib/markets/enrich'
import { ExternalLink, TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface MarketCardProps {
    market: EnrichedMarket
    onClick?: () => void
    className?: string
}

export function MarketCard({ market, onClick, className }: MarketCardProps) {
    const [flash, setFlash] = useState<'up' | 'down' | null>(null)
    const prevPriceRef = useRef(market.probability || 0)

    useEffect(() => {
        const currentPrice = market.probability || 0
        const diff = currentPrice - prevPriceRef.current

        if (Math.abs(diff) > 0.0001) {
            if (diff > 0) setFlash('up')
            else setFlash('down')

            const timer = setTimeout(() => setFlash(null), 1000)
            prevPriceRef.current = currentPrice
            return () => clearTimeout(timer)
        }
    }, [market.probability])

    const priceColor = (market.price_movement || 0) > 0
        ? 'text-emerald-400 border-l-emerald-400'
        : (market.price_movement || 0) < 0
            ? 'text-rose-400 border-l-rose-400'
            : 'text-blue-400 border-l-blue-400';

    const formatPrice = (prob: number) => {
        return `${Math.round(prob * 100)}¢`;
    }

    const formatVolume = (vol: number) => {
        if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}m`;
        if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`;
        return `$${vol}`;
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative overflow-hidden rounded-lg border border-white/10 bg-black/60 backdrop-blur-md p-3 transition-all duration-300 hover:bg-black/70 hover:border-white/20 cursor-pointer shadow-lg",
                "border-l-4",
                priceColor.split(' ')[1], // Extract border color class
                flash === 'up' && "bg-emerald-900/40 border-emerald-500/50",
                flash === 'down' && "bg-rose-900/40 border-rose-500/50",
                className
            )}
        >
            <div className="flex justify-between items-start gap-2">
                <h4 className="text-sm font-medium text-white/90 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                    {market.title}
                </h4>
                {(market.slug || market.ticker) && (
                    <a
                        href={
                            market.platform === 'polymarket'
                                ? `https://polymarket.com/event/${market.slug}`
                                : `https://kalshi.com/markets/${market.ticker}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/40 hover:text-white/80 transition-colors shrink-0 p-1"
                        onClick={(e) => e.stopPropagation()}
                        title={`Trade on ${market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}`}
                    >
                        <ExternalLink size={14} />
                    </a>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                    <div className={cn("flex items-center gap-1 font-mono font-bold text-lg", priceColor.split(' ')[0])}>
                        {market.probability ? formatPrice(market.probability) : '-'}
                    </div>

                    <div className="flex items-center gap-1 text-white/50" title="24h Volume">
                        <BarChart2 size={12} />
                        <span>{market.volume24h ? formatVolume(market.volume24h) : '$0'}</span>
                    </div>
                </div>

                {market.price_movement !== undefined && market.price_movement !== 0 && (
                    <div className={cn(
                        "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5",
                        market.price_movement > 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                        {market.price_movement > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        <span>{Math.abs(market.price_movement * 100).toFixed(0)}%</span>
                    </div>
                )}
            </div>

            {/* Decorative gradient glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
        </div>
    )
}
