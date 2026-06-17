import type { AppContext, CountryBriefSignals } from '@/app/app-context';
import type { CountryScore } from '@/services/country-instability';
import { getCurrentLanguage } from '@/services/i18n';
import { mlWorker } from '@/services/ml-worker';
import { isHeadlineMemoryEnabled } from '@/services/ai-flow-settings';
import { t } from '@/services/i18n';
import { BETA_MODE } from '@/config/beta';
import { supplementalBus } from '@/services/supplemental-signal-bus';
import { getCachedReliefWebUpdates } from '@/services/displacement';
import { getCachedWhoGhoIndicators } from '@/services/health/who-gho';
import { getCountryNameByCode } from '@/services/country-geometry';

export function buildBriefContextSnapshot(
  country: string,
  code: string,
  score: CountryScore | null,
  signals: CountryBriefSignals,
  context: Record<string, unknown>,
): string {
  const lines: string[] = [];
  lines.push(`Country: ${country} (${code})`);

  if (score) {
    lines.push(`CII: ${score.score}/100 (${score.level}), trend=${score.trend}, 24h_change=${score.change24h}`);
    lines.push(`CII components: unrest=${Math.round(score.components.unrest)}, conflict=${Math.round(score.components.conflict)}, security=${Math.round(score.components.security)}, information=${Math.round(score.components.information)}`);
  }

  lines.push(
    `Signals: critical_news=${signals.criticalNews}, protests=${signals.protests}, active_strikes=${signals.activeStrikes}, military_flights=${signals.militaryFlights}, military_vessels=${signals.militaryVessels}, outages=${signals.outages}, aviation_disruptions=${signals.aviationDisruptions}, travel_advisories=${signals.travelAdvisories}, oref_sirens=${signals.orefSirens}, oref_24h=${signals.orefHistory24h}, gps_jamming_hexes=${signals.gpsJammingHexes}, ais_disruptions=${signals.aisDisruptions}, satellite_fires=${signals.satelliteFires}, temporal_anomalies=${signals.temporalAnomalies}, cyber_threats=${signals.cyberThreats}, earthquakes=${signals.earthquakes}, conflict_events=${signals.conflictEvents}`,
  );

  if (signals.travelAdvisoryMaxLevel) {
    lines.push(`Travel advisory max level: ${signals.travelAdvisoryMaxLevel}`);
  }

  const stockIndex = typeof context.stockIndex === 'string' ? context.stockIndex : '';
  if (stockIndex) lines.push(`Stock index: ${stockIndex}`);

  const convergenceScore = typeof context.convergenceScore === 'number' ? context.convergenceScore : null;
  const signalTypes = Array.isArray(context.signalTypes) ? context.signalTypes as string[] : [];
  if (convergenceScore != null || signalTypes.length > 0) {
    lines.push(`Signal convergence: score=${convergenceScore ?? 0}, types=${signalTypes.slice(0, 8).join(', ')}`);
  }

  const regionalConvergence = Array.isArray(context.regionalConvergence) ? context.regionalConvergence as string[] : [];
  if (regionalConvergence.length > 0) {
    lines.push(`Regional context: ${regionalConvergence.slice(0, 3).join(' | ')}`);
  }

  const headlines = Array.isArray(context.headlines) ? context.headlines as string[] : [];
  if (headlines.length > 0) {
    lines.push(`Headlines: ${headlines.slice(0, 6).join(' | ')}`);
  }

  const supplementalCtx = supplementalBus.getAIContext(code);
  if (supplementalCtx) {
    lines.push(`Supplemental: ${supplementalCtx}`);
  }

  const countryName = getCountryNameByCode(code)?.toLowerCase();
  if (countryName) {
    const reliefHeadlines = getCachedReliefWebUpdates()
      .filter((update) => update.country.toLowerCase().includes(countryName) || update.title.toLowerCase().includes(countryName))
      .slice(0, 3)
      .map((update) => update.title);
    if (reliefHeadlines.length > 0) {
      lines.push(`ReliefWeb: ${reliefHeadlines.join(' | ')}`);
    }

    const whoRows = getCachedWhoGhoIndicators()
      .filter((row) => row.countryName.toLowerCase().includes(countryName))
      .slice(0, 2)
      .map((row) => `${row.indicatorName}: ${row.value.toLocaleString()} ${row.unit} (${row.year})`);
    if (whoRows.length > 0) {
      lines.push(`WHO GHO: ${whoRows.join(' | ')}`);
    }
  }

  return lines.join('\n');
}

export async function fetchCountryBrief(ctx: AppContext, code: string, contextSnapshot: string): Promise<string> {
  const lang = getCurrentLanguage();
  const params = new URLSearchParams({ country_code: code, lang });
  const trimmed = contextSnapshot.trim();
  if (trimmed.length > 0) {
    params.set('context', trimmed.slice(0, 2200));
  }

  const resp = await fetch(`/api/intelligence/v1/get-country-intel-brief?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: ctx.countryBriefPage?.signal,
  });
  if (!resp.ok) return '';

  const body = (await resp.json()) as { brief?: string };
  return typeof body.brief === 'string' ? body.brief.trim() : '';
}

export async function generateFallbackBrief(
  _ctx: AppContext,
  country: string,
  _code: string,
  _score: CountryScore | null,
  _signals: CountryBriefSignals,
  briefHeadlines: string[],
): Promise<string | null> {
  const sumModelId = BETA_MODE ? 'summarization-beta' : 'summarization';
  if (briefHeadlines.length >= 2 && mlWorker.isAvailable && mlWorker.isModelLoaded(sumModelId)) {
    try {
      const lang = getCurrentLanguage();
      const prompt = lang === 'fr'
        ? `Résumez la situation actuelle en ${country} à partir de ces titres : ${briefHeadlines.slice(0, 8).join('. ')}`
        : `Summarize the current situation in ${country} based on these headlines: ${briefHeadlines.slice(0, 8).join('. ')}`;

      const [summary] = await mlWorker.summarize([prompt], BETA_MODE ? 'summarization-beta' : undefined);
      if (summary && summary.length > 20) return summary;
    } catch { /* T5 failed */ }
  }

  return null;
}

export function buildFallbackText(
  _country: string,
  _code: string,
  score: CountryScore | null,
  signals: CountryBriefSignals,
  briefHeadlines: string[],
  context: Record<string, unknown>,
): string {
  const lines: string[] = [];
  if (score) lines.push(t('countryBrief.fallback.instabilityIndex', { score: String(score.score), level: t(`countryBrief.levels.${score.level}`), trend: t(`countryBrief.trends.${score.trend}`) }));
  if (signals.protests > 0) lines.push(t('countryBrief.fallback.protestsDetected', { count: String(signals.protests) }));
  if (signals.militaryFlights > 0) lines.push(t('countryBrief.fallback.aircraftTracked', { count: String(signals.militaryFlights) }));
  if (signals.militaryVessels > 0) lines.push(t('countryBrief.fallback.vesselsTracked', { count: String(signals.militaryVessels) }));
  if (signals.activeStrikes > 0) lines.push(t('countryBrief.fallback.activeStrikes', { count: String(signals.activeStrikes) }));
  if (signals.travelAdvisoryMaxLevel === 'do-not-travel') lines.push(`⚠️ Travel advisory: Do Not Travel (${signals.travelAdvisories} source${signals.travelAdvisories > 1 ? 's' : ''})`);
  else if (signals.travelAdvisoryMaxLevel === 'reconsider') lines.push(`⚠️ Travel advisory: Reconsider Travel (${signals.travelAdvisories} source${signals.travelAdvisories > 1 ? 's' : ''})`);
  if (signals.outages > 0) lines.push(t('countryBrief.fallback.internetOutages', { count: String(signals.outages) }));
  if (signals.criticalNews > 0) lines.push(`🚨 Critical headlines in scope: ${signals.criticalNews}`);
  if (signals.cyberThreats > 0) lines.push(`🛡️ Cyber threat indicators: ${signals.cyberThreats}`);
  if (signals.aisDisruptions > 0) lines.push(`🚢 Maritime AIS disruptions: ${signals.aisDisruptions}`);
  if (signals.satelliteFires > 0) lines.push(`🔥 Satellite fire detections: ${signals.satelliteFires}`);
  if (signals.temporalAnomalies > 0) lines.push(`⏱️ Temporal anomaly alerts: ${signals.temporalAnomalies}`);
  if (signals.earthquakes > 0) lines.push(t('countryBrief.fallback.recentEarthquakes', { count: String(signals.earthquakes) }));
  if (signals.orefHistory24h > 0) lines.push(`🚨 Sirens in past 24h: ${signals.orefHistory24h}`);
  if (context.stockIndex) lines.push(t('countryBrief.fallback.stockIndex', { value: context.stockIndex }));
  if (briefHeadlines.length > 0) {
    lines.push('', t('countryBrief.fallback.recentHeadlines'));
    briefHeadlines.slice(0, 5).forEach(h => lines.push(`• ${h}`));
  }
  return lines.join('\n');
}

export async function fetchWithRAGEnhancement(
  code: string,
  country: string,
  score: CountryScore | null,
  signals: CountryBriefSignals,
  briefHeadlines: string[],
  context: Record<string, unknown>,
): Promise<string> {
  let contextSnapshot = buildBriefContextSnapshot(country, code, score, signals, context);

  if (isHeadlineMemoryEnabled() && mlWorker.isAvailable && mlWorker.isModelLoaded('embeddings') && briefHeadlines.length > 0) {
    try {
      const results = await mlWorker.vectorStoreSearch(briefHeadlines.slice(0, 3), 5, 0.3);
      if (results.length > 0) {
        const historical = results.map(r =>
          `- ${r.text} (${new Date(r.pubDate).toISOString().slice(0, 10)})`
        ).join('\n').slice(0, 350);
        contextSnapshot = contextSnapshot.slice(0, 1800)
          + `\n[BEGIN HISTORICAL DATA]\n${historical}\n[END HISTORICAL DATA]`;
      }
    } catch { /* RAG unavailable */ }
  }

  return contextSnapshot;
}
