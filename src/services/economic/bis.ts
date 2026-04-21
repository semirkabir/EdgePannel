/**
 * BIS (Bank for International Settlements) service.
 * Extracted from the unified economic/index.ts barrel.
 */

import {
  EconomicServiceClient,
  type GetBisPolicyRatesResponse,
  type GetBisExchangeRatesResponse,
  type GetBisCreditResponse,
  type BisPolicyRate,
  type BisExchangeRate,
  type BisCreditToGdp,
} from '@/generated/client/worldmonitor/economic/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';

// ---- Client + Circuit Breakers ----

const client = new EconomicServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });

const bisPolicyBreaker = createCircuitBreaker<GetBisPolicyRatesResponse>({ name: 'BIS Policy', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const bisEerBreaker = createCircuitBreaker<GetBisExchangeRatesResponse>({ name: 'BIS EER', cacheTtlMs: 30 * 60 * 1000, persistCache: true });
const bisCreditBreaker = createCircuitBreaker<GetBisCreditResponse>({ name: 'BIS Credit', cacheTtlMs: 30 * 60 * 1000, persistCache: true });

const emptyBisPolicyFallback: GetBisPolicyRatesResponse = { rates: [] };
const emptyBisEerFallback: GetBisExchangeRatesResponse = { rates: [] };
const emptyBisCreditFallback: GetBisCreditResponse = { entries: [] };

// ---- Types ----

export type { BisPolicyRate, BisExchangeRate, BisCreditToGdp };

export interface BisData {
  policyRates: BisPolicyRate[];
  exchangeRates: BisExchangeRate[];
  creditToGdp: BisCreditToGdp[];
  fetchedAt: Date;
}

// ---- Functions ----

export async function fetchBisData(): Promise<BisData> {
  const empty: BisData = { policyRates: [], exchangeRates: [], creditToGdp: [], fetchedAt: new Date() };

  const hPolicy = getHydratedData('bisPolicy') as GetBisPolicyRatesResponse | undefined;
  const hEer = getHydratedData('bisExchange') as GetBisExchangeRatesResponse | undefined;
  const hCredit = getHydratedData('bisCredit') as GetBisCreditResponse | undefined;

  try {
    const [policy, eer, credit] = await Promise.all([
      hPolicy?.rates?.length ? Promise.resolve(hPolicy) : bisPolicyBreaker.execute(() => client.getBisPolicyRates({}, { signal: AbortSignal.timeout(20_000) }), emptyBisPolicyFallback),
      hEer?.rates?.length ? Promise.resolve(hEer) : bisEerBreaker.execute(() => client.getBisExchangeRates({}, { signal: AbortSignal.timeout(20_000) }), emptyBisEerFallback),
      hCredit?.entries?.length ? Promise.resolve(hCredit) : bisCreditBreaker.execute(() => client.getBisCredit({}, { signal: AbortSignal.timeout(20_000) }), emptyBisCreditFallback),
    ]);
    return {
      policyRates: policy.rates ?? [],
      exchangeRates: eer.rates ?? [],
      creditToGdp: credit.entries ?? [],
      fetchedAt: new Date(),
    };
  } catch {
    return empty;
  }
}
