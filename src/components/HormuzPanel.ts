import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { fetchHormuzTracker } from '@/services/hormuz-tracker';
import type { HormuzTrackerData, HormuzChart, HormuzSeries } from '@/services/hormuz-tracker';
import {
  startHormuzTransits,
  stopHormuzTransits,
  subscribeHormuzTransits,
  getTransitStats,
  type HormuzTimeframe,
  type TransitStats,
} from '@/services/hormuz-transits';

const CHART_COLORS = ['#e67e22', '#1abc9c', '#9b59b6', '#27ae60'];
const ZERO_COLOR = 'rgba(231,76,60,0.5)';

const TF_LABELS: Record<HormuzTimeframe, string> = { '6h': '6 hours', '24h': '24 hours', '7d': '7 days' };
const TF_ORDER: HormuzTimeframe[] = ['6h', '24h', '7d'];
const TF_STORAGE_KEY = 'wm-hormuz-tf';

function statusColor(status: string): string {
  switch (status) {
    case 'closed':     return '#e74c3c';
    case 'disrupted':  return '#e67e22';
    case 'restricted': return '#f39c12';
    default:           return '#2ecc71';
  }
}

function barChart(series: HormuzSeries[], color: string, chartIdx: number, width = 280, height = 52): string {
  if (!series.length) return `<div style="height:${height}px;display:flex;align-items:center;color:var(--text-dim);font-size:10px">No data</div>`;

  const max = Math.max(...series.map(p => p.value), 1);
  const barW = Math.max(2, Math.floor((width - series.length) / series.length));
  const unit = chartIdx === 0 ? 'kt/day' : 'units';

  let x = 0;
  const rects = series.map(p => {
    const h = Math.max(p.value > 0 ? 2 : 1, Math.round((p.value / max) * (height - 2)));
    const fill = p.value === 0 ? ZERO_COLOR : color;
    const rect = `<rect class="hbar" x="${x}" y="${height - h}" width="${barW}" height="${h}" fill="${fill}" rx="1" data-date="${escapeHtml(p.date)}" data-val="${p.value}" data-unit="${unit}" style="cursor:crosshair"/>`;
    x += barW + 1;
    return rect;
  });

  // Invisible full-height hit areas for easier hover detection
  x = 0;
  const hits = series.map(p => {
    const hit = `<rect class="hbar" x="${x}" y="0" width="${barW}" height="${height}" fill="transparent" data-date="${escapeHtml(p.date)}" data-val="${p.value}" data-unit="${unit}" style="cursor:crosshair"/>`;
    x += barW + 1;
    return hit;
  });

  return `<svg class="hz-svg" width="${width}" height="${height}" style="display:block;overflow:visible">${rects.join('')}${hits.join('')}</svg>`;
}

function renderChart(chart: HormuzChart, idx: number): string {
  const color = CHART_COLORS[idx % CHART_COLORS.length] ?? '#3498db';
  const last = chart.series[chart.series.length - 1];
  const lastVal = last ? last.value.toFixed(0) : 'N/A';
  const lastDate = last ? last.date.slice(5) : '';
  const unit = idx === 0 ? 'kt/day' : 'units';

  return `
    <div class="hz-chart" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em">${escapeHtml(chart.title)}</span>
        <span class="hz-last-${idx}" style="font-size:11px;font-weight:600;color:${color}">${escapeHtml(lastVal)} <span style="font-size:9px;color:var(--text-dim)">${unit} · ${escapeHtml(lastDate)}</span></span>
      </div>
      <div style="position:relative">${barChart(chart.series, color, idx)}</div>
    </div>`;
}

/** Bar chart for the transit series (theme-aware, own tooltip class). */
function transitBars(stats: TransitStats, width = 280, height = 56): string {
  const series = stats.bars;
  if (!series.length) return '';
  const max = Math.max(...series.map(b => b.value), 1);
  const barW = Math.max(3, Math.floor((width - series.length) / series.length));

  let x = 0;
  const rects = series.map(b => {
    const h = Math.max(b.value > 0 ? 2 : 1, Math.round((b.value / max) * (height - 2)));
    const rect = `<rect class="hz-tbar" x="${x}" y="${height - h}" width="${barW}" height="${height}" fill="transparent" data-label="${escapeHtml(b.label)}" data-val="${b.value}" style="cursor:crosshair"/>` +
      `<rect x="${x}" y="${height - h}" width="${barW}" height="${h}" rx="1" fill="var(--accent)" opacity="${b.value > 0 ? 0.85 : 0.18}" style="pointer-events:none"/>`;
    x += barW + 1;
    return rect;
  });

  return `<svg class="hz-svg" width="${width}" height="${height}" style="display:block;overflow:visible">${rects.join('')}</svg>`;
}

function renderTransitsInner(stats: TransitStats, timeframe: HormuzTimeframe): string {
  const toggle = TF_ORDER.map(tf =>
    `<button class="hz-tf-btn${tf === timeframe ? ' active' : ''}" data-tf="${tf}" type="button">${tf.toUpperCase()}</button>`,
  ).join('');

  // Live headline.
  let liveHtml: string;
  if (!stats.configured) {
    liveHtml = `<div class="hz-transit-live-na">Live AIS unavailable</div>`;
  } else if (!stats.hasLiveData) {
    liveHtml = `<div class="hz-transit-live-na">Connecting to AIS…</div>`;
  } else {
    liveHtml = `<div class="hz-transit-live">${stats.live}</div>
      <div class="hz-transit-live-label">vessels in strait now</div>`;
  }

  // Window metric + delta.
  let deltaHtml = '';
  if (stats.deltaPct !== null) {
    const up = stats.deltaPct >= 0;
    const arrow = up ? '▲' : '▼';
    deltaHtml = `<span class="hz-transit-delta ${up ? 'up' : 'down'}">${arrow} ${Math.abs(stats.deltaPct).toFixed(0)}%</span>`;
  }
  const metricHtml = `
    <div class="hz-transit-metric">
      <span class="hz-transit-total">${stats.windowTotal}</span>
      <span class="hz-transit-total-label">transits</span>
      ${deltaHtml}
      <span class="hz-transit-sub">past ${TF_LABELS[timeframe]}</span>
    </div>`;

  // Accruing hint when we don't yet have a full window of history.
  const needed = timeframe === '6h' ? 6 : timeframe === '24h' ? 24 : 168;
  const accruing = stats.configured && stats.bucketsCollected < needed
    ? `<div class="hz-transit-hint">Collecting — bars fill in as vessels transit over time.</div>`
    : '';

  const bars = stats.configured ? transitBars(stats) : '';

  return `
    <div class="hz-transit-head">
      <div class="hz-transit-live-wrap">${liveHtml}</div>
      <div class="hz-tf-toggle" role="group" aria-label="Timeframe">${toggle}</div>
    </div>
    ${metricHtml}
    <div class="hz-transit-chart">${bars}</div>
    ${accruing}`;
}

export class HormuzPanel extends Panel {
  private tradeData: HormuzTrackerData | null = null;
  private tradeError: string | null = null;
  private tradeLoading = true;
  private timeframe: HormuzTimeframe = '24h';
  private handlersBound = false;
  private unsubscribe: (() => void) | null = null;
  private shellRendered = false;

  constructor() {
    super({ id: 'hormuz-tracker', title: 'Hormuz Trade Tracker', showCount: false });

    const savedTf = (() => {
      try { return localStorage.getItem(TF_STORAGE_KEY) as HormuzTimeframe | null; } catch { return null; }
    })();
    if (savedTf && TF_ORDER.includes(savedTf)) this.timeframe = savedTf;

    startHormuzTransits();
    this.unsubscribe = subscribeHormuzTransits(() => this.updateTransits());

    void this.fetchData();
  }

  public async fetchData(): Promise<boolean> {
    this.tradeLoading = true;
    this.renderShell();
    try {
      const data = await fetchHormuzTracker();
      this.tradeLoading = false;
      if (!data) {
        this.tradeError = 'Trade data unavailable';
        this.tradeData = null;
        this.renderShell();
        return false;
      }
      this.tradeError = null;
      this.tradeData = data;
      this.renderShell();
      return true;
    } catch (e) {
      this.tradeLoading = false;
      this.tradeError = e instanceof Error ? e.message : 'Failed to load trade data';
      this.renderShell();
      return false;
    }
  }

  /** Update only the transits sub-section (called every AIS poll). */
  private updateTransits(): void {
    if (!this.shellRendered || !this.element) return;
    const inner = this.element.querySelector<HTMLElement>('.hz-transits-inner');
    if (!inner) return;
    inner.innerHTML = renderTransitsInner(getTransitStats(this.timeframe), this.timeframe);
  }

  private setTimeframe(tf: HormuzTimeframe): void {
    if (tf === this.timeframe) return;
    this.timeframe = tf;
    try { localStorage.setItem(TF_STORAGE_KEY, tf); } catch { /* ignore */ }
    this.updateTransits();
  }

  private bindHandlers(): void {
    if (this.handlersBound || !this.element) return;
    this.handlersBound = true;

    // Timeframe toggle (delegated).
    this.element.addEventListener('click', (e: Event) => {
      const btn = (e.target as Element)?.closest?.('.hz-tf-btn');
      if (!btn) return;
      const tf = btn.getAttribute('data-tf') as HormuzTimeframe | null;
      if (tf) this.setTimeframe(tf);
    });

    // Tooltip for both trade bars (.hbar) and transit bars (.hz-tbar).
    this.element.addEventListener('mousemove', (e: Event) => {
      const target = e.target as Element;
      const tip = this.element?.querySelector<HTMLElement>('.hz-tip');
      if (!tip) return;
      let text: string | null = null;
      if (target.classList?.contains('hbar')) {
        const date = (target.getAttribute('data-date') ?? '').slice(5);
        const val = target.getAttribute('data-val') ?? '';
        const unit = target.getAttribute('data-unit') ?? '';
        text = `${date}  ${val} ${unit}`;
      } else if (target.classList?.contains('hz-tbar')) {
        const label = target.getAttribute('data-label') ?? '';
        const val = target.getAttribute('data-val') ?? '';
        text = `${label}  ${val} transits`;
      }
      if (text === null) return;
      const barRect = (target as SVGRectElement).getBoundingClientRect();
      tip.style.left = `${barRect.left + barRect.width / 2}px`;
      tip.style.top = `${barRect.top - 28}px`;
      tip.style.transform = 'translateX(-50%)';
      tip.style.opacity = '1';
      tip.textContent = text;
    });

    this.element.addEventListener('mouseleave', () => {
      const tip = this.element?.querySelector<HTMLElement>('.hz-tip');
      if (tip) tip.style.opacity = '0';
    });
  }

  private renderTradeSection(): string {
    if (this.tradeLoading && !this.tradeData) {
      return `<div class="hz-trade-status">Loading trade flows…</div>`;
    }
    if (this.tradeError && !this.tradeData) {
      return `<div class="hz-trade-status">${escapeHtml(this.tradeError)}</div>`;
    }
    const d = this.tradeData;
    if (!d) return '';
    const sColor = statusColor(d.status);
    const charts = d.charts.length
      ? d.charts.map((c, i) => renderChart(c, i)).join('')
      : '<div style="color:var(--text-dim);font-size:11px;padding:8px 0">Chart data unavailable</div>';
    const dateStr = d.updatedDate ? `<span style="font-size:10px;color:var(--text-dim)">${escapeHtml(d.updatedDate)}</span>` : '';

    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="background:${sColor};color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;letter-spacing:0.08em">${d.status.toUpperCase()}</span>
        ${dateStr}
      </div>
      <div>${charts}</div>
      <div style="margin-top:4px;font-size:9px;color:var(--text-dim)">
        Source: <a href="${escapeHtml(d.attribution.url)}" target="_blank" rel="noopener" style="color:var(--text-dim);text-decoration:underline">${escapeHtml(d.attribution.source)}</a>
      </div>`;
  }

  private renderShell(): void {
    const transits = renderTransitsInner(getTransitStats(this.timeframe), this.timeframe);
    const html = `
      <div style="padding:12px 14px;position:relative">
        <div class="hz-tip" style="position:fixed;pointer-events:none;background:rgba(15,17,26,0.95);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:3px 8px;font-size:10px;color:#fff;white-space:nowrap;z-index:9999;opacity:0;transition:opacity 0.08s;letter-spacing:0.02em"></div>

        <section class="hz-transits" aria-label="Strait of Hormuz ship transits">
          <div class="hz-section-title">Ship Transits · Strait of Hormuz</div>
          <div class="hz-transits-inner">${transits}</div>
        </section>

        <div class="hz-divider"></div>

        <section class="hz-trade" aria-label="Hormuz trade flows">
          <div class="hz-section-title">Trade Flows</div>
          ${this.renderTradeSection()}
        </section>
      </div>`;

    this.setContent(html);
    this.shellRendered = true;
    this.bindHandlers();
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    stopHormuzTransits();
    super.destroy();
  }
}
