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
        'p-4 hover:bg-accent/50 transition-colors cursor-pointer group relative',
        !notification.read && 'bg-blue-500/5'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
          notification.read
            ? 'bg-blue-500/10'
            : 'bg-blue-500/20 ring-2 ring-blue-500/30'
        )}>
          <Fish className="h-5 w-5 text-blue-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header with amount and direction */}
          <div className="flex items-center gap-2 mb-1">
            {tradeIcon}
            <span className={cn(
              'text-base font-bold',
              getAmountColor(trade.amountUSD)
            )}>
              ${formatAmount(trade.amountUSD)}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 h-5 border-0',
                trade.tradeType === 'buy'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              )}
            >
              {trade.tradeType.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {trade.outcome}
            </span>
          </div>

          {/* Market title */}
          <p className="text-sm font-medium line-clamp-2 mb-2">
            {trade.marketTitle}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {/* Platform */}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {trade.platform.toUpperCase()}
            </Badge>

            {/* Price */}
            <span className="flex items-center gap-1">
              @ {(trade.price * 100).toFixed(1)}¢
            </span>

            {/* Timestamp */}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(notification.timestamp)}
            </span>

            {/* New badge */}
            {!notification.read && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/20 text-blue-400 border-0">
                NEW
              </Badge>
            )}
          </div>

          {/* Price impact indicator (if available) */}
          {trade.priceImpact && trade.priceImpact > 0.03 && (
            <div className="mt-2 text-[10px] text-orange-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>
                {(trade.priceImpact * 100).toFixed(1)}% price impact
              </span>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-400" />
        </Button>
      </div>
    </div>
  )
}
