/**
 * Data360 service module — World Bank Data360 API integration
 *
 * Provides convenience functions for fetching V-Dem democracy indices,
 * Polity V regime data, IFC GEM risk scores, and other Data360 datasets.
 * Uses the EconomicServiceClient RPC with circuit breaker pattern and
 * bootstrap hydration fallbacks.
 */

import {
  EconomicServiceClient,
  ApiError,
  type GetData360DataResponse,
  type GetData360DataRequest,
  type Data360DataPoint as ProtoData360DataPoint,
  type SearchData360Response,
} from '@/generated/client/worldmonitor/economic/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { isFeatureAvailable } from '../runtime-config';
import { getHydratedData } from '@/services/bootstrap';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Raw Data360 data point from the API, normalized for client use. */
export interface Data360DataPoint {
  indicator: string;
  refArea: string;       // ISO-2 country code (normalized from ISO-3)
  countryName: string;
  timePeriod: number;    // Year
  obsValue: number;
  sex: string;           // "_T" = total
  age: string;
  urbanisation: string;  // "_Z" = N/A
  freq: string;          // "A" = annual
  unitMeasure: string;
  dataSource: string;
  databaseId: string;
}

/** V-Dem Democracy Score with sub-components. */
export interface DemocracyScore {
  countryCode: string;   // ISO-2
  countryName: string;
  compositeScore: number; // 0-100, weighted blend
  rank: number;
  regimeType: 'Full Democracy' | 'Democracy' | 'Hybrid Regime' | 'Autocracy';
  components: {
    electoral: number | null;       // V2X_API
    liberal: number | null;         // V2X_LIB
    participatory: number | null;   // V2X_PART
    deliberative: number | null;    // V2X_DL
    egalitarian: number | null;     // V2X_EG
    freedomOfExpression: number | null; // V2XME_FREEXP
    cleanElections: number | null;      // V2XELECGOV
  };
  source: 'vdem';
}

/** Polity V Regime Data. */
export interface PolityData {
  countryCode: string;   // ISO-2
  countryName: string;
  polityScore: number;    // -10 to +10
  democracyScore: number; // 0-10
  autocracyScore: number; // 0-10
  regimeType: 'Full Democracy' | 'Democracy' | 'Hybrid Regime' | 'Autocracy';
  constraintOnExecutive: number; // 1-7
  politicalCompetition: number;  // 1-10
  source: 'polity';
}

/** GEM Risk Score with sub-components. */
export interface GemRiskScore {
  countryCode: string;   // ISO-2
  countryName: string;
  compositeRisk: number;  // 0-100 (higher = riskier)
  rank: number;
  components: {
    political: number | null;    // PBD
    economic: number | null;     // BED
    operational: number | null;   // OD
    sovereign: number | null;     // SRD
  };
  source: 'gem';
}

/** Merged governance & democracy data for a single country (V-Dem + Polity). */
export interface CountryGovernanceData {
  countryCode: string;
  countryName: string;
  vdem: DemocracyScore;
  polity: PolityData | null;
  /** Best regime type (prefers V-Dem when both are available). */
  regimeType: DemocracyScore['regimeType'];
}

/** Enhanced governance score blending WGI + V-Dem + Polity. */
export interface EnhancedGovernanceScore {
  countryCode: string;
  countryName: string;
  wgiScore: number;                    // 50% weight
  vdemElectoralDemocracy: number | null; // 30% weight
  polityScore: number | null;           // 20% weight
  blendedGovernance: number;            // final blended value (0-100)
}

// ─────────────────────────────────────────────────────────────────────────────
// Client + Circuit Breakers
// ─────────────────────────────────────────────────────────────────────────────

const client = new EconomicServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });

const data360Breaker = createCircuitBreaker<GetData360DataResponse>({
  name: 'Data360',
  cacheTtlMs: 30 * 60 * 1000, // 30 min circuit breaker cache
  persistCache: true,
});

const searchBreaker = createCircuitBreaker<SearchData360Response>({
  name: 'Data360 Search',
  cacheTtlMs: 60 * 60 * 1000, // 1 hour (search results change slowly)
  persistCache: true,
});

const emptyData360Response: GetData360DataResponse = { data: [], totalCount: 0 };
const emptySearchResponse: SearchData360Response = { results: [], totalCount: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// Indicator Mappings
// ─────────────────────────────────────────────────────────────────────────────

/** V-Dem key indicators for the Democracy Panel. */
export const VDEM_INDICATORS: Record<string, { key: string; label: string; weight: number }> = {
  'VDEM_CORE_V2X_API':      { key: 'electoral',           label: 'Electoral Democracy',      weight: 0.30 },
  'VDEM_CORE_V2X_LIB':      { key: 'liberal',             label: 'Liberal Democracy',         weight: 0.20 },
  'VDEM_CORE_V2X_PART':     { key: 'participatory',       label: 'Participatory Democracy',    weight: 0.15 },
  'VDEM_CORE_V2X_DL':       { key: 'deliberative',        label: 'Deliberative Democracy',     weight: 0.15 },
  'VDEM_CORE_V2X_EG':       { key: 'egalitarian',         label: 'Egalitarian Democracy',     weight: 0.10 },
  'VDEM_CORE_V2XME_FREEXP': { key: 'freedomOfExpression', label: 'Freedom of Expression',     weight: 0.05 },
  'VDEM_CORE_V2XELECGOV':   { key: 'cleanElections',      label: 'Clean Elections',           weight: 0.05 },
};

/** Polity V key indicators. */
export const POLITY_INDICATORS: Record<string, { key: string; label: string }> = {
  'POLITY5_PRC_POLITY2':  { key: 'polityScore',   label: 'Polity Score' },
  'POLITY5_PRC_DEMOC':    { key: 'democracyScore', label: 'Democracy Indicator' },
  'POLITY5_PRC_AUTOC':    { key: 'autocracyScore', label: 'Autocracy Indicator' },
  'POLITY5_PRC_XCONST':   { key: 'constraintOnExecutive', label: 'Constraint on Executive' },
  'POLITY5_PRC_POLCOMP':  { key: 'politicalCompetition', label: 'Political Competition' },
};

/** GEM risk indicators. */
export const GEM_INDICATORS: Record<string, { key: string; label: string }> = {
  'IFC_GEM_PBD':  { key: 'political',   label: 'Political Risk' },
  'IFC_GEM_BED':  { key: 'economic',     label: 'Economic Risk' },
  'IFC_GEM_OD':   { key: 'operational',  label: 'Operational Risk' },
  'IFC_GEM_SRD':  { key: 'sovereign',    label: 'Sovereign Risk' },
  'IFC_GEM_ER':   { key: 'composite',    label: 'Composite Risk' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Data360 Fetch
// ─────────────────────────────────────────────────────────────────────────────

if (!featureAvailable('economicData360')) {
  // Stub: feature flag not yet enabled
}

function featureAvailable(flag: string): boolean {
  return isFeatureAvailable(flag as any);
}

/**
 * Generic Data360 data fetch with circuit breaker.
 * Returns normalized data points from any Data360 database.
 */
export async function fetchData360Data(params: {
  databaseId: string;
  indicator?: string;
  refArea?: string;
  timePeriodFrom?: number;
  timePeriodTo?: number;
  freq?: string;
  isLatestData?: boolean;
  top?: number;
  skip?: number;
}): Promise<Data360DataPoint[]> {
  if (!featureAvailable('economicData360')) return [];

  try {
    const req: GetData360DataRequest = {
      databaseId: params.databaseId,
      indicator: params.indicator || '',
      refArea: params.refArea || '',
      timePeriodFrom: params.timePeriodFrom || 0,
      timePeriodTo: params.timePeriodTo || 0,
      freq: params.freq || 'A',
      isLatestData: params.isLatestData ?? false,
      top: params.top || 0,
      skip: params.skip || 0,
    };

    const resp = await data360Breaker.execute(async () => {
      return client.getData360Data(req, { signal: AbortSignal.timeout(30_000) });
    }, emptyData360Response);

    return (resp.data ?? []).map(normalizeData360Point);
  } catch {
    return [];
  }
}

/** Search Data360 indicators by keyword. */
export async function searchData360(query: string, top = 20): Promise<SearchData360Response['results']> {
  if (!featureAvailable('economicData360')) return [];

  try {
    const resp = await searchBreaker.execute(async () => {
      return client.searchData360({ query, top, filter: "type eq 'indicator'", select: '' }, { signal: AbortSignal.timeout(15_000) });
    }, emptySearchResponse);

    return resp.results ?? [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// V-Dem Democracy Scores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch V-Dem democracy scores for all countries.
 * Uses bootstrap hydration as fast path, then falls back to RPC.
 */
export async function fetchVDemScores(countries?: string[]): Promise<DemocracyScore[]> {
  // Fast path: bootstrap-hydrated data
  const hydrated = getHydratedData('vdemBaselines') as DemocracyScore[] | undefined;
  if (hydrated?.length && !countries) return hydrated;

  // Try seed data from Redis-backed bootstrap endpoint
  try {
    const resp = await fetch('/api/bootstrap?keys=vdemBaselines', {
      signal: AbortSignal.timeout(5_000),
    });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: { vdemBaselines?: DemocracyScore[] } };
      if (data.vdemBaselines?.length) {
        return countries
          ? data.vdemBaselines.filter(s => countries.includes(s.countryCode))
          : data.vdemBaselines;
      }
    }
  } catch { /* fall through */ }

  // Last resort: compute on-demand from Data360 API
  return computeVDemScoresFromApi(countries);
}

async function computeVDemScoresFromApi(countries?: string[]): Promise<DemocracyScore[]> {
  const indicatorCodes = Object.keys(VDEM_INDICATORS);
  const allData = new Map<string, Map<string, { name: string; value: number }>>();

  // Fetch each indicator. V-Dem data is slow, so we fetch latest only.
  const results = await Promise.allSettled(
    indicatorCodes.map(async (code) => {
      const data = await fetchData360Data({
        databaseId: 'VDEM_CORE',
        indicator: code,
        isLatestData: true,
        top: 1000,
      });
      return { code, data };
    }),
  );

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { code, data } = r.value;
    for (const point of data) {
      if (!allData.has(point.refArea)) allData.set(point.refArea, new Map());
      allData.get(point.refArea)!.set(code, { name: point.countryName, value: point.obsValue });
    }
  }

  // Compute composite democracy scores
  const scores: DemocracyScore[] = [];
  for (const [countryCode, indicators] of allData) {
    if (countries && !countries.includes(countryCode)) continue;

    let totalWeight = 0;
    let weightedSum = 0;
    const components: DemocracyScore['components'] = {
      electoral: null,
      liberal: null,
      participatory: null,
      deliberative: null,
      egalitarian: null,
      freedomOfExpression: null,
      cleanElections: null,
    };

    for (const [code, config] of Object.entries(VDEM_INDICATORS)) {
      const entry = indicators.get(code);
      if (!entry || entry.value == null) continue;

      // V-Dem scores are typically 0-1, normalize to 0-100
      const normalized = Math.min(100, entry.value * 100);
      totalWeight += config.weight;
      weightedSum += normalized * config.weight;

      (components as any)[config.key] = normalized;
    }

    if (totalWeight === 0) continue;

    const compositeScore = Math.round((weightedSum / totalWeight) * 10) / 10;
    const name = [...indicators.values()].find(e => e.name)?.name || countryCode;

    // Determine regime type based on electoral democracy score
    const electoral = components.electoral;
    let regimeType: DemocracyScore['regimeType'] = 'Autocracy';
    if (electoral !== null) {
      if (electoral >= 80) regimeType = 'Full Democracy';
      else if (electoral >= 50) regimeType = 'Democracy';
      else if (electoral >= 30) regimeType = 'Hybrid Regime';
    }

    scores.push({
      countryCode,
      countryName: name,
      compositeScore,
      rank: 0,
      regimeType,
      components,
      source: 'vdem',
    });
  }

  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  scores.forEach((s, i) => { s.rank = i + 1; });
  return scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// Polity V Regime Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch Polity V regime data for all countries.
 * Uses bootstrap hydration as fast path.
 */
export async function fetchPolityScores(countries?: string[]): Promise<PolityData[]> {
  const hydrated = getHydratedData('polityBaselines') as PolityData[] | undefined;
  if (hydrated?.length && !countries) return hydrated;

  try {
    const resp = await fetch('/api/bootstrap?keys=polityBaselines', {
      signal: AbortSignal.timeout(5_000),
    });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: { polityBaselines?: PolityData[] } };
      if (data.polityBaselines?.length) {
        return countries
          ? data.polityBaselines.filter(s => countries.includes(s.countryCode))
          : data.polityBaselines;
      }
    }
  } catch { /* fall through */ }

  return computePolityScoresFromApi(countries);
}

async function computePolityScoresFromApi(countries?: string[]): Promise<PolityData[]> {
  const allData = new Map<string, Map<string, { name: string; value: number }>>();

  const results = await Promise.allSettled(
    Object.keys(POLITY_INDICATORS).map(async (code) => {
      const data = await fetchData360Data({
        databaseId: 'POLITY5_PRC',
        indicator: code,
        isLatestData: true,
        top: 1000,
      });
      return { code, data };
    }),
  );

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { code, data } = r.value;
    for (const point of data) {
      if (!allData.has(point.refArea)) allData.set(point.refArea, new Map());
      allData.get(point.refArea)!.set(code, { name: point.countryName, value: point.obsValue });
    }
  }

  const scores: PolityData[] = [];
  for (const [countryCode, indicators] of allData) {
    if (countries && !countries.includes(countryCode)) continue;

    const polity = indicators.get('POLITY5_PRC_POLITY2')?.value ?? null;
    const democ = indicators.get('POLITY5_PRC_DEMOC')?.value ?? null;
    const autoc = indicators.get('POLITY5_PRC_AUTOC')?.value ?? null;
    const xconst = indicators.get('POLITY5_PRC_XCONST')?.value ?? null;
    const polcomp = indicators.get('POLITY5_PRC_POLCOMP')?.value ?? null;

    if (polity === null) continue;

    let regimeType: PolityData['regimeType'] = 'Autocracy';
    if (polity >= 8) regimeType = 'Full Democracy';
    else if (polity >= 5) regimeType = 'Democracy';
    else if (polity >= -5) regimeType = 'Hybrid Regime';

    const name = [...indicators.values()].find(e => e.name)?.name || countryCode;
    scores.push({
      countryCode,
      countryName: name,
      polityScore: polity,
      democracyScore: democ ?? 0,
      autocracyScore: autoc ?? 0,
      regimeType,
      constraintOnExecutive: xconst ?? 1,
      politicalCompetition: polcomp ?? 1,
      source: 'polity',
    });
  }

  scores.sort((a, b) => b.polityScore - a.polityScore);
  return scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// GEM Risk Scores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch IFC GEM risk scores for all countries.
 * Uses bootstrap hydration as fast path.
 */
export async function fetchGemRiskScores(countries?: string[]): Promise<GemRiskScore[]> {
  const hydrated = getHydratedData('gemRiskBaselines') as GemRiskScore[] | undefined;
  if (hydrated?.length && !countries) return hydrated;

  try {
    const resp = await fetch('/api/bootstrap?keys=gemRiskBaselines', {
      signal: AbortSignal.timeout(5_000),
    });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: { gemRiskBaselines?: GemRiskScore[] } };
      if (data.gemRiskBaselines?.length) {
        return countries
          ? data.gemRiskBaselines.filter(s => countries.includes(s.countryCode))
          : data.gemRiskBaselines;
      }
    }
  } catch { /* fall through */ }

  return computeGemRiskScoresFromApi(countries);
}

async function computeGemRiskScoresFromApi(countries?: string[]): Promise<GemRiskScore[]> {
  const allData = new Map<string, Map<string, { name: string; value: number }>>();
  const gemKeys = Object.keys(GEM_INDICATORS);

  const results = await Promise.allSettled(
    gemKeys.map(async (code) => {
      const data = await fetchData360Data({
        databaseId: 'IFC_GEM',
        indicator: code,
        isLatestData: true,
        top: 1000,
      });
      return { code, data };
    }),
  );

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { code, data } = r.value;
    for (const point of data) {
      if (!allData.has(point.refArea)) allData.set(point.refArea, new Map());
      allData.get(point.refArea)!.set(code, { name: point.countryName, value: point.obsValue });
    }
  }

  const scores: GemRiskScore[] = [];
  for (const [countryCode, indicators] of allData) {
    if (countries && !countries.includes(countryCode)) continue;

    const political = indicators.get('IFC_GEM_PBD')?.value ?? null;
    const economic = indicators.get('IFC_GEM_BED')?.value ?? null;
    const operational = indicators.get('IFC_GEM_OD')?.value ?? null;
    const sovereign = indicators.get('IFC_GEM_SRD')?.value ?? null;
    const composite = indicators.get('IFC_GEM_ER')?.value ?? null;

    // Compute composite if ER indicator not directly available
    const riskComponents = [political, economic, operational, sovereign].filter((v): v is number => v !== null);
    const compositeRisk = composite ?? (riskComponents.length > 0
      ? riskComponents.reduce((sum, v) => sum + v, 0) / riskComponents.length
      : 0);

    const name = [...indicators.values()].find(e => e.name)?.name || countryCode;
    scores.push({
      countryCode,
      countryName: name,
      compositeRisk: Math.round(compositeRisk * 10) / 10,
      rank: 0,
      components: { political, economic, operational, sovereign },
      source: 'gem',
    });
  }

  // Sort by risk (highest = riskiest first)
  scores.sort((a, b) => b.compositeRisk - a.compositeRisk);
  scores.forEach((s, i) => { s.rank = i + 1; });
  return scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Governance Blend (CII Enhancement)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute enhanced governance scores that blend WGI (50%), V-Dem (30%), and Polity (20%).
 * Used to enhance the Country Instability Index governance component.
 */
export async function computeEnhancedGovernance(
  wgiScores: Array<{ countryCode: string; countryName: string; governanceIndex: number }>,
  countries?: string[],
): Promise<EnhancedGovernanceScore[]> {
  const [vdemScores, polityScores] = await Promise.all([
    fetchVDemScores(countries),
    fetchPolityScores(countries),
  ]);

  const vdemMap = new Map(vdemScores.map(s => [s.countryCode, s]));
  const polityMap = new Map(polityScores.map(s => [s.countryCode, s]));

  return wgiScores
    .filter(s => !countries || countries.includes(s.countryCode))
    .map(wgi => {
      const vdem = vdemMap.get(wgi.countryCode);
      const polity = polityMap.get(wgi.countryCode);

      let totalWeight = 0.5; // WGI always counts 50%
      let weightedScore = wgi.governanceIndex * 0.5;

      const vdemElectoral = vdem?.components.electoral ?? null;
      if (vdemElectoral !== null) {
        totalWeight += 0.3;
        weightedScore += vdemElectoral * 0.3;
      }

      const polityNorm = polity ? ((polity.polityScore + 10) / 20) * 100 : null;
      if (polityNorm !== null) {
        totalWeight += 0.2;
        weightedScore += polityNorm * 0.2;
      }

      const blendedGovernance = totalWeight > 0
        ? Math.round((weightedScore / totalWeight) * 10) / 10
        : wgi.governanceIndex;

      return {
        countryCode: wgi.countryCode,
        countryName: wgi.countryName,
        wgiScore: wgi.governanceIndex,
        vdemElectoralDemocracy: vdemElectoral,
        polityScore: polity ? polity.polityScore : null,
        blendedGovernance,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize raw proto data point to client-side type. */
function normalizeData360Point(p: ProtoData360DataPoint): Data360DataPoint {
  return {
    indicator: p.indicator,
    refArea: p.refArea,
    countryName: p.countryName,
    timePeriod: p.timePeriod,
    obsValue: p.obsValue,
    sex: p.sex || '_T',
    age: p.age || '_Z',
    urbanisation: p.urbanisation || '_Z',
    freq: p.freq || 'A',
    unitMeasure: p.unitMeasure,
    dataSource: p.dataSource,
    databaseId: p.databaseId,
  };
}

/** Get human-readable regime type from a Polity score (-10 to +10). */
export function getRegimeTypeFromPolity(polityScore: number): PolityData['regimeType'] {
  if (polityScore >= 8) return 'Full Democracy';
  if (polityScore >= 5) return 'Democracy';
  if (polityScore >= -5) return 'Hybrid Regime';
  return 'Autocracy';
}

/** Get regime type color for CSS styling. */
export function getRegimeTypeColor(regimeType: string): string {
  switch (regimeType) {
    case 'Full Democracy': return '#22c55e';
    case 'Democracy': return '#84cc16';
    case 'Hybrid Regime': return '#eab308';
    case 'Autocracy': return '#ef4444';
    default: return '#6b7280';
  }
}

/** Get risk level from a GEM composite risk score (0-100). */
export function getRiskLevel(risk: number): 'low' | 'moderate' | 'high' | 'very high' {
  if (risk < 30) return 'low';
  if (risk < 50) return 'moderate';
  if (risk < 70) return 'high';
  return 'very high';
}

/** Get risk level color for CSS styling. */
export function getRiskColor(risk: number): string {
  if (risk < 30) return '#22c55e';
  if (risk < 50) return '#eab308';
  if (risk < 70) return '#f97316';
  return '#ef4444';
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions for Panel Consumers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch democracy rankings (top-level convenience function for DemocracyPanel).
 * Returns V-Dem democracy scores sorted by composite score, suitable for
 * rendering a ranked list of countries with sub-score bars.
 */
export async function fetchDemocracyRankings(countries?: string[]): Promise<DemocracyScore[]> {
  return fetchVDemScores(countries);
}

/**
 * Fetch the V-Dem core democracy indicators for a specific country.
 * Returns the raw Data360 data points for all V-Dem indicators.
 */
export async function fetchVdemCore(
  countryCode?: string,
): Promise<Data360DataPoint[]> {
  if (!featureAvailable('economicData360')) return [];

  const indicatorCodes = Object.keys(VDEM_INDICATORS);
  const allData: Data360DataPoint[] = [];

  const results = await Promise.allSettled(
    indicatorCodes.map(async (code) => {
      const data = await fetchData360Data({
        databaseId: 'VDEM_CORE',
        indicator: code,
        refArea: countryCode || '',
        isLatestData: true,
        top: 1000,
      });
      return data;
    }),
  );

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    allData.push(...r.value);
  }

  return allData;
}

/**
 * Fetch merged governance & democracy data for a single country.
 * Combines V-Dem democracy scores with Polity regime data.
 * Returns null if no V-Dem data is available for the country.
 */
export async function fetchCountryGovernance(countryCode: string): Promise<CountryGovernanceData | null> {
  const [vdemScores, polityScores] = await Promise.all([
    fetchVDemScores([countryCode]),
    fetchPolityScores([countryCode]),
  ]);

  const vdem = vdemScores.find(s => s.countryCode === countryCode) ?? null;
  if (!vdem) return null;

  const polity = polityScores.find(s => s.countryCode === countryCode) ?? null;
  const regimeType = vdem.regimeType;

  return {
    countryCode,
    countryName: vdem.countryName,
    vdem,
    polity,
    regimeType,
  };
}