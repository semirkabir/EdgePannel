export interface Portfolio {
  id: string;
  name: string;
  owner: string;
  currency: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioAsset {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  first_purchase_date: string;
  last_updated: string;
  sector: string;
}

export type PortfolioTransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT';

export interface Transaction {
  id: string;
  portfolio_id: string;
  symbol: string;
  transaction_type: PortfolioTransactionType;
  quantity: number;
  price: number;
  total_value: number;
  transaction_date: string;
  notes: string;
  created_at: string;
}

export interface HoldingWithQuote {
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  sector: string;
  current_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  day_change: number;
  day_change_percent: number;
  weight: number;
  sparkline: number[];
  name?: string;
}

export interface PortfolioSummary {
  portfolio: Portfolio;
  holdings: HoldingWithQuote[];
  total_market_value: number;
  total_cost_basis: number;
  total_unrealized_pnl: number;
  total_unrealized_pnl_percent: number;
  total_day_change: number;
  total_day_change_percent: number;
  total_positions: number;
  gainers: HoldingWithQuote[];
  losers: HoldingWithQuote[];
  last_updated: string;
}

export interface ComputedMetrics {
  sharpe: number;
  beta: number;
  volatility: number;
  max_drawdown: number;
  var_95: number;
  cvar_95: number;
  risk_score: number;
  concentration_top3: number;
}

export interface PortfolioSnapshot {
  id: string;
  portfolio_id: string;
  total_value: number;
  total_cost_basis: number;
  total_pnl: number;
  total_pnl_percent: number;
  snapshot_date: string;
}

export type HeatmapMode = 'Pnl' | 'Weight' | 'DayChange';
export type SortColumn = 'Symbol' | 'Price' | 'Change' | 'Pnl' | 'PnlPct' | 'Weight' | 'MarketValue';
export type SortDirection = 'Asc' | 'Desc';
export type DetailView =
  | 'AnalyticsSectors'
  | 'PerfRisk'
  | 'Optimization'
  | 'QuantStats'
  | 'ReportsPme'
  | 'Indices'
  | 'RiskMgmt'
  | 'Planning'
  | 'Economics';
export type ImportMode = 'New' | 'Merge';

export interface PortfolioExportTransaction {
  date: string;
  symbol: string;
  type: PortfolioTransactionType;
  quantity: number;
  price: number;
  total_value: number;
  notes: string;
}

export interface PortfolioExportV1 {
  format_version: '1.0';
  portfolio_name: string;
  owner: string;
  currency: string;
  export_date: string;
  transactions: PortfolioExportTransaction[];
}
