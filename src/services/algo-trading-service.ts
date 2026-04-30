import { createEventBus } from '@/app/event-bus';
import { createLocalDocumentStore, LOCAL_DB_STORES } from './local-db';
import { listManyOhlcv, listOhlcv } from './market/ohlcv';
import { algoWorker } from './algo-worker';
import { DEFAULT_US_WATCHLIST, SCANNER_PRESETS } from './algo-indicators';
import type {
  AlgoBacktestRequest,
  AlgoBacktestResult,
  AlgoDeployment,
  AlgoDeploymentMode,
  AlgoScanMatch,
  AlgoScanRequest,
  AlgoStrategy,
  AlgoTrade,
} from './algo-types';

function nowIso(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class AlgoTradingService {
  public readonly events = createEventBus();
  private readonly strategies = createLocalDocumentStore<AlgoStrategy>(LOCAL_DB_STORES.algoStrategies);
  private readonly deployments = createLocalDocumentStore<AlgoDeployment>(LOCAL_DB_STORES.algoDeployments);
  private readonly trades = createLocalDocumentStore<AlgoTrade>(LOCAL_DB_STORES.algoTrades);
  private readonly deploymentTimers = new Map<string, ReturnType<typeof setInterval>>();

  public async save_strategy(strategy: Omit<AlgoStrategy, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<AlgoStrategy> {
    const existing = strategy.id ? await this.strategies.get(strategy.id) : null;
    const saved: AlgoStrategy = {
      ...strategy,
      id: strategy.id ?? id('algo'),
      created_at: existing?.created_at ?? nowIso(),
      updated_at: nowIso(),
    };
    await this.strategies.put(saved);
    this.events.emit('algo:strategy_saved', saved);
    return saved;
  }

  public async list_strategies(): Promise<AlgoStrategy[]> {
    const existing = await this.strategies.list();
    if (existing.length > 0) return existing.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const demo = await this.save_strategy(this.defaultStrategy());
    return [demo];
  }

  public async delete_strategy(strategyId: string): Promise<void> {
    await this.strategies.delete(strategyId);
    this.events.emit('algo:strategy_deleted', strategyId);
  }

  public async deploy_strategy(strategyId: string, mode: AlgoDeploymentMode = 'paper'): Promise<AlgoDeployment> {
    const strategy = await this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

    const deployment: AlgoDeployment = {
      id: id('deploy'),
      strategy_id: strategy.id,
      strategy_name: strategy.name,
      mode,
      status: mode === 'paper' ? 'running' : 'error',
      symbol: strategy.symbol,
      pnl: 0,
      trades: 0,
      win_rate: 0,
      drawdown: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await this.deployments.put(deployment);
    this.events.emit('algo:deployment_created', deployment);

    if (mode === 'paper') this.startPaperRunner(deployment.id);
    return deployment;
  }

  public async stop_deployment(deploymentId: string): Promise<void> {
    const deployment = await this.deployments.get(deploymentId);
    if (!deployment) return;
    this.stopTimer(deploymentId);
    await this.deployments.put({ ...deployment, status: 'stopped', updated_at: nowIso() });
    this.events.emit('algo:deployment_stopped', deploymentId);
  }

  public async stop_all_deployments(): Promise<void> {
    const deployments = await this.list_deployments();
    await Promise.all(deployments.map((deployment) => this.stop_deployment(deployment.id)));
  }

  public async list_deployments(): Promise<AlgoDeployment[]> {
    return (await this.deployments.list()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  public async run_backtest(request: AlgoBacktestRequest): Promise<AlgoBacktestResult> {
    const bars = await listOhlcv({
      symbol: request.strategy.symbol,
      start: request.start,
      end: request.end,
      preferApi: false,
    }).then((result) => result.bars);
    const result = await algoWorker.runBacktest(request, bars);
    this.events.emit('algo:backtest_result', result);
    return result;
  }

  public async run_scan(request: AlgoScanRequest): Promise<AlgoScanMatch[]> {
    const symbols = request.symbols.length > 0 ? request.symbols : DEFAULT_US_WATCHLIST;
    const data = await listManyOhlcv(symbols, { limit: 90, preferApi: false });
    const barsBySymbol = Object.fromEntries(Object.entries(data).map(([symbol, value]) => [symbol, value.bars]));
    const matches = await algoWorker.runScan({ ...request, symbols }, barsBySymbol);
    this.events.emit('algo:scan_result', matches);
    return matches;
  }

  public scannerPreset(idValue: string): AlgoScanRequest {
    const preset = SCANNER_PRESETS.find((item) => item.id === idValue) ?? SCANNER_PRESETS[0]!;
    return {
      preset: preset.id,
      symbols: DEFAULT_US_WATCHLIST,
      conditions: preset.conditions,
      join: 'AND',
    };
  }

  public async list_trades(deploymentId: string): Promise<AlgoTrade[]> {
    return (await this.trades.list()).filter((trade) => trade.deployment_id === deploymentId);
  }

  private startPaperRunner(deploymentId: string): void {
    this.stopTimer(deploymentId);
    this.deploymentTimers.set(deploymentId, setInterval(() => {
      void this.tickDeployment(deploymentId);
    }, 5000));
  }

  private stopTimer(deploymentId: string): void {
    const timer = this.deploymentTimers.get(deploymentId);
    if (timer) clearInterval(timer);
    this.deploymentTimers.delete(deploymentId);
  }

  private async tickDeployment(deploymentId: string): Promise<void> {
    const deployment = await this.deployments.get(deploymentId);
    if (!deployment || deployment.status !== 'running') return;
    const drift = ((Date.now() / 1000) % 11) - 5;
    const updated: AlgoDeployment = {
      ...deployment,
      pnl: deployment.pnl + drift,
      trades: deployment.trades + (Math.abs(drift) > 4 ? 1 : 0),
      win_rate: Math.max(0, Math.min(100, deployment.win_rate || 52)),
      drawdown: Math.min(0, deployment.drawdown - Math.max(0, -drift / 1000)),
      updated_at: nowIso(),
    };
    await this.deployments.put(updated);
    this.events.emit('algo:deployment_tick', updated);
  }

  private defaultStrategy(): Omit<AlgoStrategy, 'id' | 'created_at' | 'updated_at'> {
    return {
      name: 'RSI Oversold Bounce',
      description: 'Paper strategy that buys RSI oversold and exits near neutral momentum.',
      symbol: 'SPY',
      timeframe: '1d',
      entryJoin: 'AND',
      exitJoin: 'OR',
      entryConditions: [{
        id: 'entry_rsi_oversold',
        left: { indicator: 'rsi', params: { period: 14 } },
        operator: '<',
        compareMode: 'value',
        rightValue: 30,
      }],
      exitConditions: [{
        id: 'exit_rsi_neutral',
        left: { indicator: 'rsi', params: { period: 14 } },
        operator: '>',
        compareMode: 'value',
        rightValue: 55,
      }],
      risk: {
        stopLossPct: 5,
        takeProfitPct: 12,
        trailingStopPct: 0,
        positionSizePct: 95,
      },
    };
  }
}

export const algoTradingService = new AlgoTradingService();
