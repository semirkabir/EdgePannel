import type { CountryBriefSignals } from '@/app/app-context';
import type { AppContext } from '@/app/app-context';
import { signalAggregator } from '@/services/signal-aggregator';
import { getCountryData, TIER1_COUNTRIES } from '@/services/country-instability';
import { hasCountryGeometry, isCoordinateInCountry, nameToCountryCode } from '@/services/country-geometry';
import { getCountrySearchTerms, getOtherCountryTerms, firstMentionPosition, COUNTRY_BOUNDS } from './country-utils';

function isInCountry(lat: number, lon: number, code: string): boolean {
  const precise = isCoordinateInCountry(lat, lon, code);
  if (precise === true) return true;
  const b = COUNTRY_BOUNDS[code];
  if (!b) return false;
  return lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;
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

export function getCountrySignals(ctx: AppContext, code: string, country: string): CountryBriefSignals {
  const countryLower = country.toLowerCase();
  const hasGeoShape = hasCountryGeometry(code) || !!COUNTRY_BOUNDS[code];
  const clusters = signalAggregator.getCountryClusters();
  const countryCluster = clusters.find(c => c.country === code);
  const globalCluster = clusters.find(c => c.country === 'XX');
  const signalTypeCounts = {
    aisDisruptions: 0,
    satelliteFires: 0,
    temporalAnomalies: 0,
  };
  if (countryCluster) {
    for (const s of countryCluster.signals) {
      if (s.type === 'ais_disruption') signalTypeCounts.aisDisruptions++;
      else if (s.type === 'satellite_fire') signalTypeCounts.satelliteFires++;
      else if (s.type === 'temporal_anomaly') signalTypeCounts.temporalAnomalies++;
    }
  }
  const globalTemporalAnomalies = globalCluster
    ? globalCluster.signals.filter((s) => s.type === 'temporal_anomaly').length
    : 0;

  const searchTerms = getCountrySearchTerms(country, code);
  const otherCountryTerms = getOtherCountryTerms(code);
  const criticalNews = ctx.latestClusters.filter((cluster) => {
    const title = cluster.primaryTitle.toLowerCase();
    const ourPos = firstMentionPosition(title, searchTerms);
    const otherPos = firstMentionPosition(title, otherCountryTerms);
    if (ourPos === Infinity || (otherPos !== Infinity && otherPos < ourPos)) return false;
    return cluster.isAlert || cluster.threat?.level === 'critical' || cluster.threat?.level === 'high';
  }).length;

  let protests = 0;
  if (ctx.intelligenceCache.protests?.events) {
    protests = ctx.intelligenceCache.protests.events.filter((e) =>
      matchesCountry({ country: e.country, lat: e.lat, lon: e.lon }, code, countryLower, hasGeoShape)
    ).length;
  }

  let militaryFlights = 0;
  let militaryVessels = 0;
  if (ctx.intelligenceCache.military) {
    militaryFlights = ctx.intelligenceCache.military.flights.filter((f) =>
      hasGeoShape ? isInCountry(f.lat, f.lon, code) : f.operatorCountry?.toUpperCase() === code
    ).length;
    militaryVessels = ctx.intelligenceCache.military.vessels.filter((v) =>
      hasGeoShape ? isInCountry(v.lat, v.lon, code) : v.operatorCountry?.toUpperCase() === code
    ).length;
  }

  let outages = 0;
  if (ctx.intelligenceCache.outages) {
    outages = ctx.intelligenceCache.outages.filter((o) =>
      matchesCountry({ country: o.country, lat: o.lat, lon: o.lon }, code, countryLower, hasGeoShape)
    ).length;
  }

  let earthquakes = 0;
  if (ctx.intelligenceCache.earthquakes) {
    earthquakes = ctx.intelligenceCache.earthquakes.filter((eq) => {
      const lat = eq.location?.latitude ?? 0;
      const lon = eq.location?.longitude ?? 0;
      if (hasGeoShape) return isInCountry(lat, lon, code);
      return eq.place?.toLowerCase().includes(countryLower) ?? false;
    }).length;
  }

  const activeStrikes = getCountryStrikes(ctx, code, hasGeoShape).length;

  let aviationDisruptions = 0;
  if (ctx.intelligenceCache.flightDelays) {
    aviationDisruptions = ctx.intelligenceCache.flightDelays.filter(d =>
      (d.severity === 'major' || d.severity === 'severe' || d.delayType === 'closure') &&
      matchesCountry({ country: d.country, lat: d.lat, lon: d.lon }, code, countryLower, hasGeoShape)
    ).length;
  }

  const ciiData = getCountryData(code);
  const isTier1 = !!TIER1_COUNTRIES[code];

  let orefSirens = 0;
  let orefHistory24h = 0;
  if (code === 'IL' && ctx.intelligenceCache.orefAlerts) {
    orefSirens = ctx.intelligenceCache.orefAlerts.alertCount;
    orefHistory24h = ctx.intelligenceCache.orefAlerts.historyCount24h;
  }

  let travelAdvisories = 0;
  let travelAdvisoryMaxLevel: string | null = null;
  const advisoryLevelRank: Record<string, number> = { 'do-not-travel': 4, 'reconsider': 3, 'caution': 2, 'normal': 1, 'info': 0 };
  if (ctx.intelligenceCache.advisories) {
    const countryAdvisories = ctx.intelligenceCache.advisories.filter(a => a.country === code);
    travelAdvisories = countryAdvisories.length;
    for (const a of countryAdvisories) {
      if (a.level && (advisoryLevelRank[a.level] || 0) > (advisoryLevelRank[travelAdvisoryMaxLevel || ''] || 0)) {
        travelAdvisoryMaxLevel = a.level;
      }
    }
  }

  let cyberThreats = 0;
  if (ctx.cyberThreatsCache) {
    cyberThreats = ctx.cyberThreatsCache.filter((threat) => {
      if (threat.country && threat.country.length === 2) return threat.country.toUpperCase() === code;
      return matchesCountry({ lat: threat.lat, lon: threat.lon }, code, countryLower, hasGeoShape);
    }).length;
  }

  return {
    criticalNews,
    protests,
    militaryFlights,
    militaryVessels,
    outages,
    aisDisruptions: signalTypeCounts.aisDisruptions,
    satelliteFires: signalTypeCounts.satelliteFires,
    temporalAnomalies: signalTypeCounts.temporalAnomalies > 0 ? signalTypeCounts.temporalAnomalies : globalTemporalAnomalies,
    cyberThreats,
    earthquakes,
    displacementOutflow: ciiData?.displacementOutflow ?? 0,
    climateStress: ciiData?.climateStress ?? 0,
    conflictEvents: ciiData?.conflicts?.length ?? 0,
    activeStrikes,
    orefSirens,
    orefHistory24h,
    aviationDisruptions,
    travelAdvisories,
    travelAdvisoryMaxLevel,
    gpsJammingHexes: (ciiData?.gpsJammingHighCount ?? 0) + (ciiData?.gpsJammingMediumCount ?? 0),
    isTier1,
  };
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
