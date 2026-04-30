import type { BacktestResultEnvelope, BacktestWorkerRunPayload } from './backtesting-types';

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

type WorkerResult =
  | { type: 'ready' }
  | { type: 'run-result'; id: string; result: BacktestResultEnvelope }
  | { type: 'error'; id: string; error: string };

class BacktestWorkerManager {
  private worker: Worker | null = null;
  private ready = false;
  private requestId = 0;
  private pending = new Map<string, PendingRequest<unknown>>();

  public run(payload: BacktestWorkerRunPayload): Promise<BacktestResultEnvelope> {
    this.init();
    return this.request<BacktestResultEnvelope>('run', payload, 60_000);
  }

  public terminate(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Backtest worker terminated'));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }

  private init(): void {
    if (this.worker) return;
    this.worker = new Worker(new URL('../workers/backtest.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      const data = event.data;
      if (data.type === 'ready') {
        this.ready = true;
        return;
      }

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
      this.ready = false;
    };
  }

  private request<T>(type: 'run', payload: BacktestWorkerRunPayload, timeoutMs: number): Promise<T> {
    this.init();
    if (!this.worker) return Promise.reject(new Error('Backtest worker unavailable'));
    const id = `bt_${++this.requestId}`;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Backtest worker request timed out'));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
      this.worker?.postMessage({ type, id, payload });
    });
  }

  public get isReady(): boolean {
    return this.ready;
  }
}

export const backtestWorker = new BacktestWorkerManager();
