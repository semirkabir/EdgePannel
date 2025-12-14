import { useEffect, useState, useCallback, useRef } from 'react'
import { KalshiWebSocketClient, KalshiWebSocketMessage } from '@/lib/ws/kalshi-websocket'

export type KalshiChannel = 'ticker' | 'orderbook_delta' | 'fill' | 'market_positions' | 'trade' | 'market_lifecycle_v2'

interface UseKalshiRealtimeOptions {
  tickers?: string[]
  channels?: KalshiChannel[]
  userChannels?: ('fill' | 'market_positions')[]
  publicChannels?: ('trade' | 'market_lifecycle_v2')[]
  accessKeyId?: string
  privateKey?: string
  autoConnect?: boolean
  onMessage?: (message: KalshiWebSocketMessage) => void
  onError?: (error: Error) => void
}

export function useKalshiRealtime(options: UseKalshiRealtimeOptions = {}) {
  const {
    tickers = [],
    channels = ['ticker', 'orderbook_delta'],
    userChannels = [],
    publicChannels = [],
    accessKeyId,
    privateKey,
    autoConnect = true,
    onMessage,
    onError
  } = options

  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<KalshiWebSocketMessage[]>([])
  const [lastMessage, setLastMessage] = useState<KalshiWebSocketMessage | null>(null)
  const wsRef = useRef<KalshiWebSocketClient | null>(null)

  // Initialize WebSocket client
  useEffect(() => {
    if (!wsRef.current) {
      wsRef.current = new KalshiWebSocketClient(accessKeyId, privateKey)
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect()
        wsRef.current = null
      }
    }
  }, [accessKeyId, privateKey])

  // Handle connection
  useEffect(() => {
    if (!autoConnect || !wsRef.current) return

    const connectWs = async () => {
      try {
        await wsRef.current!.connect()
        setConnected(true)
      } catch (error) {
        console.error('[useKalshiRealtime] Connection error:', error)
        setConnected(false)
        if (onError && error instanceof Error) {
          onError(error)
        }
      }
    }

    connectWs()
  }, [autoConnect, onError])

  // Subscribe to tickers and channels
  useEffect(() => {
    if (!connected || !wsRef.current || tickers.length === 0) return

    wsRef.current.subscribe(tickers, channels)

    return () => {
      if (wsRef.current && tickers.length > 0) {
        wsRef.current.unsubscribe(tickers, channels)
      }
    }
  }, [connected, tickers, channels])

  // Subscribe to user channels
  useEffect(() => {
    if (!connected || !wsRef.current || userChannels.length === 0) return

    wsRef.current.subscribeToUserChannels(userChannels)
  }, [connected, userChannels])

  // Subscribe to public channels
  useEffect(() => {
    if (!connected || !wsRef.current || publicChannels.length === 0) return

    wsRef.current.subscribeToPublicChannels(publicChannels, tickers.length > 0 ? tickers : undefined)
  }, [connected, publicChannels, tickers])

  // Handle messages
  useEffect(() => {
    if (!wsRef.current) return

    const unsubscribe = wsRef.current.onMessage((message) => {
      setLastMessage(message)
      setMessages(prev => [...prev.slice(-99), message]) // Keep last 100 messages
      if (onMessage) {
        onMessage(message)
      }
    })

    return unsubscribe
  }, [onMessage])

  const connect = useCallback(async () => {
    if (!wsRef.current) return
    try {
      await wsRef.current.connect()
      setConnected(true)
    } catch (error) {
      console.error('[useKalshiRealtime] Manual connection error:', error)
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

  const subscribe = useCallback((newTickers: string | string[], newChannels?: KalshiChannel[]) => {
    if (!wsRef.current) return
    wsRef.current.subscribe(newTickers, newChannels || channels)
  }, [channels])

  const unsubscribe = useCallback((tickersToRemove: string | string[], channelsToRemove?: KalshiChannel[]) => {
    if (!wsRef.current) return
    wsRef.current.unsubscribe(tickersToRemove, channelsToRemove || channels)
  }, [channels])

  return {
    connected,
    messages,
    lastMessage,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    client: wsRef.current
  }
}
