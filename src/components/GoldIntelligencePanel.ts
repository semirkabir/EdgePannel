import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';
import { toRuntimeUrl as toApiUrl } from '@/services/runtime';
import { miniSparkline } from '@/utils/sparkline';

interface CrossCurrencyPrice {
  currency: string;
  flag: string;
  price: number;
}

interface CotData {
  reportDate: string;
  managedMoneyLong: number;
  managedMoneyShort: number;
  netPct: number;
  dealerLong: number;
  dealerShort: number;
}

interface GoldIntelligenceData {
  goldPrice: number;
  goldChangePct: number;
  goldSparkline: number[];
  silverPrice: number;
  platinumPrice: number;
  palladiumPrice: number;
  goldSilverRatio?: number;
  goldPlatinumPremiumPct?: number;
  crossCurrencyPrices: CrossCurrencyPrice[];
  cot?: CotData;
  updatedAt: string;
  unavailable?: boolean;
}

function fmtPrice(v: number, decimals = 2): string {
  if (!Number.isFinite(v) || v <= 0) return '--';
  return v >= 10000 ? Math.round(v).toLocaleString() : v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function renderPositionBar(netPct: number, label: string): string {
  const clamped = Math.max(-100, Math.min(100, netPct));
  const halfWidth = Math.abs(clamped) / 100 * 50;
  const color = clamped >= 0 ? '#2ecc71' : '#e74c3c';
  const leftPct = clamped >= 0 ? 50 : 50 - halfWidth;
  const sign = clamped >= 0 ? '+' : '';
  return `
    <div style="margin:3px 0">
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-dim);margin-bottom:2px">
        <span>${escapeHtml(label)}</span>
        <span style="color:${color};font-weight:600">${sign}${clamped.toFixed(1)}%</span>
      </div>
      <div style="position:relative;height:8px;background:rgba(255,255,255,0.06);border-radius:2px">
        <div style="position:absolute;top:0;bottom:0;left:50%;width:1px;background:rgba(255,255,255,0.15)"></div>
        <div style="position:absolute;top:0;bottom:0;left:${leftPct.toFixed(2)}%;width:${halfWidth.toFixed(2)}%;background:${color};border-radius:1px"></div>
      </div>
    </div>`;
}

function ratioLabel(ratio: number): { text: string; color: string } {
  if (ratio > 80) return { text: 'Silver undervalued', color: '#f5a623' };
  if (ratio < 60) return { text: 'Gold undervalued', color: '#f5a623' };
  return { text: 'Neutral', color: 'var(--text-dim)' };
}

export class GoldIntelligencePanel extends Panel {
  private _hasData = false;

  constructor() {
    super({ id: 'gold-intelligence', title: t('panels.goldIntelligence'), infoTooltip: t('components.goldIntelligence.infoTooltip') });
  }

  public async fetchData(): Promise<boolean> {
    this.showLoading();
    try {
      const url = toApiUrl('/api/market/v1/get-gold-intelligence');
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: GoldIntelligenceData = await resp.json();

      if (data.unavailable) {
        if (!this._hasData) this.showError('Gold data unavailable', () => void this.fetchData());
        return false;
      }

      if (!this.element?.isConnected) return false;
      this._hasData = true;
      this.render(data);
      return true;
    } catch (e) {
      if (this.isAbortError(e)) return false;
      if (!this.element?.isConnected) return false;
      if (!this._hasData) this.showError(e instanceof Error ? e.message : 'Failed to load', () => void this.fetchData());
      return false;
    }
  }

  private render(d: GoldIntelligenceData): void {
    const changePct = d.goldChangePct;
    const changeColor = changePct >= 0 ? '#2ecc71' : '#e74c3c';
    const changeSign = changePct >= 0 ? '+' : '';
    const spark = miniSparkline(d.goldSparkline, changePct, 80, 20);

    const ratioHtml = d.goldSilverRatio != null && Number.isFinite(d.goldSilverRatio)
      ? (() => {
        const rl = ratioLabel(d.goldSilverRatio!);
        return `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
          <span style="font-size:10px;color:var(--text-dim)">Gold/Silver Ratio</span>
          <span style="font-size:11px;font-weight:600">${escapeHtml(d.goldSilverRatio!.toFixed(1))} <span style="font-size:9px;color:${rl.color};font-weight:400">${escapeHtml(rl.text)}</span></span>
        </div>`;
      })()
      : '';

    const premiumHtml = d.goldPlatinumPremiumPct != null && Number.isFinite(d.goldPlatinumPremiumPct)
      ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="font-size:10px;color:var(--text-dim)">Gold vs Platinum</span>
          <span style="font-size:11px;font-weight:600">${d.goldPlatinumPremiumPct >= 0 ? '+' : ''}${escapeHtml(d.goldPlatinumPremiumPct.toFixed(1))}% premium</span>
        </div>`
      : '';

    const metalCards = [
      { label: 'Silver', price: d.silverPrice, sym: 'SI=F' },
      { label: 'Platinum', price: d.platinumPrice, sym: 'PL=F' },
      { label: 'Palladium', price: d.palladiumPrice, sym: 'PA=F' },
    ].map(m =>
      `<div style="flex:1;text-align:center;padding:4px;background:rgba(255,255,255,0.03);border-radius:4px">
        <div style="font-size:9px;color:var(--text-dim)">${escapeHtml(m.label)}</div>
        <div style="font-size:11px;font-weight:600">$${escapeHtml(fmtPrice(m.price))}</div>
      </div>`
    ).join('');

    const section1 = `
      <div class="energy-tape-section">
        <div class="energy-section-title">Price &amp; Performance</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:16px;font-weight:700">$${escapeHtml(fmtPrice(d.goldPrice))}</span>
          <span style="font-size:11px;font-weight:600;color:${changeColor};padding:1px 6px;border-radius:3px;background:${changeColor}22">${changeSign}${escapeHtml(changePct.toFixed(2))}%</span>
          ${spark}
        </div>
        ${ratioHtml}
        ${premiumHtml}
        <div style="display:flex;gap:6px;margin-top:8px">${metalCards}</div>
      </div>`;

    const fxRows = d.crossCurrencyPrices.map(c =>
      `<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.03);border-radius:4px">
        <div style="font-size:9px;color:var(--text-dim)">${escapeHtml(c.flag)} XAU/${escapeHtml(c.currency)}</div>
        <div style="font-size:11px;font-weight:600">${escapeHtml(fmtPrice(c.price, 0))}</div>
      </div>`
    ).join('');

    const section2 = d.crossCurrencyPrices.length > 0
      ? `<div class="energy-tape-section" style="margin-top:10px">
          <div class="energy-section-title">Gold in Major Currencies</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${fxRows}</div>
        </div>`
      : '';

    let section3 = '';
    if (d.cot) {
      const c = d.cot;
      const longStr = Math.round(c.managedMoneyLong).toLocaleString();
      const shortStr = Math.round(c.managedMoneyShort).toLocaleString();
      section3 = `
        <div class="energy-tape-section" style="margin-top:10px">
          <div class="energy-section-title">CFTC Positioning (Managed Money)</div>
          ${renderPositionBar(c.netPct, 'Net Position')}
          <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-dim);margin-top:4px">
            <span>Long: ${escapeHtml(longStr)}</span>
            <span>Short: ${escapeHtml(shortStr)}</span>
          </div>
          ${c.reportDate ? `<div style="font-size:9px;color:var(--text-dim);margin-top:6px;text-align:right">Report: ${escapeHtml(c.reportDate)}</div>` : ''}
        </div>`;
    }

    this.setContent(`<div style="padding:10px 14px">${section1}${section2}${section3}</div>`);
  }
}
