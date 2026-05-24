/**
 * portfolio-types.ts
 *
 * Canonical type definitions for the Portfolio feature track.
 * These types match the Fincept porting guide's data contract so that
 * JSON exports/imports are byte-compatible between Fincept and World Monitor.
 *
 * Field names use snake_case to match the guide's Python/SQLite schema.
 */

// ─── Import / export mode ─────────────────────────────────────────────────────

/** How to handle a portfolio import when a portfolio with the same name already exists. */
export type ImportMode = 'New' | 'Merge' | 'Replace';

// ─── Transaction types ─────────────────────────────────────────────────────────

export type PortfolioTransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT' | 'TRANSFER';

// ─── Core entities ────────────────────────────────────────────────────────────

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
  /** Compound key: `${portfolio_id}:${symbol}` */
  id: string;
  portfolio_id: string;
  symbol: string;
  /** Number of shares/units currently held (reflects all replayed transactions). */
  quantity: number;
  /** Weighted average buy price per share. */
  avg_buy_price: number;
  first_purchase_date: string;
  last_updated: string;
  sector?: string;
}

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

export interface PortfolioSnapshot {
  /** Compound key: `${portfolio_id}:${snapshot_date}` */
  id: string;
  portfolio_id: string;
  snapshot_date: string;
  nav: number;
  total_cost: number;
  total_gain: number;
  total_gain_pct: number;
  positions: number;
}

// ─── View models (enriched with live market data) ─────────────────────────────

export interface HoldingWithQuote {
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  sector?: string;
  current_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  day_change: number;
  day_change_percent: number;
  /** Percentage weight in the total portfolio. */
  weight: number;
  /** Recent closing prices for sparkline rendering. */
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

// ─── Computed risk/performance metrics ───────────────────────────────────────

export interface ComputedMetrics {
  /** Annualised Sharpe ratio. */
  sharpe: number;
  beta: number;
  volatility: number;         // annualised std dev of daily returns
  max_drawdown: number;       // as a decimal e.g. -0.23
  var_95: number;             // Value at Risk 95th percentile (negative)
  cvar_95: number;            // Conditional VaR / Expected Shortfall
  concentration_top3: number; // combined weight of top-3 positions
  risk_score: number;         // 0–100 composite
}

// ─── Import / export contract ─────────────────────────────────────────────────

/** Transaction-replay export format.  Field names must stay stable to preserve
 *  round-trip compatibility with Fincept's own parser. */
export interface PortfolioExportTransaction {
  date: string;
  symbol: string;
  type: PortfolioTransactionType;
  quantity: number;
  price: number;
  total_value: number;
  notes?: string;
}

export interface PortfolioExportV1 {
  format_version: '1.0';
  portfolio_name: string;
  owner?: string;
  currency?: string;
  export_date: string;
  transactions: PortfolioExportTransaction[];
}

// ─── UI enums ─────────────────────────────────────────────────────────────────

export type HeatmapMode = 'pnl' | 'weight' | 'dayChange';
export type SortColumn = 'symbol' | 'value' | 'pnl' | 'pnlPct' | 'weight' | 'dayChange';
export type SortDirection = 'asc' | 'desc';

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
