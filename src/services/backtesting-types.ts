import type { OhlcvBar } from './market/ohlcv';

export type BacktestProviderId = 'vectorbt' | 'backtesting.py' | 'fasttrade' | 'zipline' | 'bt' | 'fincept';

export type BacktestProviderRuntime = 'browser' | 'desktop_sidecar';

export interface BacktestProviderInfo {
  id: BacktestProviderId;
  label: string;
  runtime: BacktestProviderRuntime;
  available: boolean;
  status_label: string;
  description: string;
}

export type BacktestCommand =
  | 'run'
  | 'optimize'
  | 'walk_forward'
  | 'indicators'
  | 'indicator_signals'
  | 'ml_labels'
  | 'cv_splits'
  | 'returns_analysis'
  | 'signal_generators';

export type BacktestParamType = 'number' | 'integer' | 'select' | 'boolean' | 'text';

export interface BacktestStrategyParam {
  name: string;
  label: string;
  type: BacktestParamType;
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface BacktestStrategy {
  id: string;
  name: string;
  category: string;
  description: string;
  params: BacktestStrategyParam[];
}

export interface BacktestExecutionSettings {
  capital: number;
  commission: number;
  slippage: number;
  leverage: number;
  stop_loss?: number;
  take_profit?: number;
  sizing: 'fixed' | 'percent';
  allow_short: boolean;
  benchmark: string;
}

export interface BacktestMarketDataSettings {
  symbols: string[];
  start: string;
  end: string;
}

export interface BacktestRunRequest {
  provider: BacktestProviderId;
  command: BacktestCommand;
  strategy_id: string;
  strategy_name: string;
  params: Record<string, string | number | boolean>;
  market_data: BacktestMarketDataSettings;
  execution: BacktestExecutionSettings;
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'SHORT' | 'COVER';
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  return_pct: number;
}

export interface BacktestResultMetrics {
  total_return: number;
  annual_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  profit_factor: number;
  volatility: number;
}

export interface BacktestEquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

export interface BacktestResultEnvelope {
  format_version: '1.0';
  provider: BacktestProviderId;
  command: BacktestCommand;
  strategy_name: string;
  symbols: string[];
  status: 'ok' | 'error' | 'provider_unavailable';
  message: string;
  metrics: BacktestResultMetrics;
  equity_curve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  raw: Record<string, unknown>;
}

export interface BacktestRunRecord extends BacktestResultEnvelope {
  id: string;
  created_at: string;
  request: BacktestRunRequest;
}

export interface BacktestWorkerRunPayload {
  request: BacktestRunRequest;
  barsBySymbol: Record<string, OhlcvBar[]>;
}
