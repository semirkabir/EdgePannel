import type {
  GetShippingRatesResponse,
  GetChokepointStatusResponse,
  GetCriticalMineralsResponse,
  ShippingIndex,
  ChokepointInfo,
  CriticalMineral,
} from '../../generated/client/worldmonitor/supply_chain/v1/service_client';

export type SupplyChainIntelSeverity = 'critical' | 'high' | 'watch' | 'normal';

export interface SupplyChainInsight {
  id: string;
  title: string;
  detail: string;
  severity: SupplyChainIntelSeverity;
  metricLabel: string;
  metricValue: string;
  source: string;
}

export interface SupplyChainSummaryStats {
  redChokepoints: number;
  yellowChokepoints: number;
  maxDisruptionScore: number;
  worstChokepointName: string | null;
  shippingSpikeCount: number;
  maxFreightChangePct: number | null;
  criticalMinerals: number;
  highRiskMinerals: number;
  upstreamUnavailable: boolean;
}

export interface SupplyChainSummary {
  score: number;
  severity: SupplyChainIntelSeverity;
  headline: string;
  stats: SupplyChainSummaryStats;
  insights: SupplyChainInsight[];
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function severityFromScore(score: number): SupplyChainIntelSeverity {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 20) return 'watch';
  return 'normal';
}

function formatSignedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function buildHeadline(severity: SupplyChainIntelSeverity, stats: SupplyChainSummaryStats): string {
  if (stats.upstreamUnavailable && stats.maxDisruptionScore === 0 && stats.shippingSpikeCount === 0 && stats.criticalMinerals === 0) {
    return 'Supply-chain upstreams temporarily unavailable';
  }
  if (severity === 'critical') return 'Critical supply-chain stress across monitored lanes';
  if (severity === 'high') return 'Supply-chain pressure is elevated';
  if (severity === 'watch') return 'Supply-chain signals warrant monitoring';
  return 'No major supply-chain stress in available data';
}

function shippingSeverity(index: ShippingIndex): SupplyChainIntelSeverity {
  const absChange = Math.abs(index.changePct);
  if (index.spikeAlert || absChange >= 30) return 'high';
  if (absChange >= 10) return 'watch';
  return 'normal';
}

function mineralSeverity(mineral: CriticalMineral): SupplyChainIntelSeverity {
  if (mineral.riskRating === 'critical') return 'critical';
  if (mineral.riskRating === 'high') return 'high';
  if (mineral.riskRating === 'moderate') return 'watch';
  return 'normal';
}

export function createSupplyChainSummary(input: {
  shipping?: GetShippingRatesResponse | null;
  chokepoints?: GetChokepointStatusResponse | null;
  minerals?: GetCriticalMineralsResponse | null;
}): SupplyChainSummary {
  const indices = input.shipping?.indices ?? [];
  const chokepoints = input.chokepoints?.chokepoints ?? [];
  const minerals = input.minerals?.minerals ?? [];

  const worstChokepoint = [...chokepoints].sort((a, b) => b.disruptionScore - a.disruptionScore)[0] ?? null;
  const redChokepoints = chokepoints.filter((cp) => cp.status === 'red').length;
  const yellowChokepoints = chokepoints.filter((cp) => cp.status === 'yellow').length;
  const shippingSpikeCount = indices.filter((index) => index.spikeAlert).length;
  const maxFreightIndex = [...indices].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0] ?? null;
  const criticalMinerals = minerals.filter((mineral) => mineral.riskRating === 'critical').length;
  const highRiskMinerals = minerals.filter((mineral) => mineral.riskRating === 'high').length;
  const upstreamUnavailable = Boolean(
    input.shipping?.upstreamUnavailable
    || input.chokepoints?.upstreamUnavailable
    || input.minerals?.upstreamUnavailable,
  );

  let score = 0;
  score += (worstChokepoint?.disruptionScore ?? 0) * 0.55;
  score += Math.min(15, Math.max(0, redChokepoints - 1) * 5 + yellowChokepoints * 2);
  if (maxFreightIndex) {
    score += Math.min(18, Math.abs(maxFreightIndex.changePct) * 0.6);
    if (maxFreightIndex.spikeAlert) score += 8;
  }
  score += Math.min(20, criticalMinerals * 4 + highRiskMinerals * 2);
  if (upstreamUnavailable && chokepoints.length + indices.length + minerals.length > 0) score += 5;

  const boundedScore = clampScore(score);
  const severity = severityFromScore(boundedScore);
  const stats: SupplyChainSummaryStats = {
    redChokepoints,
    yellowChokepoints,
    maxDisruptionScore: worstChokepoint?.disruptionScore ?? 0,
    worstChokepointName: worstChokepoint?.name ?? null,
    shippingSpikeCount,
    maxFreightChangePct: maxFreightIndex?.changePct ?? null,
    criticalMinerals,
    highRiskMinerals,
    upstreamUnavailable,
  };

  const insights: SupplyChainInsight[] = [];

  if (worstChokepoint) {
    const cpSeverity: SupplyChainIntelSeverity = worstChokepoint.disruptionScore >= 75
      ? 'critical'
      : worstChokepoint.disruptionScore >= 50
        ? 'high'
        : worstChokepoint.disruptionScore >= 20
          ? 'watch'
          : 'normal';
    insights.push({
      id: `chokepoint-${worstChokepoint.id}`,
      title: `${worstChokepoint.name} chokepoint risk`,
      detail: worstChokepoint.description || 'No active disruption description available.',
      severity: cpSeverity,
      metricLabel: 'Disruption',
      metricValue: `${worstChokepoint.disruptionScore}/100`,
      source: 'Maritime',
    });
  }

  if (maxFreightIndex) {
    insights.push({
      id: `shipping-${maxFreightIndex.indexId}`,
      title: maxFreightIndex.name,
      detail: maxFreightIndex.spikeAlert
        ? 'Freight index is outside its recent baseline.'
        : 'Largest current move among monitored freight indices.',
      severity: shippingSeverity(maxFreightIndex),
      metricLabel: 'Change',
      metricValue: formatSignedPct(maxFreightIndex.changePct),
      source: 'FRED',
    });
  }

  const topMineral = [...minerals].sort((a, b) => b.hhi - a.hhi)[0] ?? null;
  if (topMineral) {
    const leader = topMineral.topProducers[0];
    insights.push({
      id: `mineral-${topMineral.mineral.toLowerCase().replace(/\s+/g, '-')}`,
      title: `${topMineral.mineral} concentration`,
      detail: leader
        ? `${leader.country} leads known production at ${leader.sharePct.toFixed(0)}%.`
        : 'Producer concentration is elevated.',
      severity: mineralSeverity(topMineral),
      metricLabel: 'HHI',
      metricValue: topMineral.hhi.toFixed(0),
      source: 'USGS',
    });
  }

  if (upstreamUnavailable) {
    insights.push({
      id: 'supply-chain-upstream-unavailable',
      title: 'Partial supply-chain coverage',
      detail: 'One or more upstreams returned unavailable; cached, static, or partial data remains visible where present.',
      severity: insights.length > 0 ? 'watch' : 'normal',
      metricLabel: 'Status',
      metricValue: 'Partial',
      source: 'EdgePannel',
    });
  }

  return {
    score: boundedScore,
    severity,
    headline: buildHeadline(severity, stats),
    stats,
    insights: insights.slice(0, 4),
  };
}

export function getWorstChokepoint(chokepoints: ChokepointInfo[]): ChokepointInfo | null {
  return [...chokepoints].sort((a, b) => b.disruptionScore - a.disruptionScore)[0] ?? null;
}
