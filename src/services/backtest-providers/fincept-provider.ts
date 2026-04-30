import type { BacktestCommand, BacktestStrategy } from '../backtesting-types';

export const FINCEPT_PROVIDER_ID = 'fincept' as const;

export const FINCEPT_STRATEGIES: BacktestStrategy[] = [
  {
    id: 'sma_crossover',
    name: 'SMA Crossover',
    category: 'Trend Following',
    description: 'Long when the fast simple moving average crosses above the slow average.',
    params: [
      { name: 'fast_window', label: 'Fast SMA', type: 'integer', default: 20, min: 2, max: 100, step: 1 },
      { name: 'slow_window', label: 'Slow SMA', type: 'integer', default: 50, min: 5, max: 240, step: 1 },
    ],
  },
  {
    id: 'rsi_mean_reversion',
    name: 'RSI Mean Reversion',
    category: 'Mean Reversion',
    description: 'Buys oversold RSI readings and exits when momentum normalizes.',
    params: [
      { name: 'period', label: 'RSI Period', type: 'integer', default: 14, min: 2, max: 60, step: 1 },
      { name: 'oversold', label: 'Oversold', type: 'number', default: 30, min: 5, max: 45, step: 1 },
      { name: 'exit_level', label: 'Exit RSI', type: 'number', default: 55, min: 45, max: 80, step: 1 },
    ],
  },
  {
    id: 'bollinger_breakout',
    name: 'Bollinger Breakout',
    category: 'Breakout',
    description: 'Buys closes above the upper band and exits below the middle band.',
    params: [
      { name: 'period', label: 'Band Period', type: 'integer', default: 20, min: 5, max: 80, step: 1 },
      { name: 'stddev', label: 'Std Dev', type: 'number', default: 2, min: 1, max: 4, step: 0.25 },
    ],
  },
  {
    id: 'momentum',
    name: 'Momentum',
    category: 'Momentum',
    description: 'Ranks recent return and holds when lookback momentum is positive.',
    params: [
      { name: 'lookback', label: 'Lookback', type: 'integer', default: 30, min: 5, max: 120, step: 1 },
      { name: 'threshold', label: 'Threshold %', type: 'number', default: 2, min: -10, max: 20, step: 0.5 },
    ],
  },
];

export const FINCEPT_COMMANDS: Array<{ id: BacktestCommand; label: string }> = [
  { id: 'run', label: 'Run' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'walk_forward', label: 'Walk-Forward' },
  { id: 'indicators', label: 'Indicators' },
  { id: 'indicator_signals', label: 'Indicator Signals' },
  { id: 'ml_labels', label: 'ML Labels' },
  { id: 'cv_splits', label: 'CV Splits' },
  { id: 'returns_analysis', label: 'Returns Analysis' },
  { id: 'signal_generators', label: 'Signal Generators' },
];

export const FINCEPT_INDICATORS = [
  { id: 'sma', label: 'Simple Moving Average', params: ['period'] },
  { id: 'ema', label: 'Exponential Moving Average', params: ['period'] },
  { id: 'rsi', label: 'Relative Strength Index', params: ['period'] },
  { id: 'macd', label: 'MACD', params: ['fast', 'slow', 'signal'] },
  { id: 'bollinger', label: 'Bollinger Bands', params: ['period', 'stddev'] },
  { id: 'atr', label: 'Average True Range', params: ['period'] },
  { id: 'volume_sma', label: 'Volume SMA', params: ['period'] },
] as const;

export function normalizeStrategyParams(
  strategy: BacktestStrategy,
  values: Record<string, FormDataEntryValue | string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const param of strategy.params) {
    const raw = values[param.name] ?? param.default;
    if (param.type === 'boolean') out[param.name] = raw === true || raw === 'true' || raw === 'on';
    else if (param.type === 'number' || param.type === 'integer') out[param.name] = Number(raw);
    else out[param.name] = String(raw);
  }
  return out;
}
