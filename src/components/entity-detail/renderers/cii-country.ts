import { calculateCII, type CountryScore } from '@/services/country-instability';
import type { EntityRenderer, EntityRenderContext } from '../types';

const LEVEL_CLASS: Record<string, string> = {
  critical: 'edp-badge edp-badge-severity',
  high: 'edp-badge edp-badge-severity',
  elevated: 'edp-badge edp-badge-warning',
  normal: 'edp-badge',
  low: 'edp-badge edp-badge-status',
};

const LEVEL_LABEL: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  elevated: 'ELEVATED',
  normal: 'NORMAL',
  low: 'STABLE',
};

const TREND_LABEL: Record<string, string> = {
  rising: '\u2191 Rising',
  stable: '\u2192 Stable',
  falling: '\u2193 Falling',
};

function getLevel(score: number): string {
  if (score >= 81) return 'critical';
  if (score >= 66) return 'high';
  if (score >= 51) return 'elevated';
  if (score >= 31) return 'normal';
  return 'low';
}

function getScoreTone(score: number): string {
  if (score >= 81) return 'critical';
  if (score >= 66) return 'high';
  if (score >= 51) return 'elevated';
  if (score >= 31) return 'normal';
  return 'low';
}

interface CiiChoroplethFeature {
  properties?: Record<string, unknown>;
}

export class CiiCountryRenderer implements EntityRenderer {
  private cachedScores: Map<string, CountryScore> | null = null;

  private getScores(): Map<string, CountryScore> {
    if (!this.cachedScores) {
      this.cachedScores = new Map();
      for (const s of calculateCII()) {
        this.cachedScores.set(s.code, s);
      }
    }
    return this.cachedScores;
  }

  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const feature = data as CiiChoroplethFeature;
    const props = feature?.properties ?? {};
    const name = String(props.name ?? props['ISO3166-1-Alpha-2'] ?? 'Unknown');
    const code = String(props['ISO3166-1-Alpha-2'] ?? '');
    const scoreEntry = code ? this.getScores().get(code) : undefined;
    const score = scoreEntry?.score ?? 0;
    const level = scoreEntry?.level ?? getLevel(score);
    const trend = scoreEntry?.trend ?? 'stable';
    const change24h = scoreEntry?.change24h ?? 0;
    const components = scoreEntry?.components;

    const container = ctx.el('div', 'edp-generic edp-hotspot-detail');

    const header = ctx.el('div', 'edp-header edp-header-card');
    header.append(ctx.el('h2', 'edp-title', name));

    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge(LEVEL_LABEL[level] ?? level.toUpperCase(), LEVEL_CLASS[level] ?? 'edp-badge'));
    badgeRow.append(ctx.badge(`CII ${score}`, `edp-badge edp-hotspot-score-${getScoreTone(score)}`));
    header.append(badgeRow);
    container.append(header);

    const [scoreCard, scoreBody] = ctx.sectionCard('Country Instability Index');
    scoreCard.classList.add('edp-hotspot-score-card');

    const scoreTop = ctx.el('div', 'edp-hotspot-score-top');
    const scoreTile = ctx.el('div', `edp-hotspot-score-tile edp-hotspot-score-${getScoreTone(score)}`);
    scoreTile.append(ctx.el('div', 'edp-hotspot-score-value', `${score}/100`));
    scoreTile.append(ctx.el('div', 'edp-hotspot-score-label', LEVEL_LABEL[level] ?? level));
    scoreTop.append(scoreTile);

    const scoreMeta = ctx.el('div', 'edp-hotspot-score-meta');
    const trendStr = TREND_LABEL[trend] ?? trend;
    const trendClass = trend === 'rising' ? 'edp-hotspot-inline-stat edp-hotspot-inline-rising' : trend === 'falling' ? 'edp-hotspot-inline-stat edp-hotspot-inline-falling' : 'edp-hotspot-inline-stat';
    const trendStat = ctx.el('div', trendClass);
    trendStat.append(ctx.el('span', 'edp-hotspot-inline-label', 'Trend'));
    trendStat.append(ctx.el('strong', 'edp-hotspot-inline-value', trendStr));
    scoreMeta.append(trendStat);

    if (change24h !== 0) {
      const changeStat = ctx.el('div', 'edp-hotspot-inline-stat');
      changeStat.append(ctx.el('span', 'edp-hotspot-inline-label', '24h Change'));
      changeStat.append(ctx.el('strong', 'edp-hotspot-inline-value', `${change24h > 0 ? '+' : ''}${change24h.toFixed(1)}`));
      scoreMeta.append(changeStat);
    }
    scoreTop.append(scoreMeta);
    scoreBody.append(scoreTop);
    container.append(scoreCard);

    if (components) {
      const [compCard, compBody] = ctx.sectionCard('Component Breakdown');
      const compItems = [
        ['Civil Unrest', components.unrest, 'news'],
        ['Armed Conflict', components.conflict, 'conflict'],
        ['Security', components.security, 'military'],
        ['Info Integrity', components.information, 'cii'],
        ['Economic', components.economic, 'geo'],
      ] as const;

      for (const [label, value, tone] of compItems) {
        const item = ctx.el('div', 'edp-hotspot-component');
        item.append(ctx.el('span', 'edp-hotspot-component-label', label));
        const meter = ctx.el('div', 'edp-hotspot-component-meter');
        const fill = ctx.el('div', `edp-hotspot-component-fill edp-hotspot-component-fill-${tone}`);
        fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
        meter.append(fill);
        item.append(meter);
        item.append(ctx.el('strong', 'edp-hotspot-component-value', String(Math.round(value))));
        compBody.append(item);
      }
      container.append(compCard);
    }

    return container;
  }
}