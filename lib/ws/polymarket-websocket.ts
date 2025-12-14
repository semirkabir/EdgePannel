/**
 * Polymarket WebSocket Client
 * Connects to Polymarket's WebSocket API for real-time market updates
 *
 * Using CLOB Market Channel for order book and price updates
 * Documentation: https://docs.polymarket.com/developers/CLOB/websocket/wss-overview
 */

export interface PolymarketWebSocketMessage {
  type: string
  event_type?: string
  asset_id?: string
  market?: string
  price?: number
  timestamp?: number
  [key: string]: any
}

export type PolymarketWebSocketCallback = (message: PolymarketWebSocketMessage) => void

export class PolymarketWebSocketClient {
  private ws: WebSocket | null = null
  // Use CLOB market WebSocket endpoint
  private url: string = 'wss://ws-subscriptions-clob.polymarket.com/ws/market'
  private callbacks: Set<PolymarketWebSocketCallback> = new Set()
  private subscriptions: Set<string> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private isConnecting = false
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor() {
    // CLOB market channel doesn't require authentication for public market data
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    if (this.isConnecting) {
      return Promise.resolve()
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('[Polymarket WS] Connected to CLOB market channel')
          this.isConnecting = false
          this.reconnectAttempts = 0

          // Start heartbeat to keep connection alive
          this.startHeartbeat()

          // Resubscribe to all previous subscriptions
          this.subscriptions.forEach(assetId => {
            this.subscribe(assetId)
          })
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            // Handle PONG responses (they're plain text, not JSON)
            if (typeof event.data === 'string' && event.data === 'PONG') {
              return // Ignore PONG responses
            }

            const message: PolymarketWebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('[Polymarket WS] Error parsing message:', error)
          }
        }

        this.ws.onerror = (error) => {
          if (!this.ws) return // Ignore if disconnected intentionally
          console.error('[Polymarket WS] Error:', error)
          this.isConnecting = false
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('[Polymarket WS] Disconnected')
          this.isConnecting = false
          this.ws = null

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            setTimeout(() => {
              this.connect().catch(console.error)
            }, this.reconnectDelay * this.reconnectAttempts)
          }
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  subscribe(conditionId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue subscription for when connection is ready
      this.subscriptions.add(conditionId)
      this.connect().then(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendSubscribe(conditionId)
        }
      })
      return
    }

    this.subscriptions.add(conditionId)
    this.sendSubscribe(conditionId)
  }

  unsubscribe(conditionId: string): void {
    this.subscriptions.delete(conditionId)

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(conditionId)
    }
  }

  private sendSubscribe(conditionId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // CLOB market channel subscription format (subscribes by asset_id/token)
      const message = {
        type: 'subscribe',
        assets_ids: [conditionId], // Array of asset IDs to subscribe to
      }
      console.log('[Polymarket WS] Subscribing to asset:', conditionId)
      this.ws.send(JSON.stringify(message))
    }
  }

  private sendUnsubscribe(conditionId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'unsubscribe',
        assets_ids: [conditionId],
      }
      this.ws.send(JSON.stringify(message))
    }
  }

  private startHeartbeat(): void {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    // Send ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private handleMessage(message: PolymarketWebSocketMessage): void {
    // Notify all callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(message)
      } catch (error) {
        console.error('[Polymarket WS] Callback error:', error)
      }
    })
  }

  onMessage(callback: PolymarketWebSocketCallback): () => void {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      // Prevent reconnection logic from firing
      this.ws.onclose = null
      this.ws.onerror = null

      this.ws.close()
      this.ws = null
    }
    this.subscriptions.clear()
    this.callbacks.clear()
    this.isConnecting = false
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

