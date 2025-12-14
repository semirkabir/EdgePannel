'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Market } from '@/types/market'
import { KalshiWebSocketClient } from '@/lib/ws/kalshi-websocket'
import { PolymarketWebSocketClient } from '@/lib/ws/polymarket-websocket'

interface UseMarketWebSocketOptions {
  kalshiAccessKeyId?: string
  kalshiPrivateKey?: string
  markets?: Market[]
  selectedMarket?: Market | null
  watchlistMarketIds?: string[]
  onTickerUpdate?: (platform: 'polymarket' | 'kalshi', marketId: string, price: number, volume: number) => void
}

export function useMarketWebSocket(options: UseMarketWebSocketOptions) {
  const {
    kalshiAccessKeyId,
    kalshiPrivateKey,
    markets = [],
    selectedMarket,
    watchlistMarketIds = [],
    onTickerUpdate,
  } = options

  const [kalshiClient, setKalshiClient] = useState<KalshiWebSocketClient | null>(null)
  const [polymarketClient, setPolymarketClient] = useState<PolymarketWebSocketClient | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [marketUpdates, setMarketUpdates] = useState<Map<string, Partial<Market>>>(new Map())
  const kalshiClientRef = useRef<KalshiWebSocketClient | null>(null)
  const polymarketClientRef = useRef<PolymarketWebSocketClient | null>(null)

  // Initialize Kalshi WebSocket client
  useEffect(() => {
    if (kalshiAccessKeyId && kalshiPrivateKey && !kalshiClientRef.current) {
      const client = new KalshiWebSocketClient(kalshiAccessKeyId, kalshiPrivateKey)
      kalshiClientRef.current = client
      setKalshiClient(client)

      client.connect().then(() => {
        setIsConnected(true)
      }).catch((error) => {
        console.error('[useMarketWebSocket] Failed to connect Kalshi WS:', error)
      })

      return () => {
        client.disconnect()
        kalshiClientRef.current = null
      }
    }
  }, [kalshiAccessKeyId, kalshiPrivateKey])

  // Initialize Polymarket WebSocket client
  useEffect(() => {
    if (!polymarketClientRef.current) {
      const client = new PolymarketWebSocketClient()
      polymarketClientRef.current = client
      setPolymarketClient(client)

      client.connect().then(() => {
        if (polymarketClientRef.current === client) {
          setIsConnected(true)
        }
      }).catch((error) => {
        // Only log if we're still using this client
        if (polymarketClientRef.current === client) {
          console.error('[useMarketWebSocket] Failed to connect Polymarket WS:', error)
        }
      })

      return () => {
        client.disconnect()
        polymarketClientRef.current = null
      }
    }
  }, [])

  // Subscribe to selected market
  useEffect(() => {
    if (!selectedMarket) return

    if (selectedMarket.platform === 'kalshi' && kalshiClientRef.current) {
      kalshiClientRef.current.subscribe(selectedMarket.id)
    } else if (selectedMarket.platform === 'polymarket' && polymarketClientRef.current) {
      polymarketClientRef.current.subscribe(selectedMarket.id)
    }

    return () => {
      if (selectedMarket.platform === 'kalshi' && kalshiClientRef.current) {
        kalshiClientRef.current.unsubscribe(selectedMarket.id)
      } else if (selectedMarket.platform === 'polymarket' && polymarketClientRef.current) {
        polymarketClientRef.current.unsubscribe(selectedMarket.id)
      }
    }
  }, [selectedMarket])

  // Subscribe to watchlist markets
  useEffect(() => {
    watchlistMarketIds.forEach(marketId => {
      const market = markets.find(m => m.id === marketId)
      if (!market) return

      if (market.platform === 'kalshi' && kalshiClientRef.current) {
        kalshiClientRef.current.subscribe(marketId)
      } else if (market.platform === 'polymarket' && polymarketClientRef.current) {
        polymarketClientRef.current.subscribe(marketId)
      }
    })

    return () => {
      watchlistMarketIds.forEach(marketId => {
        const market = markets.find(m => m.id === marketId)
        if (!market) return

        if (market.platform === 'kalshi' && kalshiClientRef.current) {
          kalshiClientRef.current.unsubscribe(marketId)
        } else if (market.platform === 'polymarket' && polymarketClientRef.current) {
          polymarketClientRef.current.unsubscribe(marketId)
        }
      })
    }
  }, [watchlistMarketIds, markets])

  // Handle WebSocket messages
  useEffect(() => {
    if (!kalshiClientRef.current && !polymarketClientRef.current) return

    const kalshiUnsubscribe = kalshiClientRef.current?.onMessage((message) => {
      // Handle Kalshi V2 'ticker' messages
      if (message.type === 'ticker' && message.msg) {
        const ticker = message.ticker || message.msg.ticker
        if (ticker) {
          // Kalshi V2 sends prices in cents (integer)
          const rawPrice = message.msg.price // Last traded price
          const price = typeof rawPrice === 'number' ? rawPrice / 100 : undefined

          if (price !== undefined) {
            const volume = message.msg.volume || 0

            setMarketUpdates(prev => {
              const updates = new Map(prev)
              updates.set(ticker, {
                price: price,
                probability: price,
                volume24h: volume,
              })
              return updates
            })

            // Notify whale trade detector if callback provided
            if (onTickerUpdate) {
              onTickerUpdate('kalshi', ticker, price, volume)
            }
          }
        }
      }
      // Legacy or other message types fallback
      else if (message.type === 'market_update' || message.type === 'price_update') {
        const ticker = message.ticker || message.market
        if (ticker) {
          setMarketUpdates(prev => {
            const updates = new Map(prev)
            updates.set(ticker, {
              price: message.data?.price,
              probability: message.data?.price,
              volume24h: message.data?.volume,
            })
            return updates
          })
        }
      }
    })

    const polymarketUnsubscribe = polymarketClientRef.current?.onMessage((message) => {
      if (message.type === 'orderbook_update' || message.type === 'price_update') {
        const conditionId = message.condition_id || message.market
        if (conditionId) {
          const price = message.data?.price
          const volume = message.data?.volume || 0

          setMarketUpdates(prev => {
            const updates = new Map(prev)
            updates.set(conditionId, {
              price,
              probability: price,
              volume24h: volume,
            })
            return updates
          })

          // Notify whale trade detector if callback provided
          if (onTickerUpdate && price !== undefined) {
            onTickerUpdate('polymarket', conditionId, price, volume)
          }
        }
      }
    })

    return () => {
      kalshiUnsubscribe?.()
      polymarketUnsubscribe?.()
    }
  }, [onTickerUpdate])

  const getMarketUpdate = useCallback((marketId: string): Partial<Market> | undefined => {
    return marketUpdates.get(marketId)
  }, [marketUpdates])

  return {
    isConnected,
    marketUpdates,
    getMarketUpdate,
  }
}

