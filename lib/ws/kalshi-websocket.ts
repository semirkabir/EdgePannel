/**
 * Kalshi WebSocket Client (V2)
 * Connects to Kalshi's V2 WebSocket API for real-time market updates.
 * Documentation: https://trading-api.readme.io/reference/websocket
 */

export interface KalshiWebSocketMessage {
  type: string
  id?: number
  msg?: any
  // Legacy support or normalized fields
  market?: string
  ticker?: string
  data?: any
}

export type KalshiWebSocketCallback = (message: KalshiWebSocketMessage) => void

export class KalshiWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private accessKeyId?: string
  private privateKey?: string
  private callbacks: Set<KalshiWebSocketCallback> = new Set()
  private subscriptions: Set<string> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  private msgId = 1

  constructor(accessKeyId?: string, privateKey?: string, useDemo: boolean = false) {
    this.url = useDemo
      ? 'wss://demo-api.kalshi.com/trade-api/v2/ws'
      : 'wss://api.kalshi.com/trade-api/v2/ws'
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
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('[Kalshi WS] Connected to V2 API')
          this.isConnecting = false
          this.reconnectAttempts = 0

          // Resubscribe to all previous subscriptions
          if (this.subscriptions.size > 0) {
            this.sendSubscribe(Array.from(this.subscriptions))
          }
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data)
            // Normalize for internal consumption
            // V2 format: { type: 'ticker', msg: { ticker: '...', price: ... } }
            const message: KalshiWebSocketMessage = {
              type: raw.type,
              id: raw.id,
              msg: raw.msg,
              // Add normalized fields for compatibility
              ticker: raw.msg?.ticker,
              data: raw.msg
            }
            this.handleMessage(message)
          } catch (error) {
            console.error('[Kalshi WS] Error parsing message:', error)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[Kalshi WS] Error:', error)
          this.isConnecting = false
          // Don't reject if already connected, just log
          // If purely connecting (promise pending), reject might be appropriate but difficult to scope with event listeners
        }

        this.ws.onclose = () => {
          console.log('[Kalshi WS] Disconnected')
          this.isConnecting = false
          this.ws = null

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

  // V2 API handles multiple tickers in one request
  subscribe(ticker: string | string[]): void {
    const tickers = Array.isArray(ticker) ? ticker : [ticker]

    tickers.forEach(t => this.subscriptions.add(t))

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect()
      return
    }

    this.sendSubscribe(tickers)
  }

  unsubscribe(ticker: string | string[]): void {
    const tickers = Array.isArray(ticker) ? ticker : [ticker]

    tickers.forEach(t => this.subscriptions.delete(t))

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(tickers)
    }
  }

  private sendSubscribe(tickers: string[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        id: this.msgId++,
        cmd: 'subscribe',
        params: {
          channels: ['ticker', 'orderbook_delta'],
          market_tickers: tickers
        }
      }
      this.ws.send(JSON.stringify(message))
    }
  }

  private sendUnsubscribe(tickers: string[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        id: this.msgId++,
        cmd: 'unsubscribe',
        params: {
          channels: ['ticker', 'orderbook_delta'],
          market_tickers: tickers
        }
      }
      this.ws.send(JSON.stringify(message))
    }
  }

  private handleMessage(message: KalshiWebSocketMessage): void {
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
