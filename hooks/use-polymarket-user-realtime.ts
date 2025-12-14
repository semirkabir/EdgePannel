import { useEffect, useState, useCallback, useRef } from 'react'
import { PolymarketUserWebSocketClient, PolymarketUserWebSocketMessage } from '@/lib/ws/polymarket-user-websocket'

type EventType = 'MATCHED' | 'MINED' | 'CONFIRMED' | 'RETRYING' | 'FAILED' | 'PLACEMENT' | 'UPDATE' | 'CANCELLATION'

interface UsePolymarketUserRealtimeOptions {
  apiKey?: string
  autoConnect?: boolean
  onMessage?: (message: PolymarketUserWebSocketMessage) => void
  onEvent?: {
    [K in EventType]?: (message: PolymarketUserWebSocketMessage) => void
  }
  onError?: (error: Error) => void
}

export function usePolymarketUserRealtime(options: UsePolymarketUserRealtimeOptions = {}) {
  const {
    apiKey,
    autoConnect = true,
    onMessage,
    onEvent,
    onError
  } = options

  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<PolymarketUserWebSocketMessage[]>([])
  const [lastMessage, setLastMessage] = useState<PolymarketUserWebSocketMessage | null>(null)
  const [orderEvents, setOrderEvents] = useState<Record<string, PolymarketUserWebSocketMessage[]>>({})
  const wsRef = useRef<PolymarketUserWebSocketClient | null>(null)

  // Initialize WebSocket client
  useEffect(() => {
    if (!apiKey) {
      console.warn('[usePolymarketUserRealtime] API key required for authenticated user channel')
      return
    }

    if (!wsRef.current) {
      try {
        wsRef.current = new PolymarketUserWebSocketClient(apiKey)
      } catch (error) {
        console.error('[usePolymarketUserRealtime] Failed to create client:', error)
        if (onError && error instanceof Error) {
          onError(error)
        }
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect()
        wsRef.current = null
      }
    }
  }, [apiKey, onError])

  // Handle connection
  useEffect(() => {
    if (!autoConnect || !wsRef.current) return

    const connectWs = async () => {
      try {
        await wsRef.current!.connect()
        setConnected(true)
      } catch (error) {
        console.error('[usePolymarketUserRealtime] Connection error:', error)
        setConnected(false)
        if (onError && error instanceof Error) {
          onError(error)
        }
      }
    }

    connectWs()
  }, [autoConnect, onError])

  // Handle messages
  useEffect(() => {
    if (!wsRef.current) return

    const unsubscribe = wsRef.current.onMessage((message) => {
      setLastMessage(message)
      setMessages(prev => [...prev.slice(-99), message])

      // Track events by order ID
      if (message.order_id) {
        setOrderEvents(prev => ({
          ...prev,
          [message.order_id!]: [...(prev[message.order_id!] || []), message]
        }))
      }

      if (onMessage) {
        onMessage(message)
      }

      // Call specific event handlers
      if (message.event_type && onEvent?.[message.event_type]) {
        onEvent[message.event_type]!(message)
      }
    })

    return unsubscribe
  }, [onMessage, onEvent])

  const connect = useCallback(async () => {
    if (!wsRef.current) return
    try {
      await wsRef.current.connect()
      setConnected(true)
    } catch (error) {
      console.error('[usePolymarketUserRealtime] Manual connection error:', error)
      if (onError && error instanceof Error) {
        onError(error)
      }
    }
  }, [onError])

  const disconnect = useCallback(() => {
    if (!wsRef.current) return
    wsRef.current.disconnect()
    setConnected(false)
  }, [])

  const getOrderHistory = useCallback((orderId: string) => {
    return orderEvents[orderId] || []
  }, [orderEvents])

  return {
    connected,
    messages,
    lastMessage,
    orderEvents,
    getOrderHistory,
    connect,
    disconnect,
    client: wsRef.current
  }
}
