'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  metadata?: Record<string, any>
}

interface UseNotificationsOptions {
  enableBrowserNotifications?: boolean
  enableToasts?: boolean
  maxNotifications?: number
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    enableBrowserNotifications = true,
    enableToasts = true,
    maxNotifications = 100
  } = options

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [permissionGranted, setPermissionGranted] = useState(false)

  // Request browser notification permission
  useEffect(() => {
    if (!enableBrowserNotifications || typeof window === 'undefined') return

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setPermissionGranted(permission === 'granted')
      })
    } else if (Notification.permission === 'granted') {
      setPermissionGranted(true)
    }
  }, [enableBrowserNotifications])

  // Update unread count
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length)
  }, [notifications])

  const notify = useCallback((
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      actionUrl?: string
      metadata?: Record<string, any>
      duration?: number
    }
  ) => {
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      actionUrl: options?.actionUrl,
      metadata: options?.metadata
    }

    // Add to notifications list
    setNotifications(prev => [notification, ...prev].slice(0, maxNotifications))

    // Show toast notification
    if (enableToasts) {
      const toastDuration = options?.duration || 4000

      switch (type) {
        case 'success':
          toast.success(title, {
            description: message,
            duration: toastDuration
          })
          break
        case 'error':
          toast.error(title, {
            description: message,
            duration: toastDuration
          })
          break
        case 'warning':
          toast.warning(title, {
            description: message,
            duration: toastDuration
          })
          break
        case 'info':
          toast.info(title, {
            description: message,
            duration: toastDuration
          })
          break
      }
    }

    // Show browser notification
    if (enableBrowserNotifications && permissionGranted && 'Notification' in window) {
      try {
        const browserNotif = new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id
        })

        if (options?.actionUrl) {
          browserNotif.onclick = () => {
            window.focus()
            window.location.href = options.actionUrl!
            browserNotif.close()
          }
        }
      } catch (error) {
        console.error('[useNotifications] Browser notification error:', error)
      }
    }

    return notification.id
  }, [enableBrowserNotifications, enableToasts, permissionGranted, maxNotifications])

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Helper functions for specific notification types
  const notifySuccess = useCallback((title: string, message: string, options?: any) => {
    return notify('success', title, message, options)
  }, [notify])

  const notifyError = useCallback((title: string, message: string, options?: any) => {
    return notify('error', title, message, options)
  }, [notify])

  const notifyWarning = useCallback((title: string, message: string, options?: any) => {
    return notify('warning', title, message, options)
  }, [notify])

  const notifyInfo = useCallback((title: string, message: string, options?: any) => {
    return notify('info', title, message, options)
  }, [notify])

  // Whale alert specific notification
  const notifyWhaleAlert = useCallback((trade: {
    type: 'holder' | 'trade'
    value: number
    side?: string
    price?: number
    percentage?: number
    market?: string
  }) => {
    if (trade.type === 'trade') {
      return notifyWarning(
        '🐋 Whale Trade Detected',
        `$${trade.value.toFixed(0)} ${trade.side} @ ${trade.price?.toFixed(2) || 'N/A'}`,
        {
          metadata: trade,
          duration: 6000
        }
      )
    } else {
      return notifyInfo(
        '🐋 Large Holder Alert',
        `Wallet holds ${trade.percentage?.toFixed(1)}% of market`,
        {
          metadata: trade,
          duration: 6000
        }
      )
    }
  }, [notifyWarning, notifyInfo])

  // Order fill notification
  const notifyOrderFill = useCallback((order: {
    ticker: string
    side: string
    quantity: number
    price: number
  }) => {
    return notifySuccess(
      '✅ Order Filled',
      `${order.ticker}: ${order.side} ${order.quantity} @ ${order.price.toFixed(2)}`,
      {
        metadata: order,
        duration: 5000
      }
    )
  }, [notifySuccess])

  // Order failed notification
  const notifyOrderFailed = useCallback((order: {
    ticker: string
    reason?: string
  }) => {
    return notifyError(
      '❌ Order Failed',
      `${order.ticker}: ${order.reason || 'Unknown error'}`,
      {
        metadata: order,
        duration: 5000
      }
    )
  }, [notifyError])

  return {
    notifications,
    unreadCount,
    permissionGranted,
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    notifyWhaleAlert,
    notifyOrderFill,
    notifyOrderFailed,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  }
}
