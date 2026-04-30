import type { AlgoCondition, AlgoIndicatorRef } from './algo-types';
import type { OhlcvBar } from './market/ohlcv';

export interface AlgoIndicatorDef {
  id: string;
  label: string;
  params: Array<{ name: string; label: string; default: number; min?: number; max?: number; step?: number }>;
}

export const ALGO_OPERATORS = ['>', '<', '>=', '<=', '==', '!=', 'crosses_above', 'crosses_below'] as const;
export const ALGO_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '1d'] as const;

export const ALGO_INDICATORS: AlgoIndicatorDef[] = [
  { id: 'close', label: 'Close Price', params: [] },
  { id: 'volume', label: 'Volume', params: [] },
  { id: 'sma', label: 'SMA', params: [{ name: 'period', label: 'Period', default: 20, min: 2, max: 200, step: 1 }] },
  { id: 'ema', label: 'EMA', params: [{ name: 'period', label: 'Period', default: 20, min: 2, max: 200, step: 1 }] },
  { id: 'rsi', label: 'RSI', params: [{ name: 'period', label: 'Period', default: 14, min: 2, max: 60, step: 1 }] },
  { id: 'macd', label: 'MACD', params: [
    { name: 'fast', label: 'Fast', default: 12, min: 2, max: 60, step: 1 },
    { name: 'slow', label: 'Slow', default: 26, min: 3, max: 120, step: 1 },
    { name: 'signal', label: 'Signal', default: 9, min: 2, max: 40, step: 1 },
  ] },
  { id: 'bollinger_upper', label: 'Bollinger Upper', params: [
    { name: 'period', label: 'Period', default: 20, min: 5, max: 80, step: 1 },
    { name: 'stddev', label: 'Std Dev', default: 2, min: 1, max: 4, step: 0.25 },
  ] },
  { id: 'bollinger_lower', label: 'Bollinger Lower', params: [
    { name: 'period', label: 'Period', default: 20, min: 5, max: 80, step: 1 },
    { name: 'stddev', label: 'Std Dev', default: 2, min: 1, max: 4, step: 0.25 },
  ] },
  { id: 'volume_sma', label: 'Volume SMA', params: [{ name: 'period', label: 'Period', default: 20, min: 2, max: 100, step: 1 }] },
];

export const SCANNER_PRESETS: Array<{ id: string; label: string; conditions: AlgoCondition[] }> = [
  {
    id: 'rsi_oversold',
    label: 'RSI Oversold',
    conditions: [{
      id: 'preset_rsi_oversold',
      left: { indicator: 'rsi', params: { period: 14 } },
      operator: '<',
      compareMode: 'value',
      rightValue: 30,
    }],
  },
  {
    id: 'rsi_overbought',
    label: 'RSI Overbought',
    conditions: [{
      id: 'preset_rsi_overbought',
      left: { indicator: 'rsi', params: { period: 14 } },
      operator: '>',
      compareMode: 'value',
      rightValue: 70,
    }],
  },
  {
    id: 'macd_bullish',
    label: 'MACD Bullish',
    conditions: [{
      id: 'preset_macd_bullish',
      left: { indicator: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
      operator: '>',
      compareMode: 'value',
      rightValue: 0,
    }],
  },
  {
    id: 'bollinger_squeeze',
    label: 'Bollinger Squeeze',
    conditions: [{
      id: 'preset_bollinger_squeeze',
      left: { indicator: 'close', params: {} },
      operator: '<',
      compareMode: 'indicator',
      rightIndicator: { indicator: 'bollinger_upper', params: { period: 20, stddev: 2 } },
    }],
  },
  {
    id: 'high_volume',
    label: 'High Volume',
    conditions: [{
      id: 'preset_high_volume',
      left: { indicator: 'volume', params: {} },
      operator: '>',
      compareMode: 'indicator',
      rightIndicator: { indicator: 'volume_sma', params: { period: 20 } },
    }],
  },
];

export const DEFAULT_US_WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'TSLA', 'JPM', 'XOM'];
export const DEFAULT_NIFTY_WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'];
export const DEFAULT_BANK_NIFTY_WATCHLIST = ['JPM', 'BAC', 'GS', 'V', 'MA'];

function seriesFor(ref: AlgoIndicatorRef, bars: OhlcvBar[]): number[] {
  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => bar.volume);
  if (ref.indicator === 'close') return closes;
  if (ref.indicator === 'volume') return volumes;
  if (ref.indicator === 'sma') return movingAverage(closes, Number(ref.params.period ?? 20));
  if (ref.indicator === 'ema') return exponentialAverage(closes, Number(ref.params.period ?? 20));
  if (ref.indicator === 'rsi') return rsiSeries(closes, Number(ref.params.period ?? 14));
  if (ref.indicator === 'macd') return macdSeries(closes, Number(ref.params.fast ?? 12), Number(ref.params.slow ?? 26));
  if (ref.indicator === 'volume_sma') return movingAverage(volumes, Number(ref.params.period ?? 20));
  if (ref.indicator === 'bollinger_upper') return bollinger(closes, Number(ref.params.period ?? 20), Number(ref.params.stddev ?? 2), 'upper');
  if (ref.indicator === 'bollinger_lower') return bollinger(closes, Number(ref.params.period ?? 20), Number(ref.params.stddev ?? 2), 'lower');
  return closes;
}

export function indicatorValue(ref: AlgoIndicatorRef, bars: OhlcvBar[], index = bars.length - 1): number {
  const values = seriesFor(ref, bars);
  return values[Math.max(0, Math.min(index, values.length - 1))] ?? 0;
}

export function previousIndicatorValue(ref: AlgoIndicatorRef, bars: OhlcvBar[], index = bars.length - 1): number {
  return indicatorValue(ref, bars, Math.max(0, index - 1));
}

function movingAverage(values: number[], period: number): number[] {
  return values.map((_, index) => {
    if (index + 1 < period) return values[index] ?? 0;
    let sum = 0;
    for (let i = index - period + 1; i <= index; i += 1) sum += values[i] ?? 0;
    return sum / period;
  });
}

function exponentialAverage(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let prev = values[0] ?? 0;
  return values.map((value, index) => {
    prev = index === 0 ? value : (value * k) + (prev * (1 - k));
    return prev;
  });
}

function rsiSeries(values: number[], period: number): number[] {
  return values.map((value, index) => {
    if (index < period) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = index - period + 1; i <= index; i += 1) {
      const change = (values[i] ?? value) - (values[i - 1] ?? value);
      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  });
}

function macdSeries(values: number[], fast: number, slow: number): number[] {
  const fastSeries = exponentialAverage(values, fast);
  const slowSeries = exponentialAverage(values, slow);
  return values.map((_, index) => (fastSeries[index] ?? 0) - (slowSeries[index] ?? 0));
}

function bollinger(values: number[], period: number, mult: number, band: 'upper' | 'lower'): number[] {
  const avg = movingAverage(values, period);
  return values.map((value, index) => {
    if (index + 1 < period) return value;
    const slice = values.slice(index - period + 1, index + 1);
    const mean = avg[index] ?? value;
    const variance = slice.reduce((sum, item) => sum + (item - mean) ** 2, 0) / period;
    const sigma = Math.sqrt(variance);
    return band === 'upper' ? mean + (mult * sigma) : mean - (mult * sigma);
  });
}
