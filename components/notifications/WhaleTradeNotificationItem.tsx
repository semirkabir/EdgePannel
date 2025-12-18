'use client'

import { WhaleNotification } from '@/types/whale-trade'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Fish, TrendingUp, TrendingDown, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDistanceToNow } from '@/lib/utils/date'

interface WhaleTradeNotificationItemProps {
  notification: WhaleNotification
  onDismiss: () => void
  onClick: () => void
}

export function WhaleTradeNotificationItem({
  notification,
  onDismiss,
  onClick,
}: WhaleTradeNotificationItemProps) {
  const { trade } = notification

  // Determine color based on trade amount
  const getAmountColor = (amountUSD: number) => {
    if (amountUSD >= 50000) return 'text-red-400'
    if (amountUSD >= 25000) return 'text-orange-400'
    if (amountUSD >= 10000) return 'text-yellow-400'
    return 'text-green-400'
  }

  // Format amount with K/M suffix
  const formatAmount = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toFixed(0)
  }

  const tradeIcon = trade.tradeType === 'buy'
    ? <TrendingUp className="h-4 w-4 text-green-400" />
    : <TrendingDown className="h-4 w-4 text-red-400" />

  return (
    <div
      className={cn(
        'p-4 transition-all duration-300 cursor-pointer group relative overflow-hidden border-b border-white/5',
        'hover:bg-white/[0.03] hover:translate-x-1',
        !notification.read && 'bg-blue-500/[0.03] border-l-2 border-l-blue-500'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Icon with double ring */}
        <div className="relative shrink-0">
          <div className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500',
            notification.read
              ? 'bg-white/5 border border-white/10'
              : 'bg-blue-500/10 border border-blue-500/30'
          )}>
            <Fish className={cn(
              "h-6 w-6 transition-transform duration-500 group-hover:scale-110",
              notification.read ? "text-gray-400" : "text-blue-400"
            )} />
          </div>
          {!notification.read && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0e0f11] animate-pulse" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header with amount and direction */}
          <div className="flex items-center gap-2 mb-1.5 pt-0.5">
            <span className={cn(
              'text-lg font-black tracking-tight flex items-center gap-1.5',
              getAmountColor(trade.amountUSD)
            )}>
              {tradeIcon}
              ${formatAmount(trade.amountUSD)}
            </span>
            <div className={cn(
              "px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest uppercase border",
              trade.tradeType === 'buy'
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            )}>
              {trade.tradeType}
            </div>
            <span className="text-xs font-bold text-white/40 truncate">
              {trade.outcome}
            </span>
          </div>

          {/* Market title */}
          <p className="text-sm font-semibold text-white/90 line-clamp-2 mb-3 leading-snug group-hover:text-white transition-colors">
            {trade.marketTitle}
          </p>

          {/* Metadata Grid-like Layout */}
          <div className="flex items-center gap-4 text-[11px] font-bold text-white/40">
            {/* Platform Tag */}
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
              {trade.platform.toUpperCase()}
            </span>

            {/* Entry Price */}
            <span className="flex items-center gap-1">
              ENTRY <span className="text-white/70">{(trade.price * 100).toFixed(1)}¢</span>
            </span>

            {/* Timestamp */}
            <span className="flex items-center gap-1 ml-auto">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(notification.timestamp)}
            </span>
          </div>

          {/* Price impact indicator - Refined */}
          {trade.priceImpact && trade.priceImpact > 0.03 && (
            <div className="mt-3 p-2 rounded-xl bg-orange-500/5 border border-orange-500/10 text-[10px] text-orange-400 flex items-center gap-2 font-bold animate-in fade-in slide-in-from-bottom-1">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              SLIPPAGE: {(trade.priceImpact * 100).toFixed(1)}% IMPACT
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-400 shrink-0 mt-1"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Background glow for unread */}
      {!notification.read && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none" />
      )}
    </div>
  )
}
