/**
 * Live Polymarket CLOB orderbook subscription.
 *
 * Connects to wss://ws-subscriptions-clob.polymarket.com/ws/market and
 * maintains a per-token-id live book. Reference-counts subscribers so a
 * single WebSocket serves every Book tab open in the UI. Closes cleanly
 * when the last subscriber unsubscribes.
 *
 * See: https://docs.polymarket.com/trading/orderbook
 *      https://docs.polymarket.com/developers/CLOB/websocket/wss-overview
 */

export interface BookLevel {
  price: number;
  size: number;
}

export interface LiveBookSnapshot {
  tokenId: string;
  bids: BookLevel[];   // Highest → lowest
  asks: BookLevel[];   // Lowest → highest
  tickSize?: string;
  minOrderSize?: string;
  timestamp: number;   // ms since epoch (0 if unknown)
  hash?: string;
  lastTradePrice?: number;
  lastTradeSide?: 'BUY' | 'SELL';
}

export type BookListener = (snapshot: LiveBookSnapshot) => void;

interface PriceChangeEntry {
  price?: string | number;
  side?: 'BUY' | 'SELL';
  size?: string | number;
}

interface ServerBookLevel {
  price?: string | number;
  size?: string | number;
}

interface ServerEvent {
  event_type: 'book' | 'price_change' | 'tick_size_change' | 'last_trade_price' | string;
  asset_id?: string;
  market?: string;
  bids?: ServerBookLevel[];
  asks?: ServerBookLevel[];
  changes?: PriceChangeEntry[];
  hash?: string;
  timestamp?: string | number;
  tick_size?: string;
  new_tick_size?: string;
  min_order_size?: string;
  price?: string | number;
  size?: string | number;
  side?: 'BUY' | 'SELL';
}

interface TokenState {
  tokenId: string;
  listeners: Set<BookListener>;
  snapshot: LiveBookSnapshot;
}

const WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const PING_INTERVAL_MS = 10_000;  // Polymarket recommends ~10s
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

const states = new Map<string, TokenState>();

function parseNum(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseTimestamp(raw: unknown): number {
  const n = parseNum(raw);
  if (!n) return 0;
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

function sortBids(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => b.price - a.price);
}

function sortAsks(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => a.price - b.price);
}

function applyPriceChange(
  existing: BookLevel[],
  price: number,
  size: number,
): BookLevel[] {
  if (!Number.isFinite(price) || price <= 0) return existing;
  const next = existing.filter((l) => l.price !== price);
  if (size > 0) next.push({ price, size });
  return next;
}

function emit(state: TokenState): void {
  // Freeze into a shallow clone so consumers can mutate freely.
  const frozen: LiveBookSnapshot = {
    ...state.snapshot,
    bids: sortBids(state.snapshot.bids),
    asks: sortAsks(state.snapshot.asks),
  };
  state.snapshot = frozen;
  for (const listener of state.listeners) {
    try { listener(frozen); } catch (e) { console.warn('[PolymarketWS] listener threw:', e); }
  }
}

function getOrCreateState(tokenId: string): TokenState {
  const existing = states.get(tokenId);
  if (existing) return existing;
  const state: TokenState = {
    tokenId,
    listeners: new Set(),
    snapshot: { tokenId, bids: [], asks: [], timestamp: 0 },
  };
  states.set(tokenId, state);
  return state;
}

function handleServerEvent(raw: unknown): void {
  const events: ServerEvent[] = Array.isArray(raw) ? raw as ServerEvent[] : [raw as ServerEvent];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const tokenId = ev.asset_id || '';
    if (!tokenId) continue;
    const state = states.get(tokenId);
    if (!state) continue;

    switch (ev.event_type) {
      case 'book': {
        const bids = (ev.bids || []).map((l) => ({ price: parseNum(l.price), size: parseNum(l.size) }))
          .filter((l) => l.size > 0 && l.price > 0);
        const asks = (ev.asks || []).map((l) => ({ price: parseNum(l.price), size: parseNum(l.size) }))
          .filter((l) => l.size > 0 && l.price > 0);
        state.snapshot = {
          ...state.snapshot,
          bids,
          asks,
          hash: ev.hash || state.snapshot.hash,
          timestamp: parseTimestamp(ev.timestamp) || Date.now(),
        };
        emit(state);
        break;
      }
      case 'price_change': {
        let bids = state.snapshot.bids;
        let asks = state.snapshot.asks;
        for (const change of ev.changes || []) {
          const price = parseNum(change.price);
          const size = parseNum(change.size);
          if (change.side === 'BUY') {
            bids = applyPriceChange(bids, price, size);
          } else if (change.side === 'SELL') {
            asks = applyPriceChange(asks, price, size);
          }
        }
        state.snapshot = {
          ...state.snapshot,
          bids,
          asks,
          hash: ev.hash || state.snapshot.hash,
          timestamp: parseTimestamp(ev.timestamp) || Date.now(),
        };
        emit(state);
        break;
      }
      case 'tick_size_change': {
        state.snapshot = {
          ...state.snapshot,
          tickSize: ev.new_tick_size || ev.tick_size || state.snapshot.tickSize,
          timestamp: parseTimestamp(ev.timestamp) || Date.now(),
        };
        emit(state);
        break;
      }
      case 'last_trade_price': {
        const side: 'BUY' | 'SELL' | undefined = ev.side === 'BUY' || ev.side === 'SELL' ? ev.side : undefined;
        state.snapshot = {
          ...state.snapshot,
          lastTradePrice: parseNum(ev.price),
          lastTradeSide: side,
          timestamp: parseTimestamp(ev.timestamp) || Date.now(),
        };
        emit(state);
        break;
      }
      default:
        // Silently ignore unknown event types.
        break;
    }
  }
}

function sendSubscribe(): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const assetIds = [...states.keys()];
  if (assetIds.length === 0) return;
  try {
    socket.send(JSON.stringify({ type: 'market', assets_ids: assetIds }));
  } catch (e) {
    console.warn('[PolymarketWS] subscribe send failed:', e);
  }
}

function clearTimers(): void {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function scheduleReconnect(): void {
  if (states.size === 0) return;
  if (reconnectTimer) return;
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, delay);
}

function openSocket(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (typeof WebSocket === 'undefined') return;  // SSR / tests

  try {
    socket = new WebSocket(WS_URL);
  } catch (e) {
    console.warn('[PolymarketWS] construct failed:', e);
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    reconnectAttempt = 0;
    sendSubscribe();
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        try { socket.send('PING'); } catch { /* ignore */ }
      }
    }, PING_INTERVAL_MS);
  });

  socket.addEventListener('message', (event) => {
    const data = event.data;
    if (typeof data !== 'string') return;
    // Polymarket responds to PING with PONG — ignore non-JSON frames.
    if (data === 'PONG' || data === 'pong') return;
    try {
      const parsed = JSON.parse(data);
      handleServerEvent(parsed);
    } catch {
      // Non-JSON or malformed frame — ignore.
    }
  });

  socket.addEventListener('close', () => {
    clearTimers();
    socket = null;
    if (states.size > 0) scheduleReconnect();
  });

  socket.addEventListener('error', () => {
    // 'close' follows 'error' — reconnect is handled there.
  });
}

function closeSocketIfIdle(): void {
  if (states.size > 0) return;
  clearTimers();
  if (socket) {
    try { socket.close(); } catch { /* ignore */ }
    socket = null;
  }
  reconnectAttempt = 0;
}

/**
 * Subscribe to live orderbook updates for a Polymarket CLOB token.
 *
 * The listener receives a fresh snapshot after every book/price_change event.
 * Returns an unsubscribe function — call it to release the subscription.
 */
export function subscribeToOrderbook(tokenId: string, listener: BookListener): () => void {
  if (!tokenId) return () => {};
  const state = getOrCreateState(tokenId);
  const wasEmpty = state.listeners.size === 0;
  state.listeners.add(listener);

  // Replay current snapshot if one exists already.
  if (state.snapshot.bids.length > 0 || state.snapshot.asks.length > 0) {
    try { listener(state.snapshot); } catch { /* ignore */ }
  }

  if (!socket) {
    openSocket();
  } else if (socket.readyState === WebSocket.OPEN && wasEmpty) {
    // New token added to an existing connection — resubscribe with the full list.
    sendSubscribe();
  }

  return () => {
    state.listeners.delete(listener);
    if (state.listeners.size === 0) {
      states.delete(tokenId);
      closeSocketIfIdle();
    }
  };
}

/** Internal: test-only helper to reset all state. */
export function __resetOrderbookState(): void {
  states.clear();
  clearTimers();
  if (socket) {
    try { socket.close(); } catch { /* ignore */ }
    socket = null;
  }
  reconnectAttempt = 0;
}
