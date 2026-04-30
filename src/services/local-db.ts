import { deletePersistentCache, getPersistentCache, setPersistentCache } from './persistent-cache';

export const LOCAL_DB_STORES = {
  portfolios: 'wm.portfolios',
  portfolioAssets: 'wm.portfolio_assets',
  portfolioTransactions: 'wm.portfolio_transactions',
  portfolioSnapshots: 'wm.portfolio_snapshots',
  algoStrategies: 'wm.algo_strategies',
  algoDeployments: 'wm.algo_deployments',
  workflows: 'wm.workflows',
  algoTrades: 'wm.algo_trades',
  algoOrderSignals: 'wm.algo_order_signals',
  backtestRuns: 'wm.backtest_runs',
  workflowAudit: 'wm.workflow_audit',
} as const;

export type LocalDbStoreName = typeof LOCAL_DB_STORES[keyof typeof LOCAL_DB_STORES];

export interface LocalDbDocument {
  id: string;
}

export interface LocalDbStoredDocument<T extends LocalDbDocument> {
  value: T;
  updatedAt: number;
}

const INDEX_ID = '__index';

function docKey(storeName: LocalDbStoreName, id: string): string {
  return `${storeName}:${id}`;
}

function indexKey(storeName: LocalDbStoreName): string {
  return docKey(storeName, INDEX_ID);
}

async function readIndex(storeName: LocalDbStoreName): Promise<string[]> {
  const envelope = await getPersistentCache<string[]>(indexKey(storeName));
  return Array.isArray(envelope?.data) ? envelope.data : [];
}

async function writeIndex(storeName: LocalDbStoreName, ids: string[]): Promise<void> {
  await setPersistentCache(indexKey(storeName), Array.from(new Set(ids)).sort());
}

export class LocalDocumentStore<T extends LocalDbDocument> {
  public constructor(public readonly storeName: LocalDbStoreName) {}

  public async list(): Promise<T[]> {
    const ids = await readIndex(this.storeName);
    const docs: T[] = [];
    for (const id of ids) {
      const doc = await this.get(id);
      if (doc) docs.push(doc);
    }
    return docs;
  }

  public async get(id: string): Promise<T | null> {
    const envelope = await getPersistentCache<LocalDbStoredDocument<T>>(docKey(this.storeName, id));
    return envelope?.data.value ?? null;
  }

  public async getWithMeta(id: string): Promise<LocalDbStoredDocument<T> | null> {
    const envelope = await getPersistentCache<LocalDbStoredDocument<T>>(docKey(this.storeName, id));
    return envelope?.data ?? null;
  }

  public async put(value: T): Promise<T> {
    const now = Date.now();
    await setPersistentCache(docKey(this.storeName, value.id), { value, updatedAt: now });

    const ids = await readIndex(this.storeName);
    if (!ids.includes(value.id)) {
      await writeIndex(this.storeName, [...ids, value.id]);
    }

    return value;
  }

  public async putMany(values: T[]): Promise<T[]> {
    for (const value of values) {
      await setPersistentCache(docKey(this.storeName, value.id), { value, updatedAt: Date.now() });
    }

    const ids = await readIndex(this.storeName);
    await writeIndex(this.storeName, [...ids, ...values.map((value) => value.id)]);
    return values;
  }

  public async delete(id: string): Promise<void> {
    await deletePersistentCache(docKey(this.storeName, id));
    const ids = await readIndex(this.storeName);
    await writeIndex(this.storeName, ids.filter((existingId) => existingId !== id));
  }

  public async clear(): Promise<void> {
    const ids = await readIndex(this.storeName);
    await Promise.all(ids.map((id) => deletePersistentCache(docKey(this.storeName, id))));
    await deletePersistentCache(indexKey(this.storeName));
  }
}

export function createLocalDocumentStore<T extends LocalDbDocument>(
  storeName: LocalDbStoreName,
): LocalDocumentStore<T> {
  return new LocalDocumentStore<T>(storeName);
}

export function portfolioAssetId(portfolioId: string, symbol: string): string {
  return `${portfolioId}:${symbol.toUpperCase()}`;
}

export function portfolioSnapshotId(portfolioId: string, date: string): string {
  return `${portfolioId}:${date}`;
}
