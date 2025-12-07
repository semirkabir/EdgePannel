/**
 * Polymarket WebSocket Client
 * Connects to Polymarket's WebSocket API for real-time orderbook updates
 * 
 * Polymarket uses WebSocket for real-time market data
 * Documentation: https://docs.polymarket.com
 */

export interface PolymarketWebSocketMessage {
  type: string
  channel?: string
  data?: any
  market?: string
  condition_id?: string
}

export type PolymarketWebSocketCallback = (message: PolymarketWebSocketMessage) => void

export class PolymarketWebSocketClient {
  private ws: WebSocket | null = null
  private url: string = 'wss://clob.polymarket.com/ws'
  private callbacks: Set<PolymarketWebSocketCallback> = new Set()
  private subscriptions: Set<string> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false

  constructor() {
    // Polymarket WebSocket is public, no auth required for market data
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
          console.log('[Polymarket WS] Connected')
          this.isConnecting = false
          this.reconnectAttempts = 0
          
          // Resubscribe to all previous subscriptions
          this.subscriptions.forEach(conditionId => {
            this.subscribe(conditionId)
          })
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: PolymarketWebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('[Polymarket WS] Error parsing message:', error)
          }
        }

        this.ws.onerror = (error) => {
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
      // Polymarket WebSocket subscription format
      const message = {
        type: 'subscribe',
        channel: `market:${conditionId}`,
        condition_id: conditionId,
      }
      this.ws.send(JSON.stringify(message))
    }
  }

  private sendUnsubscribe(conditionId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'unsubscribe',
        channel: `market:${conditionId}`,
        condition_id: conditionId,
      }
      this.ws.send(JSON.stringify(message))
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
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.subscriptions.clear()
    this.callbacks.clear()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

