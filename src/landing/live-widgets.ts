/**
 * Live proof widgets — fetches a small sample of real data from the same API
 * routes the dashboard uses. Every widget fails soft: on error it shows a
 * static sample and flips its badge from "live" to "sample" so the page never
 * lies about freshness.
 */

interface MarketQuote {
  symbol: string;
  name: string;
  display: string;
  price: number;
  change: number;
}

interface CryptoQuote {
  name: string;
  symbol: string;
  price: number;
  change: number;
}

interface NewsItem {
  source: string;
  title: string;
  link: string;
  publishedAt: number;
}

const TIMEOUT_MS = 9000;
// The feed digest is generated on demand and can be slow on a cold cache.
const DIGEST_TIMEOUT_MS = 20000;

/** Friendly display names — the quotes API sometimes echoes raw symbols. */
const SYMBOL_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'Nasdaq',
  '^VIX': 'VIX',
  'CL=F': 'WTI crude',
  'GC=F': 'Gold',
};

function getSlot(widget: string): HTMLElement | null {
  return document.querySelector(`[data-widget="${widget}"] [data-slot="rows"]`);
}

function markSample(widget: string): void {
  const badge = document.querySelector(`[data-widget="${widget}"] .lp-live-badge`);
  if (badge) {
    badge.classList.add('lp-sample');
    badge.textContent = 'sample';
  }
}

async function fetchJson<T>(url: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<T>;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function fmtPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtChange(change: number): string {
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}

function quoteRow(name: string, price: number, change: number): string {
  const dir = change >= 0 ? 'lp-up' : 'lp-down';
  return `<li><span class="lp-row-name">${name}</span><span class="lp-row-value">${fmtPrice(price)} <span class="${dir}">${fmtChange(change)}</span></span></li>`;
}

function timeAgo(ts: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr`;
  return `${Math.round(hours / 24)} days`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
}

// ---------------------------------------------------------------- markets

const MARKET_SAMPLE: Array<[string, number, number]> = [
  ['S&P 500', 6521, 0.42],
  ['Nasdaq', 21480, -0.31],
  ['VIX', 15.8, 1.9],
  ['WTI crude', 78.4, 0.8],
  ['Gold', 3390, 0.2],
];

async function loadMarkets(): Promise<void> {
  const slot = getSlot('markets');
  if (!slot) return;
  try {
    const data = await fetchJson<{ quotes: MarketQuote[] }>(
      '/api/market/v1/list-market-quotes?symbols=' +
        encodeURIComponent('^GSPC,^IXIC,^VIX,CL=F,GC=F')
    );
    const quotes = (data.quotes ?? []).filter((q) => Number.isFinite(q.price)).slice(0, 5);
    // A partial response (rate-limited upstream) looks broken — prefer sample.
    if (quotes.length < 3) throw new Error('partial');
    slot.innerHTML = quotes
      .map((q) => {
        const label = SYMBOL_NAMES[q.symbol] ?? q.name ?? q.display ?? q.symbol;
        return quoteRow(escapeHtml(label), q.price, q.change);
      })
      .join('');
  } catch {
    markSample('markets');
    slot.innerHTML = MARKET_SAMPLE.map(([n, p, c]) => quoteRow(n, p, c)).join('');
  }
}

// ---------------------------------------------------------------- crypto/fx

const FX_SAMPLE: Array<[string, number, number]> = [
  ['Bitcoin', 64100, -1.2],
  ['Ethereum', 1830, -0.8],
  ['Solana', 142, 0.6],
];

async function loadFx(): Promise<void> {
  const slot = getSlot('fx');
  if (!slot) return;
  try {
    const data = await fetchJson<{ quotes: CryptoQuote[] }>(
      '/api/market/v1/list-crypto-quotes?ids=bitcoin,ethereum,solana,ripple,cardano'
    );
    const quotes = (data.quotes ?? []).filter((q) => Number.isFinite(q.price)).slice(0, 5);
    if (!quotes.length) throw new Error('empty');
    slot.innerHTML = quotes
      .map((q) => quoteRow(escapeHtml(titleCase(q.name || q.symbol)), q.price, q.change))
      .join('');
  } catch {
    markSample('fx');
    slot.innerHTML = FX_SAMPLE.map(([n, p, c]) => quoteRow(n, p, c)).join('');
  }
}

// ---------------------------------------------------------------- quakes

interface UsgsFeature {
  properties: { mag: number; place: string; time: number };
}

const QUAKE_SAMPLE = `
  <li><span class="lp-row-name">South of Fiji</span><span class="lp-row-value">M5.6</span></li>
  <li><span class="lp-row-name">Mindanao, Philippines</span><span class="lp-row-value">M5.1</span></li>
  <li><span class="lp-row-name">Central Chile</span><span class="lp-row-value">M4.8</span></li>
  <li><span class="lp-row-name">Hindu Kush</span><span class="lp-row-value">M4.6</span></li>`;

async function loadQuakes(): Promise<void> {
  const slot = getSlot('quakes');
  if (!slot) return;
  try {
    const data = await fetchJson<{ features: UsgsFeature[] }>(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'
    );
    const rows = (data.features ?? []).slice(0, 5);
    if (!rows.length) throw new Error('empty');
    slot.innerHTML = rows
      .map((f) => {
        const p = f.properties;
        return `<li><span class="lp-row-name">${escapeHtml(p.place || 'Unknown')}</span><span class="lp-row-value">M${p.mag?.toFixed(1)} <span class="lp-row-meta">${timeAgo(p.time)}</span></span></li>`;
      })
      .join('');
  } catch {
    markSample('quakes');
    slot.innerHTML = QUAKE_SAMPLE;
  }
}

// ---------------------------------------------------------------- signals

interface DigestResponse {
  categories: Record<string, { items: NewsItem[] }>;
}

const SIGNAL_SAMPLE = `
  <li class="lp-live-headline"><a>Wire services and official channels stream here the moment the map loads.</a><span class="lp-row-meta">Sample</span></li>
  <li class="lp-live-headline"><a>680+ feeds are deduplicated and clustered into signals.</a><span class="lp-row-meta">Sample</span></li>`;

async function loadSignals(): Promise<void> {
  const slot = getSlot('signals');
  if (!slot) return;
  try {
    const data = await fetchJson<DigestResponse>(
      '/api/news/v1/list-feed-digest?variant=full&lang=en',
      DIGEST_TIMEOUT_MS
    );
    const sorted = Object.values(data.categories ?? {})
      .flatMap((bucket) => bucket.items ?? [])
      .sort((a, b) => b.publishedAt - a.publishedAt);
    // Cap per-source so one prolific feed doesn't fill the whole card.
    const perSource = new Map<string, number>();
    const items: NewsItem[] = [];
    for (const item of sorted) {
      const seen = perSource.get(item.source) ?? 0;
      if (seen >= 2) continue;
      perSource.set(item.source, seen + 1);
      items.push(item);
      if (items.length === 4) break;
    }
    if (!items.length) throw new Error('empty');
    slot.innerHTML = items
      .map(
        (item) =>
          `<li class="lp-live-headline"><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener nofollow">${escapeHtml(item.title)}</a><span class="lp-row-meta">${escapeHtml(item.source)} · ${timeAgo(item.publishedAt)}</span></li>`
      )
      .join('');
  } catch {
    markSample('signals');
    slot.innerHTML = SIGNAL_SAMPLE;
  }
}

export function initLiveWidgets(): void {
  void loadMarkets();
  void loadFx();
  void loadQuakes();
  void loadSignals();
}
