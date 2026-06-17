import { createCircuitBreaker } from '@/utils';
import { iso3ToIso2Code, getCountryNameByCode } from '@/services/country-geometry';
import type { SupplementalSignal } from '@/services/supplemental-signal-bus';

export interface WhoGhoIndicator {
  id: string;
  indicatorCode: string;
  indicatorName: string;
  countryCode: string;
  countryName: string;
  year: number;
  value: number;
  unit: string;
  source: string;
}

interface WhoGhoResponse {
  indicators: Array<Omit<WhoGhoIndicator, 'countryName'>>;
  fetchedAt?: string;
  error?: string;
}

const breaker = createCircuitBreaker<WhoGhoIndicator[]>({
  name: 'WHO GHO',
  cacheTtlMs: 6 * 60 * 60 * 1000,
  persistCache: true,
});

let cachedIndicators: WhoGhoIndicator[] = [];

function enrichCountryNames(
  rows: Array<Omit<WhoGhoIndicator, 'countryName'>>,
): WhoGhoIndicator[] {
  return rows.map((row) => {
    const iso2 = iso3ToIso2Code(row.countryCode);
    const countryName = (iso2 && getCountryNameByCode(iso2)) || row.countryCode;
    return { ...row, countryName };
  });
}

export async function fetchWhoGhoIndicators(): Promise<WhoGhoIndicator[]> {
  const result = await breaker.execute(async () => {
    const response = await fetch('/api/who-gho', {
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: WhoGhoResponse = await response.json();
    if (!Array.isArray(data.indicators) || data.indicators.length === 0) {
      throw new Error('Empty WHO GHO response');
    }
    return enrichCountryNames(data.indicators);
  }, []);

  cachedIndicators = result;
  return result;
}

export function getCachedWhoGhoIndicators(): WhoGhoIndicator[] {
  return cachedIndicators;
}

export function buildWhoGhoSignals(indicators: WhoGhoIndicator[]): SupplementalSignal[] {
  const signals: SupplementalSignal[] = [];
  const seen = new Set<string>();

  for (const row of indicators) {
    const iso2 = iso3ToIso2Code(row.countryCode);
    if (!iso2) continue;

    const key = `${iso2}-${row.indicatorCode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const isHigh =
      (row.indicatorCode === 'WHS3_62' && row.value >= 25000) ||
      (row.indicatorCode === 'WHS2_152' && row.value >= 150);

    signals.push({
      sourceId: 'who-gho',
      sourceName: 'WHO GHO',
      country: iso2,
      value: Math.min(95, Math.round(row.value / 1000)),
      severity: isHigh ? 'high' : 'medium',
      label: `${row.indicatorName}: ${row.value.toLocaleString()} ${row.unit} (${row.year})`.slice(0, 90),
      timestamp: new Date(),
      tags: ['health', 'outbreak', row.indicatorCode.toLowerCase()],
    });
  }

  return signals;
}