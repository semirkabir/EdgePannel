import { Panel } from './Panel';
import type { PopupType } from './MapPopup';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import {
  buildPortfolioSummary,
  createPortfolio,
  getUserPositions,
  addUserPosition,
  editUserPosition,
  removeUserPosition,
  getTickerSector,
  SECTOR_COLORS,
  sparklineSvg,
  donutSvg,
} from '@/services/market/portfolio';
import { setMarketWatchlistEntries, getMarketWatchlistEntries } from '@/services/market-watchlist';
import { portfolioService } from '@/services/portfolio-service';
import type { DetailView, HoldingWithQuote, Portfolio, PortfolioSummary } from '@/services/portfolio-types';
import { getPortfolioDetailPanel } from './portfolio-detail/PortfolioDetailPanel';

const client = new MarketServiceClient('', {
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});

export class MyPortfolioPanel extends Panel {
  private activePortfolioId: string | 'legacy-watchlist' | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private editingSymbol: string | null = null;

  constructor() {
    super({
      id: 'my-portfolio',
      title: t('panels.myPortfolio'),
    });
    void this.render();
  }

  public async render(): Promise<void> {
    this.showLoading();
    await this.renderContent();
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.renderContent();
      }
    }, 60_000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
  }

  private async renderContent(): Promise<void> {
    try {
      await this.renderPortfolioTab(this.content);
    } catch (err) {
      this.setContentNow(`<div class="pf-error">Error loading data: ${escapeHtml(String(err))}</div>`);
    }
  }

  private async renderPortfolioTab(contentEl: HTMLElement): Promise<void> {
    const portfolios = await portfolioService.list_portfolios();
    if (!this.activePortfolioId) {
      this.activePortfolioId = portfolios.find((portfolio) => portfolio.name === 'Demo Portfolio')?.id
        ?? portfolios[0]?.id
        ?? 'legacy-watchlist';
    }

    if (this.activePortfolioId !== 'legacy-watchlist') {
      const selectedPortfolio = portfolios.find((portfolio) => portfolio.id === this.activePortfolioId);
      if (selectedPortfolio) {
        await this.renderRepositoryPortfolioTab(contentEl, portfolios, selectedPortfolio);
        return;
      }
      this.activePortfolioId = 'legacy-watchlist';
    }

    const activePortfolioId = this.activePortfolioId === 'legacy-watchlist'
      ? 'legacy-watchlist'
      : this.activePortfolioId;
    const positions = getUserPositions();
    const quotes = new Map<string, { price: number; change: number; sparkline: number[]; name: string }>();
    let lastUpdated = '';
    const selectorHtml = this.renderPortfolioSelector(portfolios);

    if (positions.length > 0) {
      try {
        const resp = await client.listMarketQuotes({ symbols: positions.map(p => p.symbol) });
        for (const q of resp.quotes) quotes.set(q.symbol, { price: q.price, change: q.change, sparkline: q.sparkline, name: q.name });
        lastUpdated = new Date().toLocaleTimeString();
      } catch { /* quotes unavailable */ }
    }

    this.startAutoRefresh();

    const summary = buildPortfolioSummary(activePortfolioId, [...quotes.entries()].map(([symbol, quote]) => ({
      symbol,
      price: quote.price,
      change: quote.change,
      sparkline: quote.sparkline,
      name: quote.name,
    })));

    if (positions.length === 0) {
      contentEl.innerHTML = `
        ${selectorHtml}
        <div class="pf-add-form">
          <input type="text" class="pf-input" id="pf-add-symbol" placeholder="Symbol (e.g. AAPL)" />
          <input type="number" class="pf-input pf-input-sm" id="pf-add-shares" placeholder="Shares" min="0" step="1" />
          <input type="number" class="pf-input pf-input-sm" id="pf-add-cost" placeholder="Avg Cost" min="0" step="0.01" />
          <button class="pf-add-btn" id="pf-add-btn">Add</button>
        </div>
        <div class="pf-empty">No positions yet. Add a stock above to start tracking your portfolio.</div>
      `;
      this.bindPortfolioSelector(contentEl);
      this.bindAddForm(contentEl);
      return;
    }

    const rows = positions.map(pos => {
      const quote = quotes.get(pos.symbol);
      const currentPrice = quote?.price ?? pos.avgCost;
      const dayChange = quote?.change ?? 0;
      const sparkData = quote?.sparkline ?? [];
      const marketValue = currentPrice * pos.shares;
      const costBasis = pos.avgCost * pos.shares;
      const pnl = marketValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      const sector = getTickerSector(pos.symbol);

      const pnlClass = pnl >= 0 ? 'pf-positive' : 'pf-negative';
      const pnlSign = pnl >= 0 ? '+' : '';
      const dayClass = dayChange >= 0 ? 'pf-positive' : 'pf-negative';
      const daySign = dayChange >= 0 ? '+' : '';

      const isEditing = this.editingSymbol === pos.symbol;
      const sectorColor = SECTOR_COLORS[sector] || SECTOR_COLORS.Other;

      if (isEditing) {
        return `
          <div class="pf-position-row pf-editing" data-symbol="${escapeHtml(pos.symbol)}">
            <div class="pf-pos-info">
              <span class="pf-pos-symbol ticker-link" data-ticker="${escapeHtml(pos.symbol)}" data-name="${escapeHtml(pos.name)}">${escapeHtml(pos.symbol)}</span>
              <span class="pf-pos-sector" style="background:${sectorColor}30;color:${sectorColor}">${escapeHtml(sector)}</span>
            </div>
            <div class="pf-edit-form">
              <label class="pf-edit-label">Shares<input type="number" class="pf-input pf-input-sm pf-edit-input" id="pf-edit-shares-${escapeHtml(pos.symbol)}" value="${pos.shares}" min="0" step="1" /></label>
              <label class="pf-edit-label">Avg Cost<input type="number" class="pf-input pf-input-sm pf-edit-input" id="pf-edit-cost-${escapeHtml(pos.symbol)}" value="${pos.avgCost.toFixed(2)}" min="0" step="0.01" /></label>
              <button class="pf-edit-save" data-symbol="${escapeHtml(pos.symbol)}">Save</button>
              <button class="pf-edit-cancel">Cancel</button>
            </div>
          </div>`;
      }

      return `
        <div class="pf-position-row" data-symbol="${escapeHtml(pos.symbol)}">
          <div class="pf-pos-info">
            <span class="pf-pos-symbol ticker-link" data-ticker="${escapeHtml(pos.symbol)}" data-name="${escapeHtml(pos.name)}">${escapeHtml(pos.symbol)}</span>
            <span class="pf-pos-name">${escapeHtml(quote?.name || pos.name)}</span>
            <span class="pf-pos-sector" style="background:${sectorColor}30;color:${sectorColor}">${escapeHtml(sector)}</span>
          </div>
          <div class="pf-pos-data">
            <div class="pf-pos-col">
              <span class="pf-pos-label">Shares</span>
              <span class="pf-pos-val">${pos.shares.toLocaleString()}</span>
            </div>
            <div class="pf-pos-col">
              <span class="pf-pos-label">Avg Cost</span>
              <span class="pf-pos-val">$${pos.avgCost.toFixed(2)}</span>
            </div>
            <div class="pf-pos-col">
              <span class="pf-pos-label">Price</span>
              <span class="pf-pos-val">${currentPrice ? '$' + currentPrice.toFixed(2) : '\u2014'}</span>
            </div>
            <div class="pf-pos-col">
              <span class="pf-pos-label">Day</span>
              <span class="pf-pos-val ${dayClass}">${dayChange !== 0 ? daySign + dayChange.toFixed(2) + '%' : '\u2014'}</span>
            </div>
            <div class="pf-pos-col">
              <span class="pf-pos-label">P&amp;L</span>
              <span class="pf-pos-val ${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)} (${pnlSign}${pnlPct.toFixed(1)}%)</span>
            </div>
            ${sparkData.length >= 2 ? `<div class="pf-pos-spark">${sparklineSvg(sparkData, dayChange, 56, 20)}</div>` : ''}
            <div class="pf-pos-actions">
              <button class="pf-icon-btn pf-watchlist-add" data-symbol="${escapeHtml(pos.symbol)}" data-name="${escapeHtml(pos.name)}" title="Add to watchlist">\u2606</button>
              <button class="pf-icon-btn pf-edit-btn" data-symbol="${escapeHtml(pos.symbol)}" title="Edit">\u270E</button>
              <button class="pf-remove-btn" data-symbol="${escapeHtml(pos.symbol)}" title="Remove">\u00d7</button>
            </div>
          </div>
        </div>`;
    }).join('');

    const totalPnlClass = summary.totalPnl >= 0 ? 'pf-positive' : 'pf-negative';
    const totalPnlSign = summary.totalPnl >= 0 ? '+' : '';
    const dayClass = summary.totalDayChange >= 0 ? 'pf-positive' : 'pf-negative';
    const daySign = summary.totalDayChange >= 0 ? '+' : '';
    const riskClass = summary.metrics.riskScore >= 70 ? 'pf-negative' : summary.metrics.riskScore >= 40 ? 'pf-warning' : 'pf-positive';

    const donutSegments = summary.sectorAllocation
      .map(({ sector: label, value }) => ({ label, value, color: (SECTOR_COLORS as Record<string, string>)[label] ?? SECTOR_COLORS.Other! }))
      .sort((a, b) => b.value - a.value);

    const donutHtml = donutSegments.length > 1
      ? `<div class="pf-donut-wrap">${donutSvg(donutSegments, 120, 14)}<div class="pf-donut-legend">${donutSegments.map(s => `<span class="pf-donut-legend-item"><span class="pf-donut-dot" style="background:${s.color}"></span>${escapeHtml(s.label)}</span>`).join('')}</div></div>`
      : '';
    const txnRows = summary.transactions.slice(0, 6).map(txn => {
      const typeClass = `pf-txn-${txn.type.toLowerCase()}`;
      return `
        <div class="pf-txn-row">
          <span class="pf-txn-type ${typeClass}">${escapeHtml(txn.type)}</span>
          <span class="pf-txn-symbol">${escapeHtml(txn.symbol)}</span>
          <span class="pf-txn-detail">${txn.quantity.toLocaleString()} @ $${txn.price.toFixed(2)}</span>
          <span class="pf-txn-value">$${txn.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          <span class="pf-txn-date">${escapeHtml(txn.date)}</span>
        </div>
      `;
    }).join('');

    contentEl.innerHTML = `
      ${selectorHtml}
      <div class="pf-add-form">
        <input type="text" class="pf-input" id="pf-add-symbol" placeholder="Symbol (e.g. AAPL)" />
        <input type="number" class="pf-input pf-input-sm" id="pf-add-shares" placeholder="Shares" min="0" step="1" />
        <input type="number" class="pf-input pf-input-sm" id="pf-add-cost" placeholder="Avg Cost" min="0" step="0.01" />
        <button class="pf-add-btn" id="pf-add-btn">Add</button>
      </div>
      <div class="pf-summary">
        <div class="pf-summary-item">
          <span class="pf-summary-label">Portfolio Value</span>
          <span class="pf-summary-val">$${summary.totalMarketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="pf-summary-item">
          <span class="pf-summary-label">Total P&amp;L</span>
          <span class="pf-summary-val ${totalPnlClass}">${totalPnlSign}$${Math.abs(summary.totalPnl).toFixed(2)} (${totalPnlSign}${summary.totalPnlPct.toFixed(1)}%)</span>
        </div>
        <div class="pf-summary-item">
          <span class="pf-summary-label">Day Move</span>
          <span class="pf-summary-val ${dayClass}">${daySign}$${Math.abs(summary.totalDayChange).toFixed(2)} (${daySign}${summary.totalDayChangePct.toFixed(1)}%)</span>
        </div>
        ${lastUpdated ? `<div class="pf-summary-item"><span class="pf-summary-label">Updated</span><span class="pf-summary-val pf-updated">${escapeHtml(lastUpdated)}</span></div>` : ''}
      </div>
      <div class="pf-risk-ribbon">
        <div class="pf-risk-chip"><span>Top 3 Conc.</span><strong>${summary.metrics.concentrationTop3.toFixed(0)}%</strong></div>
        <div class="pf-risk-chip"><span>Vol 30D</span><strong>${summary.metrics.volatility30d.toFixed(1)}%</strong></div>
        <div class="pf-risk-chip"><span>VaR 95%</span><strong>$${summary.metrics.var95.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></div>
        <div class="pf-risk-chip"><span>Max DD</span><strong>${summary.metrics.maxDrawdown.toFixed(1)}%</strong></div>
        <div class="pf-risk-chip"><span>Sharpe</span><strong>${summary.metrics.sharpe.toFixed(2)}</strong></div>
        <div class="pf-risk-chip"><span>Risk</span><strong class="${riskClass}">${summary.metrics.riskScore.toFixed(0)}</strong></div>
      </div>
      ${donutHtml}
      <div class="pf-positions">${rows}</div>
      <div class="pf-transaction-section">
        <div class="pf-section-head">
          <div>
            <div class="pf-section-title">Transaction Trail</div>
            <div class="pf-section-subtitle">${summary.transactions.length} ledger ${summary.transactions.length === 1 ? 'entry' : 'entries'} in ${escapeHtml(summary.portfolio.name)}</div>
          </div>
        </div>
        <div class="pf-txn-list">${txnRows || '<div class="pf-empty">No transactions yet.</div>'}</div>
      </div>
    `;

    this.bindPortfolioSelector(contentEl);
    this.bindAddForm(contentEl);
    this.bindPositionActions(contentEl);
  }

  private bindPortfolioSelector(contentEl: HTMLElement): void {
    const select = contentEl.querySelector<HTMLSelectElement>('#pf-portfolio-select');
    select?.addEventListener('change', () => {
      this.activePortfolioId = select.value === 'legacy-watchlist' ? 'legacy-watchlist' : select.value;
      this.editingSymbol = null;
      this.renderContent();
    });

    contentEl.querySelector<HTMLButtonElement>('#pf-new-portfolio-btn')?.addEventListener('click', () => {
      const name = window.prompt('Portfolio name');
      if (!name?.trim()) return;
      createPortfolio(name.trim());
      this.editingSymbol = null;
      void this.renderContent();
    });
  }

  private bindRepositoryPortfolioActions(contentEl: HTMLElement, summary: PortfolioSummary): void {
    contentEl.querySelector('#pf-open-full-portfolio')?.addEventListener('click', () => {
      this.openPortfolioDetail(summary.portfolio.id);
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-position-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol;
        if (symbol) this.openPortfolioPosition(summary.portfolio.id, symbol);
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.ticker-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = el.dataset.ticker;
        const name = el.dataset.name;
        if (ticker) {
          this.openEntityDetail('company', { ticker, name: name || ticker });
        }
      });
    });
  }

  private async renderRepositoryPortfolioTab(contentEl: HTMLElement, portfolios: Portfolio[], portfolio: Portfolio): Promise<void> {
    const summary = await portfolioService.get_summary(portfolio.id);
    const sectorMap = new Map<string, number>();
    for (const holding of summary.holdings) {
      const sect = holding.sector ?? 'Other';
      sectorMap.set(sect, (sectorMap.get(sect) || 0) + holding.market_value);
    }

    const donutSegments = Array.from(sectorMap.entries())
      .map(([label, value]) => ({ label, value, color: (SECTOR_COLORS as Record<string, string>)[label] ?? SECTOR_COLORS.Other! }))
      .sort((a, b) => b.value - a.value);

    const donutHtml = donutSegments.length > 1
      ? `<div class="pf-donut-wrap">${donutSvg(donutSegments, 120, 14)}<div class="pf-donut-legend">${donutSegments.map(s => `<span class="pf-donut-legend-item"><span class="pf-donut-dot" style="background:${s.color}"></span>${escapeHtml(s.label)}</span>`).join('')}</div></div>`
      : '';

    const rows = summary.holdings.map((holding) => this.renderRepositoryHoldingRow(holding)).join('');

    contentEl.innerHTML = `
      ${this.renderPortfolioSelector(portfolios)}
      <div class="pf-section-head">
        <div>
          <div class="pf-section-title">${escapeHtml(summary.portfolio.name)}</div>
          <div class="pf-section-subtitle">${escapeHtml(summary.portfolio.currency)} transaction-replay portfolio</div>
        </div>
        <button class="pf-inline-btn" id="pf-open-full-portfolio" type="button">Open full</button>
      </div>
      <div class="pf-summary">
        <div class="pf-summary-item">
          <span class="pf-summary-label">NAV</span>
          <span class="pf-summary-val">$${summary.total_market_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="pf-summary-item">
          <span class="pf-summary-label">P&amp;L</span>
          <span class="pf-summary-val ${summary.total_unrealized_pnl >= 0 ? 'pf-positive' : 'pf-negative'}">${summary.total_unrealized_pnl >= 0 ? '+' : ''}$${Math.abs(summary.total_unrealized_pnl).toFixed(2)} (${summary.total_unrealized_pnl >= 0 ? '+' : ''}${summary.total_unrealized_pnl_percent.toFixed(1)}%)</span>
        </div>
        <div class="pf-summary-item">
          <span class="pf-summary-label">Positions</span>
          <span class="pf-summary-val">${summary.total_positions}</span>
        </div>
      </div>
      ${donutHtml}
      <div class="pf-positions">${rows || '<div class="pf-empty">No holdings in this portfolio.</div>'}</div>
    `;

    this.bindPortfolioSelector(contentEl);
    this.bindRepositoryPortfolioActions(contentEl, summary);
  }

  private renderRepositoryHoldingRow(holding: HoldingWithQuote): string {
    const pnlClass = holding.unrealized_pnl >= 0 ? 'pf-positive' : 'pf-negative';
    const pnlSign = holding.unrealized_pnl >= 0 ? '+' : '';
    const dayClass = holding.day_change_percent >= 0 ? 'pf-positive' : 'pf-negative';
    const daySign = holding.day_change_percent >= 0 ? '+' : '';
    const sectorColor = SECTOR_COLORS[holding.sector ?? 'Other'] || SECTOR_COLORS.Other;

    return `
      <div class="pf-position-row" data-symbol="${escapeHtml(holding.symbol)}">
        <div class="pf-pos-info">
          <span class="pf-pos-symbol ticker-link" data-ticker="${escapeHtml(holding.symbol)}" data-name="${escapeHtml(holding.name || holding.symbol)}">${escapeHtml(holding.symbol)}</span>
          <span class="pf-pos-name">${escapeHtml(holding.name || holding.symbol)}</span>
          <span class="pf-pos-sector" style="background:${sectorColor}30;color:${sectorColor}">${escapeHtml(holding.sector ?? '')}</span>
        </div>
        <div class="pf-pos-data">
          <div class="pf-pos-col">
            <span class="pf-pos-label">Qty</span>
            <span class="pf-pos-val">${holding.quantity.toLocaleString()}</span>
          </div>
          <div class="pf-pos-col">
            <span class="pf-pos-label">Price</span>
            <span class="pf-pos-val">${holding.current_price ? '$' + holding.current_price.toFixed(2) : '-'}</span>
          </div>
          <div class="pf-pos-col">
            <span class="pf-pos-label">Day</span>
            <span class="pf-pos-val ${dayClass}">${daySign}${holding.day_change_percent.toFixed(2)}%</span>
          </div>
          <div class="pf-pos-col">
            <span class="pf-pos-label">P&amp;L</span>
            <span class="pf-pos-val ${pnlClass}">${pnlSign}$${Math.abs(holding.unrealized_pnl).toFixed(2)} (${pnlSign}${holding.unrealized_pnl_percent.toFixed(1)}%)</span>
          </div>
          ${holding.sparkline.length >= 2 ? `<div class="pf-pos-spark">${sparklineSvg(holding.sparkline, holding.day_change_percent, 56, 20)}</div>` : ''}
          <div class="pf-pos-actions">
            <button class="pf-row-open-btn pf-position-expand" data-symbol="${escapeHtml(holding.symbol)}" title="Expand position" type="button">&rsaquo;</button>
          </div>
        </div>
      </div>`;
  }

  private renderPortfolioSelector(portfolios: Portfolio[]): string {
    const portfolioOptions = portfolios.map((portfolio) => `
      <option value="${escapeHtml(portfolio.id)}"${portfolio.id === this.activePortfolioId ? ' selected' : ''}>
        ${escapeHtml(portfolio.name)}
      </option>
    `).join('');
    const legacySelected = this.activePortfolioId === 'legacy-watchlist' ? ' selected' : '';

    return `
      <div class="pf-portfolio-switcher">
        <label class="pf-switch-label" for="pf-portfolio-select">Portfolios</label>
        <select class="pf-select pf-portfolio-select" id="pf-portfolio-select">
          ${portfolioOptions}
          <option value="legacy-watchlist"${legacySelected}>My Watchlist</option>
        </select>
      </div>
    `;
  }

  private bindAddForm(contentEl: HTMLElement): void {
    const addBtn = contentEl.querySelector('#pf-add-btn');
    addBtn?.addEventListener('click', () => {
      const symbolInput = contentEl.querySelector('#pf-add-symbol') as HTMLInputElement;
      const sharesInput = contentEl.querySelector('#pf-add-shares') as HTMLInputElement;
      const costInput = contentEl.querySelector('#pf-add-cost') as HTMLInputElement;
      const symbol = symbolInput.value.trim().toUpperCase();
      const shares = parseFloat(sharesInput.value);
      const avgCost = parseFloat(costInput.value);
      if (!symbol || !shares || !avgCost) return;
      addUserPosition({ symbol, name: symbol, shares, avgCost });
      this.renderContent();
    });

    const symbolInput = contentEl.querySelector('#pf-add-symbol') as HTMLInputElement;
    if (symbolInput) {
      symbolInput.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') addBtn?.dispatchEvent(new Event('click'));
      });
    }
  }

  private bindPositionActions(contentEl: HTMLElement): void {
    contentEl.querySelectorAll<HTMLElement>('.pf-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol;
        if (symbol) { removeUserPosition(symbol); this.renderContent(); }
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editingSymbol = btn.dataset.symbol || null;
        this.renderContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-edit-save').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol!;
        const sharesInput = contentEl.querySelector(`#pf-edit-shares-${CSS.escape(symbol)}`) as HTMLInputElement;
        const costInput = contentEl.querySelector(`#pf-edit-cost-${CSS.escape(symbol)}`) as HTMLInputElement;
        const shares = parseFloat(sharesInput?.value);
        const avgCost = parseFloat(costInput?.value);
        if (shares && avgCost) {
          editUserPosition(symbol, { shares, avgCost });
        }
        this.editingSymbol = null;
        this.renderContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-edit-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editingSymbol = null;
        this.renderContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-watchlist-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol || '';
        const name = btn.dataset.name || symbol;
        if (!symbol) return;
        const entries = getMarketWatchlistEntries();
        if (!entries.some(e => e.symbol === symbol)) {
          entries.push({ symbol, name });
          setMarketWatchlistEntries(entries);
        }
        btn.textContent = '\u2605';
        btn.classList.add('pf-watchlisted');
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.ticker-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = el.dataset.ticker;
        const name = el.dataset.name;
        if (ticker) {
          this.openEntityDetail('company', { ticker, name: name || ticker });
        }
      });
    });
  }

  private openPortfolioDetail(portfolioId: string, view: DetailView = 'AnalyticsSectors'): void {
    getPortfolioDetailPanel().showAggregate(portfolioId, view);
  }

  private openPortfolioPosition(portfolioId: string, symbol: string): void {
    getPortfolioDetailPanel().showPosition(portfolioId, symbol);
  }

  private openEntityDetail(type: PopupType, data: unknown): void {
    document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
      detail: { type, data },
    }));

    const fallback = (window as any).__entityDetailPanel;
    fallback?.show?.(type, data);
  }

  public override destroy(): void {
    this.stopAutoRefresh();
    super.destroy();
  }
}
