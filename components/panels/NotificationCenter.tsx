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
  Crown,
  ChevronDown
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
  const [activeTab, setActiveTab] = useState<'all' | 'price' | 'whale'>('all');
  const [showWhaleConfig, setShowWhaleConfig] = useState(false);
  const [whaleThreshold, setWhaleThreshold] = useState('5000');

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

  // Filter notifications based on active tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return unifiedNotifications;
    return unifiedNotifications.filter(n =>
      activeTab === 'price' ? n.type === 'price_alert' : n.type === 'whale_trade'
    );
  }, [unifiedNotifications, activeTab]);

  return (
    <RightPanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Notifications</h2>
            <p className="text-xs text-gray-500">Price alerts & whale trades</p>
          </div>
          {unifiedNotifications.length > 0 && (
            <span className="px-2.5 py-1 text-xs bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg font-bold">
              {unifiedNotifications.length}
            </span>
          )}
        </div>
      }
      headerContent={
        <div className="flex items-center gap-2">
          {unifiedNotifications.some(n => n.read || (n.type === 'price_alert' && (n.data as PriceAlert).triggered)) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearRead}
              className="text-gray-400 hover:text-white hover:bg-white/10 gap-2 text-xs"
            >
              <CheckCheck className="h-4 w-4" />
              Clear Read
            </Button>
          )}
        </div>
      }
    >

      {/* Enhanced Tab Navigation */}
      <div className="flex gap-2 p-4 bg-[#0e0f11]/80 border-b border-white/10">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            "flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
            activeTab === 'all'
              ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
              : "bg-white/5 text-gray-400 hover:bg-white/10"
          )}
        >
          All ({unifiedNotifications.length})
        </button>
        <button
          onClick={() => setActiveTab('price')}
          className={cn(
            "flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
            activeTab === 'price'
              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg"
              : "bg-white/5 text-gray-400 hover:bg-white/10"
          )}
        >
          <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
          Prices ({alerts.length})
        </button>
        <button
          onClick={() => setActiveTab('whale')}
          className={cn(
            "flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
            activeTab === 'whale'
              ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg"
              : "bg-white/5 text-gray-400 hover:bg-white/10"
          )}
        >
          <Crown className="w-3.5 h-3.5 inline mr-1" />
          Whales ({whaleNotifications.length})
        </button>
      </div>

      {/* Whale Alert Configuration */}
      {activeTab === 'whale' && (
        <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-b border-white/10">
          <button
            onClick={() => setShowWhaleConfig(!showWhaleConfig)}
            className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
          >
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-purple-400" />
              <div className="text-left">
                <div className="text-sm font-bold text-white">Whale Alert Settings</div>
                <div className="text-xs text-gray-400">Customize trade size threshold</div>
              </div>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-gray-400 transition-transform",
              showWhaleConfig && "rotate-180"
            )} />
          </button>

          {showWhaleConfig && (
            <div className="mt-3 p-4 bg-black/40 rounded-xl border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                Minimum Trade Size ($USD)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={whaleThreshold}
                  onChange={(e) => setWhaleThreshold(e.target.value)}
                  placeholder="5000"
                  className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 font-mono"
                />
                <Button
                  onClick={() => {
                    // Handle whale threshold update
                    console.log('Updated whale threshold:', whaleThreshold);
                    setShowWhaleConfig(false);
                  }}
                  className="px-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold rounded-xl"
                >
                  Save
                </Button>
              </div>
              <div className="flex gap-2">
                {['1000', '5000', '10000', '50000'].map(value => (
                  <button
                    key={value}
                    onClick={() => setWhaleThreshold(value)}
                    className="flex-1 px-3 py-2 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 rounded-lg text-xs font-mono font-bold text-gray-400 hover:text-purple-400 transition-all"
                  >
                    ${parseInt(value).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center mb-4">
              <BellOff className="h-10 w-10 text-gray-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No {activeTab === 'all' ? '' : activeTab === 'price' ? 'price ' : 'whale '}notifications</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              {activeTab === 'whale'
                ? 'Whale trades will appear here when large positions are detected'
                : 'Set up alerts to get notified about price changes and market movements'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredNotifications.map(notification => {
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

      {/* Enhanced Footer */}
      {filteredNotifications.length > 0 && (
        <div className="p-4 border-t border-white/10 bg-gradient-to-br from-[#0e0f11] to-black/80 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 font-bold rounded-xl py-3"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Notifications
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







