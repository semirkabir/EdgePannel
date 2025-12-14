/**
 * Polymarket User WebSocket Client
 * Connects to Polymarket's authenticated user channel for real-time order and trade updates
 *
 * Documentation: https://docs.polymarket.com/developers/CLOB/websocket/user-channel
 *
 * Events:
 * - MATCHED: Order matched (but not yet mined)
 * - MINED: Transaction mined on blockchain
 * - CONFIRMED: Transaction confirmed
 * - RETRYING: Order placement retry
 * - FAILED: Order failed
 * - PLACEMENT: New order placed
 * - UPDATE: Order updated
 * - CANCELLATION: Order cancelled
 */

export interface PolymarketUserWebSocketMessage {
  type: string
  event_type?: 'MATCHED' | 'MINED' | 'CONFIRMED' | 'RETRYING' | 'FAILED' | 'PLACEMENT' | 'UPDATE' | 'CANCELLATION'
  order_id?: string
  market?: string
  asset_id?: string
  price?: number
  size?: number
  side?: 'BUY' | 'SELL'
  timestamp?: number
  [key: string]: any
}

export type PolymarketUserWebSocketCallback = (message: PolymarketUserWebSocketMessage) => void

export class PolymarketUserWebSocketClient {
  private ws: WebSocket | null = null
  private url: string = 'wss://ws-subscriptions-clob.polymarket.com/ws/user'
  private apiKey: string
  private callbacks: Set<PolymarketUserWebSocketCallback> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private isConnecting = false
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('[Polymarket User WS] API key is required for authenticated user channel')
    }
    this.apiKey = apiKey
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
        // User channel requires authentication via API key
        const wsUrl = `${this.url}?apiKey=${this.apiKey}`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log('[Polymarket User WS] Connected to authenticated user channel')
          this.isConnecting = false
          this.reconnectAttempts = 0

          // Start heartbeat to keep connection alive
          this.startHeartbeat()

          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            // Handle PONG responses
            if (typeof event.data === 'string' && event.data === 'PONG') {
              return
            }

            const message: PolymarketUserWebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('[Polymarket User WS] Error parsing message:', error)
          }
        }

        this.ws.onerror = (error) => {
          if (!this.ws) return
          console.error('[Polymarket User WS] Error:', error)
          this.isConnecting = false
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('[Polymarket User WS] Disconnected')
          this.isConnecting = false
          this.ws = null

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            console.log(`[Polymarket User WS] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
            setTimeout(() => {
              this.connect().catch(console.error)
            }, this.reconnectDelay * this.reconnectAttempts)
          } else {
            console.error('[Polymarket User WS] Max reconnection attempts reached')
          }
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
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

  private handleMessage(message: PolymarketUserWebSocketMessage): void {
    // Log important events
    if (message.event_type) {
      console.log('[Polymarket User WS] Event:', message.event_type, message)
    }

    // Notify all callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(message)
      } catch (error) {
        console.error('[Polymarket User WS] Callback error:', error)
      }
    })
  }

  onMessage(callback: PolymarketUserWebSocketCallback): () => void {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Filter messages by event type
   */
  onEvent(
    eventType: 'MATCHED' | 'MINED' | 'CONFIRMED' | 'RETRYING' | 'FAILED' | 'PLACEMENT' | 'UPDATE' | 'CANCELLATION',
    callback: (message: PolymarketUserWebSocketMessage) => void
  ): () => void {
    const wrappedCallback = (message: PolymarketUserWebSocketMessage) => {
      if (message.event_type === eventType) {
        callback(message)
      }
    }

    this.callbacks.add(wrappedCallback)
    return () => {
      this.callbacks.delete(wrappedCallback)
    }
  }

  disconnect(): void {
    this.stopHeartbeat()
    this.isConnecting = false

    if (this.ws) {
      // Prevent reconnection logic from firing
      this.ws.onclose = null
      this.ws.onerror = null

      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.close()
        } catch (error) {
          // Silently ignore close errors
        }
      }
      this.ws = null
    }
    this.callbacks.clear()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
