import type { EntityRenderer, EntityRenderContext } from '../types';
import {
  buildPortfolioInsights,
  computeInstitutionStructure,
  computeLargestTradeDeltas,
  type SectorAllocation,
} from '@/services/market/portfolio';
import {
  fetchInstitution13FProfile,
  type InstitutionFilingHistoryEntry,
  type InstitutionHoldingMapped,
} from '@/services/market/normalized-13f';

interface InstitutionData {
  name: string;
  cik: string;
}

interface InstitutionEnriched {
  name: string;
  cik: string;
  filingDate: string;
  filingCadence: string;
  holdings: InstitutionHoldingMapped[];
  topHoldings: InstitutionHoldingMapped[];
  filingHistory: InstitutionFilingHistoryEntry[];
  totalHoldings: number;
  totalValue: number;
  mappedValueCoverage: number;
  sectorBreakdown: SectorAllocation[];
  deltas: ReturnType<typeof computeLargestTradeDeltas>;
  insights: string[];
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

function fmtDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export class InstitutionRenderer implements EntityRenderer {
  private activeTab: TabId = 'holdings';

  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const { name, cik } = data as InstitutionData;
    const container = ctx.el('div', 'edp-generic edp-institution-profile');

    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', name || 'Institution'));
    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge(`CIK ${cik || '-'}`, 'edp-badge'));
    header.append(badgeRow);

    const summary = ctx.el('div', 'edp-trade-stats');
    summary.append(makeStatCard(ctx, '13F Value', '-'));
    summary.append(makeStatCard(ctx, 'Holdings', '-'));
    summary.append(makeStatCard(ctx, 'Filing Date', '-'));
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
    tabContent.append(ctx.makeLoading('Loading 13F data...'));
    container.append(tabContent);

    return container;
  }

  async enrich(data: unknown, _signal: AbortSignal): Promise<InstitutionEnriched> {
    const d = data as InstitutionData;
    if (!d.cik) {
      return {
        name: d.name || 'Unknown Institution',
        cik: '',
        filingDate: '',
        filingCadence: 'No recent 13F history',
        holdings: [],
        topHoldings: [],
        filingHistory: [],
        totalHoldings: 0,
        totalValue: 0,
        mappedValueCoverage: 0,
        sectorBreakdown: [],
        deltas: [],
        insights: ['CIK identifier is required to fetch normalized 13F history for this institution.'],
      };
    }

    const profile = await fetchInstitution13FProfile(d.cik, d.name);
    const sectorBreakdown = computeInstitutionStructure(profile.mappedHoldings);
    const deltas = computeLargestTradeDeltas(profile.mappedHoldings);
    const insights = buildPortfolioInsights({
      kind: 'institution',
      holdings: profile.mappedHoldings,
      structure: sectorBreakdown,
      totalValue: profile.totalValue,
      filingHistory: profile.filingHistory,
      mappedValueCoverage: profile.mappedValueCoverage,
    });

    return {
      name: profile.name || d.name,
      cik: d.cik,
      filingDate: profile.filingDate,
      filingCadence: profile.filingCadence,
      holdings: profile.mappedHoldings,
      topHoldings: profile.mappedHoldings.slice(0, 10),
      filingHistory: profile.filingHistory,
      totalHoldings: profile.totalHoldings,
      totalValue: profile.totalValue,
      mappedValueCoverage: profile.mappedValueCoverage,
      sectorBreakdown,
      deltas,
      insights,
    };
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const data = enrichedData as InstitutionEnriched;

    const titleEl = container.querySelector('.edp-title');
    if (titleEl) titleEl.textContent = data.name;

    const badgeRow = container.querySelector('.edp-badge-row');
    if (badgeRow) {
      badgeRow.replaceChildren();
      badgeRow.append(ctx.badge(`CIK ${data.cik || '-'}`, 'edp-badge'));
      if (data.filingCadence) {
        badgeRow.append(ctx.badge(data.filingCadence, 'edp-badge edp-badge-dim'));
      }
      if (data.mappedValueCoverage > 0) {
        badgeRow.append(ctx.badge(`${data.mappedValueCoverage.toFixed(0)}% ticker mapped`, 'edp-badge edp-badge-status'));
      }
    }

    const summary = container.querySelector('.edp-trade-stats');
    if (summary) {
      summary.replaceChildren();
      summary.append(makeStatCard(ctx, '13F Value', fmtLargeNumber(data.totalValue)));
      summary.append(makeStatCard(ctx, 'Holdings', `${data.totalHoldings}`));
      summary.append(makeStatCard(ctx, 'Filing Date', data.filingDate ? fmtDate(data.filingDate) : '-'));
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
    if (!data.cik) {
      const [card, body] = ctx.sectionCard('Holdings Unavailable');
      const callout = ctx.el('div', 'edp-callout edp-callout-attention edp-callout-text');
      callout.textContent = 'CIK identifier is not available for this institution. Holdings data requires a valid SEC CIK number.';
      body.append(callout);
      const searchLink = ctx.el('a', 'edp-wiki-link') as HTMLAnchorElement;
      searchLink.href = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(data.name)}&owner=include&count=40`;
      searchLink.target = '_blank';
      searchLink.rel = 'noopener noreferrer';
      searchLink.textContent = `Search EDGAR for "${data.name}"`;
      body.append(searchLink);
      content.append(card);
      return;
    }

    if (data.holdings.length === 0) {
      content.append(ctx.makeEmpty('No 13F holdings available for this filer.'));
      return;
    }

    const [card, body] = ctx.sectionCard('Reported 13F Positions');
    const subnote = ctx.el('p', 'edp-description');
    subnote.textContent = data.mappedValueCoverage > 0
      ? `${data.mappedValueCoverage.toFixed(1)}% of disclosed value is currently normalized to tickers for profile enrichment.`
      : 'Holdings loaded from SEC 13F data. Ticker mapping coverage is still limited for this manager.';
    body.append(subnote);

    const grid = ctx.el('div', 'edp-holdings-table');
    for (const holding of data.topHoldings) {
      const rowEl = ctx.el('div', 'edp-holdings-row');
      rowEl.append(ctx.el('span', 'edp-holdings-name', holding.issuer));
      const detailParts = [
        holding.ticker || '',
        holding.title,
        holding.cusip ? `CUSIP ${holding.cusip}` : '',
      ].filter(Boolean);
      rowEl.append(ctx.el('span', 'edp-holdings-detail', detailParts.join(' · ')));
      const barWrap = ctx.el('div', 'edp-holdings-bar-wrap');
      const bar = ctx.el('div', 'edp-holdings-bar');
      bar.style.width = `${Math.min(holding.valuePct, 100)}%`;
      barWrap.append(bar);
      rowEl.append(barWrap);
      rowEl.append(ctx.el('span', 'edp-holdings-pct', holding.valuePct.toFixed(1) + '%'));
      rowEl.append(ctx.el('span', 'edp-holdings-val', fmtLargeNumber(holding.value)));
      grid.append(rowEl);
    }
    body.append(grid);
    content.append(card);
  }

  private renderLargestTrades(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Largest Disclosed Positions');
    if (data.deltas.length === 0) {
      body.append(ctx.makeEmpty('Only a single 13F snapshot is available; historical deltas require prior normalized filings.'));
    } else {
      const list = ctx.el('div', 'edp-holdings-table');
      for (const delta of data.deltas) {
        const rowEl = ctx.el('div', 'edp-holdings-row');
        rowEl.append(ctx.el('span', 'edp-holdings-name', delta.label));
        rowEl.append(ctx.el('span', 'edp-holdings-detail', delta.detail || ''));
        const barWrap = ctx.el('div', 'edp-holdings-bar-wrap');
        const bar = ctx.el('div', 'edp-holdings-bar');
        bar.style.width = `${Math.min(delta.percentage, 100)}%`;
        barWrap.append(bar);
        rowEl.append(barWrap);
        rowEl.append(ctx.el('span', 'edp-holdings-pct', delta.percentage.toFixed(1) + '%'));
        rowEl.append(ctx.el('span', 'edp-holdings-val', fmtLargeNumber(delta.estimatedValue)));
        list.append(rowEl);
      }
      body.append(list);
    }
    content.append(card);
  }

  private renderInsights(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Observations');
    for (const bullet of data.insights) {
      const p = ctx.el('p', 'edp-description');
      p.textContent = bullet;
      body.append(p);
    }
    content.append(card);
  }

  private renderStructure(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Inferred Sector Allocation');
    if (data.sectorBreakdown.length > 0) {
      const list = ctx.el('div', 'edp-sector-bars');
      for (const sector of data.sectorBreakdown) {
        const rowEl = ctx.el('div', 'edp-sector-row');
        rowEl.append(ctx.el('span', 'edp-sector-label', sector.sector));
        const barWrap = ctx.el('div', 'edp-sector-bar-wrap');
        const bar = ctx.el('div', 'edp-sector-bar');
        bar.style.width = `${Math.min(sector.percentage, 100)}%`;
        barWrap.append(bar);
        rowEl.append(barWrap);
        rowEl.append(ctx.el('span', 'edp-sector-pct', sector.percentage.toFixed(1) + '%'));
        list.append(rowEl);
      }
      body.append(list);
    } else {
      body.append(ctx.makeEmpty('Not enough data to build a sector map.'));
    }
    content.append(card);
  }

  private renderPerformance(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Performance History');
    const note = ctx.el('div', 'edp-callout edp-callout-attention edp-callout-text');
    note.textContent = data.mappedValueCoverage > 0
      ? `Ticker mapping now covers ${data.mappedValueCoverage.toFixed(1)}% of disclosed value. That is enough to enrich holdings context, but we still need a fuller mapped history before showing an institution-level performance curve.`
      : 'Performance cannot be estimated yet because the latest 13F snapshot does not include enough reliable ticker mapping.';
    body.append(note);

    const mapped = data.topHoldings.filter(holding => holding.ticker).slice(0, 6);
    if (mapped.length > 0) {
      const grid = ctx.el('div', 'edp-holdings-table');
      for (const holding of mapped) {
        const rowEl = ctx.el('div', 'edp-holdings-row');
        rowEl.append(ctx.el('span', 'edp-holdings-name', holding.ticker));
        rowEl.append(ctx.el('span', 'edp-holdings-detail', holding.issuer));
        const barWrap = ctx.el('div', 'edp-holdings-bar-wrap');
        const bar = ctx.el('div', 'edp-holdings-bar');
        bar.style.width = `${Math.min(holding.valuePct, 100)}%`;
        barWrap.append(bar);
        rowEl.append(barWrap);
        rowEl.append(ctx.el('span', 'edp-holdings-pct', holding.valuePct.toFixed(1) + '%'));
        rowEl.append(ctx.el('span', 'edp-holdings-val', fmtLargeNumber(holding.value)));
        grid.append(rowEl);
      }
      body.append(grid);
    }

    content.append(card);
  }

  private renderAum(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Assets Under Management');

    const aumNote = ctx.el('div', 'edp-callout edp-callout-attention edp-callout-text');
    aumNote.textContent = 'Only 13F portfolio value is available here. True adviser AUM still requires Form ADV data or another adviser-level source.';
    body.append(aumNote);

    const grid = ctx.el('div', 'edp-aum-grid');
    grid.append(makeAumCard(ctx, '13F Portfolio Value', fmtLargeNumber(data.totalValue), 'Based on latest disclosed long positions.'));
    grid.append(makeAumCard(ctx, 'Reported Positions', String(data.totalHoldings), 'Number of holdings in latest 13F-HR filing.'));
    grid.append(makeAumCard(ctx, 'Filing Cadence', data.filingCadence || '-', 'Derived from recent filing history.'));
    body.append(grid);

    const placeholder = ctx.el('div', 'edp-aum-chart-row');
    placeholder.append(makeAumCard(ctx, 'Latest Filing Date', data.filingDate ? fmtDate(data.filingDate) : '-', 'Most recent reported 13F filing date.'));
    placeholder.append(makeAumCard(ctx, 'Ticker Mapping', `${data.mappedValueCoverage.toFixed(1)}%`, 'Share of disclosed value normalized to tickers.'));
    placeholder.append(makeAumCard(ctx, 'Adviser AUM', 'Not available', 'Requires SEC Form ADV data source.'));
    body.append(placeholder);

    content.append(card);
  }

  private renderFilings(content: HTMLElement, data: InstitutionEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('13F Filings');

    const summary = ctx.el('p', 'edp-description');
    summary.textContent = data.filingHistory.length > 0
      ? `${data.filingHistory.length} recent 13F entries are available for this filer. Latest cadence: ${data.filingCadence}.`
      : 'No normalized filing history is available for this filer yet.';
    body.append(summary);

    if (data.filingHistory.length === 0) {
      body.append(ctx.makeEmpty('No filing metadata available.'));
    } else {
      for (const filing of data.filingHistory.slice(0, 12)) {
        const rowEl = ctx.el('div', 'edp-disclosure-row');
        const badgeClass = filing.isAmendment
          ? 'edp-disclosure-badge edp-disclosure-badge-sell'
          : 'edp-disclosure-badge';
        rowEl.append(ctx.el('span', badgeClass, filing.filingType));
        const info = ctx.el('div', 'edp-disclosure-info');
        info.append(ctx.el('span', 'edp-disclosure-name', filing.institutionName));
        info.append(ctx.el('span', 'edp-disclosure-detail', `Filed ${fmtDate(filing.filedAt)} · CIK ${filing.cik || '-'}`));
        rowEl.append(info);
        if (filing.url) {
          const link = ctx.el('a', 'edp-wiki-link') as HTMLAnchorElement;
          link.href = filing.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = fmtDate(filing.filedAt);
          rowEl.append(link);
        } else {
          rowEl.append(ctx.el('span', 'edp-disclosure-date', fmtDate(filing.filedAt)));
        }
        body.append(rowEl);
      }
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
