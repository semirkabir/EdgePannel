import type { EntityRenderer, EntityRenderContext } from '../types';
import { toBinanceSymbol, fetchOrderBook, fetchRecentTrades, BinanceLiveStream } from '@/services/market/crypto-live';
import type { OrderBookSnapshot, LiveTrade } from '@/services/market/crypto-live';

interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  sparkline?: number[];
}

interface EnrichedCrypto {
  coin: CryptoData;
  binanceSym: string;
  orderBook: OrderBookSnapshot | null;
  trades: LiveTrade[];
}

// ── Formatters ────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '—';
  const abs = Math.abs(price);
  const dec = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return price.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '—';
  return qty >= 1 ? qty.toFixed(3) : qty.toFixed(5);
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getOutlook(change: number): string {
  if (change >= 6)               return 'Breakout momentum';
  if (change >= 2)               return 'Bullish session';
  if (change > 0)                return 'Grinding higher';
  if (change <= -6)              return 'Heavy selloff';
  if (change <= -2)              return 'Pullback in motion';
  if (Math.abs(change) <= 0.5)  return 'Range-bound trade';
  return 'Pressure building';
}

function toTVSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  const map: Record<string, string> = {
    BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
    XRP: 'XRPUSDT', ADA: 'ADAUSDT', DOGE: 'DOGEUSDT', DOT: 'DOTUSDT',
    AVAX: 'AVAXUSDT', MATIC: 'MATICUSDT', POL: 'MATICUSDT', LINK: 'LINKUSDT',
    UNI: 'UNIUSDT', LTC: 'LTCUSDT', ATOM: 'ATOMUSDT', NEAR: 'NEARUSDT',
    APT: 'APTUSDT', ARB: 'ARBUSDT', OP: 'OPUSDT', FIL: 'FILUSDT', TRX: 'TRXUSDT',
  };
  return `BINANCE:${map[s] ?? s + 'USDT'}`;
}

// ── TradingView widget ────────────────────────────────────────────────────

function injectTradingViewWidget(container: HTMLElement, symbol: string): void {
  const wrap = container.querySelector('.edp-tradingview-widget');
  if (!wrap) return;
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
  script.async = true;
  script.textContent = JSON.stringify({
    symbol: toTVSymbol(symbol),
    width: '100%',
    height: 200,
    colorTheme: 'dark',
    isTransparent: true,
    dateRange: '1M',
    locale: 'en',
  });
  wrap.appendChild(script);
}

// ── Tab content builders ──────────────────────────────────────────────────

function buildOverviewTab(coin: CryptoData, ctx: EntityRenderContext): HTMLElement {
  const wrap = ctx.el('div', 'crypto-tab-content');
  const positive = coin.change >= 0;

  const outlook = ctx.el('div', `crypto-outlook ${positive ? 'is-positive' : 'is-negative'}`, getOutlook(coin.change));
  wrap.append(outlook);

  const sparkline = coin.sparkline ?? [];
  if (sparkline.length >= 2) {
    const low      = Math.min(...sparkline);
    const high     = Math.max(...sparkline);
    const momentum = ((sparkline[sparkline.length - 1]! - sparkline[0]!) / (sparkline[0] || 1)) * 100;
    const vol      = ((high - low) / (low || 1)) * 100;

    const [statsCard, statsBody] = ctx.sectionCard('7-Day Stats');
    const grid = ctx.el('div', 'crypto-edp-stats-grid');

    const items: [string, string, string][] = [
      ['7D Low',           '$' + formatPrice(low),                          ''],
      ['7D High',          '$' + formatPrice(high),                         ''],
      ['7D Momentum',      (momentum >= 0 ? '+' : '') + momentum.toFixed(2) + '%', momentum >= 0 ? 'crypto-edp-positive' : 'crypto-edp-negative'],
      ['Range Volatility', vol.toFixed(2) + '%',                             ''],
    ];
    for (const [label, value, cls] of items) {
      const cell = ctx.el('div', 'crypto-edp-stat-cell');
      cell.append(ctx.el('span', 'crypto-edp-stat-label', label));
      cell.append(ctx.el('span', `crypto-edp-stat-value ${cls}`.trim(), value));
      grid.append(cell);
    }
    statsBody.append(grid);
    wrap.append(statsCard);
  }

  const [priceCard, priceBody] = ctx.sectionCard('Price Info');
  priceBody.append(buildRow(ctx, 'Current Price', '$' + formatPrice(coin.price)));
  priceBody.append(buildRow(ctx, '24h Change',
    (positive ? '+' : '') + coin.change.toFixed(2) + '%',
    positive ? 'var(--accent-green, #22c55e)' : 'var(--accent-red, #ef4444)'));
  wrap.append(priceCard);

  return wrap;
}

function buildOrderBookTab(snap: OrderBookSnapshot | null, ctx: EntityRenderContext): HTMLElement {
  const wrap = ctx.el('div', 'crypto-ob-wrap');
  if (!snap) {
    wrap.append(ctx.makeEmpty('Order book unavailable'));
    return wrap;
  }

  const headers = ctx.el('div', 'crypto-ob-headers');
  headers.append(
    ctx.el('span', 'crypto-ob-side-label is-bid', 'Bids'),
    ctx.el('span', 'crypto-ob-side-label is-ask', 'Asks'),
  );
  wrap.append(headers);

  const grid = ctx.el('div', 'crypto-ob-grid');
  grid.dataset['ob'] = '1';

  const allQtys = [...snap.bids, ...snap.asks].map(l => l.qty);
  const maxQty = Math.max(...allQtys, 0.001);

  const bidCol = ctx.el('div', 'crypto-ob-side is-bid');
  const askCol = ctx.el('div', 'crypto-ob-side is-ask');

  snap.bids.forEach(({ price, qty }) => bidCol.append(makeObRow(price, qty, maxQty, true)));
  snap.asks.forEach(({ price, qty }) => askCol.append(makeObRow(price, qty, maxQty, false)));

  grid.append(bidCol, askCol);
  wrap.append(grid);
  return wrap;
}

function makeObRow(price: number, qty: number, maxQty: number, isBid: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = 'crypto-ob-row';
  const bar = document.createElement('div');
  bar.className = `crypto-ob-bar ${isBid ? 'is-bid' : 'is-ask'}`;
  bar.style.width = ((qty / maxQty) * 100).toFixed(1) + '%';
  const priceEl = document.createElement('span');
  priceEl.className = `crypto-ob-price ${isBid ? 'is-bid' : 'is-ask'}`;
  priceEl.textContent = formatPrice(price);
  const qtyEl = document.createElement('span');
  qtyEl.className = 'crypto-ob-qty';
  qtyEl.textContent = formatQty(qty);
  row.append(bar, priceEl, qtyEl);
  return row;
}

function updateOrderBook(wrap: HTMLElement, snap: OrderBookSnapshot): void {
  const grid = wrap.querySelector<HTMLElement>('[data-ob]');
  if (!grid) return;

  const allQtys = [...snap.bids, ...snap.asks].map(l => l.qty);
  const maxQty = Math.max(...allQtys, 0.001);

  const sides = grid.querySelectorAll<HTMLElement>('.crypto-ob-side');
  const [bidCol, askCol] = [sides[0], sides[1]];
  if (!bidCol || !askCol) return;

  const rebuildSide = (col: HTMLElement, levels: OrderBookSnapshot['bids'], isBid: boolean): void => {
    const rows = col.querySelectorAll<HTMLElement>('.crypto-ob-row');
    levels.forEach(({ price, qty }, i) => {
      const row = rows[i];
      if (!row) return;
      const bar   = row.querySelector<HTMLElement>('.crypto-ob-bar');
      const pEl   = row.querySelector<HTMLElement>('.crypto-ob-price');
      const qEl   = row.querySelector<HTMLElement>('.crypto-ob-qty');
      if (bar)  bar.style.width = ((qty / maxQty) * 100).toFixed(1) + '%';
      if (pEl)  pEl.textContent = formatPrice(price);
      if (qEl)  qEl.textContent = formatQty(qty);
      void isBid;
    });
  };

  rebuildSide(bidCol, snap.bids, true);
  rebuildSide(askCol, snap.asks, false);
}

function buildTradesTab(trades: LiveTrade[], ctx: EntityRenderContext): HTMLElement {
  const wrap = ctx.el('div', 'crypto-trade-wrap');
  const header = ctx.el('div', 'crypto-trade-header');
  header.append(
    ctx.el('span', 'crypto-trade-hcol', 'Time'),
    ctx.el('span', 'crypto-trade-hcol', 'Price'),
    ctx.el('span', 'crypto-trade-hcol', 'Size'),
    ctx.el('span', 'crypto-trade-hcol', 'Side'),
  );
  wrap.append(header);

  const feed = ctx.el('div', 'crypto-trade-feed');
  feed.dataset['feed'] = '1';

  for (const t of trades) feed.append(makeTradeRow(t));
  wrap.append(feed);
  return wrap;
}

function makeTradeRow(t: LiveTrade): HTMLElement {
  const row = document.createElement('div');
  row.className = `crypto-trade-row ${t.isBuy ? 'is-buy' : 'is-sell'}`;
  const time  = document.createElement('span');
  time.className = 'crypto-trade-time';
  time.textContent = formatTime(t.time);
  const price = document.createElement('span');
  price.className = 'crypto-trade-price';
  price.textContent = formatPrice(t.price);
  const size = document.createElement('span');
  size.className = 'crypto-trade-size';
  size.textContent = formatQty(t.qty);
  const side = document.createElement('span');
  side.className = `crypto-trade-side ${t.isBuy ? 'is-buy' : 'is-sell'}`;
  side.textContent = t.isBuy ? 'Buy' : 'Sell';
  row.append(time, price, size, side);
  return row;
}

const MAX_TRADES = 30;

function prependTrade(feed: HTMLElement, t: LiveTrade): void {
  feed.prepend(makeTradeRow(t));
  const rows = feed.querySelectorAll('.crypto-trade-row');
  if (rows.length > MAX_TRADES) rows[rows.length - 1]?.remove();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildRow(ctx: EntityRenderContext, label: string, value: string, color?: string): HTMLElement {
  const r = ctx.el('div', 'edp-detail-row');
  r.append(ctx.el('span', 'edp-detail-label', label));
  const v = ctx.el('span', 'edp-detail-value', value);
  if (color) v.style.color = color;
  r.append(v);
  return r;
}

// ── Renderer ─────────────────────────────────────────────────────────────

const TAB_DEFS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'orderbook',  label: 'Order Book' },
  { id: 'trades',     label: 'Trades' },
] as const;

export class CryptoRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const coin = data as CryptoData;
    const positive = coin.change >= 0;
    const container = ctx.el('div', 'edp-generic edp-crypto-detail');

    // Header
    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('div', 'crypto-edp-badge', coin.symbol.slice(0, 5).toUpperCase()));
    header.append(ctx.el('h2', 'edp-title', coin.name));
    header.append(ctx.el('div', 'crypto-edp-subtitle', coin.symbol.toUpperCase() + ' · Crypto'));
    container.append(header);

    // TradingView chart
    container.append(ctx.el('div', 'edp-tradingview-widget'));

    // Live price ticker
    const ticker = ctx.el('div', 'crypto-live-ticker');
    const dot = ctx.el('span', 'crypto-live-dot');
    const priceEl = ctx.el('span', 'crypto-live-price', '$' + formatPrice(coin.price));
    priceEl.dataset['livePrice'] = '1';
    const changeEl = ctx.el('span', `crypto-live-change ${positive ? 'is-positive' : 'is-negative'}`,
      (positive ? '+' : '') + coin.change.toFixed(2) + '% 24h');
    ticker.append(dot, priceEl, changeEl);
    container.append(ticker);

    // Tab bar + panels with loading placeholders
    const tabBar   = ctx.el('div', 'crypto-tab-bar');
    const tabPanel = ctx.el('div', 'crypto-tab-panel');

    TAB_DEFS.forEach((tab, i) => {
      const btn = ctx.el('button', `crypto-tab${i === 0 ? ' is-active' : ''}`) as HTMLButtonElement;
      btn.textContent = tab.label;
      btn.dataset['tab'] = tab.id;

      const pane = ctx.el('div', 'crypto-tab-pane');
      pane.dataset['tab'] = tab.id;
      if (i !== 0) pane.hidden = true;
      pane.append(ctx.makeLoading(''));
      tabPanel.append(pane);

      btn.addEventListener('click', () => {
        tabBar.querySelectorAll('.crypto-tab').forEach((b, j) => {
          (b as HTMLButtonElement).classList.toggle('is-active', j === i);
        });
        tabPanel.querySelectorAll<HTMLElement>('.crypto-tab-pane').forEach((p, j) => {
          p.hidden = j !== i;
        });
      });
      tabBar.append(btn);
    });

    container.append(tabBar, tabPanel);
    injectTradingViewWidget(container, coin.symbol);
    return container;
  }

  async enrich(data: unknown, signal: AbortSignal): Promise<EnrichedCrypto> {
    const coin = data as CryptoData;
    const binanceSym = toBinanceSymbol(coin.symbol);

    const [obResult, tradesResult] = await Promise.allSettled([
      fetchOrderBook(binanceSym, 10),
      fetchRecentTrades(binanceSym, 25),
    ]);

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    return {
      coin,
      binanceSym,
      orderBook: obResult.status === 'fulfilled'     ? obResult.value     : null,
      trades:    tradesResult.status === 'fulfilled' ? tradesResult.value : [],
    };
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const { coin, binanceSym, orderBook, trades } = enrichedData as EnrichedCrypto;

    const panes = Array.from(container.querySelectorAll<HTMLElement>('.crypto-tab-pane'));
    const [overviewPane, obPane, tradesPane] = panes;
    if (!overviewPane || !obPane || !tradesPane) return;

    // Populate tabs
    overviewPane.replaceChildren(buildOverviewTab(coin, ctx));
    const obWrap = buildOrderBookTab(orderBook, ctx);
    obPane.replaceChildren(obWrap);
    const tradeWrap = buildTradesTab(trades, ctx);
    tradesPane.replaceChildren(tradeWrap);

    // Live price DOM refs
    const priceEl = container.querySelector<HTMLElement>('[data-live-price]');
    const dotEl   = container.querySelector<HTMLElement>('.crypto-live-dot');

    let lastPrice = coin.price;

    const stream = new BinanceLiveStream(binanceSym);
    stream.connect({
      onPrice: (price, isBuy) => {
        if (priceEl) {
          priceEl.textContent = '$' + formatPrice(price);
          priceEl.classList.remove('flash-up', 'flash-down');
          void priceEl.offsetWidth; // reflow to retrigger animation
          priceEl.classList.add(price >= lastPrice ? 'flash-up' : 'flash-down');
          lastPrice = price;
        }
        if (dotEl) {
          dotEl.classList.add('is-live');
          dotEl.classList.toggle('is-buy', isBuy);
          dotEl.classList.toggle('is-sell', !isBuy);
        }
      },
      onDepth: (snap) => updateOrderBook(obWrap, snap),
      onTrade: (trade) => {
        const feed = tradeWrap.querySelector<HTMLElement>('[data-feed]');
        if (feed) prependTrade(feed, trade);
      },
    }, ctx.signal);
  }
}
