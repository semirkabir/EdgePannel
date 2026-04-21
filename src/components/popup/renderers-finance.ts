import type { TradeRouteSegment } from '@/config/trade-routes';
import type { CommodityPort } from '@/config/commodity-geo';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import type { StockExchangePopupData, FinancialCenterPopupData, CentralBankPopupData, CommodityHubPopupData } from './types';

function stat(label: string, value: string): string {
  return `<div class="popup-stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
}
function pbadge(text: string, cls: string): string {
  return `<span class="popup-badge ${cls}">${text}</span>`;
}
function section(title: string, content: string): string {
  return `<div class="popup-section"><span class="section-label">${title}</span>${content}</div>`;
}
function tags(items: string[]): string {
  return `<div class="popup-tags">${items.map(i => `<span class="popup-tag">${i}</span>`).join('')}</div>`;
}

export function renderStockExchangePopup(exchange: StockExchangePopupData): string {
  const tierClass = exchange.tier === 'mega' ? 'high' : exchange.tier === 'major' ? 'medium' : 'low';
  return `
    <div class="popup-header exchange">
      <span class="popup-title">${escapeHtml(exchange.shortName)}</span>
      ${pbadge(exchange.tier.toUpperCase(), tierClass)}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(exchange.name)}</div>
      <div class="popup-stats">
        ${stat(t('popups.location'), `${escapeHtml(exchange.city)}, ${escapeHtml(exchange.country)}`)}
        ${exchange.marketCap ? stat(t('popups.stockExchange.marketCap'), `$${exchange.marketCap}T`) : ''}
        ${exchange.tradingHours ? stat(t('popups.tradingHours'), escapeHtml(exchange.tradingHours)) : ''}
      </div>
      ${exchange.description ? `<p class="popup-description">${escapeHtml(exchange.description)}</p>` : ''}
    </div>
  `;
}

export function renderFinancialCenterPopup(center: FinancialCenterPopupData): string {
  return `
    <div class="popup-header financial-center">
      <span class="popup-title">${escapeHtml(center.name)}</span>
      ${pbadge(center.type.toUpperCase(), '')}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat(t('popups.location'), `${escapeHtml(center.city)}, ${escapeHtml(center.country)}`)}
        ${center.gfciRank ? stat(t('popups.financialCenter.gfciRank'), `#${center.gfciRank}`) : ''}
      </div>
      ${center.specialties?.length ? section(t('popups.financialCenter.specialties'), tags(center.specialties.map(s => escapeHtml(s)))) : ''}
      ${center.description ? `<p class="popup-description">${escapeHtml(center.description)}</p>` : ''}
    </div>
  `;
}

export function renderCentralBankPopup(bank: CentralBankPopupData): string {
  return `
    <div class="popup-header central-bank">
      <span class="popup-title">${escapeHtml(bank.shortName)}</span>
      ${pbadge(bank.type.toUpperCase(), '')}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(bank.name)}</div>
      <div class="popup-stats">
        ${stat(t('popups.location'), `${escapeHtml(bank.city)}, ${escapeHtml(bank.country)}`)}
        ${bank.currency ? stat(t('popups.centralBank.currency'), escapeHtml(bank.currency)) : ''}
      </div>
      ${bank.description ? `<p class="popup-description">${escapeHtml(bank.description)}</p>` : ''}
    </div>
  `;
}

export function renderCommodityHubPopup(hub: CommodityHubPopupData): string {
  return `
    <div class="popup-header commodity-hub">
      <span class="popup-title">${escapeHtml(hub.name)}</span>
      ${pbadge(hub.type.toUpperCase(), '')}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat(t('popups.location'), `${escapeHtml(hub.city)}, ${escapeHtml(hub.country)}`)}
      </div>
      ${hub.commodities?.length ? section(t('popups.commodityHub.commodities'), tags(hub.commodities.map(c => escapeHtml(c)))) : ''}
      ${hub.description ? `<p class="popup-description">${escapeHtml(hub.description)}</p>` : ''}
    </div>
  `;
}

export function renderCommodityPortPopup(port: CommodityPort): string {
  return `
    <div class="popup-header commodity-hub">
      <span class="popup-icon">⚓</span>
      <span class="popup-title">${escapeHtml(port.name.toUpperCase())}</span>
      ${pbadge('COMMODITY PORT', '')}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(port.city)}, ${escapeHtml(port.country)}</div>
      <div class="popup-stats">
        ${stat(t('popups.location'), `${escapeHtml(port.city)}, ${escapeHtml(port.country)}`)}
        ${port.annualVolumeMt != null ? stat('Annual Volume', `${port.annualVolumeMt}Mt/yr`) : ''}
        ${port.annualThroughput ? stat('Throughput', escapeHtml(port.annualThroughput)) : ''}
      </div>
      ${section('Commodities', tags(port.commodities.map(c => escapeHtml(c))))}
      ${port.significance ? `<p class="popup-description">${escapeHtml(port.significance)}</p>` : ''}
    </div>
  `;
}

export function renderTradeRoutePopup(seg: TradeRouteSegment): string {
  const statusClass = seg.status === 'disrupted' ? 'high' : seg.status === 'high_risk' ? 'medium' : 'normal';
  const statusLabel = seg.status === 'disrupted' ? 'DISRUPTED' : seg.status === 'high_risk' ? 'HIGH RISK' : 'ACTIVE';
  const categoryLabel = seg.category.charAt(0).toUpperCase() + seg.category.slice(1);
  return `
    <div class="popup-header trade-route">
      <span class="popup-title">${escapeHtml(seg.routeName)}</span>
      ${pbadge(statusLabel, statusClass)}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat(t('popups.type'), categoryLabel)}
        ${stat(t('components.investments.investment'), escapeHtml(seg.volumeDesc))}
      </div>
    </div>
  `;
}
