'use client'

import { useEffect, useState, useRef } from 'react'
import { Market } from '@/types/market'
import { WhaleTrade, WhaleNotification } from '@/types/whale-trade'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Activity, Radio, Trophy, Mic2, Landmark, Fish } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface LiveTradesPanelProps {
    markets: Market[]
    onMarketClick?: (market: Market) => void
}

type ActivityType = 'whale_trade' | 'event'
type EventCategory = 'sports' | 'politics' | 'economics' | 'other'

interface ActivityItem {
    id: string
    type: ActivityType
    timestamp: number
    marketId?: string
    marketTitle?: string

    // Whale trade specific
    whaleTrade?: WhaleTrade

    // Event specific
    eventCategory?: EventCategory
    eventTitle?: string
    eventDescription?: string
}

export function LiveTradesPanel({ markets, onMarketClick }: LiveTradesPanelProps) {
    const [activities, setActivities] = useState<ActivityItem[]>([])
    const [isVisible, setIsVisible] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Listen for real whale trade notifications
    useEffect(() => {
        const handleWhaleNotification = (event: CustomEvent<WhaleNotification>) => {
            const notification = event.detail
            const trade = notification.trade

            const newActivity: ActivityItem = {
                id: notification.id,
                type: 'whale_trade',
                timestamp: notification.timestamp,
                marketId: trade.marketId,
                marketTitle: trade.marketTitle,
                whaleTrade: trade,
            }

            setActivities(prev => [newActivity, ...prev].slice(0, 50))
        }

        window.addEventListener('whale-trade-notification', handleWhaleNotification as EventListener)

        return () => {
            window.removeEventListener('whale-trade-notification', handleWhaleNotification as EventListener)
        }
    }, [])

    const getEventIcon = (category?: EventCategory) => {
        switch (category) {
            case 'sports': return <Trophy className="h-3 w-3" />
            case 'politics': return <Mic2 className="h-3 w-3" />
            case 'economics': return <Landmark className="h-3 w-3" />
            default: return <Radio className="h-3 w-3" />
        }
    }

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="flex items-center gap-2 px-3 py-2 bg-background/80 backdrop-blur-md border border-border rounded-lg shadow-lg hover:bg-accent transition-colors"
            >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold">LIVE ACTIVITY</span>
            </button>
        )
    }

    return (
        <Card className="bg-background/80 backdrop-blur-md border-border shadow-xl overflow-hidden">
            <div className="p-3 border-b border-border/50 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <h3 className="text-xs font-bold tracking-wider">LIVE ACTIVITY</h3>
                    <span className="text-[10px] text-muted-foreground ml-1">
                        Streaming
                    </span>
                </div>
                <button
                    onClick={() => setIsVisible(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>

            <div className="h-[400px] overflow-y-auto scrollbar-hide p-2 space-y-2">
                {activities.map((item) => (
                    <div
                        key={item.id}
                        className={cn(
                            "group relative p-3 rounded-lg border transition-all cursor-pointer",
                            item.type === 'whale_trade'
                                ? "bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 hover:from-blue-500/20 hover:to-purple-500/20"
                                : "bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10"
                        )}
                        onClick={() => {
                            if (item.marketId) {
                                const market = markets.find(m => m.id === item.marketId)
                                if (market && onMarketClick) onMarketClick(market)
                            }
                        }}
                    >
                        {item.type === 'whale_trade' && item.whaleTrade ? (
                            // Whale Trade Item
                            <>
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <Fish className="h-3 w-3 text-blue-400" />
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[10px] px-1 py-0 h-4 border-0",
                                                item.whaleTrade.tradeType === 'buy'
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-red-500/20 text-red-400"
                                            )}
                                        >
                                            {item.whaleTrade.tradeType.toUpperCase()}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                            {item.whaleTrade.outcome}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-blue-400">
                                            ${(item.whaleTrade.amountUSD / 1000).toFixed(1)}K
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            {(item.whaleTrade.price * 100).toFixed(1)}¢
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs font-medium leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                                    {item.whaleTrade.marketTitle}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="uppercase">{item.whaleTrade.platform}</span>
                                    <span className="flex items-center gap-0.5">
                                        {Math.floor((Date.now() - item.timestamp) / 1000)}s ago
                                    </span>
                                </div>
                            </>
                        ) : item.type === 'event' ? (
                            // Event Item
                            <>
                                <div className="flex items-start gap-2 mb-1">
                                    <div className={cn(
                                        "p-1 rounded-full shrink-0",
                                        item.eventCategory === 'sports' ? "bg-orange-500/20 text-orange-400" :
                                            item.eventCategory === 'politics' ? "bg-purple-500/20 text-purple-400" :
                                                "bg-blue-500/20 text-blue-400"
                                    )}>
                                        {getEventIcon(item.eventCategory)}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-foreground leading-none mb-1">
                                            {item.eventTitle}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-tight">
                                            {item.eventDescription}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-1">
                                    <span className="text-[10px] text-muted-foreground">
                                        LIVE • {Math.floor((Date.now() - item.timestamp) / 1000)}s ago
                                    </span>
                                </div>
                            </>
                        ) : null}

                        {/* Flash effect on new */}
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
                    </div>
                ))}

                {activities.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <Fish className="h-8 w-8 opacity-20" />
                        <span className="text-xs font-medium">Waiting for whale trades...</span>
                        <span className="text-[10px] text-center max-w-[200px]">
                            Large trades will appear here in real-time
                        </span>
                    </div>
                )}
            </div>
        </Card>
    )
}
