export type AlgoTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '1d';
export type AlgoConditionJoin = 'AND' | 'OR';
export type AlgoCompareMode = 'value' | 'indicator';
export type AlgoOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'crosses_above' | 'crosses_below';
export type AlgoDeploymentMode = 'paper' | 'live';
export type AlgoDeploymentStatus = 'running' | 'stopped' | 'error';

export interface AlgoIndicatorRef {
  indicator: string;
  params: Record<string, number | string | boolean>;
  field?: string;
}

export interface AlgoCondition {
  id: string;
  left: AlgoIndicatorRef;
  operator: AlgoOperator;
  compareMode: AlgoCompareMode;
  rightValue?: number | string | boolean;
  rightIndicator?: AlgoIndicatorRef;
}

export interface AlgoRiskSettings {
  stopLossPct: number;
  takeProfitPct: number;
  trailingStopPct: number;
  positionSizePct: number;
}

export interface AlgoStrategy {
  id: string;
  name: string;
  description: string;
  symbol: string;
  timeframe: AlgoTimeframe;
  entryJoin: AlgoConditionJoin;
  exitJoin: AlgoConditionJoin;
  entryConditions: AlgoCondition[];
  exitConditions: AlgoCondition[];
  risk: AlgoRiskSettings;
  created_at: string;
  updated_at: string;
}

export interface AlgoBacktestRequest {
  strategy: AlgoStrategy;
  capital: number;
  start: string;
  end: string;
}

export interface AlgoBacktestResult {
  strategy_id: string;
  symbol: string;
  total_return: number;
  max_drawdown: number;
  total_trades: number;
  win_rate: number;
  equity_curve: Array<{ date: string; equity: number }>;
}

export interface AlgoScanRequest {
  preset?: string;
  symbols: string[];
  conditions: AlgoCondition[];
  join: AlgoConditionJoin;
}

export interface AlgoScanMatch {
  symbol: string;
  price: number;
  signal: string;
  matched: boolean;
  timestamp: string;
}

export interface AlgoDeployment {
  id: string;
  strategy_id: string;
  strategy_name: string;
  mode: AlgoDeploymentMode;
  status: AlgoDeploymentStatus;
  symbol: string;
  pnl: number;
  trades: number;
  win_rate: number;
  drawdown: number;
  created_at: string;
  updated_at: string;
}

export interface AlgoTrade {
  id: string;
  deployment_id: string;
  strategy_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  mode: AlgoDeploymentMode;
}
