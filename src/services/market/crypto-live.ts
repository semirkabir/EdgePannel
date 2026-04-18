const BINANCE_REST = 'https://api.binance.com/api/v3';
const BINANCE_WS   = 'wss://stream.binance.com:9443/stream';

export function toBinanceSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s === 'MATIC' || s === 'POL') return 'MATICUSDT';
  if (s === 'SHIB') return 'SHIBUSDT';
  return `${s}USDT`;
}

export interface OrderLevel {
  price: number;
  qty: number;
}

export interface LiveTrade {
  id: number;
  price: number;
  qty: number;
  time: number;
  isBuy: boolean;
}

export interface OrderBookSnapshot {
  bids: OrderLevel[];
  asks: OrderLevel[];
}

export async function fetchOrderBook(sym: string, limit = 10): Promise<OrderBookSnapshot> {
  const r = await fetch(`${BINANCE_REST}/depth?symbol=${sym}&limit=${limit}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`depth HTTP ${r.status}`);
  const d = await r.json() as { bids: string[][]; asks: string[][] };
  return {
    bids: d.bids.map(b => ({ price: +b[0]!, qty: +b[1]! })),
    asks: d.asks.map(a => ({ price: +a[0]!, qty: +a[1]! })),
  };
}

export async function fetchRecentTrades(sym: string, limit = 20): Promise<LiveTrade[]> {
  const r = await fetch(`${BINANCE_REST}/aggTrades?symbol=${sym}&limit=${limit}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`aggTrades HTTP ${r.status}`);
  const d = await r.json() as Array<{ a: number; p: string; q: string; T: number; m: boolean }>;
  return d.map(t => ({ id: t.a, price: +t.p, qty: +t.q, time: t.T, isBuy: !t.m })).reverse();
}

export class BinanceLiveStream {
  private ws: WebSocket | null = null;

  constructor(private readonly sym: string) {}

  connect(opts: {
    onTrade?: (t: LiveTrade) => void;
    onDepth?: (snap: OrderBookSnapshot) => void;
    onPrice?: (price: number, isBuy: boolean) => void;
  }, signal: AbortSignal): void {
    const s = this.sym.toLowerCase();
    const streams = [];
    if (opts.onTrade || opts.onPrice) streams.push(`${s}@aggTrade`);
    if (opts.onDepth)                  streams.push(`${s}@depth10@1000ms`);
    if (!streams.length) return;

    const url = `${BINANCE_WS}?streams=${streams.join('/')}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as { stream: string; data: Record<string, unknown> };
        const { stream, data } = msg;
        if (stream.includes('aggTrade')) {
          const trade: LiveTrade = {
            id: data['a'] as number,
            price: +(data['p'] as string),
            qty: +(data['q'] as string),
            time: data['T'] as number,
            isBuy: !(data['m'] as boolean),
          };
          opts.onTrade?.(trade);
          opts.onPrice?.(trade.price, trade.isBuy);
        } else if (stream.includes('depth')) {
          const snap: OrderBookSnapshot = {
            bids: (data['bids'] as string[][]).map(b => ({ price: +b[0]!, qty: +b[1]! })),
            asks: (data['asks'] as string[][]).map(a => ({ price: +a[0]!, qty: +a[1]! })),
          };
          opts.onDepth?.(snap);
        }
      } catch { /* ignore malformed */ }
    };

    signal.addEventListener('abort', () => { ws.close(); this.ws = null; }, { once: true });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
