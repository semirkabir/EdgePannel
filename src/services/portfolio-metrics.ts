import type { ComputedMetrics, HoldingWithQuote } from './portfolio-types';

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function returnsFromValues(values: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1] ?? 0;
    const current = values[i] ?? 0;
    if (previous > 0) returns.push((current - previous) / previous);
  }
  return returns;
}

export function sharpeRatio(returns: number[], riskFreeDaily = 0): number {
  if (returns.length < 2) return 0;
  const excess = returns.map((value) => value - riskFreeDaily);
  const sd = standardDeviation(excess);
  return sd === 0 ? 0 : (mean(excess) / sd) * Math.sqrt(252);
}

export function sortinoRatio(returns: number[], riskFreeDaily = 0): number {
  if (returns.length < 2) return 0;
  const excess = returns.map((value) => value - riskFreeDaily);
  const downside = excess.filter((value) => value < 0);
  const downsideDeviation = standardDeviation(downside);
  return downsideDeviation === 0 ? 0 : (mean(excess) / downsideDeviation) * Math.sqrt(252);
}

export function annualizedVolatility(returns: number[]): number {
  return standardDeviation(returns) * Math.sqrt(252);
}

export function maxDrawdown(values: number[]): number {
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    if (peak > 0) {
      maxDd = Math.min(maxDd, (value - peak) / peak);
    }
  }
  return maxDd;
}

export function valueAtRisk(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.max(0, Math.floor((1 - confidence) * sorted.length));
  return Math.abs(sorted[index] ?? 0);
}

export function conditionalValueAtRisk(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.max(1, Math.floor((1 - confidence) * sorted.length));
  return Math.abs(mean(sorted.slice(0, cutoff)));
}

export function concentrationTop3(holdings: HoldingWithQuote[]): number {
  return holdings
    .map((holding) => holding.weight)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, value) => sum + value, 0);
}

export function riskScore(input: {
  volatility: number;
  maxDrawdown: number;
  concentrationTop3: number;
  var95: number;
}): number {
  const volScore = Math.min(35, input.volatility * 100);
  const drawdownScore = Math.min(30, Math.abs(input.maxDrawdown) * 100);
  const concentrationScore = Math.min(25, input.concentrationTop3 * 0.25);
  const varScore = Math.min(10, input.var95 * 250);
  return Math.round(Math.max(0, Math.min(100, volScore + drawdownScore + concentrationScore + varScore)));
}

export function computePortfolioMetrics(
  holdings: HoldingWithQuote[],
  portfolioValues: number[],
  benchmarkValues: number[] = [],
): ComputedMetrics {
  const returns = returnsFromValues(portfolioValues);
  const benchmarkReturns = returnsFromValues(benchmarkValues);
  const volatility = annualizedVolatility(returns);
  const mdd = maxDrawdown(portfolioValues);
  const var95 = valueAtRisk(returns);
  const cvar95 = conditionalValueAtRisk(returns);
  const concentration = concentrationTop3(holdings);

  let beta = 1;
  if (returns.length > 1 && benchmarkReturns.length === returns.length) {
    const meanReturns = mean(returns);
    const meanBenchmark = mean(benchmarkReturns);
    const covariance = mean(returns.map((value, index) => (value - meanReturns) * ((benchmarkReturns[index] ?? 0) - meanBenchmark)));
    const benchmarkVariance = standardDeviation(benchmarkReturns) ** 2;
    beta = benchmarkVariance === 0 ? 1 : covariance / benchmarkVariance;
  }

  return {
    sharpe: sharpeRatio(returns),
    beta,
    volatility,
    max_drawdown: mdd,
    var_95: var95,
    cvar_95: cvar95,
    risk_score: riskScore({ volatility, maxDrawdown: mdd, concentrationTop3: concentration, var95 }),
    concentration_top3: concentration,
  };
}
