import type { AppContext } from '@/app/app-context';
import type { CountryScore } from '@/services/country-instability';
import type { TimelineEvent } from '@/components/CountryTimeline';
import { CountryTimeline } from '@/components/CountryTimeline';
import type {
  CardAvailability,
  CountryDeepDiveEconomicIndicator,
  CountryDeepDiveMilitarySummary,
} from '@/components/CountryBriefPanel';
import { fetchCountryMacroData } from '@/services/economic';
import { fetchCountryMarkets } from '@/services/prediction';
import { fetchCountryGovernance } from '@/services/data360';
import { getCountryCentroid, hasCountryGeometry, isCoordinateInCountry, nameToCountryCode, iso3ToIso2Code } from '@/services/country-geometry';
import { getCountryData } from '@/services/country-instability';
import { getPreferredCountryScore } from '@/services/cached-risk-scores';
import { hasIntelligenceSignalsLoaded, TIER1_COUNTRIES } from '@/services/country-instability';
import { MILITARY_BASES } from '@/config';
import { getCountryInfrastructure, getNearbyInfrastructure } from '@/services/related-assets';
import { t } from '@/services/i18n';
import { COUNTRY_BOUNDS } from './country-utils';
import { getCountryProfile, getCountryIndices } from '@/services/country-profiles';

type CountryStockSnapshot = {
  available: boolean;
  code: string;
  symbol: string;
  indexName: string;
  price: string;
  weekChangePercent: string;
  currency: string;
};

function isInCountry(lat: number, lon: number, code: string): boolean {
  const precise = isCoordinateInCountry(lat, lon, code);
  if (precise === true) return true;
  const b = COUNTRY_BOUNDS[code];
  if (!b) return false;
  return lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;
}

function sameCountry(code: string, country: string, raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim();
  if (!normalized) return false;

  const upper = normalized.toUpperCase();
  if (upper === code) return true;
  if (upper.length === 3) {
    const iso2 = iso3ToIso2Code(upper);
    if (iso2 === code) return true;
  }

  const fromName = nameToCountryCode(normalized.toLowerCase());
  if (fromName === code) return true;

  const countryLower = country.toLowerCase();
  const rawLower = normalized.toLowerCase();
  return rawLower === countryLower || rawLower.includes(countryLower);
}

export function buildMilitarySummary(ctx: AppContext, code: string, country: string): CountryDeepDiveMilitarySummary {
  const hasGeoShape = hasCountryGeometry(code) || !!COUNTRY_BOUNDS[code];
  const flights = ctx.intelligenceCache.military?.flights ?? [];
  const vessels = ctx.intelligenceCache.military?.vessels ?? [];

  const flightsInCountry = flights.filter((flight) =>
    hasGeoShape ? isInCountry(flight.lat, flight.lon, code) : sameCountry(code, country, flight.operatorCountry)
  );
  const ownFlights = flightsInCountry.filter((flight) => sameCountry(code, country, flight.operatorCountry)).length;
  const foreignFlights = Math.max(0, flightsInCountry.length - ownFlights);

  const vesselsInCountry = vessels.filter((vessel) =>
    hasGeoShape ? isInCountry(vessel.lat, vessel.lon, code) : sameCountry(code, country, vessel.operatorCountry)
  );
  const foreignVessels = vesselsInCountry.filter((vessel) => !sameCountry(code, country, vessel.operatorCountry)).length;

  const centroid = getCountryCentroid(code, COUNTRY_BOUNDS);
  const localBases = getCountryInfrastructure(code, ['base']);
  const hostedForeignBases = MILITARY_BASES.filter((base) =>
    !!base.country && nameToCountryCode(base.country.toLowerCase()) === code
  );
  const nearbyBases = (localBases.length > 0
    ? localBases
    : (centroid ? getNearbyInfrastructure(centroid.lat, centroid.lon, ['base']) : [])
  ).slice(0, 3).map((base) => ({
    id: base.id,
    name: base.name,
    distanceKm: base.distanceKm,
    country: MILITARY_BASES.find((entry) => entry.id === base.id)?.country,
  }));

  return {
    ownFlights,
    foreignFlights,
    nearbyVessels: vesselsInCountry.length,
    nearestBases: nearbyBases,
    foreignPresence: foreignFlights > 0 || foreignVessels > 0 || hostedForeignBases.length > 0,
  };
}

export function buildCiiAvailability(code: string, score: CountryScore | null): CardAvailability {
  if (score !== null) return { available: true, source: 'CII', updatedAt: score.lastUpdated ? new Date(score.lastUpdated) : new Date() };

  if (!hasIntelligenceSignalsLoaded()) {
    return { available: false, reason: 'Intelligence feeds still loading…', source: 'CII' };
  }

  const ciiData = getCountryData(code);
  const hasDirectSignals = ciiData != null && (
    (ciiData.conflicts?.length ?? 0) > 0 ||
    (ciiData.displacementOutflow ?? 0) > 0 ||
    (ciiData.climateStress ?? 0) > 0
  );
  const hasTier1Baseline = !!TIER1_COUNTRIES[code];

  if (!hasDirectSignals && !hasTier1Baseline) {
    return {
      available: false,
      reason: 'No direct signal coverage for this country. Curated baseline unavailable.',
      source: 'CII',
    };
  }

  return { available: false, reason: t('countryBrief.ciiUnavailable'), source: 'CII' };
}

export function buildEconomicIndicators(
  code: string,
  score: CountryScore | null,
  stock: CountryStockSnapshot | null,
): CountryDeepDiveEconomicIndicator[] {
  const indicators: CountryDeepDiveEconomicIndicator[] = [];

  if (stock?.available) {
    const weekly = Number.parseFloat(stock.weekChangePercent);
    const weeklyTrend = Number.isFinite(weekly)
      ? weekly > 0 ? 'up' : weekly < 0 ? 'down' : 'flat'
      : 'flat';
    indicators.push({
      label: 'Stock Index',
      value: `${stock.indexName}: ${stock.price} ${stock.currency}`,
      trend: weeklyTrend,
      source: 'Market Service',
    });
    indicators.push({
      label: 'Weekly Momentum',
      value: `${weekly >= 0 ? '+' : ''}${stock.weekChangePercent}%`,
      trend: weeklyTrend,
    });
  }

  if (score) {
    const trend = score.trend === 'rising'
      ? 'up'
      : score.trend === 'falling'
        ? 'down'
        : 'flat';
    indicators.push({
      label: 'Instability Regime',
      value: `${score.score}/100 (${score.level})`,
      trend,
      source: 'CII',
    });
  }

  const countryData = getCountryData(code);
  if (countryData?.displacementOutflow && countryData.displacementOutflow > 0) {
    const displaced = countryData.displacementOutflow >= 1_000_000
      ? `${(countryData.displacementOutflow / 1_000_000).toFixed(1)}M`
      : `${Math.round(countryData.displacementOutflow / 1000)}K`;
    indicators.push({
      label: 'Displacement Outflow',
      value: displaced,
      trend: 'up',
      source: 'UN-style displacement feed',
    });
  }

  return indicators.slice(0, 3);
}

export async function fetchCountryPredictions(ctx: AppContext, code: string, country: string): Promise<void> {
  fetchCountryMarkets(country)
    .then((markets) => {
      if (ctx.countryBriefPage?.getCode() !== code) return;
      const availability: CardAvailability = markets.length > 0
        ? { available: true, source: 'Prediction Markets', updatedAt: new Date() }
        : { available: false, reason: 'No active prediction markets for this country.', source: 'Prediction Markets' };
      ctx.countryBriefPage.updateMarkets(markets, availability);
    })
    .catch(() => {
      if (ctx.countryBriefPage?.getCode() !== code) return;
      ctx.countryBriefPage.updateMarkets([], {
        available: false,
        reason: 'Prediction market source unavailable.',
        source: 'Prediction Markets',
      });
    });
}

export function mountCountryTimeline(ctx: AppContext, code: string, country: string): void {
  ctx.countryTimeline?.destroy();
  ctx.countryTimeline = null;

  const mount = ctx.countryBriefPage?.getTimelineMount();
  if (!mount) return;

  const events: TimelineEvent[] = [];
  const countryLower = country.toLowerCase();
  const hasGeoShape = hasCountryGeometry(code) || !!COUNTRY_BOUNDS[code];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  if (ctx.intelligenceCache.protests?.events) {
    for (const e of ctx.intelligenceCache.protests.events) {
      if (matchesCountry({ country: e.country, lat: e.lat, lon: e.lon }, code, countryLower, hasGeoShape)) {
        events.push({
          timestamp: new Date(e.time).getTime(),
          lane: 'protest',
          label: e.title || `${e.eventType} in ${e.city || e.country}`,
          severity: e.severity === 'high' ? 'high' : e.severity === 'medium' ? 'medium' : 'low',
        });
      }
    }
  }

  if (ctx.intelligenceCache.earthquakes) {
    for (const eq of ctx.intelligenceCache.earthquakes) {
      const lat = eq.location?.latitude ?? 0;
      const lon = eq.location?.longitude ?? 0;
      const match = hasGeoShape
        ? isInCountry(lat, lon, code)
        : (eq.place?.toLowerCase().includes(countryLower) ?? false);
      if (match) {
        events.push({
          timestamp: eq.occurredAt,
          lane: 'natural',
          label: `M${eq.magnitude.toFixed(1)} ${eq.place}`,
          severity: eq.magnitude >= 6 ? 'critical' : eq.magnitude >= 5 ? 'high' : eq.magnitude >= 4 ? 'medium' : 'low',
        });
      }
    }
  }

  if (ctx.intelligenceCache.military) {
    for (const f of ctx.intelligenceCache.military.flights) {
      if (hasGeoShape ? isInCountry(f.lat, f.lon, code) : f.operatorCountry?.toUpperCase() === code) {
        events.push({
          timestamp: new Date(f.lastSeen).getTime(),
          lane: 'military',
          label: `${f.callsign} (${f.aircraftModel || f.aircraftType})`,
          severity: f.isInteresting ? 'high' : 'low',
        });
      }
    }
    for (const v of ctx.intelligenceCache.military.vessels) {
      if (hasGeoShape ? isInCountry(v.lat, v.lon, code) : v.operatorCountry?.toUpperCase() === code) {
        events.push({
          timestamp: new Date(v.lastAisUpdate).getTime(),
          lane: 'military',
          label: `${v.name} (${v.vesselType})`,
          severity: v.isDark ? 'high' : 'low',
        });
      }
    }
  }

  const ciiData = getCountryData(code);
  if (ciiData?.conflicts) {
    for (const c of ciiData.conflicts) {
      events.push({
        timestamp: new Date(c.time).getTime(),
        lane: 'conflict',
        label: `${c.eventType}: ${c.location || c.country}`,
        severity: c.fatalities > 0 ? 'critical' : 'high',
      });
    }
  }

  for (const e of getCountryStrikes(ctx, code, hasGeoShape)) {
    const rawTs = Number(e.timestamp) || 0;
    const ts = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    events.push({
      timestamp: ts,
      lane: 'conflict',
      label: e.title || `Strike: ${e.locationName}`,
      severity: (e.severity.toLowerCase() === 'high' || e.severity.toLowerCase() === 'critical') ? 'critical' : 'high',
    });
  }

  ctx.countryTimeline = new CountryTimeline(mount);
  const recentEvents = events
    .filter((e) => Number.isFinite(e.timestamp) && e.timestamp >= sevenDaysAgo)
    .sort((a, b) => a.timestamp - b.timestamp);
  ctx.countryTimeline.render(recentEvents);
  console.debug('[CountryBrief] Timeline events rendered', {
    code,
    country,
    totalEvents: events.length,
    recentEvents: recentEvents.length,
    byLane: recentEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.lane] = (acc[event.lane] || 0) + 1;
      return acc;
    }, {}),
  });
}

export async function loadCountryEconomicData(ctx: AppContext, code: string, score: CountryScore | null, stock: CountryStockSnapshot | null): Promise<void> {
  ctx.countryBriefPage?.updateEconomicIndicators?.(buildEconomicIndicators(code, score, stock));
  fetchCountryMacroData(code).then((cards) => {
    if (ctx.countryBriefPage?.getCode() !== code) return;
    ctx.countryBriefPage.updateMacroCards?.(cards);
  });
  // Enrich with static profile data
  loadCountryEnrichment(ctx, code);
}

/**
 * Loads enriched static country profile data (population, area, languages,
 * currency, timezone, HDI, CPI, democracy index, etc.) and updates the
 * country detail panel.
 */
export async function loadCountryEnrichment(ctx: AppContext, code: string): Promise<void> {
  const [profile, indices] = await Promise.all([
    getCountryProfile(code),
    getCountryIndices(code),
  ]);
  if (ctx.countryBriefPage?.getCode() !== code) return;
  if (profile) ctx.countryBriefPage.updateCountryProfile?.(profile);
  if (indices) ctx.countryBriefPage.updateCountryIndices?.(indices);
}

/**
 * Preloads all country profile data into the module cache.
 * Call once during app bootstrap (low priority).
 */
export async function preloadCountryProfiles(): Promise<void> {
  const { fetchCountryProfiles, fetchCountryIndicators, fetchCountryIndices } = await import('@/services/country-profiles');
  await Promise.allSettled([
    fetchCountryProfiles(),
    fetchCountryIndicators(),
    fetchCountryIndices(),
  ]);
}

export async function refreshEconomicForPanel(ctx: AppContext, code: string, score: ReturnType<typeof getPreferredCountryScore>): Promise<void> {
  const page = ctx.countryBriefPage;
  if (!page) return;
  page.updateEconomicIndicators?.(buildEconomicIndicators(code, score, null));
  fetchCountryMacroData(code).then((cards) => {
    if (page.getCode() !== code) return;
    page.updateMacroCards?.(cards);
  });
}

export async function refreshGovernance(ctx: AppContext, code: string): Promise<void> {
  fetchCountryGovernance(code)
    .then((governanceData) => {
      if (ctx.countryBriefPage?.getCode() !== code) return;
      ctx.countryBriefPage.updateGovernance?.(governanceData);
    })
    .catch(() => {
      if (ctx.countryBriefPage?.getCode() !== code) return;
      ctx.countryBriefPage.updateGovernance?.(null);
    });
}

function matchesCountry(
  item: { country?: string; lat?: number; lon?: number },
  code: string,
  countryLower: string,
  hasGeoShape: boolean,
): boolean {
  if (item.country) {
    const raw = item.country.toLowerCase().trim();
    if (raw === countryLower) return true;
    if (item.country.length === 2 && item.country.toUpperCase() === code) return true;
    if (nameToCountryCode(raw) === code) return true;
  }
  if (hasGeoShape && item.lat != null && item.lon != null) {
    return isInCountry(item.lat, item.lon, code);
  }
  return false;
}

function getCountryStrikes(ctx: AppContext, code: string, hasGeoShape: boolean): typeof ctx.intelligenceCache.iranEvents & object {
  if (!ctx.intelligenceCache.iranEvents) return [];
  const seen = new Set<string>();
  return ctx.intelligenceCache.iranEvents.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return hasGeoShape && isInCountry(e.latitude, e.longitude, code);
  });
}
