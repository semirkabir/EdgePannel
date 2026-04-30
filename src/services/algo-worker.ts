import type { AlgoBacktestRequest, AlgoBacktestResult, AlgoScanMatch, AlgoScanRequest } from './algo-types';
import type { OhlcvBar } from './market/ohlcv';

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

type WorkerResult =
  | { type: 'ready' }
  | { type: 'backtest-result'; id: string; result: AlgoBacktestResult }
  | { type: 'scan-result'; id: string; result: AlgoScanMatch[] }
  | { type: 'error'; id: string; error: string };

class AlgoWorkerManager {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<string, PendingRequest<unknown>>();

  public runBacktest(request: AlgoBacktestRequest, bars: OhlcvBar[]): Promise<AlgoBacktestResult> {
    return this.request('backtest', { request, bars }, 60_000);
  }

  public runScan(request: AlgoScanRequest, barsBySymbol: Record<string, OhlcvBar[]>): Promise<AlgoScanMatch[]> {
    return this.request('scan', { request, barsBySymbol }, 60_000);
  }

  private init(): void {
    if (this.worker) return;
    this.worker = new Worker(new URL('../workers/algo.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      const data = event.data;
      if (data.type === 'ready') return;
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(data.id);
      if (data.type === 'error') pending.reject(new Error(data.error));
      else pending.resolve(data.result);
    };
    this.worker.onerror = (error) => {
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(error.message));
        this.pending.delete(id);
      }
    };
  }

  private request<T>(type: 'backtest' | 'scan', payload: unknown, timeoutMs: number): Promise<T> {
    this.init();
    if (!this.worker) return Promise.reject(new Error('Algo worker unavailable'));
    const id = `algo_${++this.requestId}`;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Algo worker request timed out'));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
      this.worker?.postMessage({ type, id, ...payload as Record<string, unknown> });
    });
  }
}

export const algoWorker = new AlgoWorkerManager();
