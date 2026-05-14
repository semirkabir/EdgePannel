import type { EntityRenderer, EntityRenderContext } from '../types';
import { fetchMultipleStocks } from '@/services/market/index';
import { fetchCompanyProfile, type CompanyProfile } from '@/services/market/finnhub-extra';
import { getHeatmapClass, getChangeClass, formatChange, formatPrice } from '@/utils';
import { SECTOR_CONSTITUENTS } from '@/config/sector-constituents';

export interface SectorData {
  symbol: string;
  name: string;
  change: number | null;
}

interface ConstituentQuote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  marketCap: number | null;
}

interface SectorEnriched {
  symbol: string;
  name: string;
  fullName: string;
  change: number | null;
  constituents: ConstituentQuote[];
}

interface TileRect { x: number; y: number; w: number; h: number; }

const cache = new Map<string, SectorEnriched>();

// ─── Squarified treemap ───────────────────────────────────────────────────────

function tmWorst(row: number[], rowSum: number, side: number): number {
  if (!row.length || !rowSum || !side) return Infinity;
  let worst = 0;
  for (const area of row) {
    const stripW = rowSum / side;
    const itemH = area / stripW;
    worst = Math.max(worst, Math.max(stripW / itemH, itemH / stripW));
  }
  return worst;
}

// Returns rects in 0-100 percentage coordinate space, ordered to match `sorted` input
function buildTreemap(weights: number[]): TileRect[] {
  const n = weights.length;
  if (n === 0) return [];
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return weights.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));

  const result: TileRect[] = new Array(n);
  squarify(weights, 0, n, 0, 0, 100, 100, total, result);
  return result;
}

function squarify(
  values: number[],
  start: number,
  end: number,
  x: number, y: number, w: number, h: number,
  groupTotal: number,
  result: TileRect[],
): void {
  const n = end - start;
  if (n === 0) return;
  if (n === 1) { result[start] = { x, y, w, h }; return; }

  const landscape = w >= h;
  const side = landscape ? h : w;

  let row: number[] = [];
  let rowSum = 0;
  let rowEnd = start;

  for (let i = start; i < end; i++) {
    const area = ((values[i] ?? 0) / groupTotal) * w * h;
    const newRow = [...row, area];
    const newSum = rowSum + area;
    if (!row.length || tmWorst(newRow, newSum, side) <= tmWorst(row, rowSum, side)) {
      row = newRow;
      rowSum = newSum;
      rowEnd = i + 1;
    } else {
      break;
    }
  }

  // Lay out the row strip
  const stripFrac = rowSum / (w * h);
  const stripSize = landscape ? w * stripFrac : h * stripFrac;
  let pos = landscape ? y : x;

  for (let j = start; j < rowEnd; j++) {
    const frac = (row[j - start] ?? 0) / rowSum;
    const tileSize = side * frac;
    result[j] = landscape
      ? { x, y: pos, w: stripSize, h: tileSize }
      : { x: pos, y, w: tileSize, h: stripSize };
    pos += tileSize;
  }

  // Recurse on the remaining area
  if (rowEnd < end) {
    const remainingTotal = groupTotal - values.slice(start, rowEnd).reduce((a, b) => a + b, 0);
    if (landscape) squarify(values, rowEnd, end, x + stripSize, y, w - stripSize, h, remainingTotal, result);
    else            squarify(values, rowEnd, end, x, y + stripSize, w, h - stripSize, remainingTotal, result);
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtMarketCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6)  return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toFixed(0)}`;
}

function makeStatCard(ctx: EntityRenderContext, label: string, value: string, changeValue?: number | null): HTMLElement {
  const el = ctx.el('div', 'edp-stat-highlight');
  if (changeValue != null) {
    el.classList.add(changeValue >= 0 ? 'edp-stat-positive' : 'edp-stat-negative');
  }
  el.append(ctx.el('span', 'edp-stat-highlight-label', label));
  el.append(ctx.el('span', 'edp-stat-highlight-value', value));
  return el;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export class SectorRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const { symbol, name, change } = data as SectorData;
    const meta = SECTOR_CONSTITUENTS[symbol];
    const fullName = meta?.fullName ?? name;
    const container = ctx.el('div', 'edp-generic edp-sector-profile');

    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', fullName));
    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge(symbol, 'edp-badge'));
    if (change != null) {
      const cls = change >= 0 ? 'edp-badge edp-badge-status' : 'edp-badge edp-badge-danger';
      badgeRow.append(ctx.badge(formatChange(change), cls));
    }
    header.append(badgeRow);

    const stats = ctx.el('div', 'edp-trade-stats');
    stats.append(makeStatCard(ctx, 'Sector', fullName));
    stats.append(makeStatCard(ctx, 'Daily Change', change != null ? formatChange(change) : '—', change));
    stats.append(makeStatCard(ctx, 'Top Holdings', '—'));
    header.append(stats);
    container.append(header);

    const wrap = ctx.el('div', 'edp-sector-treemap-wrap');
    wrap.dataset.slot = 'treemap';
    wrap.append(ctx.makeLoading('Loading top holdings…'));
    container.append(wrap);

    return container;
  }

  async enrich(data: unknown, _signal: AbortSignal): Promise<SectorEnriched> {
    const { symbol, name, change } = data as SectorData;
    const cached = cache.get(symbol);
    if (cached) return cached;

    const meta = SECTOR_CONSTITUENTS[symbol];
    const fullName = meta?.fullName ?? name;
    const rawConstituents = meta?.constituents ?? [];

    if (rawConstituents.length === 0) {
      const result: SectorEnriched = { symbol, name, fullName, change, constituents: [] };
      cache.set(symbol, result);
      return result;
    }

    const [quotesResult, profiles] = await Promise.allSettled([
      fetchMultipleStocks(rawConstituents.map(c => ({ symbol: c.symbol, name: c.name, display: c.symbol }))),
      Promise.all(rawConstituents.map(c => fetchCompanyProfile(c.symbol).catch(() => null))),
    ]);

    const quoteMap = new Map<string, { price: number | null; change: number | null }>();
    if (quotesResult.status === 'fulfilled') {
      for (const q of quotesResult.value.data) {
        quoteMap.set(q.symbol, { price: q.price, change: q.change });
      }
    }

    const profileMap = new Map<string, CompanyProfile>();
    if (profiles.status === 'fulfilled') {
      for (const p of profiles.value) {
        if (p) profileMap.set(p.ticker, p);
      }
    }

    const constituents: ConstituentQuote[] = rawConstituents.map((c) => {
      const q = quoteMap.get(c.symbol);
      const prof = profileMap.get(c.symbol);
      return {
        symbol: c.symbol,
        name: prof?.name ?? c.name,
        price: q?.price ?? null,
        change: q?.change ?? null,
        marketCap: prof?.marketCapitalization ? prof.marketCapitalization * 1e6 : null,
      };
    });

    const result: SectorEnriched = { symbol, name, fullName, change, constituents };
    cache.set(symbol, result);
    return result;
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const data = enrichedData as SectorEnriched;

    const titleEl = container.querySelector('.edp-title');
    if (titleEl) titleEl.textContent = data.fullName;

    const stats = container.querySelector('.edp-trade-stats');
    if (stats) {
      stats.replaceChildren();
      stats.append(makeStatCard(ctx, 'Sector', data.fullName));
      stats.append(makeStatCard(ctx, 'Daily Change', data.change != null ? formatChange(data.change) : '—', data.change));
      stats.append(makeStatCard(ctx, 'Top Holdings', String(data.constituents.length)));
    }

    const wrap = container.querySelector<HTMLElement>('[data-slot="treemap"]');
    if (!wrap) return;
    wrap.replaceChildren();

    if (data.constituents.length === 0) {
      wrap.append(ctx.makeEmpty('No top-holding data available for this sector.'));
      return;
    }

    // Sort by market cap descending; squarify needs sorted input for best results
    const sorted = [...data.constituents].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    const hasMarketCap = sorted.some(c => c.marketCap != null && c.marketCap > 0);

    // Fall back to equal weights when market cap is missing
    const nonZeroCaps = sorted.filter(c => c.marketCap && c.marketCap > 0);
    const avgCap = nonZeroCaps.length > 0
      ? nonZeroCaps.reduce((s, c) => s + c.marketCap!, 0) / nonZeroCaps.length
      : 1;
    const weights = sorted.map(c => (hasMarketCap ? (c.marketCap ?? avgCap) : 1));

    const rects = buildTreemap(weights);

    const treemap = ctx.el('div', 'edp-sector-treemap');

    // Shared hover popup inside treemap
    const popup = ctx.el('div', 'edp-sector-tile-popup');
    popup.style.display = 'none';
    treemap.append(popup);

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i]!;
      const r = rects[i];
      if (!r || r.w < 0.5 || r.h < 0.5) continue;

      const tile = ctx.el('button', 'edp-sector-tile') as HTMLButtonElement;
      tile.type = 'button';
      if (c.change != null) tile.classList.add(`sector-tile-${getHeatmapClass(c.change)}`);
      tile.style.left   = `${r.x}%`;
      tile.style.top    = `${r.y}%`;
      tile.style.width  = `${r.w}%`;
      tile.style.height = `${r.h}%`;
      tile.setAttribute('aria-label', `${c.name}: ${c.change != null ? formatChange(c.change) : '—'}`);

      const inner = ctx.el('div', 'edp-sector-tile-inner');

      // Scale content density to tile size
      const ticker = ctx.el('span', 'edp-sector-tile-ticker', c.symbol);
      inner.append(ticker);

      if (r.h > 18) {
        if (c.change != null) {
          const chg = ctx.el('span', `edp-sector-tile-change ${getChangeClass(c.change)}`);
          chg.textContent = formatChange(c.change);
          inner.append(chg);
        }
      }

      if (r.h > 28 && r.w > 12 && c.price != null) {
        inner.append(ctx.el('span', 'edp-sector-tile-price', formatPrice(c.price)));
      }

      if (r.h > 38 && r.w > 16 && hasMarketCap && c.marketCap != null) {
        inner.append(ctx.el('span', 'edp-sector-tile-mcap', fmtMarketCap(c.marketCap)));
      }

      tile.append(inner);

      tile.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
          detail: { type: 'company', data: { ticker: c.symbol, name: c.name } },
        }));
      });

      // Rich hover popup
      tile.addEventListener('mouseenter', () => {
        popup.replaceChildren();
        popup.append(ctx.el('div', 'edp-sector-tile-popup-name', c.name));
        popup.append(ctx.el('div', 'edp-sector-tile-popup-symbol', c.symbol));

        if (c.price != null || c.change != null) {
          const row1 = ctx.el('div', 'edp-sector-tile-popup-row');
          row1.append(ctx.el('span', 'edp-sector-tile-popup-label', 'Price'));
          const priceVal = ctx.el('span', 'edp-sector-tile-popup-value', c.price != null ? formatPrice(c.price) : '—');
          row1.append(priceVal);
          popup.append(row1);
        }

        if (c.change != null) {
          const row2 = ctx.el('div', 'edp-sector-tile-popup-row');
          row2.append(ctx.el('span', 'edp-sector-tile-popup-label', 'Change'));
          const chgVal = ctx.el('span', `edp-sector-tile-popup-value ${getChangeClass(c.change)}`, formatChange(c.change));
          row2.append(chgVal);
          popup.append(row2);
        }

        if (c.marketCap != null) {
          const row3 = ctx.el('div', 'edp-sector-tile-popup-row');
          row3.append(ctx.el('span', 'edp-sector-tile-popup-label', 'Market Cap'));
          row3.append(ctx.el('span', 'edp-sector-tile-popup-value', fmtMarketCap(c.marketCap)));
          popup.append(row3);
        }

        popup.style.display = 'block';
        popup.classList.remove('visible');

        // Position popup relative to tile within treemap
        requestAnimationFrame(() => {
          const treemapRect = treemap.getBoundingClientRect();
          const tileRect = tile.getBoundingClientRect();
          const popupW = popup.offsetWidth;
          const popupH = popup.offsetHeight;
          const gap = 8;

          // Center horizontally over tile, clamp to treemap bounds
          let left = tileRect.left - treemapRect.left + tileRect.width / 2 - popupW / 2;
          left = Math.max(4, Math.min(left, treemapRect.width - popupW - 4));

          // Prefer above; flip below if not enough room
          let top = tileRect.top - treemapRect.top - popupH - gap;
          if (top < 4) {
            top = tileRect.top - treemapRect.top + tileRect.height + gap;
          }
          top = Math.max(4, Math.min(top, treemapRect.height - popupH - 4));

          popup.style.left = `${left}px`;
          popup.style.top = `${top}px`;
          popup.classList.add('visible');
        });
      });

      tile.addEventListener('mouseleave', () => {
        popup.classList.remove('visible');
        // Allow transition to finish before hiding
        setTimeout(() => {
          if (!popup.classList.contains('visible')) popup.style.display = 'none';
        }, 120);
      });

      treemap.append(tile);
    }

    wrap.append(treemap);

    if (!hasMarketCap) {
      const note = ctx.el('p', 'edp-description');
      note.style.fontSize = '11px';
      note.style.marginTop = '6px';
      note.textContent = 'Market cap unavailable — tiles shown at equal size.';
      wrap.append(note);
    }
  }
}
