'use client'

import { useEffect, useState, useRef } from 'react'
import { Market } from '@/types/market'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Activity, ArrowUpRight, ArrowDownRight, Radio, Trophy, Mic2, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface LiveTradesPanelProps {
    markets: Market[]
    onMarketClick?: (market: Market) => void
}

type ActivityType = 'trade' | 'event'
type EventCategory = 'sports' | 'politics' | 'economics' | 'other'

interface ActivityItem {
    id: string
    type: ActivityType
    timestamp: number
    marketId?: string
    marketTitle?: string

    // Trade specific
    tradeType?: 'buy' | 'sell'
    outcome?: 'Yes' | 'No'
    amount?: number
    price?: number
    platform?: 'polymarket' | 'kalshi'

    // Event specific
    eventCategory?: EventCategory
    eventTitle?: string
    eventDescription?: string
}

export function LiveTradesPanel({ markets, onMarketClick }: LiveTradesPanelProps) {
    const [activities, setActivities] = useState<ActivityItem[]>([])
    const [isVisible, setIsVisible] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Simulate live activity
    useEffect(() => {
        if (markets.length === 0) return

        const interval = setInterval(() => {
            const isEvent = Math.random() > 0.7 // 30% chance of being an event

            if (isEvent) {
                // Generate random event
                const categories: EventCategory[] = ['sports', 'politics', 'economics']
                const category = categories[Math.floor(Math.random() * categories.length)]

                let title = ''
                let description = ''

                if (category === 'sports') {
                    const teams = ['Lakers', 'Warriors', 'Chiefs', 'Eagles', 'Real Madrid', 'Barcelona']
                    const team = teams[Math.floor(Math.random() * teams.length)]
                    title = `${team} scores!`
                    description = `Goal scored in the 88th minute. Odds shifting rapidly.`
                } else if (category === 'politics') {
                    title = 'Presidential Speech Live'
                    description = 'President addressing economic policy now. Watch for market reaction.'
                } else if (category === 'economics') {
                    title = 'FOMC Meeting Update'
                    description = 'Fed Chair announces interest rate decision. Markets volatile.'
                }

                const newEvent: ActivityItem = {
                    id: Math.random().toString(36).substring(7),
                    type: 'event',
                    timestamp: Date.now(),
                    eventCategory: category,
                    eventTitle: title,
                    eventDescription: description
                }

                setActivities(prev => [newEvent, ...prev].slice(0, 50))
            } else {
                // Generate random trade
                const randomMarket = markets[Math.floor(Math.random() * markets.length)]
                const isBuy = Math.random() > 0.5
                const amount = Math.floor(Math.random() * 1000) + 10
                const price = randomMarket.price || Math.random()

                const newTrade: ActivityItem = {
                    id: Math.random().toString(36).substring(7),
                    type: 'trade',
                    timestamp: Date.now(),
                    marketId: randomMarket.id,
                    marketTitle: randomMarket.title,
                    tradeType: isBuy ? 'buy' : 'sell',
                    outcome: Math.random() > 0.5 ? 'Yes' : 'No',
                    amount,
                    price,
                    platform: randomMarket.platform
                }

                setActivities(prev => [newTrade, ...prev].slice(0, 50))
            }
        }, 2000)

        return () => clearInterval(interval)
    }, [markets])

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
            <div className="absolute top-20 left-4 z-10">
                <button
                    onClick={() => setIsVisible(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-background/80 backdrop-blur-md border border-border rounded-lg shadow-lg hover:bg-accent transition-colors"
                >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-bold">LIVE ACTIVITY</span>
                </button>
            </div>
        )
    }

    return (
        <div className="absolute top-20 left-4 z-10 w-80 flex flex-col gap-2">
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
                                item.type === 'event'
                                    ? "bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10"
                                    : "bg-background/50 border-border/50 hover:bg-accent/50"
                            )}
                            onClick={() => {
                                if (item.marketId) {
                                    const market = markets.find(m => m.id === item.marketId)
                                    if (market && onMarketClick) onMarketClick(market)
                                }
                            }}
                        >
                            {item.type === 'trade' ? (
                                // Trade Item
                                <>
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[10px] px-1 py-0 h-4 border-0",
                                                    item.tradeType === 'buy'
                                                        ? "bg-green-500/20 text-green-400"
                                                        : "bg-red-500/20 text-red-400"
                                                )}
                                            >
                                                {item.tradeType?.toUpperCase()}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                {item.outcome}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-primary">
                                                {((item.price || 0) * 100).toFixed(1)}¢
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                ${item.amount}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-xs font-medium leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                                        {item.marketTitle}
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>{item.platform}</span>
                                        <span className="flex items-center gap-0.5">
                                            {Math.floor((Date.now() - item.timestamp) / 1000)}s ago
                                        </span>
                                    </div>
                                </>
                            ) : (
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
                            )}

                            {/* Flash effect on new */}
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
                        </div>
                    ))}

                    {activities.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                            <Activity className="h-8 w-8 opacity-20" />
                            <span className="text-xs">Waiting for activity...</span>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}
