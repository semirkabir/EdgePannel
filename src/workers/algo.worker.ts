import type {
  AlgoBacktestRequest,
  AlgoBacktestResult,
  AlgoScanMatch,
  AlgoScanRequest,
} from '@/services/algo-types';
import type { OhlcvBar } from '@/services/market/ohlcv';
import { evaluateConditions } from '@/services/algo-evaluator';

interface BacktestMessage {
  type: 'backtest';
  id: string;
  request: AlgoBacktestRequest;
  bars: OhlcvBar[];
}

interface ScanMessage {
  type: 'scan';
  id: string;
  request: AlgoScanRequest;
  barsBySymbol: Record<string, OhlcvBar[]>;
}

type WorkerMessage = BacktestMessage | ScanMessage;

function maxDrawdown(values: number[]): number {
  let peak = 0;
  let max = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    if (peak > 0) max = Math.min(max, (value - peak) / peak);
  }
  return max * 100;
}

function runBacktest(request: AlgoBacktestRequest, bars: OhlcvBar[]): AlgoBacktestResult {
  const capital = request.capital;
  let cash = capital;
  let qty = 0;
  let entry = 0;
  const equity: Array<{ date: string; equity: number }> = [];
  const tradePnls: number[] = [];

  for (let i = 1; i < bars.length; i += 1) {
    const price = bars[i]?.close ?? 0;
    const entrySignal = qty === 0 && evaluateConditions(request.strategy.entryConditions, request.strategy.entryJoin, bars, i);
    const exitSignal = qty > 0 && evaluateConditions(request.strategy.exitConditions, request.strategy.exitJoin, bars, i);

    if (entrySignal && price > 0) {
      qty = Math.floor((cash * (request.strategy.risk.positionSizePct / 100)) / price);
      if (qty > 0) {
        entry = price;
        cash -= qty * price;
      }
    } else if (exitSignal && qty > 0) {
      const pnl = (price - entry) * qty;
      tradePnls.push(pnl);
      cash += qty * price;
      qty = 0;
      entry = 0;
    }

    equity.push({ date: bars[i]?.date ?? '', equity: cash + (qty * price) });
  }

  const end = equity[equity.length - 1]?.equity ?? capital;
  const wins = tradePnls.filter((pnl) => pnl > 0).length;
  return {
    strategy_id: request.strategy.id,
    symbol: request.strategy.symbol,
    total_return: capital > 0 ? ((end - capital) / capital) * 100 : 0,
    max_drawdown: maxDrawdown(equity.map((point) => point.equity)),
    total_trades: tradePnls.length,
    win_rate: tradePnls.length > 0 ? (wins / tradePnls.length) * 100 : 0,
    equity_curve: equity,
  };
}

function runScan(request: AlgoScanRequest, barsBySymbol: Record<string, OhlcvBar[]>): AlgoScanMatch[] {
  return request.symbols.map((symbol) => {
    const bars = barsBySymbol[symbol] ?? [];
    const latest = bars[bars.length - 1];
    const matched = bars.length > 0 && evaluateConditions(request.conditions, request.join, bars);
    return {
      symbol,
      price: latest?.close ?? 0,
      signal: request.preset ?? 'custom',
      matched,
      timestamp: new Date().toISOString(),
    };
  }).filter((match) => match.matched);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  try {
    if (message.type === 'backtest') {
      self.postMessage({ type: 'backtest-result', id: message.id, result: runBacktest(message.request, message.bars) });
      return;
    }
    self.postMessage({ type: 'scan-result', id: message.id, result: runScan(message.request, message.barsBySymbol) });
  } catch (error) {
    self.postMessage({ type: 'error', id: message.id, error: String(error) });
  }
};

self.postMessage({ type: 'ready' });
