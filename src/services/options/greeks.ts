export type OptionSide = 'call' | 'put';

export interface OptionGreeksInput {
  underlyingPrice: number;
  strikePrice: number;
  yearsToExpiry: number;
  impliedVolatility: number;
  side: OptionSide;
  riskFreeRate?: number;
  dividendYield?: number;
}

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

const DEFAULT_RISK_FREE_RATE = 0.045;
const SQRT_2PI = Math.sqrt(2 * Math.PI);

function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);

  // Abramowitz and Stegun 7.1.26. Max error around 1.5e-7.
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Normalize implied volatility to a decimal fraction (e.g. 0.20 = 20% vol).
 *
 * Finnhub returns IV as a decimal (0.20) but some data sources emit percent-style
 * values (20.0). The heuristic `value > 3` treats values above 3.0 as percent-style
 * and divides by 100. This works for the realistic vol range (0%–300%), but will
 * misclassify extreme vols (e.g. 320% would be treated as 3.20 decimal).
 *
 * Callers should normalize to decimal before passing where possible.
 */
function normalizeVolatility(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Heuristic: values > 3 are assumed to be percent-style (e.g. 20 → 0.20).
  // Valid for realistic IV range 0–300%; may misclassify extreme values above 300%.
  return value > 3 ? value / 100 : value;
}

export function yearsToExpiry(expirationDate: string, now = new Date()): number {
  const expiry = new Date(`${expirationDate}T21:00:00.000Z`);
  const ms = expiry.getTime() - now.getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(ms / (365 * 24 * 60 * 60 * 1000), 1 / 365);
}

export function calculateOptionGreeks(input: OptionGreeksInput): OptionGreeks | null {
  const spot = input.underlyingPrice;
  const strike = input.strikePrice;
  const time = input.yearsToExpiry;
  const volatility = normalizeVolatility(input.impliedVolatility);
  const rate = input.riskFreeRate ?? DEFAULT_RISK_FREE_RATE;
  const dividendYield = input.dividendYield ?? 0;

  if (
    spot <= 0
    || strike <= 0
    || time <= 0
    || volatility <= 0
    || !Number.isFinite(spot)
    || !Number.isFinite(strike)
    || !Number.isFinite(time)
    || !Number.isFinite(rate)
    || !Number.isFinite(dividendYield)
  ) {
    return null;
  }

  const sqrtTime = Math.sqrt(time);
  const volSqrtTime = volatility * sqrtTime;
  const d1 = (Math.log(spot / strike) + (rate - dividendYield + 0.5 * volatility * volatility) * time) / volSqrtTime;
  const d2 = d1 - volSqrtTime;
  const discountDividend = Math.exp(-dividendYield * time);
  const discountRate = Math.exp(-rate * time);
  const pdfD1 = normalPdf(d1);
  const isCall = input.side === 'call';

  const delta = isCall
    ? discountDividend * normalCdf(d1)
    : discountDividend * (normalCdf(d1) - 1);
  const gamma = discountDividend * pdfD1 / (spot * volSqrtTime);
  const vega = spot * discountDividend * pdfD1 * sqrtTime / 100;
  const thetaAnnual = isCall
    ? -(spot * discountDividend * pdfD1 * volatility) / (2 * sqrtTime)
      - rate * strike * discountRate * normalCdf(d2)
      + dividendYield * spot * discountDividend * normalCdf(d1)
    : -(spot * discountDividend * pdfD1 * volatility) / (2 * sqrtTime)
      + rate * strike * discountRate * normalCdf(-d2)
      - dividendYield * spot * discountDividend * normalCdf(-d1);
  const rho = isCall
    ? strike * time * discountRate * normalCdf(d2) / 100
    : -strike * time * discountRate * normalCdf(-d2) / 100;

  return {
    delta,
    gamma,
    theta: thetaAnnual / 365,
    vega,
    rho,
  };
}
