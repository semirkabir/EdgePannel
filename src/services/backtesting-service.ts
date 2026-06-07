import { createEventBus } from '@/app/event-bus';
import { createLocalDocumentStore, LOCAL_DB_STORES } from './local-db';
import { listManyOhlcv } from './market/ohlcv';
import { FINCEPT_COMMANDS, FINCEPT_INDICATORS, FINCEPT_STRATEGIES } from './backtest-providers/fincept-provider';
import { VENDOR_PROVIDERS, vendorProviderUnavailable } from './backtest-providers/vendor-stub';
import { backtestWorker } from './backtest-worker';
import { hasTauriInvokeBridge } from './tauri-bridge';
import type {
  BacktestCommand,
  BacktestProviderInfo,
  BacktestProviderId,
  BacktestResultEnvelope,
  BacktestRunRecord,
  BacktestRunRequest,
  BacktestStrategy,
} from './backtesting-types';

const CACHE_TTL_MS = 10 * 60 * 1000;

const PROVIDER_DEFINITIONS: Array<Omit<BacktestProviderInfo, 'available' | 'status_label'>> = [
  {
    id: 'vectorbt',
    label: 'VectorBT',
    runtime: 'desktop_sidecar',
    description: 'Python vectorized backtesting engine exposed through the desktop sidecar.',
  },
  {
    id: 'backtesting.py',
    label: 'Backtesting.py',
    runtime: 'desktop_sidecar',
    description: 'Python strategy runner exposed through the desktop sidecar.',
  },
  {
    id: 'fasttrade',
    label: 'FastTrade',
    runtime: 'desktop_sidecar',
    description: 'Sidecar provider for FastTrade strategy experiments.',
  },
  {
    id: 'zipline',
    label: 'Zipline',
    runtime: 'desktop_sidecar',
    description: 'Zipline-style research engine exposed through the desktop sidecar.',
  },
  {
    id: 'bt',
    label: 'BT',
    runtime: 'desktop_sidecar',
    description: 'Portfolio backtesting engine exposed through the desktop sidecar.',
  },
  {
    id: 'fincept',
    label: 'Fincept',
    runtime: 'browser',
    description: 'Bundled browser backtesting engine.',
  },
];

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

  public is_desktop_runtime(): boolean {
    return hasTauriInvokeBridge();
  }

  public list_providers(): BacktestProviderInfo[] {
    const desktopRuntime = this.is_desktop_runtime();
    return PROVIDER_DEFINITIONS.map((provider) => {
      const available = provider.runtime === 'browser' || desktopRuntime;
      return {
        ...provider,
        available,
        status_label: provider.runtime === 'browser'
          ? 'Browser ready'
          : available
            ? 'Desktop sidecar'
            : 'Desktop app required',
      };
    });
  }

  public get_provider_info(provider: BacktestProviderId): BacktestProviderInfo {
    return this.list_providers().find((item) => item.id === provider) ?? this.list_providers().find((item) => item.id === 'fincept')!;
  }

  public is_provider_available(provider: BacktestProviderId): boolean {
    return this.get_provider_info(provider).available;
  }

  public async load_strategies(provider: BacktestProviderId): Promise<BacktestStrategy[]> {
    const cached = this.strategyCache.get(provider);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) return cached.value;

    let value: BacktestStrategy[];
    if (provider === 'fincept') {
      value = FINCEPT_STRATEGIES;
    } else if (!this.is_provider_available(provider)) {
      value = [];
    } else {
      const providerInfo = this.get_provider_info(provider);
      value = [{
        id: `${provider}_sidecar_placeholder`,
        name: `${providerInfo.label} Sidecar Strategy`,
        category: 'Sidecar Required',
        description: `${providerInfo.label} strategies load when the Tauri sidecar provider is connected.`,
        params: [],
      }];
    }
    this.strategyCache.set(provider, { updatedAt: Date.now(), value });
    return value;
  }

  public async load_command_options(provider: BacktestProviderId): Promise<Array<{ id: BacktestCommand; label: string }>> {
    const cached = this.commandCache.get(provider);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) return cached.value;
    const value = provider === 'fincept'
      ? FINCEPT_COMMANDS
      : this.is_provider_available(provider)
        ? FINCEPT_COMMANDS.slice(0, 1)
        : [];
    this.commandCache.set(provider, { updatedAt: Date.now(), value });
    return value;
  }

  public async load_indicators(): Promise<typeof FINCEPT_INDICATORS> {
    return FINCEPT_INDICATORS;
  }

  public async run_command(request: BacktestRunRequest): Promise<BacktestRunRecord> {
    let envelope: BacktestResultEnvelope;
    if (request.provider !== 'fincept' || VENDOR_PROVIDERS.includes(request.provider)) {
      envelope = vendorProviderUnavailable(request, this.is_desktop_runtime());
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
