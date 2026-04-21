import type { EntityRenderer, EntityRenderContext } from '../types';
import {
  fetchInstitutionalHoldings,
  computeInstitutionStructure,
  computeLargestTradeDeltas,
  buildPortfolioInsights,
  type InstitutionalHoldingsResponse,
  type SectorAllocation,
} from '@/services/market/portfolio';

interface InstitutionData {
  name: string;
  cik: string;
}

interface InstitutionEnriched {
  name: string;
  cik: string;
  holdings: InstitutionalHoldingsResponse['holdings'];
  totalHoldings: number;
  totalValue: number;
  filingDate: string;
  topHoldings: InstitutionalHoldingsResponse['holdings'];
  sectorBreakdown: SectorAllocation[];
  deltas: ReturnType<typeof computeLargestTradeDeltas>;
  insights: string[];
  wikiSummary?: string;
  wikiUrl?: string;
}

const TABS = ['holdings', 'trades', 'insights', 'structure', 'performance', 'aum', 'filings'] as const;
type TabId = typeof TABS[number];

const TAB_LABELS: Record<TabId, string> = {
  holdings: 'Top Holdings',
  trades: 'Largest Trades',
  insights: 'AI Insights',
  structure: 'Portfolio Structure',
  performance: 'Performance History',
  aum: 'AUM',
  filings: 'Filings / Disclosures',
};

function fmtLargeNumber(value: number): string {
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
  return '$' + value.toFixed(0);
}

export class InstitutionRenderer implements EntityRenderer {
  private activeTab: TabId = 'holdings';

  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const { name, cik } = data as InstitutionData;
    const container = ctx.el('div', 'edp-generic edp-institution-profile');

    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', name || 'Institution'));
    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge(`CIK ${cik || '—'}`, 'edp-badge'));
    header.append(badgeRow);

    const summary = ctx.el('div', 'edp-trade-stats');
    summary.append(makeStatCard(ctx, '13F Value', '—'));
    summary.append(makeStatCard(ctx, 'Holdings', '—'));
    summary.append(makeStatCard(ctx, 'Filing Date', '—'));
    header.append(summary);
    container.append(header);

    const tabBar = ctx.el('div', 'edp-portfolio-tab-bar');
    for (const tab of TABS) {
      const btn = ctx.el('button', `edp-portfolio-tab${tab === this.activeTab ? ' edp-portfolio-tab-active' : ''}`);
      btn.textContent = TAB_LABELS[tab];
      btn.dataset.tab = tab;
      tabBar.append(btn);
    }
    container.append(tabBar);

    const tabContent = ctx.el('div', 'edp-portfolio-tab-content');
    tabContent.dataset.slot = 'tab-content';
    tabContent.append(ctx.makeLoading('Loading 13F data…'));
    container.append(tabContent);

    return container;
  }

  async enrich(data: unknown, _signal: AbortSignal): Promise<InstitutionEnriched> {
    const d = data as InstitutionData;
    const holdingsResp = await fetchInstitutionalHoldings(d.cik);
    const sectorBreakdown = computeInstitutionStructure(holdingsResp.holdings);
    const deltas = computeLargestTradeDeltas(holdingsResp.holdings);
    const insights = buildPortfolioInsights({
      kind: 'institution',
      holdings: holdingsResp.holdings,
      structure: sectorBreakdown,
      totalValue: holdingsResp.totalValue,
    });

    return {
      name: holdingsResp.name || d.name,
      cik: d.cik,
      holdings: holdingsResp.holdings,
      totalHoldings: holdingsResp.totalHoldings,
      totalValue: holdingsResp.totalValue,
      filingDate: holdingsResp.filingDate,
      topHoldings: holdingsResp.holdings.slice(0, 10),
      sectorBreakdown,
      deltas,
      insights,
    };
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const data = enrichedData as InstitutionEnriched;

    const titleEl = container.querySelector('.edp-title');
    if (titleEl) titleEl.textContent = data.name;

    const summary = container.querySelector('.edp-trade-stats');
    if (summary) {
      summary.replaceChildren();
      summary.append(makeStatCard(ctx, '13F Value', fmtLargeNumber(data.totalValue)));
      summary.append(makeStatCard(ctx, 'Holdings', `${data.totalHoldings}`));
      summary.append(makeStatCard(ctx, 'Filing Date', data.filingDate || '—'));
    }

    this.activeTab = 'holdings';
    this.renderTabContent(container, data, ctx);

    const tabBar = container.querySelector('.edp-portfolio-tab-bar');
    tabBar?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.edp-portfolio-tab') as HTMLElement | null;
      if (!btn || !btn.dataset.tab) return;
      this.activeTab = btn.dataset.tab as TabId;
      tabBar.querySelectorAll('.edp-portfolio-tab').forEach(t => t.classList.remove('edp-portfolio-tab-active'));
      btn.classList.add('edp-portfolio-tab-active');
      this.renderTabContent(container, data, ctx);
    });
  }

  private renderTabContent(container: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const content = container.querySelector<HTMLElement>('[data-slot="tab-content"]');
    if (!content) return;
    content.replaceChildren();

    switch (this.activeTab) {
      case 'holdings': this.renderTopHoldings(content, data, ctx); break;
      case 'trades': this.renderLargestTrades(content, data, ctx); break;
      case 'insights': this.renderInsights(content, data, ctx); break;
      case 'structure': this.renderStructure(content, data, ctx); break;
      case 'performance': this.renderPerformance(content, data, ctx); break;
      case 'aum': this.renderAum(content, data, ctx); break;
      case 'filings': this.renderFilings(content, data, ctx); break;
    }
  }

  private renderTopHoldings(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    if (data.holdings.length === 0) {
      content.append(ctx.makeEmpty('No 13F holdings available for this filer.'));
      return;
    }
    const [card, body] = ctx.sectionCard('Reported 13F Positions');
    const grid = ctx.el('div', 'edp-holdings-table');
    for (const h of data.topHoldings) {
      const pct = data.totalValue > 0 ? (h.value / data.totalValue) * 100 : 0;
      const rowEl = ctx.el('div', 'edp-holdings-row');
      rowEl.append(ctx.el('span', 'edp-holdings-name', h.issuer));
      rowEl.append(ctx.el('span', 'edp-holdings-detail', h.title));
      const barWrap = ctx.el('div', 'edp-holdings-bar-wrap');
      const bar = ctx.el('div', 'edp-holdings-bar');
      bar.style.width = `${Math.min(pct, 100)}%`;
      barWrap.append(bar);
      rowEl.append(barWrap);
      rowEl.append(ctx.el('span', 'edp-holdings-pct', pct.toFixed(1) + '%'));
      rowEl.append(ctx.el('span', 'edp-holdings-val', fmtLargeNumber(h.value)));
      grid.append(rowEl);
    }
    body.append(grid);
    content.append(card);
  }

  private renderLargestTrades(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Largest Disclosed Positions');
    if (data.deltas.length === 0) {
      body.append(ctx.makeEmpty('Only a single 13F snapshot is available; historical deltas require prior filings.'));
    } else {
      const list = ctx.el('div', 'edp-holdings-table');
      for (const d of data.deltas) {
        const rowEl = ctx.el('div', 'edp-holdings-row');
        rowEl.append(ctx.el('span', 'edp-holdings-name', d.label));
        rowEl.append(ctx.el('span', 'edp-holdings-detail', d.detail || ''));
        const barWrap = ctx.el('div', 'edp-holdings-bar-wrap');
        const bar = ctx.el('div', 'edp-holdings-bar');
        bar.style.width = `${Math.min(d.percentage, 100)}%`;
        barWrap.append(bar);
        rowEl.append(barWrap);
        rowEl.append(ctx.el('span', 'edp-holdings-pct', d.percentage.toFixed(1) + '%'));
        rowEl.append(ctx.el('span', 'edp-holdings-val', fmtLargeNumber(d.estimatedValue)));
        list.append(rowEl);
      }
      body.append(list);
    }
    content.append(card);
  }

  private renderInsights(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Observations');
    for (const b of data.insights) {
      const p = ctx.el('p', 'edp-description');
      p.textContent = b;
      body.append(p);
    }
    content.append(card);
  }

  private renderStructure(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Inferred Sector Allocation');
    if (data.sectorBreakdown.length > 0) {
      const list = ctx.el('div', 'edp-sector-bars');
      for (const s of data.sectorBreakdown) {
        const rowEl = ctx.el('div', 'edp-sector-row');
        rowEl.append(ctx.el('span', 'edp-sector-label', s.sector));
        const barWrap = ctx.el('div', 'edp-sector-bar-wrap');
        const bar = ctx.el('div', 'edp-sector-bar');
        bar.style.width = `${Math.min(s.percentage, 100)}%`;
        barWrap.append(bar);
        rowEl.append(barWrap);
        rowEl.append(ctx.el('span', 'edp-sector-pct', s.percentage.toFixed(1) + '%'));
        list.append(rowEl);
      }
      body.append(list);
    } else {
      body.append(ctx.makeEmpty('Not enough data to build a sector map.'));
    }
    content.append(card);
  }

  private renderPerformance(content: HTMLElement, _data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Performance History');
    const note = ctx.el('div', 'edp-callout edp-callout-attention edp-callout-text');
    note.textContent = 'Performance cannot be accurately estimated without mapping 13F issuers to tickers and their corresponding historical prices. This tab will be enabled once ticker mapping is available.';
    body.append(note);
    content.append(card);
  }

  private renderAum(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Assets Under Management');

    const aumNote = ctx.el('div', 'edp-callout edp-callout-attention edp-callout-text');
    aumNote.textContent = 'Only 13F portfolio value is available. True adviser AUM (including non-discretionary and non-13F assets) is not currently provided by our data sources.';
    body.append(aumNote);

    const grid = ctx.el('div', 'edp-aum-grid');
    grid.append(makeAumCard(ctx, '13F Portfolio Value', fmtLargeNumber(data.totalValue), 'Based on latest disclosed long positions.'));
    grid.append(makeAumCard(ctx, 'Reported Positions', String(data.totalHoldings), 'Number of holdings in latest 13F-HR filing.'));
    grid.append(makeAumCard(ctx, 'Filing Date', data.filingDate || '—', 'As of the most recent 13F-HR or 13F-HR/A filing.'));
    body.append(grid);

    const placeholder = ctx.el('div', 'edp-aum-chart-row');
    placeholder.append(makeAumCard(ctx, 'Discretionary AUM', 'Not available', 'Requires SEC Form ADV data source.'));
    placeholder.append(makeAumCard(ctx, 'Non-Discretionary AUM', 'Not available', 'Requires SEC Form ADV data source.'));
    placeholder.append(makeAumCard(ctx, 'Investor Composition', 'Not available', 'Requires SEC Form ADV data source.'));
    body.append(placeholder);

    content.append(card);
  }

  private renderFilings(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('13F Filings');
    if (data.filingDate) {
      const rowEl = ctx.el('div', 'edp-disclosure-row');
      const badge = ctx.el('span', 'edp-disclosure-badge', '13F-HR');
      rowEl.append(badge);
      const info = ctx.el('div', 'edp-disclosure-info');
      info.append(ctx.el('span', 'edp-disclosure-name', data.name));
      info.append(ctx.el('span', 'edp-disclosure-detail', `Filing date: ${data.filingDate}`));
      rowEl.append(info);
      rowEl.append(ctx.el('span', 'edp-disclosure-date', data.filingDate));
      body.append(rowEl);
    } else {
      body.append(ctx.makeEmpty('No filing metadata available.'));
    }
    const secLink = ctx.el('a', 'edp-wiki-link') as HTMLAnchorElement;
    secLink.href = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.cik}&type=13F&owner=include&count=40&output=atom`;
    secLink.target = '_blank';
    secLink.rel = 'noopener noreferrer';
    secLink.textContent = 'View SEC EDGAR filings';
    body.append(secLink);
    content.append(card);
  }
}

function makeStatCard(ctx: EntityRenderContext, label: string, value: string): HTMLElement {
  const el = ctx.el('div', 'edp-stat-highlight');
  el.append(ctx.el('span', 'edp-stat-highlight-label', label));
  el.append(ctx.el('span', 'edp-stat-highlight-value', value));
  return el;
}

function makeAumCard(ctx: EntityRenderContext, label: string, value: string, note: string): HTMLElement {
  const card = ctx.el('div', 'edp-aum-card');
  card.append(ctx.el('span', 'edp-aum-card-label', label));
  card.append(ctx.el('span', 'edp-aum-card-value', value));
  card.append(ctx.el('span', 'edp-aum-card-note', note));
  return card;
}
