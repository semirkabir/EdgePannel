import type { BacktestProviderId, BacktestResultEnvelope, BacktestRunRequest } from '../backtesting-types';

export const VENDOR_PROVIDERS: BacktestProviderId[] = ['vectorbt', 'backtesting.py', 'fasttrade', 'zipline', 'bt'];

export function vendorProviderUnavailable(request: BacktestRunRequest): BacktestResultEnvelope {
  return {
    format_version: '1.0',
    provider: request.provider,
    command: request.command,
    strategy_name: request.strategy_name,
    symbols: request.market_data.symbols,
    status: 'provider_unavailable',
    message: `${request.provider} requires a Tauri sidecar provider and is not available in the browser.`,
    metrics: {
      total_return: 0,
      annual_return: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      win_rate: 0,
      total_trades: 0,
      profit_factor: 0,
      volatility: 0,
    },
    equity_curve: [],
    trades: [],
    raw: { provider_available: false, requires_sidecar: true },
  };
}
