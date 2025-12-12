'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { usePriceAlerts, PriceAlert } from '@/hooks/use-price-alerts'
import { 
  Bell, 
  BellOff, 
  X, 
  Trash2, 
  CheckCheck,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDistanceToNow } from '@/lib/utils/date'

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

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'triggered'>('all')

  const displayAlerts = activeTab === 'all' 
    ? alerts 
    : activeTab === 'active' 
      ? activeAlerts 
      : triggeredAlerts

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
      <div 
        className="bg-background border-l border-border shadow-2xl w-full max-w-md h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Notifications</h2>
            {alerts.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {triggeredAlerts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearTriggeredAlerts}
                className="text-muted-foreground hover:text-foreground gap-1"
              >
                <CheckCheck className="h-4 w-4" />
                Clear read
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { key: 'all', label: 'All', count: alerts.length },
            { key: 'active', label: 'Active', count: activeAlerts.length },
            { key: 'triggered', label: 'Triggered', count: triggeredAlerts.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-muted rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {displayAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <BellOff className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No notifications</h3>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'active' 
                  ? "You don't have any active price alerts"
                  : activeTab === 'triggered'
                    ? "No alerts have been triggered yet"
                    : "Set price alerts on markets to get notified"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displayAlerts.map(alert => (
                <NotificationItem
                  key={alert.id}
                  alert={alert}
                  onRemove={() => removeAlert(alert.id)}
                  onClick={() => {
                    onMarketSelect?.(alert.marketId, alert.platform)
                    onClose()
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {alerts.length > 0 && (
          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllAlerts}
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear all notifications
            </Button>
          </div>
        )}
      </div>
    </div>
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
  const unreadCount = triggeredAlerts.length

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
      {alerts.length > 0 && unreadCount === 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
      )}
    </Button>
  )
}



