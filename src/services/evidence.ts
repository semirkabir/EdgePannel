import type { EvidenceVerificationState, NewsItem, SignalEvidence, SignalEvidenceSource } from '@/types';

const OFFICIAL_SOURCE_RE = /\b(gov|government|ministry|department|state dept|federal reserve|central bank|nato|un|who|cdc|noaa|usgs|nasa|acled|gdacs)\b/i;
const CONFLICTING_RE = /\b(denies|disputes|unconfirmed|false report|contradicts|conflicting reports|no evidence)\b/i;

function asDate(value: Date | string | number | undefined): Date {
  const parsed = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function normalizeTier(tier: number | undefined): number {
  if (!Number.isFinite(tier)) return 3;
  return Math.max(1, Math.min(5, Math.round(tier ?? 3)));
}

export function resolveVerificationState(input: {
  sourceTier: number;
  corroborationCount: number;
  hasOfficialSource?: boolean;
  hasConflictSignal?: boolean;
  analystReviewed?: boolean;
}): EvidenceVerificationState {
  if (input.hasConflictSignal) return 'conflicting';
  if (input.analystReviewed) return 'analyst-reviewed';
  if (input.hasOfficialSource) return 'official';
  if (input.corroborationCount >= 2 && input.sourceTier <= 2) return 'corroborated';
  return 'unverified';
}

export function scoreSignalEvidence(input: {
  sourceTier: number;
  corroborationCount: number;
  verificationState: EvidenceVerificationState;
}): number {
  const tierBoost = input.sourceTier <= 1 ? 0.28 : input.sourceTier === 2 ? 0.2 : input.sourceTier === 3 ? 0.12 : 0.04;
  const corroborationBoost = Math.min(0.3, Math.max(0, input.corroborationCount - 1) * 0.1);
  const stateBoost: Record<EvidenceVerificationState, number> = {
    'analyst-reviewed': 0.3,
    official: 0.26,
    corroborated: 0.2,
    unverified: 0,
    conflicting: -0.18,
  };
  return clampConfidence(0.35 + tierBoost + corroborationBoost + stateBoost[input.verificationState]);
}

export function buildSignalEvidenceFromNews(items: NewsItem[], options: { analystReviewed?: boolean } = {}): SignalEvidence {
  const sources: SignalEvidenceSource[] = items.slice(0, 12).map(item => ({
    title: item.title,
    url: item.link,
    source: item.source,
    tier: normalizeTier(item.tier),
    publishedAt: asDate(item.pubDate),
  }));
  const dates = sources.map(source => asDate(source.publishedAt));
  const sourceTier = sources.reduce((best, source) => Math.min(best, normalizeTier(source.tier)), 5);
  const uniqueSources = new Set(sources.map(source => source.source.toLowerCase().trim()).filter(Boolean));
  const combinedText = sources.map(source => `${source.source} ${source.title}`).join(' ');
  const verificationState = resolveVerificationState({
    sourceTier,
    corroborationCount: uniqueSources.size,
    hasOfficialSource: OFFICIAL_SOURCE_RE.test(combinedText),
    hasConflictSignal: CONFLICTING_RE.test(combinedText),
    analystReviewed: options.analystReviewed,
  });

  return {
    sourceUrls: [...new Set(sources.map(source => source.url).filter((url): url is string => Boolean(url)))],
    sourceTier,
    confidence: scoreSignalEvidence({ sourceTier, corroborationCount: uniqueSources.size, verificationState }),
    corroborationCount: uniqueSources.size,
    firstSeen: dates.reduce((earliest, date) => date < earliest ? date : earliest, dates[0] ?? new Date()),
    lastSeen: dates.reduce((latest, date) => date > latest ? date : latest, dates[0] ?? new Date()),
    verificationState,
    sources,
  };
}
