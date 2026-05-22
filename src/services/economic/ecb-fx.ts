/**
 * ECB (European Central Bank) foreign exchange reference rates service.
 *
 * Fetches the ECB's official daily reference rates for ~30 major currencies
 * via the /api/ecb-fx proxy route (which calls the ECB SDMX 2.1 REST API).
 *
 * Free, no API key, publishes once per business day ~16:00 CET.
 * Source: https://data-api.ecb.europa.eu/service/data/EXR/
 */

import { createCircuitBreaker } from '@/utils';

// ── Currency metadata ────────────────────────────────────────────────────────

/** ISO2 country code that "owns" each currency (for map display / popup enrichment). */
export const CURRENCY_COUNTRY: Record<string, string> = {
  USD: 'US', JPY: 'JP', GBP: 'GB', CHF: 'CH', CNY: 'CN',
  INR: 'IN', BRL: 'BR', CAD: 'CA', AUD: 'AU', NZD: 'NZ',
  MXN: 'MX', TRY: 'TR', PLN: 'PL', HUF: 'HU', CZK: 'CZ',
  RON: 'RO', ZAR: 'ZA', KRW: 'KR', SGD: 'SG', HKD: 'HK',
  NOK: 'NO', SEK: 'SE', DKK: 'DK', IDR: 'ID', MYR: 'MY',
  PHP: 'PH', THB: 'TH', ILS: 'IL', BGN: 'BG', ISK: 'IS',
  DZD: 'DZ', HRK: 'HR',
};

/** Human-readable currency name keyed by ISO4217 code. */
export const CURRENCY_NAME: Record<string, string> = {
  USD: 'US Dollar',            JPY: 'Japanese Yen',         GBP: 'British Pound',
  CHF: 'Swiss Franc',          CNY: 'Chinese Yuan',         INR: 'Indian Rupee',
  BRL: 'Brazilian Real',       CAD: 'Canadian Dollar',      AUD: 'Australian Dollar',
  NZD: 'New Zealand Dollar',   MXN: 'Mexican Peso',         TRY: 'Turkish Lira',
  PLN: 'Polish Złoty',         HUF: 'Hungarian Forint',     CZK: 'Czech Koruna',
  RON: 'Romanian Leu',         ZAR: 'South African Rand',   KRW: 'South Korean Won',
  SGD: 'Singapore Dollar',     HKD: 'Hong Kong Dollar',     NOK: 'Norwegian Krone',
  SEK: 'Swedish Krona',        DKK: 'Danish Krone',         IDR: 'Indonesian Rupiah',
  MYR: 'Malaysian Ringgit',    PHP: 'Philippine Peso',      THB: 'Thai Baht',
  ILS: 'Israeli Shekel',       BGN: 'Bulgarian Lev',        ISK: 'Icelandic Króna',
  DZD: 'Algerian Dinar',       HRK: 'Croatian Kuna',
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface EcbFxRate {
  /** ISO 4217 currency code (e.g. 'USD', 'CNY'). */
  currency: string;
  /** Human-readable name. */
  name: string;
  /** ECB reference rate: 1 EUR = this many units of `currency`. */
  rateVsEur: number;
  /**
   * USD-based rate: 1 USD = this many units of `currency`.
   * Derived as `rateVsEur / eurUsdRate`.
   */
  vsUsd: number;
  /** 1-day % change of the EUR-based rate (positive = currency weakened vs EUR). */
  changePct: number;
  /** Publication date in ISO format (YYYY-MM-DD). */
  date: string;
  /** ISO2 country code, or null for multi-country currencies. */
  countryCode: string | null;
}

interface EcbApiResponse {
  rates: Array<{
    currency: string;
    rateVsEur: number;
    prevRateVsEur: number | null;
    changePct: number;
    date: string;
  }>;
  publishDate: string;
  baseCurrency: string;
  error?: string;
}

// ── Circuit breaker ──────────────────────────────────────────────────────────

const breaker = createCircuitBreaker<EcbApiResponse>({
  name: 'ECB FX Rates',
  cacheTtlMs: 60 * 60 * 1000, // 1 hour — ECB updates once per business day
  persistCache: true,
});

const EMPTY_RESPONSE: EcbApiResponse = { rates: [], publishDate: '', baseCurrency: 'EUR' };

// ── Module-level cache (consumed by popup enrichment without async) ───────────

let cachedRates: EcbFxRate[] = [];
let cacheByCountry: Map<string, EcbFxRate> = new Map();
let cacheByCurrency: Map<string, EcbFxRate> = new Map();

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Given the raw rate list (all vs EUR), compute the USD-denominated rate
 * for every currency: vsUsd = rateVsEur / eurUsdRate.
 */
function buildUsdRates(rates: EcbApiResponse['rates']): Map<string, number> {
  const eurUsd = rates.find(r => r.currency === 'USD')?.rateVsEur ?? 1;
  const map = new Map<string, number>();
  for (const r of rates) {
    map.set(r.currency, eurUsd > 0 ? r.rateVsEur / eurUsd : r.rateVsEur);
  }
  return map;
}

function hydrateCache(raw: EcbApiResponse): void {
  const usdRates = buildUsdRates(raw.rates);

  cachedRates = raw.rates.map(r => ({
    currency:    r.currency,
    name:        CURRENCY_NAME[r.currency] ?? r.currency,
    rateVsEur:  r.rateVsEur,
    vsUsd:      usdRates.get(r.currency) ?? r.rateVsEur,
    changePct:  r.changePct,
    date:       r.date || raw.publishDate,
    countryCode: CURRENCY_COUNTRY[r.currency] ?? null,
  }));

  cacheByCountry  = new Map(cachedRates.filter(r => r.countryCode).map(r => [r.countryCode!, r]));
  cacheByCurrency = new Map(cachedRates.map(r => [r.currency, r]));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch (or return cached) ECB reference rates for all supported currencies.
 * Falls back to empty array on network failure.
 */
export async function fetchEcbFxRates(): Promise<EcbFxRate[]> {
  const raw = await breaker.execute(async () => {
    const resp = await fetch('/api/ecb-fx', {
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data: EcbApiResponse = await resp.json();
    if (!data.rates?.length) throw new Error('Empty ECB response');
    return data;
  }, EMPTY_RESPONSE);

  hydrateCache(raw);
  return cachedRates;
}

/** Return the in-memory cached rate list — synchronous, no fetch. */
export function getCachedFxRates(): EcbFxRate[] {
  return cachedRates;
}

/**
 * Get the FX rate for a country by its ISO2 code.
 * Returns `undefined` if the country's currency is not tracked by ECB.
 */
export function getFxRateByCountry(iso2: string): EcbFxRate | undefined {
  return cacheByCountry.get(iso2);
}

/**
 * Get the FX rate for a specific ISO 4217 currency code (e.g. 'JPY').
 */
export function getFxRateByCurrency(currency: string): EcbFxRate | undefined {
  return cacheByCurrency.get(currency);
}

/**
 * Get the number of units of `currency` per 1 USD.
 * Useful for commodity pricing and supply-chain cost context.
 */
export function getVsUsd(currency: string): number | undefined {
  return cacheByCurrency.get(currency)?.vsUsd;
}
