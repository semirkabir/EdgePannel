import { createCircuitBreaker } from '@/utils';
import type { SupplementalSignal } from '@/services/supplemental-signal-bus';
import { matchCountryNamesInText } from '@/services/country-geometry';

export interface AirSigmet {
  id: string;
  hazard: string;
  hazardLabel: string;
  type: string;
  seriesId: string;
  icaoId: string;
  severity: number;
  validFrom: number | null;
  validTo: number | null;
  altitudeLow: number | null;
  altitudeHigh: number | null;
  movementDir: number | null;
  movementSpd: number | null;
  coords: Array<{ lat: number; lon: number }>;
  center: { lat: number; lon: number } | null;
  summary: string;
}

interface AirSigmetResponse {
  sigmets: AirSigmet[];
  fetchedAt?: string;
  error?: string;
}

const breaker = createCircuitBreaker<AirSigmet[]>({
  name: 'Aviation SIGMET',
  cacheTtlMs: 15 * 60 * 1000,
  persistCache: true,
});

let cachedSigmets: AirSigmet[] = [];

export async function fetchAirSigmets(): Promise<AirSigmet[]> {
  const result = await breaker.execute(async () => {
    const response = await fetch('/api/airsigmet', {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: AirSigmetResponse = await response.json();
    if (!Array.isArray(data.sigmets)) throw new Error('Invalid SIGMET response');
    return data.sigmets;
  }, []);

  cachedSigmets = result;
  return result;
}

export function getCachedAirSigmets(): AirSigmet[] {
  return cachedSigmets;
}

function hazardSeverity(hazard: string, apiSeverity: number): SupplementalSignal['severity'] {
  if (hazard === 'CONVECTIVE' || hazard === 'VOLCANIC' || hazard === 'TROPICAL' || apiSeverity >= 5) {
    return 'high';
  }
  if (hazard === 'TURB' || hazard === 'ICE' || hazard === 'MTW' || apiSeverity >= 4) {
    return 'medium';
  }
  return 'low';
}

export function buildSigmetSignals(sigmets: AirSigmet[]): SupplementalSignal[] {
  const signals: SupplementalSignal[] = [];
  const seen = new Set<string>();

  for (const sigmet of sigmets.slice(0, 20)) {
    const center = sigmet.center ?? sigmet.coords[0];
    if (!center) continue;

    const text = `${sigmet.summary} ${sigmet.hazardLabel} ${sigmet.icaoId}`;
    const countries = matchCountryNamesInText(text.toLowerCase());
    const country = countries[0] || 'GLOBAL';
    const key = `sigmet:${sigmet.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const severity = hazardSeverity(sigmet.hazard, sigmet.severity);
    signals.push({
      sourceId: 'airsigmet',
      sourceName: 'Aviation SIGMET',
      country,
      value: severity === 'high' ? 70 : severity === 'medium' ? 45 : 25,
      severity,
      label: `${sigmet.hazardLabel} SIGMET${sigmet.seriesId ? ` ${sigmet.seriesId}` : ''}`.slice(0, 90),
      timestamp: new Date(),
      lat: center.lat,
      lon: center.lon,
      tags: ['aviation', 'weather', sigmet.hazard.toLowerCase()],
    });
  }

  return signals;
}