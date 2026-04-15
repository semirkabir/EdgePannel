import type { EntityRenderer, EntityRenderContext } from '../types';

interface GovernanceFeature {
  properties?: Record<string, unknown>;
}

const GOV_LEVEL_CLASS: Record<string, string> = {
  excellent: 'edp-badge edp-badge-status',
  good: 'edp-badge edp-badge-tier',
  moderate: 'edp-badge edp-badge-warning',
  weak: 'edp-badge edp-badge-severity',
  failing: 'edp-badge edp-badge-severity',
};

const GOV_LEVEL_LABEL: Record<string, string> = {
  excellent: 'EXCELLENT',
  good: 'GOOD',
  moderate: 'MODERATE',
  weak: 'WEAK',
  failing: 'FAILING',
};

function getGovernanceLevel(index: number): string {
  if (index >= 80) return 'excellent';
  if (index >= 60) return 'good';
  if (index >= 40) return 'moderate';
  if (index >= 20) return 'weak';
  return 'failing';
}

const COMPONENT_LABELS: Record<string, string> = {
  controlOfCorruption: 'Control of Corruption',
  governmentEffectiveness: 'Gov. Effectiveness',
  politicalStability: 'Political Stability',
  ruleOfLaw: 'Rule of Law',
  regulatoryQuality: 'Regulatory Quality',
  voiceAndAccountability: 'Voice & Accountability',
};

const GOV_WEIGHTS: Record<string, number> = {
  controlOfCorruption: 0.20,
  governmentEffectiveness: 0.20,
  politicalStability: 0.30,
  ruleOfLaw: 0.15,
  regulatoryQuality: 0.10,
  voiceAndAccountability: 0.05,
};

export class GovernanceCountryRenderer implements EntityRenderer {
  private governanceMap: Map<string, { index: number; baselineRisk: number; components: Record<string, number | null> }> = new Map();

  private async loadGovernance(signal: AbortSignal): Promise<void> {
    try {
      const { getGovernanceScores } = await import('@/services/economic/index');
      const { iso3ToIso2Code } = await import('@/services/country-geometry');
      const scores = await getGovernanceScores();
      if (signal.aborted) return;
      for (const s of scores) {
        const code = iso3ToIso2Code(s.countryCode) ?? s.countryCode;
        this.governanceMap.set(code, {
          index: s.governanceIndex,
          baselineRisk: s.baselineRisk,
          components: {
            controlOfCorruption: s.components.controlOfCorruption,
            governmentEffectiveness: s.components.governmentEffectiveness,
            politicalStability: s.components.politicalStability,
            ruleOfLaw: s.components.ruleOfLaw,
            regulatoryQuality: s.components.regulatoryQuality,
            voiceAndAccountability: s.components.voiceAndAccountability,
          },
        });
      }
    } catch { /* governance data unavailable */ }
  }

  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const feature = data as GovernanceFeature;
    const props = feature?.properties ?? {};
    const name = String(props.name ?? props['ISO3166-1-Alpha-2'] ?? 'Unknown');
    const code = String(props['ISO3166-1-Alpha-2'] ?? '');

    const govData = code ? this.governanceMap.get(code) : undefined;
    const govIndex = govData?.index ?? 0;
    const baselineRisk = govData?.baselineRisk ?? 100;
    const level = getGovernanceLevel(govIndex);

    const container = ctx.el('div', 'edp-generic edp-hotspot-detail');

    const header = ctx.el('div', 'edp-header edp-header-card');
    header.append(ctx.el('h2', 'edp-title', name));

    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge('GOVERNANCE', 'edp-badge'));
    badgeRow.append(ctx.badge(GOV_LEVEL_LABEL[level] ?? level.toUpperCase(), GOV_LEVEL_CLASS[level] ?? 'edp-badge'));
    header.append(badgeRow);
    container.append(header);

    if (!govData) {
      const [noDataCard, noDataBody] = ctx.sectionCard('Governance Data');
      noDataBody.append(ctx.el('p', 'edp-description', 'No governance data available for this country. Governance scores are based on World Bank Worldwide Governance Indicators (WGI).'));
      container.append(noDataCard);
      return container;
    }

    const [scoreCard, scoreBody] = ctx.sectionCard('Governance Index');
    scoreCard.classList.add('edp-hotspot-score-card');

    const scoreTop = ctx.el('div', 'edp-hotspot-score-top');
    const scoreTile = ctx.el('div', `edp-hotspot-score-tile edp-hotspot-score-${level === 'excellent' || level === 'good' ? 'low' : level === 'moderate' ? 'elevated' : 'critical'}`);
    scoreTile.append(ctx.el('div', 'edp-hotspot-score-value', `${govIndex.toFixed(1)}/100`));
    scoreTile.append(ctx.el('div', 'edp-hotspot-score-label', GOV_LEVEL_LABEL[level] ?? level));
    scoreTop.append(scoreTile);

    const scoreMeta = ctx.el('div', 'edp-hotspot-score-meta');
    const riskStat = ctx.el('div', 'edp-hotspot-inline-stat');
    riskStat.append(ctx.el('span', 'edp-hotspot-inline-label', 'Risk Score'));
    riskStat.append(ctx.el('strong', 'edp-hotspot-inline-value', `${baselineRisk}/100`));
    scoreMeta.append(riskStat);
    scoreTop.append(scoreMeta);
    scoreBody.append(scoreTop);
    container.append(scoreCard);

    const [compCard, compBody] = ctx.sectionCard('Component Breakdown');
    const entries = Object.entries(govData.components);
    for (const [key, rawValue] of entries) {
      const value = rawValue != null ? Math.round(rawValue) : null;
      const label = COMPONENT_LABELS[key] ?? key;
      const weight = GOV_WEIGHTS[key] ?? 0;
      const displayValue = value ?? '\u2014';
      const pct = value != null ? Math.max(0, Math.min(100, value)) : 0;

      const item = ctx.el('div', 'edp-hotspot-component');
      item.append(ctx.el('span', 'edp-hotspot-component-label', label));

      const meter = ctx.el('div', 'edp-hotspot-component-meter');
      const tone = (value ?? 0) >= 70 ? 'news' : (value ?? 0) >= 40 ? 'cii' : 'military';
      const fill = ctx.el('div', `edp-hotspot-component-fill edp-hotspot-component-fill-${tone}`);
      fill.style.width = `${pct}%`;
      meter.append(fill);
      item.append(meter);

      item.append(ctx.el('strong', 'edp-hotspot-component-value', String(displayValue)));
      const weightStr = `${Math.round(weight * 100)}%`;
      item.append(ctx.el('span', 'edp-badge edp-badge-dim', weightStr));
      compBody.append(item);
    }
    container.append(compCard);

    const [aboutCard, aboutBody] = ctx.sectionCard('About');
    aboutBody.append(ctx.el('p', 'edp-description', 'The Worldwide Governance Indicators (WGI) project reports composite governance scores for 200+ countries, aggregating over 30 data sources. Higher values indicate better governance quality and lower instability risk.'));
    container.append(aboutCard);

    return container;
  }

  async enrich(data: unknown, signal: AbortSignal): Promise<unknown> {
    await this.loadGovernance(signal);
    return data;
  }
}