import type {
  GetTradeRestrictionsResponse,
  GetTariffTrendsResponse,
  GetTradeFlowsResponse,
  GetTradeBarriersResponse,
  TradeRestriction,
  TradeBarrier,
  TradeFlowRecord,
  TariffDataPoint,
} from '../../generated/client/worldmonitor/trade/v1/service_client';

export type TradeIntelSeverity = 'critical' | 'high' | 'watch' | 'normal';

export interface TradePolicyInsight {
  id: string;
  title: string;
  detail: string;
  severity: TradeIntelSeverity;
  metricLabel: string;
  metricValue: string;
  source: string;
}

export interface TradePolicySummaryStats {
  activeRestrictions: number;
  highRestrictions: number;
  barrierCount: number;
  highBarriers: number;
  latestTariffRate: number | null;
  tariffDelta: number | null;
  latestFlowYear: number | null;
  tradeBalanceUsd: number | null;
  exportYoyChange: number | null;
  importYoyChange: number | null;
  upstreamUnavailable: boolean;
}

export interface TradePolicySummary {
  score: number;
  severity: TradeIntelSeverity;
  headline: string;
  stats: TradePolicySummaryStats;
  insights: TradePolicyInsight[];
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function severityFromScore(score: number): TradeIntelSeverity {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 20) return 'watch';
  return 'normal';
}

function sortByYearDesc<T extends { year: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.year - a.year);
}

function formatUsdMillions(value: number): string {
  const abs = Math.abs(value);
  const prefix = value < 0 ? '-' : '';
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}B`;
  return `${prefix}$${abs.toFixed(0)}M`;
}

function extractRestrictionRate(restriction: TradeRestriction): number {
  return Number.parseFloat(restriction.description.match(/[\d.]+/)?.[0] ?? '0') || 0;
}

function highBarrierCount(barriers: TradeBarrier[]): number {
  return barriers.filter((barrier) => {
    const status = barrier.status.toLowerCase();
    return status === 'high' || barrier.measureType.toLowerCase().includes('high');
  }).length;
}

function buildHeadline(severity: TradeIntelSeverity, stats: TradePolicySummaryStats): string {
  if (stats.upstreamUnavailable && stats.activeRestrictions + stats.barrierCount === 0) {
    return 'Trade policy data temporarily unavailable';
  }
  if (severity === 'critical') return 'High trade policy pressure across monitored economies';
  if (severity === 'high') return 'Trade policy pressure is elevated';
  if (severity === 'watch') return 'Trade policy signals warrant monitoring';
  return 'No major trade policy stress in available data';
}

export function createTradePolicySummary(input: {
  restrictions?: GetTradeRestrictionsResponse | null;
  tariffs?: GetTariffTrendsResponse | null;
  flows?: GetTradeFlowsResponse | null;
  barriers?: GetTradeBarriersResponse | null;
}): TradePolicySummary {
  const restrictions = input.restrictions?.restrictions ?? [];
  const tariffs = input.tariffs?.datapoints ?? [];
  const flows = input.flows?.flows ?? [];
  const barriers = input.barriers?.barriers ?? [];

  const latestTariffs = sortByYearDesc(tariffs);
  const latestTariff = latestTariffs[0] ?? null;
  const previousTariff = latestTariffs.find((point) => point.year < (latestTariff?.year ?? 0)) ?? null;
  const latestFlows = sortByYearDesc(flows);
  const latestFlow = latestFlows[0] ?? null;

  const highRestrictions = restrictions.filter((restriction) => restriction.status === 'high').length;
  const highBarriers = highBarrierCount(barriers);
  const tariffDelta = latestTariff && previousTariff
    ? latestTariff.tariffRate - previousTariff.tariffRate
    : null;
  const tradeBalanceUsd = latestFlow
    ? latestFlow.exportValueUsd - latestFlow.importValueUsd
    : null;
  const upstreamUnavailable = Boolean(
    input.restrictions?.upstreamUnavailable
    || input.tariffs?.upstreamUnavailable
    || input.flows?.upstreamUnavailable
    || input.barriers?.upstreamUnavailable,
  );

  let score = 0;
  score += Math.min(35, highRestrictions * 7);
  score += Math.min(25, highBarriers * 5);
  if (latestTariff) {
    if (latestTariff.tariffRate >= 10) score += 18;
    else if (latestTariff.tariffRate >= 5) score += 10;
  }
  if (tariffDelta !== null && tariffDelta >= 1) score += 8;
  if (latestFlow) {
    if (latestFlow.yoyExportChange <= -10) score += 14;
    else if (latestFlow.yoyExportChange <= -5) score += 7;
    if (latestFlow.yoyImportChange <= -10) score += 10;
    else if (latestFlow.yoyImportChange <= -5) score += 5;
  }
  if (upstreamUnavailable && restrictions.length + tariffs.length + flows.length + barriers.length > 0) score += 5;

  const boundedScore = clampScore(score);
  const severity = severityFromScore(boundedScore);

  const stats: TradePolicySummaryStats = {
    activeRestrictions: restrictions.length,
    highRestrictions,
    barrierCount: barriers.length,
    highBarriers,
    latestTariffRate: latestTariff?.tariffRate ?? null,
    tariffDelta,
    latestFlowYear: latestFlow?.year ?? null,
    tradeBalanceUsd,
    exportYoyChange: latestFlow?.yoyExportChange ?? null,
    importYoyChange: latestFlow?.yoyImportChange ?? null,
    upstreamUnavailable,
  };

  const insights: TradePolicyInsight[] = [];

  const topRestriction = [...restrictions].sort((a, b) => extractRestrictionRate(b) - extractRestrictionRate(a))[0];
  if (topRestriction) {
    insights.push({
      id: `restriction-${topRestriction.id}`,
      title: `${topRestriction.reportingCountry} tariff pressure`,
      detail: `${topRestriction.productSector}: ${topRestriction.description}`,
      severity: topRestriction.status === 'high' ? 'high' : topRestriction.status === 'moderate' ? 'watch' : 'normal',
      metricLabel: topRestriction.measureType,
      metricValue: `${extractRestrictionRate(topRestriction).toFixed(1)}%`,
      source: 'WTO',
    });
  }

  if (latestTariff) {
    insights.push({
      id: `tariff-${latestTariff.reportingCountry}-${latestTariff.year}`,
      title: `${latestTariff.reportingCountry} tariff trend`,
      detail: tariffDelta !== null
        ? `${latestTariff.productSector || 'All products'} moved ${tariffDelta >= 0 ? '+' : ''}${tariffDelta.toFixed(1)}pp from the previous observation.`
        : `${latestTariff.productSector || 'All products'} latest applied rate.`,
      severity: latestTariff.tariffRate >= 10 ? 'high' : latestTariff.tariffRate >= 5 ? 'watch' : 'normal',
      metricLabel: String(latestTariff.year),
      metricValue: `${latestTariff.tariffRate.toFixed(1)}%`,
      source: latestTariff.indicatorCode || 'WTO',
    });
  }

  if (latestFlow) {
    const flowSeverity: TradeIntelSeverity = latestFlow.yoyExportChange <= -10 || latestFlow.yoyImportChange <= -10
      ? 'high'
      : latestFlow.yoyExportChange <= -5 || latestFlow.yoyImportChange <= -5
        ? 'watch'
        : 'normal';
    insights.push({
      id: `flow-${latestFlow.reportingCountry}-${latestFlow.partnerCountry}-${latestFlow.year}`,
      title: `${latestFlow.reportingCountry} - ${latestFlow.partnerCountry} flows`,
      detail: `Exports ${latestFlow.yoyExportChange >= 0 ? '+' : ''}${latestFlow.yoyExportChange.toFixed(1)}%, imports ${latestFlow.yoyImportChange >= 0 ? '+' : ''}${latestFlow.yoyImportChange.toFixed(1)}% year over year.`,
      severity: flowSeverity,
      metricLabel: 'Balance',
      metricValue: formatUsdMillions(latestFlow.exportValueUsd - latestFlow.importValueUsd),
      source: 'WTO',
    });
  }

  const topBarrier = barriers.find((barrier) => barrier.status === 'high') ?? barriers[0];
  if (topBarrier) {
    insights.push({
      id: `barrier-${topBarrier.id}`,
      title: `${topBarrier.notifyingCountry} sector barrier`,
      detail: topBarrier.title,
      severity: topBarrier.status === 'high' ? 'high' : topBarrier.status === 'moderate' ? 'watch' : 'normal',
      metricLabel: topBarrier.measureType,
      metricValue: topBarrier.dateDistributed || 'latest',
      source: 'WTO',
    });
  }

  if (upstreamUnavailable) {
    insights.push({
      id: 'trade-upstream-unavailable',
      title: 'Partial trade data coverage',
      detail: 'One or more trade upstreams returned unavailable; existing cached or partial data remains visible.',
      severity: insights.length > 0 ? 'watch' : 'normal',
      metricLabel: 'Status',
      metricValue: 'Partial',
      source: 'World Monitor',
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

export function getLatestTradeFlow(flows: TradeFlowRecord[]): TradeFlowRecord | null {
  return sortByYearDesc(flows)[0] ?? null;
}

export function getLatestTariffPoint(points: TariffDataPoint[]): TariffDataPoint | null {
  return sortByYearDesc(points)[0] ?? null;
}
