/**
 * Live proof widgets — fetches a small sample of real data from the same API
 * routes the dashboard uses. Every widget fails soft: on error it shows a
 * static sample and flips its badge from "live" to "sample" so the page never
 * lies about freshness.
 */

import { TICKER_FEEDS, TICKER_CATEGORY_LABELS } from './ticker-data';

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

// Nine seconds of "Connecting…" reads as broken on a page whose whole pitch is
// speed. These routes are CDN-cached and normally answer well inside a second,
// so a shorter budget falls back to a labelled row long before a visitor
// concludes the product is dead.
const TIMEOUT_MS = 6000;
// The feed digest is generated on demand and can be slow on a cold cache, so it
// keeps a longer budget — it is the one call worth waiting on.
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

/** A named row with no value, for when the feed could not be reached. */
function unavailableRow(name: string): string {
  return `<li><span class="lp-row-name">${name}</span><span class="lp-row-value lp-row-unavailable">—</span></li>`;
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

/**
 * Fallback rows name the instruments without inventing prices. Hardcoded numbers
 * were frozen at authoring time, so the longer they shipped the more obviously
 * wrong they looked — a "sample" badge does not rescue a Bitcoin price that is a
 * year stale. Naming the row keeps the layout intact and states plainly that the
 * value could not be fetched.
 */
const MARKET_SAMPLE: string[] = ['S&P 500', 'Nasdaq', 'VIX', 'WTI crude', 'Gold'];

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
    slot.innerHTML = MARKET_SAMPLE.map(unavailableRow).join('');
  }
}

// ---------------------------------------------------------------- crypto/fx

const FX_SAMPLE: string[] = ['Bitcoin', 'Ethereum', 'Solana'];

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
    slot.innerHTML = FX_SAMPLE.map(unavailableRow).join('');
  }
}

// ---------------------------------------------------------------- quakes

interface Earthquake {
  magnitude: number;
  place: string;
  occurredAt: number;
}

// Unlike a quote row, a quake row carries no meaning without its magnitude and
// place — naming a placeholder location would just be inventing an earthquake.
// So this card states the outage instead of filling itself with fiction.
const QUAKE_SAMPLE = `
  <li class="lp-live-placeholder">USGS feed unreachable — live magnitudes resume automatically.</li>`;

async function loadQuakes(): Promise<void> {
  const slot = getSlot('quakes');
  if (!slot) return;
  try {
    // Served through our own Seismology route rather than calling USGS directly
    // from the browser: it keeps the widget behind the same cache and CDN as the
    // rest of the page, removes a hard dependency on a third party's CORS policy,
    // and stops every visitor's IP being handed to earthquake.usgs.gov.
    const data = await fetchJson<{ earthquakes: Earthquake[] }>(
      '/api/seismology/v1/list-earthquakes?min_magnitude=4.5&page_size=5'
    );
    const rows = (data.earthquakes ?? []).slice(0, 5);
    if (!rows.length) throw new Error('empty');
    slot.innerHTML = rows
      .map(
        (q) =>
          `<li><span class="lp-row-name">${escapeHtml(q.place || 'Unknown')}</span><span class="lp-row-value">M${q.magnitude?.toFixed(1)} <span class="lp-row-meta">${timeAgo(q.occurredAt)}</span></span></li>`
      )
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

// ---------------------------------------------------------------- pulse

interface RiskScoresResponse {
  ciiScores: Array<{
    region: string;
    combinedScore: number;
    trend: string;
  }>;
  strategicRisks: Array<{
    region: string;
    score: number;
    level: string;
  }>;
}

/** Country names for the tier-1 codes the risk API scores. */
const PULSE_COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', RU: 'Russia', CN: 'China', UA: 'Ukraine', IR: 'Iran',
  IL: 'Israel', TW: 'Taiwan', KP: 'North Korea', SA: 'Saudi Arabia', TR: 'Turkey',
  PL: 'Poland', DE: 'Germany', FR: 'France', GB: 'United Kingdom', IN: 'India',
  PK: 'Pakistan', SY: 'Syria', YE: 'Yemen', MM: 'Myanmar', VE: 'Venezuela',
};

function pulseBand(score: number): { label: string; cls: string } {
  if (score >= 70) return { label: 'High pressure', cls: 'lp-pulse-high' };
  if (score >= 40) return { label: 'Elevated', cls: 'lp-pulse-elevated' };
  return { label: 'Guarded', cls: 'lp-pulse-guarded' };
}

function renderPulseScore(score: number): void {
  const num = document.querySelector<HTMLElement>('[data-widget="pulse"] [data-slot="score"]');
  const level = document.querySelector<HTMLElement>('[data-widget="pulse"] [data-slot="level"]');
  if (!num || !level) return;
  const band = pulseBand(score);
  num.textContent = String(score);
  num.classList.add(band.cls);
  level.textContent = band.label;
  level.classList.add(band.cls);
}

function pulseCountryRow(code: string, score: number): string {
  const band = pulseBand(score);
  return `<li><span class="lp-row-name">${escapeHtml(PULSE_COUNTRY_NAMES[code] ?? code)}</span><span class="lp-row-value ${band.cls}">${score}</span></li>`;
}

const PULSE_SAMPLE: Array<[string, number]> = [
  ['UA', 78], ['IR', 64], ['SY', 58], ['MM', 55], ['YE', 52],
];

async function loadPulse(): Promise<void> {
  const slot = getSlot('pulse');
  if (!slot) return;
  try {
    const data = await fetchJson<RiskScoresResponse>('/api/intelligence/v1/get-risk-scores');
    const global = data.strategicRisks?.find((r) => r.region === 'global');
    const top = (data.ciiScores ?? [])
      .filter((s) => Number.isFinite(s.combinedScore))
      .slice(0, 5);
    if (!global || !top.length) throw new Error('empty');
    renderPulseScore(Math.round(global.score));
    slot.innerHTML = top
      .map((s) => pulseCountryRow(s.region, Math.round(s.combinedScore)))
      .join('');
  } catch {
    markSample('pulse');
    renderPulseScore(46);
    slot.innerHTML = PULSE_SAMPLE.map(([c, s]) => pulseCountryRow(c, s)).join('');
  }
}

// ---------------------------------------------------------------- ticker

/**
 * The marquee needs two identical copies of the strip: the animation slides
 * the track by exactly -50%, so the second copy takes over seamlessly.
 */
function initTicker(): void {
  const track = document.querySelector<HTMLElement>('[data-slot="ticker-track"]');
  if (!track) return;
  const cards = TICKER_FEEDS.map(
    (f) =>
      `<li class="lp-tick" data-cat="${f.category}"><span class="lp-tick-dot" aria-hidden="true"></span><span class="lp-tick-name">${escapeHtml(f.name)}</span><span class="lp-tick-cadence">${f.cadence}</span><span class="lp-tick-cat">${TICKER_CATEGORY_LABELS[f.category]}</span></li>`
  ).join('');
  track.innerHTML = `<ul class="lp-ticker-strip">${cards}</ul><ul class="lp-ticker-strip" aria-hidden="true">${cards}</ul>`;
}

export function initLiveWidgets(): void {
  initTicker();
  void loadPulse();
  void loadMarkets();
  void loadFx();
  void loadQuakes();
  void loadSignals();
}
