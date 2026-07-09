/**
 * ISIN resolver — maps ISIN / FIGI identifiers via the OpenFIGI API.
 *
 * OpenFIGI is free for up to 250 req/min (unauthenticated).
 * An API key unlocks higher limits; set VITE_OPENFIGI_API_KEY if available.
 * https://www.openfigi.com/api
 */

const OPENFIGI_KEY = import.meta.env.VITE_OPENFIGI_API_KEY || '';

export interface FigiRecord {
  figi: string;
  ticker?: string;
  isin?: string;
  name?: string;
  exchCode?: string;
  marketSector?: string;
  securityType?: string;
}

type OpenFigiJob =
  | { idType: 'ID_ISIN'; idValue: string }
  | { idType: 'ID_BB_GLOBAL'; idValue: string }
  | { idType: 'TICKER'; idValue: string; exchCode?: string };

async function postOpenFigi(jobs: OpenFigiJob[]): Promise<FigiRecord[][]> {
  const headers: Record<string, string> = { 'Content-Type': 'text/json' };
  if (OPENFIGI_KEY) headers['X-OPENFIGI-APIKEY'] = OPENFIGI_KEY;

  try {
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers,
      body: JSON.stringify(jobs),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return jobs.map(() => []);
    const data = await res.json() as Array<{ data?: Array<Record<string, string>>; error?: string }>;
    return data.map((entry) =>
      (entry.data ?? []).map((r) => ({
        figi: r.figi ?? '',
        ticker: r.ticker,
        name: r.name,
        exchCode: r.exchCode,
        marketSector: r.marketSector,
        securityType: r.securityType,
      })),
    );
  } catch {
    return jobs.map(() => []);
  }
}

/** Resolve an ISIN to a list of FIGI records (one per exchange listing). */
export async function resolveIsin(isin: string): Promise<FigiRecord[]> {
  const upper = isin.toUpperCase().trim();
  if (!upper || upper.length !== 12) return [];
  const results = await postOpenFigi([{ idType: 'ID_ISIN', idValue: upper }]);
  return (results[0] ?? []).map((r) => ({ ...r, isin: upper }));
}

/** Resolve a FIGI to its security metadata. */
export async function resolveFigi(figi: string): Promise<FigiRecord | null> {
  const upper = figi.toUpperCase().trim();
  if (!upper) return null;
  const results = await postOpenFigi([{ idType: 'ID_BB_GLOBAL', idValue: upper }]);
  const first = results[0]?.[0];
  return first ?? null;
}

/** Resolve a ticker + optional exchange code to a FIGI record. */
export async function resolveTickerToFigi(ticker: string, exchCode?: string): Promise<FigiRecord | null> {
  const job: OpenFigiJob = { idType: 'TICKER', idValue: ticker.toUpperCase() };
  if (exchCode) (job as Record<string, string>).exchCode = exchCode;
  const results = await postOpenFigi([job]);
  return results[0]?.[0] ?? null;
}
