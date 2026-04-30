import { createEventBus } from '@/app/event-bus';
import { createLocalDocumentStore, LOCAL_DB_STORES } from './local-db';
import { listManyOhlcv } from './market/ohlcv';
import { FINCEPT_COMMANDS, FINCEPT_INDICATORS, FINCEPT_STRATEGIES } from './backtest-providers/fincept-provider';
import { VENDOR_PROVIDERS, vendorProviderUnavailable } from './backtest-providers/vendor-stub';
import { backtestWorker } from './backtest-worker';
import type {
  BacktestCommand,
  BacktestProviderId,
  BacktestResultEnvelope,
  BacktestRunRecord,
  BacktestRunRequest,
  BacktestStrategy,
} from './backtesting-types';

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  updatedAt: number;
  value: T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeRunId(): string {
  return `btr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export class BacktestingService {
  public readonly events = createEventBus();
  private readonly runs = createLocalDocumentStore<BacktestRunRecord>(LOCAL_DB_STORES.backtestRuns);
  private readonly strategyCache = new Map<BacktestProviderId, CacheEntry<BacktestStrategy[]>>();
  private readonly commandCache = new Map<BacktestProviderId, CacheEntry<Array<{ id: BacktestCommand; label: string }>>>();

  public async load_strategies(provider: BacktestProviderId): Promise<BacktestStrategy[]> {
    const cached = this.strategyCache.get(provider);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) return cached.value;

    const value = provider === 'fincept'
      ? FINCEPT_STRATEGIES
      : [{
          id: `${provider}_sidecar_placeholder`,
          name: `${provider} Sidecar Strategy`,
          category: 'Sidecar Required',
          description: `${provider} strategies load when the Tauri sidecar provider is connected.`,
          params: [],
        }];
    this.strategyCache.set(provider, { updatedAt: Date.now(), value });
    return value;
  }

  public async load_command_options(provider: BacktestProviderId): Promise<Array<{ id: BacktestCommand; label: string }>> {
    const cached = this.commandCache.get(provider);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) return cached.value;
    const value = provider === 'fincept' ? FINCEPT_COMMANDS : FINCEPT_COMMANDS.slice(0, 1);
    this.commandCache.set(provider, { updatedAt: Date.now(), value });
    return value;
  }

  public async load_indicators(): Promise<typeof FINCEPT_INDICATORS> {
    return FINCEPT_INDICATORS;
  }

  public async run_command(request: BacktestRunRequest): Promise<BacktestRunRecord> {
    let envelope: BacktestResultEnvelope;
    if (request.provider !== 'fincept' || VENDOR_PROVIDERS.includes(request.provider)) {
      envelope = vendorProviderUnavailable(request);
    } else {
      const data = await listManyOhlcv(request.market_data.symbols, {
        start: request.market_data.start,
        end: request.market_data.end,
        preferApi: false,
      });
      const barsBySymbol = Object.fromEntries(
        Object.entries(data).map(([symbol, response]) => [symbol, response.bars]),
      );
      envelope = await backtestWorker.run({ request, barsBySymbol });
    }

    const record: BacktestRunRecord = {
      ...envelope,
      id: makeRunId(),
      created_at: nowIso(),
      request,
    };
    await this.runs.put(record);
    this.events.emit('backtesting:run_completed', record);
    return record;
  }

  public async recent_runs(limit = 6): Promise<BacktestRunRecord[]> {
    return (await this.runs.list())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  public export_result_json(result: BacktestResultEnvelope): string {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  public clear_result(): void {
    this.events.emit('backtesting:result_cleared');
  }
}

export const backtestingService = new BacktestingService();
