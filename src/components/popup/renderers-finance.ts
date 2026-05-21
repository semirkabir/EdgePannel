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
  const ciiScore = exchange.enrichCii;
  const ciiColor = ciiScore ? (ciiScore.level === 'critical' || ciiScore.level === 'high' ? '#f87171' : ciiScore.level === 'elevated' ? '#fbbf24' : '#4ade80') : null;
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
        ${ciiScore ? stat('Country Stability', `<span style="color:${ciiColor}">${escapeHtml(ciiScore.level.toUpperCase())} (${ciiScore.score.toFixed(0)}/100)</span>`) : ''}
      </div>
      ${exchange.description ? `<p class="popup-description">${escapeHtml(exchange.description)}</p>` : ''}
    </div>
  `;
}

export function renderFinancialCenterPopup(center: FinancialCenterPopupData): string {
  const ciiScore = center._enrichCii;
  const ciiColor = ciiScore ? (ciiScore.level === 'critical' || ciiScore.level === 'high' ? '#f87171' : ciiScore.level === 'elevated' ? '#fbbf24' : '#4ade80') : null;
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
        ${ciiScore ? stat('Country Stability', `<span style="color:${ciiColor}">${escapeHtml(ciiScore.level.toUpperCase())} (${ciiScore.score.toFixed(0)}/100)</span>`) : ''}
      </div>
      ${center.specialties?.length ? section(t('popups.financialCenter.specialties'), tags(center.specialties.map(s => escapeHtml(s)))) : ''}
      ${center.description ? `<p class="popup-description">${escapeHtml(center.description)}</p>` : ''}
    </div>
  `;
}

export function renderCentralBankPopup(bank: CentralBankPopupData): string {
  const ciiScore = bank.enrichCii;
  const ciiColor = ciiScore ? (ciiScore.level === 'critical' || ciiScore.level === 'high' ? '#f87171' : ciiScore.level === 'elevated' ? '#fbbf24' : '#4ade80') : null;
  const sanctionLevel = bank.enrichSanctioned;
  const sanctionColor = sanctionLevel === 'severe' ? '#f87171' : sanctionLevel === 'high' ? '#fb923c' : '#fbbf24';
  return `
    <div class="popup-header central-bank">
      <span class="popup-title">${escapeHtml(bank.shortName)}</span>
      ${pbadge(bank.type.toUpperCase(), '')}
      ${sanctionLevel ? pbadge('SANCTIONED', 'high') : ''}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(bank.name)}</div>
      <div class="popup-stats">
        ${stat(t('popups.location'), `${escapeHtml(bank.city)}, ${escapeHtml(bank.country)}`)}
        ${bank.currency ? stat(t('popups.centralBank.currency'), escapeHtml(bank.currency)) : ''}
        ${ciiScore ? stat('Country Stability', `<span style="color:${ciiColor}">${escapeHtml(ciiScore.level.toUpperCase())} (${ciiScore.score.toFixed(0)}/100)</span>`) : ''}
        ${sanctionLevel ? stat('Sanctions Risk', `<span style="color:${sanctionColor}">${escapeHtml(sanctionLevel.toUpperCase())}</span>`) : ''}
      </div>
      ${bank.description ? `<p class="popup-description">${escapeHtml(bank.description)}</p>` : ''}
    </div>
  `;
}

export function renderCommodityHubPopup(hub: CommodityHubPopupData): string {
  const showOil = hub.enrichWtiPrice != null || hub.enrichBrentPrice != null;
  return `
    <div class="popup-header commodity-hub">
      <span class="popup-title">${escapeHtml(hub.name)}</span>
      ${pbadge(hub.type.toUpperCase(), '')}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat(t('popups.location'), `${escapeHtml(hub.city)}, ${escapeHtml(hub.country)}`)}
        ${hub.enrichWtiPrice != null ? stat('WTI Crude', `<strong>$${hub.enrichWtiPrice.toFixed(2)}</strong>/bbl`) : ''}
        ${hub.enrichBrentPrice != null ? stat('Brent Crude', `<strong>$${hub.enrichBrentPrice.toFixed(2)}</strong>/bbl`) : ''}
      </div>
      ${hub.commodities?.length ? section(t('popups.commodityHub.commodities'), tags(hub.commodities.map(c => escapeHtml(c)))) : ''}
      ${showOil ? `<p class="popup-description" style="font-size:0.75rem;opacity:0.6">Live prices via EIA</p>` : ''}
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
