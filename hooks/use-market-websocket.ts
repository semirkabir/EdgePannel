'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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

  const [isConnected, setIsConnected] = useState(false)
  const [marketUpdates, setMarketUpdates] = useState<Map<string, Partial<Market>>>(new Map())
  const kalshiClientRef = useRef<KalshiWebSocketClient | null>(null)
  const polymarketClientRef = useRef<PolymarketWebSocketClient | null>(null)
  const kalshiEventSourceRef = useRef<EventSource | null>(null)

  const needsKalshiClient = useMemo(() => {
    if (kalshiAccessKeyId && kalshiPrivateKey) return true
    if (selectedMarket?.platform === 'kalshi') return true

    const watchlistHasKalshi = watchlistMarketIds.some(marketId => {
      const market = markets.find(m => m.id === marketId)
      return market?.platform === 'kalshi'
    })
    if (watchlistHasKalshi) return true

    return markets.some(m => m.platform === 'kalshi')
  }, [kalshiAccessKeyId, kalshiPrivateKey, selectedMarket, watchlistMarketIds, markets])

  const shouldUseKalshiProxy = needsKalshiClient && !(kalshiAccessKeyId && kalshiPrivateKey)
  const shouldUseDirectKalshiWs = needsKalshiClient && !shouldUseKalshiProxy

  const kalshiTickerToMarketIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    const watchlistSet = new Set(watchlistMarketIds)

    const relevantMarkets = watchlistMarketIds.length > 0
      ? markets.filter(m => watchlistSet.has(m.id))
      : markets

    const addMapping = (ticker: string, marketId: string) => {
      if (!ticker || !marketId) return
      if (!map.has(ticker)) {
        map.set(ticker, new Set())
      }
      map.get(ticker)!.add(marketId)
    }

    relevantMarkets.forEach(market => {
      if (market.platform !== 'kalshi') return
      if (market.ticker) addMapping(market.ticker, market.id)

      const nestedMarkets = (market as any).markets
      if (Array.isArray(nestedMarkets)) {
        nestedMarkets.forEach((nested: any) => {
          if (nested?.ticker) {
            addMapping(nested.ticker, market.id)
          }
          if (nested?.ticker && nested?.id) {
            addMapping(nested.ticker, nested.id)
          }
        })
      }
    })

    if (selectedMarket?.platform === 'kalshi' && selectedMarket.ticker) {
      addMapping(selectedMarket.ticker, selectedMarket.id)
    }

    return map
  }, [markets, watchlistMarketIds, selectedMarket])

  const kalshiTickers = useMemo(() => {
    const tickers = new Set<string>()
    kalshiTickerToMarketIds.forEach((_ids, ticker) => {
      tickers.add(ticker)
    })
    return Array.from(tickers).slice(0, 200)
  }, [kalshiTickerToMarketIds])

  const handleKalshiTickerUpdate = useCallback((ticker: string, price: number, volume: number) => {
    setMarketUpdates(prev => {
      const updates = new Map(prev)
      const targetIds = kalshiTickerToMarketIds.get(ticker)

      if (targetIds && targetIds.size > 0) {
        targetIds.forEach(marketId => {
          updates.set(marketId, {
            price: price,
            probability: price,
            volume24h: volume,
          })
        })
      } else {
        updates.set(ticker, {
          price: price,
          probability: price,
          volume24h: volume,
        })
      }
      return updates
    })

    if (onTickerUpdate) {
      onTickerUpdate('kalshi', ticker, price, volume)
    }
  }, [kalshiTickerToMarketIds, onTickerUpdate])

  useEffect(() => {
    if (!shouldUseDirectKalshiWs || kalshiClientRef.current) {
      return
    }

    const client = new KalshiWebSocketClient(kalshiAccessKeyId, kalshiPrivateKey)
    kalshiClientRef.current = client

    client.connect().then(() => {
      setIsConnected(true)
    }).catch((error) => {
      console.error('[useMarketWebSocket] Failed to connect Kalshi WS:', error)
    })

    return () => {
      client.disconnect()
      kalshiClientRef.current = null
    }
  }, [shouldUseDirectKalshiWs, kalshiAccessKeyId, kalshiPrivateKey])

  // Initialize Polymarket WebSocket client
  useEffect(() => {
    if (!polymarketClientRef.current) {
      const client = new PolymarketWebSocketClient()
      polymarketClientRef.current = client

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

  // Kalshi SSE proxy (server-side WS) for secure, key-backed streaming
  useEffect(() => {
    if (!shouldUseKalshiProxy || kalshiTickers.length === 0) {
      if (kalshiEventSourceRef.current) {
        kalshiEventSourceRef.current.close()
        kalshiEventSourceRef.current = null
      }
      return
    }

    const url = `/api/ws/kalshi?tickers=${encodeURIComponent(kalshiTickers.join(','))}&channels=ticker`
    const eventSource = new EventSource(url)
    kalshiEventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      if (!event.data) return
      let payload: any
      try {
        payload = JSON.parse(event.data)
      } catch (error) {
        console.warn('[useMarketWebSocket] Kalshi SSE parse error:', error)
        return
      }

      if (payload?.type === 'ticker' && payload?.msg) {
        const ticker = payload.msg.ticker
        const rawPrice = payload.msg.price
        const price = typeof rawPrice === 'number' ? rawPrice / 100 : undefined

        if (ticker && price !== undefined) {
          const volume = payload.msg.volume || 0
          handleKalshiTickerUpdate(ticker, price, volume)
        }
      }
    }

    eventSource.onerror = (error) => {
      console.error('[useMarketWebSocket] Kalshi SSE error:', error)
    }

    return () => {
      eventSource.close()
      if (kalshiEventSourceRef.current === eventSource) {
        kalshiEventSourceRef.current = null
      }
    }
  }, [shouldUseKalshiProxy, kalshiTickers, handleKalshiTickerUpdate])

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
            handleKalshiTickerUpdate(ticker, price, volume)
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
  }, [onTickerUpdate, handleKalshiTickerUpdate])

  const getMarketUpdate = useCallback((marketId: string): Partial<Market> | undefined => {
    return marketUpdates.get(marketId)
  }, [marketUpdates])

  return {
    isConnected,
    marketUpdates,
    getMarketUpdate,
  }
}
