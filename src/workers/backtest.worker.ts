import type {
  BacktestEquityPoint,
  BacktestResultEnvelope,
  BacktestTrade,
  BacktestWorkerRunPayload,
} from '@/services/backtesting-types';
import type { OhlcvBar } from '@/services/market/ohlcv';

interface RunMessage {
  type: 'run';
  id: string;
  payload: BacktestWorkerRunPayload;
}

type WorkerMessage = RunMessage;

function sma(values: number[], period: number, index: number): number | null {
  if (index + 1 < period) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i += 1) sum += values[i] ?? 0;
  return sum / period;
}

function stdev(values: number[], period: number, index: number): number | null {
  const avg = sma(values, period, index);
  if (avg === null) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i += 1) sum += ((values[i] ?? 0) - avg) ** 2;
  return Math.sqrt(sum / period);
}

function rsi(values: number[], period: number, index: number): number | null {
  if (index < period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = index - period + 1; i <= index; i += 1) {
    const change = (values[i] ?? 0) - (values[i - 1] ?? 0);
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function maxDrawdown(equity: number[]): { points: number[]; max: number } {
  let peak = 0;
  let max = 0;
  const points = equity.map((value) => {
    peak = Math.max(peak, value);
    const drawdown = peak > 0 ? (value - peak) / peak : 0;
    max = Math.min(max, drawdown);
    return drawdown;
  });
  return { points, max };
}

function signalFor(strategyId: string, closes: number[], index: number, params: Record<string, string | number | boolean>): boolean {
  if (strategyId === 'sma_crossover') {
    const fast = sma(closes, Number(params.fast_window ?? 20), index);
    const slow = sma(closes, Number(params.slow_window ?? 50), index);
    return fast !== null && slow !== null && fast > slow;
  }

  if (strategyId === 'rsi_mean_reversion') {
    const value = rsi(closes, Number(params.period ?? 14), index);
    return value !== null && value < Number(params.oversold ?? 30);
  }

  if (strategyId === 'bollinger_breakout') {
    const period = Number(params.period ?? 20);
    const avg = sma(closes, period, index);
    const sigma = stdev(closes, period, index);
    return avg !== null && sigma !== null && (closes[index] ?? 0) > avg + (Number(params.stddev ?? 2) * sigma);
  }

  const lookback = Number(params.lookback ?? 30);
  if (index < lookback) return false;
  const previous = closes[index - lookback] ?? 0;
  const current = closes[index] ?? 0;
  const returnPct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return returnPct > Number(params.threshold ?? 2);
}

function exitSignalFor(strategyId: string, closes: number[], index: number, params: Record<string, string | number | boolean>): boolean {
  if (strategyId === 'rsi_mean_reversion') {
    const value = rsi(closes, Number(params.period ?? 14), index);
    return value !== null && value > Number(params.exit_level ?? 55);
  }
  if (strategyId === 'bollinger_breakout') {
    const avg = sma(closes, Number(params.period ?? 20), index);
    return avg !== null && (closes[index] ?? 0) < avg;
  }
  return !signalFor(strategyId, closes, index, params);
}

function runSingleSymbol(payload: BacktestWorkerRunPayload, symbol: string, bars: OhlcvBar[]): BacktestResultEnvelope {
  const { request } = payload;
  const closes = bars.map((bar) => bar.close);
  const dates = bars.map((bar) => bar.date);
  const capital = request.execution.capital;
  const commission = request.execution.commission;
  const slippage = request.execution.slippage / 100;

  let cash = capital;
  let quantity = 0;
  let entryPrice = 0;
  let entryDate = '';
  const equity: number[] = [];
  const trades: BacktestTrade[] = [];

  for (let i = 1; i < bars.length; i += 1) {
    const price = closes[i] ?? 0;
    const shouldEnter = quantity === 0 && signalFor(request.strategy_id, closes, i, request.params);
    const shouldExit = quantity > 0 && exitSignalFor(request.strategy_id, closes, i, request.params);

    if (shouldEnter && price > 0) {
      const fill = price * (1 + slippage);
      quantity = Math.floor((cash * 0.95) / fill);
      if (quantity > 0) {
        entryPrice = fill;
        entryDate = dates[i] ?? '';
        cash -= (quantity * fill) + commission;
      }
    } else if (shouldExit && quantity > 0) {
      const fill = price * (1 - slippage);
      const proceeds = (quantity * fill) - commission;
      const pnl = proceeds - (quantity * entryPrice);
      cash += proceeds;
      trades.push({
        id: `trade_${trades.length + 1}`,
        symbol,
        side: 'SELL',
        entry_date: entryDate,
        exit_date: dates[i] ?? '',
        entry_price: entryPrice,
        exit_price: fill,
        quantity,
        pnl,
        return_pct: entryPrice > 0 ? ((fill - entryPrice) / entryPrice) * 100 : 0,
      });
      quantity = 0;
      entryPrice = 0;
      entryDate = '';
    }

    equity.push(cash + (quantity * price));
  }

  const finalEquity = equity[equity.length - 1] ?? capital;
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i += 1) {
    const prev = equity[i - 1] ?? 0;
    if (prev > 0) returns.push(((equity[i] ?? 0) - prev) / prev);
  }

  const drawdown = maxDrawdown(equity);
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossWin = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const totalReturn = capital > 0 ? ((finalEquity - capital) / capital) * 100 : 0;
  const years = Math.max(1 / 252, equity.length / 252);
  const annualReturn = ((finalEquity / capital) ** (1 / years) - 1) * 100;
  const volatility = std(returns) * Math.sqrt(252) * 100;
  const sharpe = std(returns) === 0 ? 0 : (mean(returns) / std(returns)) * Math.sqrt(252);

  const equityCurve: BacktestEquityPoint[] = equity.map((value, index) => ({
    date: dates[index + 1] ?? dates[index] ?? '',
    equity: value,
    drawdown: drawdown.points[index] ?? 0,
  }));

  return {
    format_version: '1.0',
    provider: request.provider,
    command: request.command,
    strategy_name: request.strategy_name,
    symbols: request.market_data.symbols,
    status: 'ok',
    message: 'Backtest completed with browser Fincept provider.',
    metrics: {
      total_return: totalReturn,
      annual_return: annualReturn,
      sharpe_ratio: sharpe,
      max_drawdown: drawdown.max * 100,
      win_rate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      total_trades: trades.length,
      profit_factor: grossLoss === 0 ? grossWin : grossWin / grossLoss,
      volatility,
    },
    equity_curve: equityCurve,
    trades,
    raw: {
      final_equity: finalEquity,
      bars: bars.length,
      engine: 'fincept-browser-ts',
    },
  };
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type !== 'run') return;

  try {
    const symbol = message.payload.request.market_data.symbols[0] ?? 'SPY';
    const bars = message.payload.barsBySymbol[symbol] ?? [];
    if (bars.length < 20) throw new Error(`Not enough OHLCV bars for ${symbol}`);
    const result = runSingleSymbol(message.payload, symbol, bars);
    self.postMessage({ type: 'run-result', id: message.id, result });
  } catch (error) {
    self.postMessage({ type: 'error', id: message.id, error: String(error) });
  }
};

self.postMessage({ type: 'ready' });
