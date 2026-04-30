# Fincept Terminal Porting Guide: Portfolio, Backtesting, Algo Trading, Node Editor

This guide is a handoff for implementing four Fincept Terminal surfaces in another situation-monitor or terminal app. Port the behavior, data contracts, workflows, and service boundaries. Do not copy the Qt visual style unless your target app intentionally wants that look.

The screenshots describe the desired desktop information architecture. The codebase describes the source of truth for data shapes and actions.

## How To Use This Guide

- Treat Qt widgets and signals as target-app screens, components, events, commands, and state updates.
- Preserve JSON shapes, model fields, command names, and service boundaries where possible.
- Keep the target app's own UI system and style. The port should feel native to the target app while using the same financial data and function.
- Build the four requested categories only: `portfolio`, `backtesting`, `algo_trading`, and `node_editor`.

## Source Map

Use these files as the canonical references:

- Portfolio UI and types: `fincept-qt/src/screens/portfolio/**`
- Portfolio service: `fincept-qt/src/services/portfolio/**`
- Portfolio storage: `fincept-qt/src/storage/repositories/PortfolioRepository.*`
- Portfolio migrations: `fincept-qt/src/storage/sqlite/migrations/v006_portfolio_multi.cpp`, `v019_sector_cache.cpp`
- Portfolio demo data: `fincept-qt/resources/demo_portfolio.json`
- Backtesting UI and service: `fincept-qt/src/screens/backtesting/**`, `fincept-qt/src/services/backtesting/**`
- Backtesting Python providers: `fincept-qt/scripts/Analytics/backtesting/**`
- Backtesting process notes: `fincept-qt/docs/backtesting-provider-process.md`
- Algo UI and service: `fincept-qt/src/screens/algo_trading/**`, `fincept-qt/src/services/algo_trading/**`
- Algo Python engines: `fincept-qt/scripts/algo_trading/**`
- Node editor UI and types: `fincept-qt/src/screens/node_editor/**`
- Workflow service and node registry: `fincept-qt/src/services/workflow/**`
- Workflow storage: `fincept-qt/src/storage/repositories/WorkflowRepository.*`
- Workflow migration: `fincept-qt/src/storage/sqlite/migrations/v008_workflows.cpp`

## Shared Implementation Pattern

The source app is a Qt/C++ shell backed by Python subprocesses for analytics and trading engines.

- UI screens own layout, presentation, local state, and event wiring.
- Services expose user actions and async callbacks. In the target app, these can become stores, hooks, commands, RPC handlers, or backend endpoints.
- Storage is SQLite through repositories for portfolio and workflows. Algo uses Python scripts directly against SQLite for strategy/deployment tables.
- Python commands return JSON on stdout. The C++ side extracts the JSON and emits result events.
- Most screens are stateful. Save/restore selected provider, active tab, portfolio id, active workflow id, etc.

---

# 1. Portfolio

## Desktop Anatomy From Screenshot

The Portfolio desktop screen is a dense terminal-style portfolio monitor.

- Global nav highlights `PORTFOLIO`.
- Local tab/title line shows `Portfolio`.
- Command bar row:
  - Portfolio selector, e.g. `DEMO PORTFOLIO (USD)`.
  - Inline NAV, P&L, day change, and position count.
  - Actions: `BUY`, `SELL`, `DIV`.
  - Detail tabs: `SECTORS`, `PERF/RISK`, `OPTIMIZE`, `QUANTSTATS`, `REPORTS`, `INDICES`, `RISK`, `PLANNING`, `ECONOMICS`.
  - AI/agent buttons on the right.
  - Refresh interval control.
- KPI strip:
  - Total value, unrealized P&L, day change, positions.
  - Risk/stat chips: cost, concentration, Sharpe, beta, 30-day volatility, MDD, VaR 95%, risk score.
- Left rail:
  - Holding heatmap tiles with symbol and P&L percent.
  - Selected symbol facts: price, day change, qty, cost, market value, P&L, weight.
  - Risk score, top movers, holdings count, concentration, volatility.
- Main center:
  - Performance chart with period selectors.
  - NAV and cost basis labels.
  - Positions table with sortable columns and sparklines.
  - Transaction history panel below.
- Right rail:
  - Sector allocation donut and legend.
  - Correlation matrix.
  - Filter input for positions.
- Bottom status:
  - Product/version text, selected portfolio, live status, position count, NAV/P&L/time, ready state.

## Core Models

Source: `fincept-qt/src/screens/portfolio/PortfolioTypes.h`

```cpp
Portfolio {
  id, name, owner, currency = "USD", description, created_at, updated_at
}

PortfolioAsset {
  id, portfolio_id, symbol, quantity, avg_buy_price,
  first_purchase_date, last_updated, sector
}

Transaction {
  id, portfolio_id, symbol, transaction_type, quantity, price,
  total_value, transaction_date, notes, created_at
}

HoldingWithQuote {
  symbol, quantity, avg_buy_price, sector,
  current_price, market_value, cost_basis,
  unrealized_pnl, unrealized_pnl_percent,
  day_change, day_change_percent, weight
}

PortfolioSummary {
  portfolio, holdings,
  total_market_value, total_cost_basis,
  total_unrealized_pnl, total_unrealized_pnl_percent,
  total_day_change, total_day_change_percent,
  total_positions, gainers, losers, last_updated
}

ComputedMetrics {
  sharpe, beta, volatility, max_drawdown,
  var_95, cvar_95, risk_score, concentration_top3
}

PortfolioSnapshot {
  id, portfolio_id, total_value, total_cost_basis,
  total_pnl, total_pnl_percent, snapshot_date
}
```

Enums:

- `HeatmapMode`: `Pnl`, `Weight`, `DayChange`
- `SortColumn`: `Symbol`, `Price`, `Change`, `Pnl`, `PnlPct`, `Weight`, `MarketValue`
- `SortDirection`: `Asc`, `Desc`
- `DetailView`: `AnalyticsSectors`, `PerfRisk`, `Optimization`, `QuantStats`, `ReportsPme`, `Indices`, `RiskMgmt`, `Planning`, `Economics`
- `ImportMode`: `New`, `Merge`

## Import/Export Contract

Portfolio JSON import/export is transaction-replay based. Holdings-only snapshots are rejected unless converted to transactions first.

```json
{
  "format_version": "1.0",
  "portfolio_name": "Demo Portfolio",
  "owner": "Fincept User",
  "currency": "USD",
  "export_date": "2025-01-15T00:00:00Z",
  "transactions": [
    {
      "date": "2024-01-15",
      "symbol": "AAPL",
      "type": "BUY",
      "quantity": 15,
      "price": 178.50,
      "total_value": 2677.50,
      "notes": "Core tech position"
    }
  ]
}
```

Valid transaction types: `BUY`, `SELL`, `DIVIDEND`, `SPLIT`.

The demo portfolio contains 12 positions: `AAPL`, `MSFT`, `GOOGL`, `NVDA`, `AMZN`, `TSLA`, `JPM`, `JNJ`, `XOM`, `V`, `UNH`, `PG`.

## Storage Schema

Source migrations: `v006_portfolio_multi.cpp`, `v019_sector_cache.cpp`.

Tables:

- `portfolios`
  - `id TEXT PRIMARY KEY`
  - `name TEXT NOT NULL`
  - `owner TEXT NOT NULL DEFAULT ''`
  - `currency TEXT NOT NULL DEFAULT 'USD'`
  - `description TEXT DEFAULT ''`
  - `created_at`, `updated_at`
- `portfolio_assets`
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE`
  - `symbol TEXT NOT NULL`
  - `quantity REAL NOT NULL DEFAULT 0`
  - `avg_buy_price REAL NOT NULL DEFAULT 0`
  - `first_purchase_date`, `last_updated`
  - `sector TEXT DEFAULT ''`
  - unique key: `(portfolio_id, symbol)`
- `portfolio_transactions`
  - `id TEXT PRIMARY KEY`
  - `portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE`
  - `symbol TEXT NOT NULL`
  - `transaction_type TEXT NOT NULL CHECK IN ('BUY','SELL','DIVIDEND','SPLIT')`
  - `quantity`, `price`, `total_value`, `transaction_date`, `notes`, `created_at`
- `portfolio_snapshots`
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE`
  - `total_value`, `total_cost_basis`, `total_pnl`, `total_pnl_percent`
  - `snapshot_date TEXT NOT NULL`
  - unique key: `(portfolio_id, snapshot_date)`
- `sector_cache`
  - `symbol TEXT PRIMARY KEY`
  - `sector`, `industry`, `quote_type`, `resolved_at`

Required indexes:

- `idx_pa_portfolio` on `portfolio_assets(portfolio_id)`
- `idx_ptx_portfolio` on `portfolio_transactions(portfolio_id)`
- `idx_ptx_date` on `portfolio_transactions(transaction_date)`
- `idx_ps_portfolio` on `portfolio_snapshots(portfolio_id)`

## Repository Contract

Source: `PortfolioRepository.h`

Implement these capabilities:

- `list_portfolios()`
- `get_portfolio(id)`
- `create_portfolio(name, owner, currency, description)`
- `update_portfolio(id, name, owner, currency, description)`
- `delete_portfolio(id)`
- `get_assets(portfolio_id)`
- `add_asset(portfolio_id, symbol, qty, price, date, sector)`
- `update_asset(portfolio_id, symbol, qty, avg_price)`
- `set_asset_sector(portfolio_id, symbol, sector)`
- `remove_asset(portfolio_id, symbol)`
- `get_transactions(portfolio_id, limit)`
- `get_symbol_transactions(portfolio_id, symbol)`
- `add_transaction(portfolio_id, symbol, type, qty, price, date, notes)`
- `update_transaction(id, qty, price, date, notes)`
- `delete_transaction(id)`
- `save_snapshot(portfolio_id, value, cost_basis, pnl, pnl_pct, date)`
- `get_snapshots(portfolio_id, days)`

## Service Contract

Source: `PortfolioService.h/.cpp`

Expose these actions/events in the target app:

- Portfolio CRUD:
  - `load_portfolios`
  - `create_portfolio`
  - `delete_portfolio`
- Summary:
  - `load_summary(portfolio_id)`
  - `refresh_summary(portfolio_id)`
  - `invalidate_cache(portfolio_id)`
- Trading/accounting:
  - `add_asset`
  - `sell_asset`
  - `record_dividend`
  - `load_transactions`
  - `update_transaction`
  - `delete_transaction`
- Analytics:
  - `fetch_correlation(symbols)`
  - `fetch_benchmark_history(symbol = "SPY", period = "1y")`
  - `fetch_spy_history(period = "1y")`
  - `fetch_risk_free_rate`
  - `compute_metrics(summary)`
  - `load_snapshots(portfolio_id, days = 365)`
  - `backfill_history(portfolio_id, period = "1y")`
- I/O:
  - `export_csv`
  - `export_json`
  - `import_json(file_path, mode, merge_target_id)`

Important emitted events:

- `portfolios_loaded`
- `portfolio_created`
- `portfolio_deleted`
- `summary_loaded`
- `summary_error`
- `transactions_loaded`
- `metrics_computed`
- `snapshots_loaded`
- `asset_added`
- `asset_sold`
- `export_complete`
- `import_complete`
- `correlation_computed`
- `benchmark_history_loaded`
- `risk_free_rate_loaded`
- `history_backfilled`

## Summary Calculation Flow

1. Load portfolio and assets from SQLite.
2. Batch-fetch quotes through `MarketDataService::fetch_quotes`.
3. For each asset:
   - Resolve or persist sector through `SectorResolver`.
   - Use current quote if available, otherwise fallback to average buy price.
   - Calculate market value, cost basis, unrealized P&L, day change, and weight.
4. Aggregate portfolio totals.
5. Cache the summary.
6. Save a daily snapshot keyed by portfolio/date.
7. Emit `summary_loaded`.

## Analytics Views Under Portfolio

The detail tabs are actual subviews, not placeholder labels.

- `SECTORS` / `AnalyticsSectorsView`
  - Overview and correlation tabs.
  - Computes sector rollups from holdings.
  - Shows sector KPIs, donut, sector table, best/worst performers, concentration, and correlation.
  - Emits `sector_selected` to filter the positions blotter.
- `PERF/RISK` / `PerformanceRiskView`
  - Uses snapshots and summary data.
  - Shows performance chart and risk metrics such as VaR.
- `OPTIMIZE` / `PortfolioOptimizationView`
  - Nine tabs: optimize, frontier, allocation, strategies, compare, backtest, risk, stress, Black-Litterman.
  - Calls Python optimizer via `PortfolioAnalyticsService::optimize_weights`.
- `QUANTSTATS` / `QuantStatsView`
  - Five tabs: metrics, returns, drawdown, rolling, Monte Carlo.
  - Calls Python through `PortfolioAnalyticsService::run_quantstats` and `run_monte_carlo`.
- `REPORTS` / `ReportsView`
  - Summary, transactions, attribution.
  - Reads transactions through `PortfolioRepository`.
- `INDICES` / `CustomIndexView`
  - Creates and stores custom indices through `CustomIndexRepository`.
- `RISK` / `RiskManagementView`
  - Risk overview, contribution, stress tests.
- `PLANNING` / `PlanningView`
  - Retirement planning, goals, savings.
- `ECONOMICS` / `EconomicsView`
  - Macro exposure and sensitivity-style panels.

## Portfolio Port Checklist

- Build the screen shell with command bar, KPI strip, left heatmap rail, central chart/table/history, and right analytics rail.
- Implement the exact portfolio data models and transaction import/export shape.
- Implement SQLite or equivalent persistence with the same tables and uniqueness rules.
- Implement summary construction from holdings plus quotes.
- Preserve sector mapping, benchmark history, snapshot backfill, and computed metric behavior.
- Support all detail tabs, even if some start as lightweight panels in v1.
- Wire create/delete/buy/sell/dividend/import/export/refresh actions as events.
- Add demo import from `resources/demo_portfolio.json`.

---

# 2. Backtesting

## Desktop Anatomy From Screenshot

The Backtesting screen is a provider-driven command console.

- Global nav highlights `BACKTEST`.
- Local screen title: `Backtesting`.
- Top provider strip:
  - `VectorBT`, `Backtesting.py`, `FastTrade`, `Zipline`, `BT`, `Fincept`.
  - `RUN` button on the right.
  - Status badge: `READY`.
- Left panel:
  - Command list: `Run Backtest`, `Optimize`, `Walk-Forward`, `Indicators`, `Indicator Signals`, `ML Labels`, `CV Splits`, `Returns Analysis`, `Signal Generators`.
  - Strategy category selector.
  - Strategy selector.
  - Strategy parameter controls generated dynamically.
- Center panel:
  - Result tabs: `SUMMARY`, `METRICS`, `TRADES`, `RAW JSON`.
  - Empty state explains supported providers and commands.
  - `EXPORT JSON` action.
- Right panel:
  - Market data: `SYMBOLS`, start/end.
  - Execution: initial capital, commission, slippage.
  - Advanced: leverage, stop loss, take profit, position sizing, allow short selling, benchmark.
- Bottom bar:
  - Provider count, strategy count, version, readiness.

## Provider Definitions

Source: `BacktestingTypes.h`

| Provider slug | Display | Commands exposed in C++ |
|---|---|---|
| `vectorbt` | VectorBT | `backtest`, `optimize`, `walk_forward`, `indicator`, `indicator_signals`, `labels`, `splits`, `returns`, `signals` |
| `backtestingpy` | Backtesting.py | `backtest`, `optimize`, `walk_forward`, `indicator` |
| `fasttrade` | FastTrade | `backtest` |
| `zipline` | Zipline | `backtest`, `optimize`, `walk_forward`, `indicator`, `indicator_signals` |
| `bt` | BT | `backtest`, `optimize`, `walk_forward`, `indicator`, `indicator_signals` |
| `fincept` | Fincept | `backtest`, `optimize`, `walk_forward` |

Command labels:

- `backtest`: Run Backtest
- `optimize`: Optimize
- `walk_forward`: Walk-Forward
- `indicator`: Indicators
- `indicator_signals`: Indicator Signals
- `labels`: ML Labels
- `splits`: CV Splits
- `returns`: Returns Analysis
- `signals`: Signal Generators

## Backtesting Data Models And Contracts

The C++ side uses lightweight structs plus JSON objects returned by the Python providers. Keep the target app schema compatible with these shapes even if the implementation language differs.

```cpp
BacktestProvider {
  slug, display_name, commands
}

BacktestStrategy {
  id, name, category, parameters
}

BacktestParameter {
  name_or_id, label, default_value, min, max, step,
  options, type
}

BacktestCommandOptions {
  position_sizing, optimize_objectives, optimize_methods,
  label_types, splitter_types, signal_generators,
  indicator_signal_modes, returns_analysis_types
}

BacktestRequest {
  provider, command, args_json
}

BacktestResultEnvelope {
  success, message, data, error
}
```

The UI treats provider metadata as dynamic. Do not hard-code strategy categories beyond fallback defaults. The source app can accept both object-grouped and array-based strategy payloads, so the port should normalize both.

## Python Command Mapping

Source: `BacktestingService.cpp`

The UI uses short command ids. The service maps some to Python provider command names:

| UI command | Python command |
|---|---|
| `backtest` | `run_backtest` |
| `indicator` | `calculate_indicator` |
| `signals` | `generate_signals` |
| `labels` | `generate_labels` |
| `splits` | `generate_splits` |
| `returns` | `analyze_returns` |
| `optimize` | `optimize` |
| `walk_forward` | `walk_forward` |
| `indicator_signals` | `indicator_signals` |

Python script path pattern:

```text
Analytics/backtesting/{provider}/{provider}_provider.py
```

The subprocess call shape is:

```text
python {provider}_provider.py <python_command> <json_args>
```

Dynamic loading:

```text
python {provider}_provider.py get_strategies {}
python {provider}_provider.py get_command_options {}
python {provider}_provider.py get_indicators {}
```

Strategies and command options are cached for 10 minutes.

## Strategy and Indicator Loading

Python is the source of truth.

- `default_strategies()` returns an empty list in C++.
- `all_indicators()` returns an empty list in C++.
- `BacktestingService::load_strategies(provider)` calls provider `get_strategies`.
- `BacktestingService::load_command_options(provider)` calls `get_command_options`.
- On provider switch, the screen loads strategies, command options, and indicators.

Supported strategy JSON shapes:

```json
{
  "success": true,
  "data": {
    "strategies": {
      "Trend": [
        {
          "id": "sma_crossover",
          "name": "SMA Crossover",
          "params": [
            {"name": "fast_period", "label": "Fast Period", "default": 10, "min": 1, "max": 200, "step": 1}
          ]
        }
      ]
    }
  }
}
```

VectorBT can return an array:

```json
{
  "success": true,
  "data": [
    {
      "type": "sma_crossover",
      "name": "SMA Crossover",
      "category": "Trend",
      "parameters": [
        {"id": "fast_window", "name": "Fast Window", "default": 10, "min": 1, "max": 200, "step": 1}
      ]
    }
  ]
}
```

Parameter normalizer:

- Name key: `name` if present, else `id`.
- Label key: `label` if present, else `name`.
- Numeric controls use `default`, `min`, `max`, `step`.

## Backtesting Service/API Contract And Dependencies

Primary service actions:

- `load_strategies(provider)`
- `load_command_options(provider)`
- `load_indicators(provider)`
- `run_command(provider, command, args)`
- `export_result_json(result)`
- `clear_result()`

Primary events or callbacks:

- `strategies_loaded(provider, strategies_by_category)`
- `command_options_loaded(provider, options)`
- `indicators_loaded(provider, indicators)`
- `command_started(provider, command)`
- `command_finished(provider, command, result)`
- `command_failed(provider, command, error)`

Runtime dependencies:

- Python interpreter available to the app process.
- Provider scripts under `scripts/Analytics/backtesting/**`.
- Provider-specific Python packages, for example VectorBT, Backtesting.py, FastTrade, Zipline, and BT if those providers are enabled.
- JSON stdout contract. Providers may print logs, so the service extracts the JSON object from stdout rather than assuming stdout is pure JSON.
- In-memory caches for strategies and command options with a 10 minute TTL.

Storage behavior:

- There is no dedicated backtesting SQLite schema in the cited code.
- Persist only UI/session state in the target app unless the target product needs a backtest history table.
- Exported result JSON is generated from the last provider result and should not mutate source data.

## Backtesting Argument Contract

Source: `BacktestingScreen::gather_args()`

Base args always include:

```json
{
  "symbols": ["SPY"],
  "startDate": "2025-04-29",
  "endDate": "2026-04-28"
}
```

Backtest/optimize/walk-forward commands add:

```json
{
  "initialCapital": 100000,
  "commission": 0.001,
  "slippage": 0.0005,
  "leverage": 1.0,
  "positionSizing": "percent",
  "allowShort": false,
  "benchmarkSymbol": "SPY",
  "stopLoss": 0.03,
  "takeProfit": 0.05,
  "strategy": {
    "type": "strategy_id",
    "name": "Strategy Display Name",
    "category": "Trend",
    "params": {}
  }
}
```

Optional command-specific args:

- Optimize:
  - `optimizeObjective`
  - `optimizeMethod`
  - `maxIterations`
  - `paramRanges`
- Walk-forward:
  - `wfSplits`
  - `wfTrainRatio`
- Indicator:
  - `indicator`
  - indicator params
- Indicator signals:
  - `indicator`
  - `mode`
- Labels:
  - `labelType`
  - `params.horizon`
  - `params.threshold`
- Splits:
  - `splitterType`
  - `params.windowLength`
  - `params.step`
- Returns:
  - `analysisType`
  - `rollingWindow`
  - optional `benchmarkSymbol`
- Signals:
  - `generatorType`

Fallback option lists:

- Position sizing: `percent`, `fixed`, `kelly`, `vol_target`, `risk`
- Optimize objectives: `sharpe`, `sortino`, `calmar`, `return`
- Optimize methods: `grid`, `random`
- Labels: `FIXLB`, `MEANLB`, `LEXLB`, `TRENDLB`, `BOLB`
- Splitters: `RollingSplitter`, `ExpandingSplitter`, `PurgedKFold`
- Signal generators: `RAND`, `RANDX`, `RANDNX`, `RPROB`, `RPROBX`
- Indicator signal modes: `crossover`, `threshold`, `breakout`, `mean_reversion`, `filter`
- Returns analysis types: `cumulative`, `rolling`, `drawdown`, `distribution`, `benchmark_comparison`

## Result Contract

All providers should return JSON. The screen supports:

- Summary metrics tab.
- Metrics table.
- Trades table.
- Raw JSON view.
- Error panel if provider returns invalid JSON or subprocess fails.

Preferred envelope:

```json
{
  "success": true,
  "message": "Backtest completed",
  "data": {
    "metrics": {},
    "trades": [],
    "equity_curve": [],
    "returns": []
  }
}
```

Metric formatting helpers treat these keys specially:

- Ratio keys: `sharpe_ratio`, `sortino_ratio`, `calmar_ratio`, `treynor_ratio`, `information_ratio`, `profit_factor`, `beta`, `alpha`, and camelCase variants.
- Percent keys: `total_return`, `annualized_return`, `max_drawdown`, `win_rate`, `volatility`, and camelCase variants.
- Count keys: `total_trades`, `winning_trades`, `losing_trades`, `winning_days`, `losing_days`, `consecutive_wins`, `consecutive_losses`, and camelCase variants.

## Backtesting Python Provider Files

Provider folders:

- `vectorbt`: `vectorbt_provider.py`, strategy, indicator, labels, splits, returns, optimization modules.
- `backtestingpy`: `backtestingpy_provider.py`, `btp_*` modules.
- `fasttrade`: `fasttrade_provider.py`, `ft_*` modules.
- `zipline`: `zipline_provider.py`, `zl_*` modules.
- `bt`: `bt_provider.py`, `bt_*` modules.
- `fincept`: `fincept_provider.py`, bridges to the Fincept strategy registry.
- `base`: `base_provider.py`, `advanced_metrics.py`, `fincept_strategy_runner.py`.

## Backtesting Port Checklist

- Build provider tabs and command sidebar exactly as a provider-command matrix.
- Load strategies and indicators dynamically from Python/backend providers.
- Generate strategy controls from returned param metadata.
- Preserve the `gather_args` JSON contract.
- Implement command mapping before hitting Python/provider code.
- Provide result tabs: summary, metrics, trades, raw JSON.
- Implement JSON export.
- Save/restore selected provider, command, strategy, symbols, and active result where useful.
- Add provider-level errors and clear empty states.

---

# 3. Algo Trading

## Desktop Anatomy From Screenshot

The Algo screen is a strategy builder with backtest and deployment surfaces.

- Global nav highlights `ALGO`.
- Local title: `ALGO TRADING`.
- Subtitle: `strategy builder - backtesting - live deployment`.
- Top tabs:
  - `BUILDER`
  - `MY STRATEGIES`
  - `SCANNER`
  - `DASHBOARD`
- Live badge on right, e.g. `0 LIVE`.
- Builder layout:
  - Left pane: strategy definition.
  - Right pane: backtest parameters and result space.
- Strategy definition pane:
  - Name, description, timeframe.
  - Entry conditions with logic selector `AND`/`OR`.
  - Add entry condition button.
  - Exit conditions with logic selector `AND`/`OR`.
  - Add exit condition button.
  - Risk management: stop loss %, take profit %, trailing stop %.
  - Save strategy button at the bottom.
- Backtest pane:
  - Symbol.
  - Capital.
  - Start date.
  - End date.
  - Run backtest button.
  - Empty/result area.

## Core Models

Source: `AlgoTradingTypes.h`

```cpp
AlgoStrategy {
  id, name, description, timeframe,
  entry_conditions, exit_conditions,
  entry_logic = "AND", exit_logic = "AND",
  stop_loss, take_profit, trailing_stop,
  is_active, created_at, updated_at,
  last_backtest
}

AlgoDeployment {
  id, strategy_id, strategy_name, symbol, mode, status,
  timeframe, quantity, error_message, created_at, updated_at,
  total_pnl, unrealized_pnl, total_trades, win_rate, max_drawdown,
  position_qty, position_side, position_entry
}

ConditionDef {
  indicator, params, field, op, value,
  compare_mode = "value",
  compare_indicator, compare_params, compare_field
}
```

Status colors:

- `running`: green
- `starting`: amber
- `error`: red
- `stopped`/`pending`: muted gray

## Indicator Catalog

Source: `algo_indicators()`

| Category | Indicators |
|---|---|
| stock | `CLOSE`, `OPEN`, `HIGH`, `LOW`, `VOLUME`, `VWAP` |
| ma | `SMA`, `EMA`, `WMA`, `DEMA`, `TEMA` |
| momentum | `RSI`, `MACD`, `STOCHASTIC`, `CCI`, `WILLIAMS_R`, `MFI`, `ROC` |
| trend | `ADX`, `SUPERTREND`, `AROON`, `ICHIMOKU` |
| volatility | `ATR`, `BOLLINGER`, `KELTNER`, `DONCHIAN` |
| volume | `OBV`, `CMF` |

Indicator parameter hints:

- `SMA`, `EMA`, `WMA`, `DEMA`, `TEMA`: `period`
- `RSI`, `CCI`, `WILLIAMS_R`, `MFI`, `ROC`, `ADX`, `ATR`, `DONCHIAN`: `period`
- `MACD`: `fast`, `slow`, `signal`
- `STOCHASTIC`: `k_period`, `d_period`
- `SUPERTREND`: `period`, `multiplier`
- `AROON`: `period`
- `ICHIMOKU`: `tenkan`, `kijun`, `senkou`
- `BOLLINGER`: `period`, `std_dev`
- `KELTNER`: `period`, `multiplier`

Operators:

```text
>, <, >=, <=, ==, crosses_above, crosses_below, rising, falling
```

Timeframes:

```text
live, 1m, 3m, 5m, 10m, 15m, 30m, 1h, 4h, 1d
```

## Condition JSON Shape

The UI and Python evaluator expect conditions like:

```json
{
  "indicator": "RSI",
  "params": {"period": 14},
  "field": "value",
  "operator": "<",
  "value": 30
}
```

Indicator-vs-indicator comparisons use:

```json
{
  "indicator": "CLOSE",
  "params": {},
  "field": "value",
  "operator": "crosses_above",
  "compareMode": "indicator",
  "compareIndicator": "EMA",
  "compareParams": {"period": 20},
  "compareField": "value"
}
```

Python evaluator source: `scripts/algo_trading/condition_evaluator.py`

## Scanner Presets

Source: `scanner_presets()`

- RSI Oversold: `RSI(14).value < 30`
- RSI Overbought: `RSI(14).value > 70`
- MACD Bullish: `MACD(12,26,9).histogram > 0`
- Bollinger Squeeze: `BOLLINGER(20,2).width < 0.05`
- High Volume: `VOLUME.value > 1000000`

Default watchlist helpers:

- Nifty list: `RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `ICICIBANK`, `HINDUNILVR`, `SBIN`, `BHARTIARTL`, `ITC`, `KOTAKBANK`, `LT`, `AXISBANK`, `BAJFINANCE`, `ASIANPAINT`, `MARUTI`, `TITAN`, `SUNPHARMA`, `ULTRACEMCO`, `NESTLEIND`, `WIPRO`
- Bank Nifty list: `HDFCBANK`, `ICICIBANK`, `KOTAKBANK`, `AXISBANK`, `SBIN`, `INDUSINDBK`, `BANDHANBNK`, `FEDERALBNK`, `PNB`, `BANKBARODA`, `IDFCFIRSTB`, `AUBANK`

## Service Contract

Source: `AlgoTradingService.h/.cpp`

Actions:

- Strategy management:
  - `save_strategy(strategy)`
  - `list_strategies()`
  - `delete_strategy(id)`
- Deployment:
  - `deploy_strategy(strategy_id, symbol, mode, timeframe, quantity)`
  - `stop_deployment(deployment_id)`
  - `stop_all_deployments()`
  - `list_deployments()`
- Analytics:
  - `run_backtest(strategy_id, symbol, start_date, end_date, capital)`
  - `run_scan(conditions, symbols, timeframe, lookback_days, logic)`

Events:

- `strategy_saved`
- `strategies_loaded`
- `strategy_deleted`
- `deployment_started`
- `deployments_loaded`
- `deployment_stopped`
- `backtest_result`
- `scan_result`
- `error_occurred`

Python script calls:

```text
algo_trading/backtest_engine.py save_strategy <json> --db <path>
algo_trading/backtest_engine.py list_registry
algo_trading/backtest_engine.py delete_strategy <id> --db <path>
algo_trading/backtest_engine.py run_backtest <json> --db <path>
algo_trading/scanner_engine.py scan <json> --db <path>
algo_trading/algo_live_runner.py --deploy-id <id> --strategy-id <id> --symbol <symbol> --mode <paper|live> --timeframe <tf> --quantity <qty> --db <path>
algo_trading/algo_manager.py list_deployments --db <path>
algo_trading/algo_manager.py stop <deployment_id> --db <path>
algo_trading/algo_manager.py stop_all --db <path>
```

## Algo Storage Contract

`backtest_engine.py` creates `algo_strategies` if missing:

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `description TEXT DEFAULT ''`
- `timeframe TEXT DEFAULT '1d'`
- `entry_conditions TEXT DEFAULT '[]'`
- `exit_conditions TEXT DEFAULT '[]'`
- `entry_logic TEXT DEFAULT 'AND'`
- `exit_logic TEXT DEFAULT 'AND'`
- `stop_loss REAL DEFAULT 0`
- `take_profit REAL DEFAULT 0`
- `trailing_stop REAL DEFAULT 0`
- `trailing_stop_type TEXT DEFAULT 'percent'`
- `is_active INTEGER DEFAULT 1`
- `created_at`, `updated_at`

Deployment tables are inferred from `algo_manager.py` and `algo_live_runner.py`:

- `algo_deployments`
  - `id`, `strategy_id`, `symbol`, `mode`, `status`, `timeframe`, `quantity`, `error_message`, `created_at`, `updated_at`
- `algo_metrics`
  - `deployment_id` unique/primary key
  - `total_pnl`, `unrealized_pnl`, `total_trades`, `win_rate`, `max_drawdown`
  - `current_position_qty`, `current_position_side`, `current_position_entry`, `updated_at`
- `algo_trades`
  - `id`, `deployment_id`, `symbol`, `side`, `quantity`, `price`, `pnl`, `signal_reason`
- `algo_order_signals`
  - `id`, `deployment_id`, `symbol`, `side`, `quantity`, `order_type`, `price`, `status`
- Market data dependencies:
  - `candle_cache(symbol, timeframe, open_time, o, h, l, c, volume, is_closed, ...)`
  - `strategy_price_cache(symbol, price, updated_at)`

Porting note: in the inspected C++ service, `deploy_strategy` launches the live runner with a generated deployment id. The deployment table insert is not visible in the inspected files, but `algo_manager.py` and the live runner assume the row exists. In the target app, explicitly create the deployment row before starting the runner.

## Algo Runtime Flow

Strategy builder:

1. User creates entry and exit conditions.
2. User chooses timeframe and risk settings.
3. Save calls `save_strategy`.
4. Strategy JSON is stored as text in `algo_strategies`.

Backtest:

1. User selects symbol, date range, and capital.
2. Service calls `backtest_engine.py run_backtest`.
3. Python loads saved conditions.
4. Python fetches historical data from yfinance or `candle_cache`.
5. Engine walks bar-by-bar after warmup, evaluates entry/exit conditions, applies stop loss/take profit, and returns:
   - `trades`
   - `equity_curve`
   - `metrics`
   - `debug`

Scanner:

1. User selects preset or condition list.
2. Service calls `scanner_engine.py scan`.
3. Python loads candles for each symbol from `candle_cache`.
4. Result includes:
   - `matches`
   - `total_scanned`
   - `condition_count`
   - `scanner_debug`

Live/paper deployment:

1. Create deployment row.
2. Start `algo_live_runner.py`.
3. Runner loads conditions, watches `candle_cache` and `strategy_price_cache`.
4. Paper mode records trades directly.
5. Live mode writes order signals for host execution.
6. Metrics are upserted into `algo_metrics`.
7. UI polls deployments every 5 seconds.

## Algo Port Checklist

- Build four tabs: builder, my strategies, scanner, dashboard.
- Implement strategy JSON exactly, including condition arrays and logic.
- Implement the indicator catalog and dynamic condition rows.
- Implement scanner presets and scan result table.
- Persist strategies in SQLite or equivalent.
- Implement a deployment row lifecycle before launching live runners.
- Poll or subscribe to deployment metrics.
- Separate paper-mode trade recording from live-mode order signals.
- Surface errors from Python/backend engines.

---

# 4. Node Editor

## Desktop Anatomy From Screenshot

The Node Editor is a visual workflow builder.

- Global nav highlights `NODES`.
- Local title line:
  - `Untitled Workflow`
  - status text such as `DRAFT`
- Top toolbar:
  - `UNDO`
  - `REDO`
  - `SAVE`
  - `LOAD`
  - `CLEAR`
  - `IMPORT`
  - `EXPORT`
  - `TEMPLATES`
  - `DEPLOY`
  - `EXECUTE`
- Left palette:
  - Search input.
  - Grouped node categories.
  - Draggable node rows.
- Center canvas:
  - Dark grid.
  - Draggable cards.
  - Typed ports on left/right.
  - Curved edges.
  - Pan/zoom.
- Right properties panel:
  - Selected node name.
  - Node category/type id.
  - Parameter widgets.
  - Settings toggles: disabled, continue on fail.
  - Delete button.
- Bottom-right mini-map.
- Status indicator: `READY`.

## Core Workflow Types

Source: `NodeEditorTypes.h`

```cpp
PortDef {
  id, label, direction, connection_type, required, multi
}

ParamDef {
  key, label, type, default_value, options, placeholder, required
}

NodeTypeDef {
  type_id, display_name, category, description,
  icon_text, accent_color, version,
  inputs, outputs, parameters, execute
}

NodeDef {
  id, type, name, type_version, x, y,
  parameters, credentials,
  disabled, continue_on_fail, retry_on_fail, max_tries
}

EdgeDef {
  id, source_node, target_node, source_port, target_port, animated
}

WorkflowDef {
  id, name, description, nodes, edges, status,
  static_data, created_at, updated_at
}

NodeExecutionResult {
  node_id, success, output, error, duration_ms
}

WorkflowExecutionResult {
  workflow_id, success, node_results, total_duration_ms, error
}
```

Connection types:

```text
Main, AiLanguageModel, AiMemory, AiTool, MarketData, PortfolioData,
PriceData, SignalData, RiskData, BacktestData, TechnicalData,
FundamentalData, NewsData, EconomicData, OptionsData
```

Workflow statuses:

```text
Draft, Idle, Running, Completed, Error
```

Parameter widget types:

```text
string, number, boolean, select, code, json, expression
```

## Workflow Storage

Source: `v008_workflows.cpp`, `WorkflowRepository.cpp`

Tables:

- `workflows`
  - `id TEXT PRIMARY KEY`
  - `name TEXT NOT NULL DEFAULT 'Untitled Workflow'`
  - `description TEXT DEFAULT ''`
  - `status TEXT NOT NULL DEFAULT 'draft'`
  - `static_data TEXT DEFAULT '{}'`
  - `created_at`, `updated_at`
- `workflow_nodes`
  - `id TEXT PRIMARY KEY`
  - `workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE`
  - `type TEXT NOT NULL`
  - `name TEXT NOT NULL`
  - `type_version INTEGER NOT NULL DEFAULT 1`
  - `pos_x`, `pos_y`
  - `parameters TEXT DEFAULT '{}'`
  - `credentials TEXT DEFAULT '{}'`
  - `disabled INTEGER NOT NULL DEFAULT 0`
  - `continue_on_fail INTEGER NOT NULL DEFAULT 0`
  - `retry_on_fail INTEGER NOT NULL DEFAULT 0`
  - `max_tries INTEGER NOT NULL DEFAULT 1`
  - `sort_order INTEGER NOT NULL DEFAULT 0`
- `workflow_edges`
  - `id TEXT PRIMARY KEY`
  - `workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE`
  - `source_node`, `target_node`, `source_port`, `target_port`
  - `animated INTEGER NOT NULL DEFAULT 0`

Repository behavior:

- Save upserts workflow header.
- Save deletes and reinserts all nodes and edges.
- Load reconstructs `WorkflowDef`.
- List returns workflow summaries only.
- Delete removes workflow and cascades nodes/edges.

## Workflow Service/API Contract

Source: `WorkflowService.cpp`, `WorkflowExecutor.cpp`, `NodeRegistry.cpp`

Primary service actions:

- `create_workflow(name, description)`
- `load_workflow(id)`
- `save_workflow(workflow)`
- `delete_workflow(id)`
- `list_workflows()`
- `import_workflow(json)`
- `export_workflow(id)`
- `validate_workflow(workflow)`
- `execute_workflow(workflow)`
- `execute_from_node(workflow, node_id)`
- `stop_execution(execution_id)` if the target runtime supports cancellation
- `register_node_type(node_type_def)`
- `get_node_catalog()`

Primary events or callbacks:

- `workflow_loaded(workflow)`
- `workflow_saved(workflow_id)`
- `workflow_deleted(workflow_id)`
- `workflow_validation_failed(errors)`
- `execution_started(workflow_id)`
- `node_execution_started(node_id)`
- `node_execution_completed(node_id, result)`
- `node_execution_failed(node_id, error)`
- `execution_finished(workflow_id, result)`

Import/export contract:

- Export the complete `WorkflowDef` object: workflow metadata, nodes, edges, `static_data`, and status.
- Node `parameters` and `credentials` remain JSON objects.
- Edge endpoints must reference existing node ids and port ids.
- On import, regenerate ids only if the target app requires avoiding collisions; otherwise preserve ids so saved edges remain stable.

## Editor Events and Actions

Source: `NodeEditorScreen.cpp`

Implement these actions:

- Drop a palette node onto canvas.
- Select node and show property editor.
- Change node name.
- Change parameter value.
- Delete node.
- Duplicate node.
- Execute workflow from selected node.
- Clear workflow with confirmation.
- Import workflow JSON.
- Export workflow JSON.
- Save workflow.
- Load workflow.
- Auto-save every 30 seconds while screen is visible.
- Execute full workflow.
- Show templates.
- Deploy workflow, optionally auto-execute.
- Copy/paste selected nodes and edges.
- Undo/redo through command stack.

Keyboard shortcuts:

- Ctrl+Z: undo
- Ctrl+Y: redo
- Delete: delete selected nodes
- Ctrl+C: copy selected nodes/edges
- Ctrl+V: paste copied nodes/edges

## Execution Lifecycle

Source: `WorkflowExecutor.cpp`, `WorkflowService.cpp`

1. `WorkflowService::execute_workflow(wf)` creates a `WorkflowExecutor`.
2. Executor validates workflow graph.
3. Disabled nodes are skipped.
4. Graph is built from edges.
5. Cycles are detected and rejected.
6. Nodes are topologically sorted.
7. Ready nodes are launched.
8. Inputs are collected from predecessor outputs.
9. Node type definition is resolved from `NodeRegistry`.
10. Node `execute(params, inputs, callback)` runs.
11. Result is recorded.
12. On failure:
   - If `continue_on_fail` is false, workflow fails.
   - Otherwise downstream launch continues.
13. Hooks and audit events fire for workflow/node start/end/error.
14. UI receives:
   - `execution_started`
   - `node_execution_started`
   - `node_execution_completed`
   - `execution_finished`

Supporting services:

- `NodeRegistry`: registry of node type definitions.
- `ExpressionEngine`: expression evaluation for condition and transform nodes.
- `ParameterProcessor`: parameter conversion, validation, and request routing.
- `WorkflowCache`: TTL cache for node outputs.
- `RiskManager`: order risk checks.
- `ConfirmationService`: approval flow for sensitive actions.
- `ExecutionHooks`: workflow/node lifecycle hooks.
- `AuditLogger`: workflow audit table and export.
- `ServiceBridges`: wires nodes with null executors to real app services where needed.

## Node Catalog

Important count note: raw C++ initializer scanning finds 107 direct registrations. Expanding the notification factory in `NotificationNodes.cpp` yields 112 concrete node types across 14 categories.

### Agents

| Type id | Display | Description |
|---|---|---|
| `agent.run` | AI Agent | Run a configured AI agent with optional context input |
| `agent.tool_picker` | Tool Picker | Ask the LLM to pick the right MCP tool and arguments for a query |

### Analytics

| Type id | Display | Description |
|---|---|---|
| `analytics.technical_indicators` | Technical Indicators | Calculate SMA, RSI, MACD, Bollinger Bands, etc. |
| `analytics.backtest` | Backtest Engine | Run backtesting simulation on a trading strategy |
| `analytics.portfolio_optimization` | Portfolio Optimization | Optimize portfolio allocation |
| `analytics.performance_metrics` | Performance Metrics | Calculate returns, Sharpe, Sortino, max drawdown |
| `analytics.correlation_matrix` | Correlation Matrix | Calculate asset correlation matrix |
| `analytics.risk_analysis` | Risk Analysis | VaR, CVaR, stress testing, Monte Carlo simulation |
| `analytics.sharpe_ratio` | Sharpe / Sortino | Calculate Sharpe, Sortino, Calmar ratios |
| `analytics.ma_crossover` | MA Crossover | Detect moving average crossover signals |
| `analytics.drawdown` | Max Drawdown | Calculate maximum drawdown, drawdown duration, recovery time |
| `analytics.monte_carlo` | Monte Carlo Sim | Monte Carlo simulation for portfolio returns |
| `analytics.factor_model` | Factor Model | Fama-French factor decomposition |
| `analytics.pairs_trading` | Pairs Trading | Cointegration test and pairs trading signal generation |
| `analytics.regime_detection` | Regime Detection | Detect market regime using HMM-style logic |

### Control Flow

| Type id | Display | Description |
|---|---|---|
| `control.if_else` | If / Else | Branch based on a condition |
| `control.switch` | Switch | Route data to one of multiple outputs |
| `control.loop` | Loop | Iterate over array items |
| `control.split` | Split | Split data flow into parallel branches |
| `control.merge` | Merge | Merge multiple branches into one |
| `control.wait` | Wait | Wait for a duration |
| `control.error_handler` | Error Handler | Catch errors from upstream nodes |
| `control.execute_workflow` | Execute Workflow | Execute another workflow as a sub-workflow |

### Core

| Type id | Display | Description |
|---|---|---|
| `output.results_display` | Results Display | Display execution results |
| `core.set` | Set Variable | Set a key-value pair in data flow |

### Data Format

| Type id | Display | Description |
|---|---|---|
| `format.json` | JSON | Parse, stringify, or query JSON data |
| `format.xml` | XML | Parse or generate XML data |
| `format.html_extract` | HTML Extract | Extract data from HTML using CSS selectors |
| `format.compare_datasets` | Compare Datasets | Compare two datasets and find differences |
| `format.csv_parse` | CSV Parse | Parse CSV string to structured data |
| `format.regex_extract` | Regex Extract | Extract data using regular expressions |

### Data Transform

| Type id | Display | Description |
|---|---|---|
| `transform.filter` | Filter | Filter items by field value |
| `transform.map` | Map | Transform each item in a dataset |
| `transform.aggregate` | Aggregate | Summarize data |
| `transform.sort` | Sort | Sort data by a field |
| `transform.join` | Join | Join two datasets on a common key |
| `transform.group_by` | Group By | Group data by a field |
| `transform.deduplicate` | Deduplicate | Remove duplicate items |
| `transform.reshape` | Reshape | Restructure data |
| `transform.pivot` | Pivot Table | Pivot rows to columns |
| `transform.normalize` | Normalize | Min-max or z-score normalization |
| `transform.rolling_window` | Rolling Window | Rolling calculations |
| `transform.lag` | Lag / Lead | Time-shift data by N periods |
| `transform.resample` | Resample | Change time frequency |

### Files

| Type id | Display | Description |
|---|---|---|
| `file.operations` | File Operations | Read, write, or append files |
| `file.binary` | Binary File | Read/write binary files |
| `file.convert` | Convert to File | Convert data to downloadable format |
| `file.compress` | Compress | Compress or decompress files |
| `file.pdf_generate` | PDF Report | Generate PDF report from data |
| `file.image_chart` | Chart Image | Generate chart as PNG image |

### Market Data

| Type id | Display | Description |
|---|---|---|
| `market.get_quote` | Get Quote | Fetch real-time market quote |
| `market.get_historical` | Historical Data | Fetch OHLCV historical price data |
| `market.get_depth` | Market Depth | Fetch Level 2 order book data |
| `market.get_stats` | Ticker Stats | Fetch ticker statistics |
| `market.get_fundamentals` | Fundamentals | Fetch company fundamentals |
| `market.get_economics` | FRED Economic Data | Fetch a FRED macroeconomic series |
| `market.get_yield_curve` | US Treasury Yield Curve | Fetch yield curve and spreads |
| `market.get_news` | Market News | Fetch latest financial news |
| `market.get_options_chain` | Options Chain | Fetch options chain with Greeks |
| `market.get_crypto_price` | Crypto Price | Real-time crypto prices |
| `market.get_forex_rate` | Forex Rate | Foreign exchange rates |
| `market.screener` | Stock Screener | Screen stocks by criteria |
| `market.insider_trades` | Insider Trades | Fetch insider trading activity |
| `market.sec_filings` | SEC Filings | Fetch SEC filings |

### MCP

| Type id | Display | Description |
|---|---|---|
| `mcp.tool_call` | MCP Tool | Call any Fincept internal MCP tool by name |

### Notifications

| Type id | Display | Description |
|---|---|---|
| `notify.email` | Email | Send an email notification |
| `notify.slack` | Slack | Send a Slack message |
| `notify.discord` | Discord | Send a Discord message |
| `notify.telegram` | Telegram | Send a Telegram message |
| `notify.sms` | SMS | Send an SMS notification |
| `notify.webhook` | Webhook | Send data to a webhook URL |

Common notification params: `message`, `title`. Extra params: email `to`, Slack `channel`, SMS `phone`, webhook `url` and `method`.

### Safety

| Type id | Display | Description |
|---|---|---|
| `safety.risk_check` | Risk Check | Validate trade against position size and volatility limits |
| `safety.loss_limit` | Loss Limit | Enforce daily/weekly loss limits |
| `safety.position_size_limit` | Position Size Limit | Enforce max position sizing |
| `safety.trading_hours` | Trading Hours Check | Validate trade is within market hours |
| `safety.max_drawdown_check` | Max Drawdown Check | Halt trading if drawdown exceeds threshold |
| `safety.correlation_check` | Correlation Check | Block if too correlated with existing positions |
| `safety.volatility_filter` | Volatility Filter | Skip trade if volatility is too high |

### Trading

| Type id | Display | Description |
|---|---|---|
| `trading.place_order` | Place Order | Submit a buy or sell order |
| `trading.cancel_order` | Cancel Order | Cancel an existing order |
| `trading.modify_order` | Modify Order | Modify an existing order |
| `trading.get_orders` | Get Orders | Retrieve current orders |
| `trading.get_positions` | Get Positions | Retrieve open positions |
| `trading.get_holdings` | Get Holdings | Retrieve portfolio holdings |
| `trading.get_balance` | Get Balance | Retrieve account balance and buying power |
| `trading.close_position` | Close Position | Close an open position |
| `trading.bracket_order` | Bracket Order | Entry plus stop loss plus take profit |
| `trading.trailing_stop` | Trailing Stop | Trailing stop loss order |
| `trading.scale_in` | Scale In | Build a position in tranches |

### Triggers

| Type id | Display | Description |
|---|---|---|
| `trigger.manual` | Manual Trigger | Start workflow manually |
| `trigger.schedule` | Schedule Trigger | Start workflow on a schedule |
| `trigger.price_alert` | Price Alert | Trigger when price crosses a threshold |
| `trigger.news_event` | News Event | Trigger on news keyword match |
| `trigger.webhook` | Webhook | Trigger from external webhook call |
| `trigger.cron_market` | Market Hours Cron | Scheduled trigger during market hours |
| `trigger.portfolio_drift` | Portfolio Drift | Trigger when portfolio drifts from target allocation |
| `trigger.market_event` | Market Event | Trigger on volatility/circuit-breaker events |

### Utilities

| Type id | Display | Description |
|---|---|---|
| `utility.http_request` | HTTP Request | Make an HTTP request |
| `utility.code` | Code | Execute custom code |
| `utility.datetime` | Date/Time | Get current date/time or format a timestamp |
| `utility.limit` | Limit | Limit output to first N items |
| `utility.item_lists` | Item Lists | Array operations |
| `utility.rss_read` | RSS Read | Parse RSS/Atom feed |
| `utility.crypto` | Crypto/Hash | Encrypt, decrypt, hash, or encode data |
| `utility.database` | Database | Execute SQL queries |
| `utility.cache_node` | Cache | Cache node output with TTL |
| `utility.delay_node` | Delay | Delay between nodes |
| `utility.log_node` | Log | Log data for debugging |
| `utility.assert_node` | Assert | Fail workflow if condition is false |
| `utility.template_render` | Template | Render string template with variables |
| `utility.google_sheets` | Spreadsheet | Read/write local spreadsheets or Google Sheets |
| `utility.api_call` | API Call | REST API call with authentication |

## Node Editor Port Checklist

- Implement registry-driven node palette with search and category groups.
- Implement typed ports and connection validation.
- Implement canvas pan, zoom, selection, drag/drop, edges, mini-map.
- Implement property panel from `ParamDef`.
- Persist workflows, nodes, and edges with JSON params/credentials.
- Implement import/export JSON around `WorkflowDef`.
- Implement workflow execution by topological graph traversal.
- Support disabled nodes, continue-on-fail, retry flags, and max tries.
- Surface execution results per node and for the whole workflow.
- Wire service bridge nodes to target app services.
- Add audit/log hooks for workflow start/end/error.

---

# Final Acceptance Checklist

- Portfolio, Backtesting, Algo Trading, and Node Editor each have their own implementation surface.
- Each category preserves source data models and JSON contracts.
- Each category has UI anatomy based on the desktop screenshots.
- Each category has service/action/event mapping.
- Persistence tables are represented where source code defines or implies them.
- Python provider/engine subprocess contracts are preserved or replaced by equivalent backend calls.
- Node registry includes all concrete categories and node types.
- The target app can use its own UI style while implementing the same data and function.
