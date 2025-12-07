/**
 * Kalshi WebSocket Client
 * Connects to Kalshi's WebSocket API for real-time market updates
 * 
 * Note: Kalshi WebSocket documentation may vary. This is a basic implementation
 * that can be extended based on actual Kalshi WebSocket API specifications.
 */

export interface KalshiWebSocketMessage {
  type: string
  data: any
  market?: string
  ticker?: string
}

export type KalshiWebSocketCallback = (message: KalshiWebSocketMessage) => void

export class KalshiWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private accessKeyId: string
  private privateKey: string
  private callbacks: Set<KalshiWebSocketCallback> = new Set()
  private subscriptions: Set<string> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false

  constructor(accessKeyId: string, privateKey: string, useDemo: boolean = false) {
    // Kalshi WebSocket endpoint (update based on actual documentation)
    this.url = useDemo
      ? 'wss://demo-api.kalshi.com/trade-api/v2/ws'
      : 'wss://api.elections.kalshi.com/trade-api/v2/ws'
    this.accessKeyId = accessKeyId
    this.privateKey = privateKey
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
        // Create WebSocket connection
        // Note: Kalshi may require authentication via query params or initial message
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('[Kalshi WS] Connected')
          this.isConnecting = false
          this.reconnectAttempts = 0
          
          // Authenticate if required
          this.authenticate()
            .then(() => {
              // Resubscribe to all previous subscriptions
              this.subscriptions.forEach(ticker => {
                this.subscribe(ticker)
              })
              resolve()
            })
            .catch(reject)
        }

        this.ws.onmessage = (event) => {
          try {
            const message: KalshiWebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('[Kalshi WS] Error parsing message:', error)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[Kalshi WS] Error:', error)
          this.isConnecting = false
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('[Kalshi WS] Disconnected')
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

  private async authenticate(): Promise<void> {
    // Kalshi WebSocket authentication
    // This may require sending an auth message with signed credentials
    // Implementation depends on Kalshi's actual WebSocket auth protocol
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Example auth message (update based on actual Kalshi requirements)
      const authMessage = {
        type: 'auth',
        access_key_id: this.accessKeyId,
        // Add signature if required
      }
      this.ws.send(JSON.stringify(authMessage))
    }
  }

  subscribe(ticker: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue subscription for when connection is ready
      this.subscriptions.add(ticker)
      this.connect().then(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendSubscribe(ticker)
        }
      })
      return
    }

    this.subscriptions.add(ticker)
    this.sendSubscribe(ticker)
  }

  unsubscribe(ticker: string): void {
    this.subscriptions.delete(ticker)
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(ticker)
    }
  }

  private sendSubscribe(ticker: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        ticker: ticker,
      }
      this.ws.send(JSON.stringify(message))
    }
  }

  private sendUnsubscribe(ticker: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'unsubscribe',
        ticker: ticker,
      }
      this.ws.send(JSON.stringify(message))
    }
  }

  private handleMessage(message: KalshiWebSocketMessage): void {
    // Notify all callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(message)
      } catch (error) {
        console.error('[Kalshi WS] Callback error:', error)
      }
    })
  }

  onMessage(callback: KalshiWebSocketCallback): () => void {
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

