/**
 * Hero live-proof strip — a tiny always-on sample of the same API routes the
 * dashboard uses, rendered directly under the hero CTA. Fails soft: if the
 * APIs are unreachable the strip hides itself rather than show fake numbers.
 */

interface MarketQuote {
  symbol: string;
  name: string;
  display: string;
  price: number;
  change: number;
}

interface RiskScoresResponse {
  strategicRisks: Array<{
    region: string;
    score: number;
    level: string;
  }>;
}

const TIMEOUT_MS = 9000;

const HERO_QUOTES: Array<{ symbol: string; label: string; widget: string }> = [
  { symbol: '^GSPC', label: 'S&P 500', widget: 'hero-spx' },
  { symbol: '^IXIC', label: 'Nasdaq', widget: 'hero-ndx' },
];

function fmtPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<T>;
}

function pulseBand(score: number): string {
  if (score >= 70) return 'High pressure';
  if (score >= 40) return 'Elevated';
  return 'Guarded';
}

function markUpdated(): void {
  const el = document.querySelector<HTMLElement>('#hero-proof [data-slot="updated"]');
  if (el) el.textContent = 'just now';
}

async function loadHeroPulse(): Promise<boolean> {
  const score = document.querySelector<HTMLElement>('[data-widget="hero-pulse"] [data-slot="score"]');
  const level = document.querySelector<HTMLElement>('[data-widget="hero-pulse"] [data-slot="level"]');
  if (!score || !level) return false;
  try {
    const data = await fetchJson<RiskScoresResponse>('/api/intelligence/v1/get-risk-scores');
    const global = data.strategicRisks?.find((r) => r.region === 'global');
    if (!global || !Number.isFinite(global.score)) throw new Error('empty');
    const s = Math.round(global.score);
    score.textContent = String(s);
    level.textContent = pulseBand(s);
    return true;
  } catch {
    return false;
  }
}

async function loadHeroQuotes(): Promise<boolean> {
  try {
    const data = await fetchJson<{ quotes: MarketQuote[] }>(
      '/api/market/v1/list-market-quotes?symbols=' +
        encodeURIComponent(HERO_QUOTES.map((q) => q.symbol).join(','))
    );
    for (const { symbol, widget } of HERO_QUOTES) {
      const tile = document.querySelector<HTMLElement>(`[data-widget="${widget}"]`);
      if (!tile) continue;
      const q = (data.quotes ?? []).find((x) => x.symbol === symbol);
      if (q && Number.isFinite(q.price)) {
        const dir = q.change >= 0 ? 'lp-up' : 'lp-down';
        const priceEl = tile.querySelector<HTMLElement>('[data-slot="price"]');
        const changeEl = tile.querySelector<HTMLElement>('[data-slot="change"]');
        if (priceEl) priceEl.textContent = fmtPrice(q.price);
        if (changeEl) changeEl.innerHTML = `<span class="${dir}">${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}%</span>`;
      } else {
        // Upstream dropped this symbol — hide the tile rather than show a
        // stale placeholder. The strip grid re-flows around the gap.
        tile.hidden = true;
      }
    }
    // "Success" here only gates the updated-timestamp; tiles decide their own fate.
    return (data.quotes ?? []).length > 0;
  } catch {
    // Whole quotes call failed — hide every quote tile.
    for (const { widget } of HERO_QUOTES) {
      const tile = document.querySelector<HTMLElement>(`[data-widget="${widget}"]`);
      if (tile) tile.hidden = true;
    }
    return false;
  }
}

export function initHeroProof(): void {
  const strip = document.getElementById('hero-proof');
  if (!strip) return;
  void Promise.all([loadHeroPulse(), loadHeroQuotes()]).then(([pulseOk, quotesOk]) => {
    if (pulseOk || quotesOk) {
      markUpdated();
    } else {
      // APIs unreachable (offline dev, etc.) — don't lie about freshness.
      strip.hidden = true;
    }
  });
}
