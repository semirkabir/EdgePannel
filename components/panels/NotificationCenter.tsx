'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { RightPanel } from '@/components/ui/RightPanel'
import { usePriceAlerts, PriceAlert } from '@/hooks/use-price-alerts'
import { useWhaleTrades } from '@/hooks/use-whale-trades'
import { WhaleNotification } from '@/types/whale-trade'
import { WhaleTradeNotificationItem } from '@/components/notifications/WhaleTradeNotificationItem'
import {
  Bell,
  BellOff,
  Trash2,
  CheckCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  Whale
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDistanceToNow } from '@/lib/utils/date'

// Unified notification type
type NotificationType = 'price_alert' | 'whale_trade'
interface UnifiedNotification {
  id: string
  type: NotificationType
  timestamp: number
  read: boolean
  data: PriceAlert | WhaleNotification
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  onMarketSelect?: (marketId: string, platform: string) => void
}

export function NotificationCenter({
  isOpen,
  onClose,
  onMarketSelect
}: NotificationCenterProps) {
  const {
    alerts,
    activeAlerts,
    triggeredAlerts,
    removeAlert,
    clearTriggeredAlerts,
    clearAllAlerts
  } = usePriceAlerts()

  const {
    activeNotifications: whaleNotifications,
    unreadCount: whaleUnreadCount,
    dismissNotification,
    clearReadNotifications,
    clearAllNotifications: clearAllWhaleNotifications,
  } = useWhaleTrades({ enabled: true })

  // Merge price alerts and whale notifications into unified list
  const unifiedNotifications = useMemo((): UnifiedNotification[] => {
    const priceAlertNotifications: UnifiedNotification[] = alerts.map(alert => ({
      id: alert.id,
      type: 'price_alert' as const,
      timestamp: alert.triggeredAt || alert.createdAt,
      read: alert.triggered,
      data: alert,
    }))

    const whaleTradeNotifications: UnifiedNotification[] = whaleNotifications.map(notif => ({
      id: notif.id,
      type: 'whale_trade' as const,
      timestamp: notif.timestamp,
      read: notif.read,
      data: notif,
    }))

    // Combine and sort by timestamp (newest first)
    return [...priceAlertNotifications, ...whaleTradeNotifications]
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [alerts, whaleNotifications])

  // Clear all notifications
  const handleClearAll = () => {
    clearAllAlerts()
    clearAllWhaleNotifications()
  }

  const handleClearRead = () => {
    clearTriggeredAlerts()
    clearReadNotifications()
  }

  return (
    <RightPanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <span>Notifications</span>
          {unifiedNotifications.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {unifiedNotifications.length}
            </span>
          )}
        </div>
      }
      headerContent={
        unifiedNotifications.some(n => n.read || (n.type === 'price_alert' && (n.data as PriceAlert).triggered)) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearRead}
            className="text-muted-foreground hover:text-foreground gap-1"
          >
            <CheckCheck className="h-4 w-4" />
            Clear read
          </Button>
        )
      }
    >

      <div className="flex-1 overflow-auto">
        {unifiedNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <BellOff className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              Set up alerts to get notified about price changes and whale trades
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {unifiedNotifications.map(notification => {
                if (notification.type === 'price_alert') {
                  const alert = notification.data as PriceAlert
                  return (
                    <NotificationItem
                      key={notification.id}
                      alert={alert}
                      onRemove={() => removeAlert(alert.id)}
                      onClick={() => {
                        onMarketSelect?.(alert.marketId, alert.platform)
                        onClose()
                      }}
                    />
                  )
                } else {
                  const whaleNotif = notification.data as WhaleNotification
                  return (
                    <WhaleTradeNotificationItem
                      key={notification.id}
                      notification={whaleNotif}
                      onDismiss={() => dismissNotification(whaleNotif.id)}
                      onClick={() => {
                        onMarketSelect?.(whaleNotif.trade.marketId, whaleNotif.trade.platform)
                        onClose()
                      }}
                    />
                  )
                }
              })}
          </div>
        )}
      </div>

      {/* Footer */}
      {unifiedNotifications.length > 0 && (
        <div className="p-4 border-t border-border bg-[#0e0f11]">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear all notifications
          </Button>
        </div>
      )}
    </RightPanel>
  )
}

// Individual notification item
function NotificationItem({ 
  alert, 
  onRemove,
  onClick 
}: { 
  alert: PriceAlert
  onRemove: () => void
  onClick: () => void
}) {
  const conditionIcon = alert.condition === 'above' 
    ? <TrendingUp className="h-4 w-4 text-green-400" />
    : alert.condition === 'below'
      ? <TrendingDown className="h-4 w-4 text-red-400" />
      : <TrendingUp className="h-4 w-4 text-blue-400" />

  const conditionText = {
    above: 'goes above',
    below: 'goes below',
    crosses: 'crosses',
  }[alert.condition]

  return (
    <div 
      className={cn(
        "p-4 hover:bg-accent/50 transition-colors cursor-pointer group",
        alert.triggered && "bg-green-500/5"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          alert.triggered 
            ? "bg-green-500/20" 
            : "bg-primary/10"
        )}>
          {alert.triggered ? (
            <CheckCheck className="h-5 w-5 text-green-400" />
          ) : (
            <Bell className="h-5 w-5 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2 mb-1">
            {alert.marketTitle}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {conditionIcon}
            <span>
              Alert when price {conditionText}{' '}
              <strong className="text-foreground">{alert.targetPrice}%</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {alert.triggered && alert.triggeredAt
                ? `Triggered ${formatDistanceToNow(alert.triggeredAt)}`
                : `Created ${formatDistanceToNow(alert.createdAt)}`}
            </span>
            {alert.triggered && (
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                TRIGGERED
              </span>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-400" />
        </Button>
      </div>
    </div>
  )
}

// Notification bell button for header
export function NotificationBell({
  onClick
}: {
  onClick: () => void
}) {
  const { alerts, triggeredAlerts } = usePriceAlerts()
  const { unreadCount: whaleUnreadCount, activeNotifications } = useWhaleTrades({ enabled: true })

  // Combined unread count
  const unreadCount = triggeredAlerts.length + whaleUnreadCount
  const totalNotifications = alerts.length + activeNotifications.length

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="relative"
      title="Notifications"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      {totalNotifications > 0 && unreadCount === 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
      )}
    </Button>
  )
}




