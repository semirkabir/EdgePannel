import type { EntityRenderer, EntityRenderContext } from '../types';
import type { CongressTrade } from '@/services/market/portfolio';
import { escapeHtml } from '@/utils/sanitize';
import { fetchCongressTrades } from '@/services/market/portfolio';

interface CongressTradeEnriched {
  trade: CongressTrade;
  relatedTrades: CongressTrade[];
}

export class CongressTradeRenderer implements EntityRenderer {
  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const trade = data as CongressTrade;
    const root = ctx.el('div', 'edp-generic');

    const header = ctx.el('div', 'edp-header');
    const title = ctx.el('h2', 'edp-title', trade?.politician || 'Congress Trade');
    header.append(title);
    root.append(header);

    root.append(ctx.makeLoading('Loading trade details\u2026'));
    return root;
  }

  async enrich(data: unknown, signal: AbortSignal): Promise<CongressTradeEnriched> {
    const trade = data as CongressTrade;
    let relatedTrades: CongressTrade[] = [];

    try {
      const resp = await fetchCongressTrades();
      relatedTrades = resp.trades.filter(t =>
        t.politician === trade.politician ||
        t.ticker === trade.ticker
      ).slice(0, 20);
    } catch { /* related trades unavailable */ }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    return { trade, relatedTrades };
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const { trade, relatedTrades } = enrichedData as CongressTradeEnriched;

    container.replaceChildren();

    const root = ctx.el('div', 'edp-generic');
    const partyColor = trade.party === 'Republican' ? '#ef4444' : trade.party === 'Democrat' ? '#3b82f6' : '#888';

    const header = ctx.el('div', 'edp-header');
    const title = ctx.el('h2', 'edp-title', trade.politician);
    const badge = ctx.badge(trade.party, 'edp-badge');
    badge.style.color = partyColor;
    badge.style.borderColor = partyColor;
    header.append(title, badge);
    root.append(header);

    const [detailsCard, detailsBody] = ctx.sectionCard('Trade Details');
    const isPurchase = trade.transactionType.toLowerCase().includes('purchase');
    const isSale = trade.transactionType.toLowerCase().includes('sale');
    const typeLabel = isPurchase ? 'PURCHASE' : isSale ? 'SALE' : trade.transactionType.toUpperCase();
    const typeColor = isPurchase ? '#22c55e' : isSale ? '#ef4444' : '#94a3b8';

    detailsBody.innerHTML = `
      <div class="edp-detail-row">
        <span class="edp-detail-label">Type</span>
        <span class="edp-detail-value" style="color:${typeColor};font-weight:700">${typeLabel}</span>
      </div>
      <div class="edp-detail-row">
        <span class="edp-detail-label">Ticker</span>
        <span class="edp-detail-value ticker-link" data-ticker="${escapeHtml(trade.ticker)}" data-name="${escapeHtml(trade.assetDescription)}" style="color:var(--accent);cursor:pointer">${escapeHtml(trade.ticker)}</span>
      </div>
      <div class="edp-detail-row">
        <span class="edp-detail-label">Asset</span>
        <span class="edp-detail-value">${escapeHtml(trade.assetDescription)}</span>
      </div>
      <div class="edp-detail-row">
        <span class="edp-detail-label">Amount</span>
        <span class="edp-detail-value">${escapeHtml(trade.amount)}</span>
      </div>
      <div class="edp-detail-row">
        <span class="edp-detail-label">Transaction Date</span>
        <span class="edp-detail-value">${escapeHtml(trade.transactionDate)}</span>
      </div>
      <div class="edp-detail-row">
        <span class="edp-detail-label">Disclosure Date</span>
        <span class="edp-detail-value">${escapeHtml(trade.disclosureDate)}</span>
      </div>
      <div class="edp-detail-row">
        <span class="edp-detail-label">Chamber</span>
        <span class="edp-detail-value">${escapeHtml(trade.chamber)}</span>
      </div>
      ${trade.district ? `<div class="edp-detail-row">
        <span class="edp-detail-label">District</span>
        <span class="edp-detail-value">${escapeHtml(trade.district)}</span>
      </div>` : ''}
      ${trade.state ? `<div class="edp-detail-row">
        <span class="edp-detail-label">State</span>
        <span class="edp-detail-value">${escapeHtml(trade.state)}</span>
      </div>` : ''}
    `;
    root.append(detailsCard);

    const samePoliticianTrades = relatedTrades.filter(t => t.politician === trade.politician && t !== trade);
    if (samePoliticianTrades.length > 0) {
      const [relatedCard, relatedBody] = ctx.sectionCard(`Recent Trades by ${trade.politician}`);
      const tradeRows = samePoliticianTrades.slice(0, 10).map(rt => {
        const rtPurchase = rt.transactionType.toLowerCase().includes('purchase');
        const rtColor = rtPurchase ? '#22c55e' : '#ef4444';
        const rtLabel = rtPurchase ? 'BUY' : 'SELL';
        return `<div class="edp-detail-row" style="cursor:pointer" data-ticker="${escapeHtml(rt.ticker)}" data-name="${escapeHtml(rt.assetDescription)}">
          <span class="edp-detail-value">${escapeHtml(rt.ticker)}
            <span style="color:${rtColor};font-size:10px;font-weight:700;margin-left:4px">${rtLabel}</span>
          </span>
          <span style="font-size:11px;color:var(--text-dim)">${escapeHtml(rt.transactionDate)} \u00b7 ${escapeHtml(rt.amount)}</span>
        </div>`;
      }).join('');
      relatedBody.innerHTML = tradeRows;
      root.append(relatedCard);
    }

    const sameTickerTrades = relatedTrades.filter(t => t.ticker === trade.ticker && t !== trade);
    if (sameTickerTrades.length > 0) {
      const [tickerCard, tickerBody] = ctx.sectionCard(`Other ${trade.ticker} Trades`);
      const tickerRows = sameTickerTrades.slice(0, 10).map(rt => {
        const rtPurchase = rt.transactionType.toLowerCase().includes('purchase');
        const rtColor = rtPurchase ? '#22c55e' : '#ef4444';
        const rtLabel = rtPurchase ? 'BUY' : 'SELL';
        return `<div class="edp-detail-row" style="cursor:pointer" data-politician="${escapeHtml(rt.politician)}">
          <span class="edp-detail-value">${escapeHtml(rt.politician)}
            <span style="color:${rtColor};font-size:10px;font-weight:700;margin-left:4px">${rtLabel}</span>
          </span>
          <span style="font-size:11px;color:var(--text-dim)">${escapeHtml(rt.transactionDate)} \u00b7 ${escapeHtml(rt.amount)}</span>
        </div>`;
      }).join('');
      tickerBody.innerHTML = tickerRows;
      root.append(tickerCard);
    }

    container.append(root);

    container.querySelectorAll<HTMLElement>('.ticker-link').forEach(el => {
      el.addEventListener('click', () => {
        const ticker = el.dataset.ticker;
        const name = el.dataset.name;
        if (ticker) {
          const panel = (window as any).__entityDetailPanel;
          panel?.show('company', { ticker, name: name || ticker });
        }
      });
    });
  }
}