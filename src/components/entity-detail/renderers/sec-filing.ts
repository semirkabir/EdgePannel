import type { GetSecFilingAnalysisResponse, SecFilingSeries } from '@/generated/client/worldmonitor/market/v1/service_client';
import { fetchSecFilingAnalysis, type SecFilingAnalysisInput } from '@/services/market/sec-filing-analysis';
import { sanitizeUrl } from '@/utils/sanitize';
import { row, type EntityRenderer, type EntityRenderContext } from '../types';

interface SecFilingData extends SecFilingAnalysisInput {
  title?: string;
  companyName?: string;
  filedAt?: string;
}

function fmtDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function titleFor(data: SecFilingData): string {
  return [data.filingType, data.companyName || data.ticker || data.cik].filter(Boolean).join(' - ') || 'SEC filing';
}

export class SecFilingRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const filing = data as SecFilingData;
    const container = ctx.el('div', 'edp-generic edp-sec-filing-reader');
    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', titleFor(filing)));
    const subtitle = [filing.title, filing.filedAt ? `Filed ${fmtDate(filing.filedAt)}` : ''].filter(Boolean).join(' - ');
    if (subtitle) header.append(ctx.el('div', 'edp-subtitle', subtitle));
    const badges = ctx.el('div', 'edp-badge-row');
    if (filing.filingType) badges.append(ctx.badge(filing.filingType, 'edp-badge edp-badge-ticker'));
    if (filing.cik) badges.append(ctx.badge(`CIK ${filing.cik.replace(/^0+/, '') || filing.cik}`, 'edp-badge edp-badge-dim'));
    header.append(badges);
    container.append(header, ctx.makeLoading('Reading SEC filing...'));
    return container;
  }

  async enrich(data: unknown, signal: AbortSignal): Promise<GetSecFilingAnalysisResponse> {
    return fetchSecFilingAnalysis(data as SecFilingData, signal);
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const analysis = enrichedData as GetSecFilingAnalysisResponse;
    container.replaceChildren();

    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', `${analysis.filingType} - ${analysis.companyName || analysis.ticker || 'SEC filing'}`));
    header.append(ctx.el('div', 'edp-subtitle', [analysis.title, analysis.filedAt ? `Filed ${fmtDate(analysis.filedAt)}` : ''].filter(Boolean).join(' - ')));
    const badges = ctx.el('div', 'edp-badge-row');
    badges.append(ctx.badge(analysis.filingType, 'edp-badge edp-badge-ticker'));
    badges.append(ctx.badge(analysis.formCategory, analysis.structured ? 'edp-badge edp-badge-status' : 'edp-badge edp-badge-warning'));
    if (analysis.cik) badges.append(ctx.badge(`CIK ${analysis.cik.replace(/^0+/, '') || analysis.cik}`, 'edp-badge edp-badge-dim'));
    header.append(badges);
    container.append(header);

    container.append(this.buildSummaryCard(ctx, analysis));
    const cat = analysis.formCategory;
    const showSeries = cat === 'periodic';
    if (analysis.metrics.length > 0) container.append(this.buildMetricsCard(ctx, analysis));
    if (analysis.series.length > 0 && showSeries) container.append(this.buildSeriesCard(ctx, analysis.series));
    container.append(this.buildEventsCard(ctx, analysis));

    if (analysis.url) {
      const [card, body] = ctx.sectionCard('Source');
      body.append(row(ctx, 'Accession', analysis.accessionNumber || '-'));
      const link = ctx.el('a', 'cp-link') as HTMLAnchorElement;
      link.href = sanitizeUrl(analysis.url);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open filing on EDGAR';
      body.append(link);
      container.append(card);
    }
  }

  private buildSummaryCard(ctx: EntityRenderContext, analysis: GetSecFilingAnalysisResponse): HTMLElement {
    const [card, body] = ctx.sectionCard(analysis.structured ? 'Filing Reader' : 'Filing Reader - Metadata Fallback');
    const list = ctx.el('div', 'edp-disclosure-info');
    for (const bullet of analysis.summaryBullets) {
      const p = ctx.el('p', 'edp-description', bullet);
      list.append(p);
    }
    body.append(list);
    if (!analysis.structured && analysis.fallbackReason) {
      body.append(ctx.makeEmpty(analysis.fallbackReason));
    }
    return card;
  }

  private metricsCardTitle(category: string): string {
    switch (category) {
      case 'periodic':     return 'Financial Summary';
      case 'current':      return 'Event Metrics';
      case 'insider':      return 'Transaction Metrics';
      case 'ownership':    return 'Ownership Metrics';
      case 'proxy':        return 'Proxy Metrics';
      case 'registration': return 'Issuer Context';
      default:             return 'Structured Numbers';
    }
  }

  private buildMetricsCard(ctx: EntityRenderContext, analysis: GetSecFilingAnalysisResponse): HTMLElement {
    const title = this.metricsCardTitle(analysis.formCategory);
    const [card, body] = ctx.sectionCard(title);
    card.classList.add('edp-card--wide');

    // Current/proxy/registration filings can include both extracted filing metrics
    // and latest issuer-level XBRL facts, so clarify the mixed provenance.
    if (analysis.formCategory === 'current' || analysis.formCategory === 'proxy' || analysis.formCategory === 'registration') {
      body.append(ctx.el('p', 'edp-detail-label edp-filing-fact-note',
        'Filing-specific metrics are extracted from this disclosure; any issuer financial facts shown here are the latest available SEC XBRL facts for context.'));
    }

    const grid = ctx.el('div', 'cp-mini-kpi-grid');
    for (const metric of analysis.metrics.slice(0, 12)) {
      const item = ctx.el('div', 'cp-mini-kpi');
      item.append(ctx.el('span', 'cp-mini-kpi-label', metric.label));
      item.append(ctx.el('span', 'cp-mini-kpi-value', metric.formattedValue));
      const meta = [metric.fiscalPeriod, metric.hasYoy ? `${fmtPercent(metric.yoy)} YoY` : ''].filter(Boolean).join(' — ');
      if (meta) item.append(ctx.el('span', 'edp-detail-label', meta));
      grid.append(item);
    }
    body.append(grid);
    return card;
  }

  private buildSeriesCard(ctx: EntityRenderContext, series: SecFilingSeries[]): HTMLElement {
    const [card, body] = ctx.sectionCard('Historical Trends');
    card.classList.add('edp-card--wide');
    for (const item of series.slice(0, 2)) {
      body.append(ctx.el('div', 'cp-trend-title', item.label));
      const chart = ctx.el('div', 'cp-financial-chart');
      const max = Math.max(...item.points.map(point => Math.abs(point.value)), 1);
      for (const point of item.points) {
        const barWrap = ctx.el('div', 'cp-financial-chart-bar-wrap');
        const bar = ctx.el('div', point.value >= 0 ? 'cp-financial-chart-bar' : 'cp-financial-chart-bar is-negative');
        bar.style.height = `${Math.max(4, (Math.abs(point.value) / max) * 100)}%`;
        bar.title = `${point.label}: ${point.value.toLocaleString()}`;
        barWrap.append(bar, ctx.el('span', 'cp-financial-chart-label', point.label));
        chart.append(barWrap);
      }
      body.append(chart);
    }
    return card;
  }

  private eventsCardTitle(category: string): string {
    switch (category) {
      case 'insider':       return 'Transaction Context';
      case 'institutional': return 'Holdings Context';
      case 'ownership':     return 'Ownership Context';
      case 'proxy':         return 'Proxy Context';
      case 'current':       return 'Event Context';
      case 'registration':  return 'Registration Context';
      default:              return 'Disclosure Context';
    }
  }

  private buildEventsCard(ctx: EntityRenderContext, analysis: GetSecFilingAnalysisResponse): HTMLElement {
    const title = this.eventsCardTitle(analysis.formCategory);
    const [card, body] = ctx.sectionCard(title);
    for (const event of analysis.events) {
      body.append(row(ctx, event.label, event.value));
    }
    if (analysis.events.length === 0) body.append(ctx.makeEmpty('No filing metadata was extracted'));
    return card;
  }
}
