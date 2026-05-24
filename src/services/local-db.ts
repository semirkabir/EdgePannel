/**
 * local-db.ts
 *
 * Typed IndexedDB layer for the Portfolio / Backtest / Algo / Node-Editor stores.
 * Separate from persistent-cache.ts (which is a generic TTL cache) — this database
 * holds user-created business data (portfolios, strategies, workflows) that must
 * survive indefinitely without expiry.
 *
 * DB name: worldmonitor_localdb  version: 1
 *
 * Object stores:
 *   wm.portfolios              keyPath: id
 *   wm.portfolio_assets        keyPath: id   (compound key: portfolio_id + symbol)
 *   wm.portfolio_transactions  keyPath: id
 *   wm.portfolio_snapshots     keyPath: id   (compound key: portfolio_id + date)
 *   wm.algo_strategies         keyPath: id
 *   wm.algo_deployments        keyPath: id
 *   wm.algo_trades             keyPath: id
 *   wm.backtest_runs           keyPath: id
 *   wm.workflows               keyPath: id
 *   wm.workflow_audit          keyPath: id
 */

// ─── Store names ─────────────────────────────────────────────────────────────

export const STORES = {
  portfolios:            'wm.portfolios',
  portfolioAssets:       'wm.portfolio_assets',
  portfolioTransactions: 'wm.portfolio_transactions',
  portfolioSnapshots:    'wm.portfolio_snapshots',
  algoStrategies:        'wm.algo_strategies',
  algoDeployments:       'wm.algo_deployments',
  algoTrades:            'wm.algo_trades',
  backtestRuns:          'wm.backtest_runs',
  workflows:             'wm.workflows',
  workflowAudit:         'wm.workflow_audit',
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

// ─── Schema types ─────────────────────────────────────────────────────────────

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

export interface PortfolioAsset {
  /** `${portfolio_id}:${symbol}` */
  id: string;
  portfolio_id: string;
  symbol: string;
  name: string;
  sector?: string;
  shares: number;
  avg_cost: number;
  currency: string;
  addedAt: string;
}

export type TransactionType = 'buy' | 'sell' | 'dividend' | 'split' | 'transfer';

export interface Transaction {
  id: string;
  portfolio_id: string;
  symbol: string;
  type: TransactionType;
  shares: number;
  price: number;
  total: number;
  fees?: number;
  currency: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface PortfolioSnapshot {
  /** `${portfolio_id}:${date}` */
  id: string;
  portfolio_id: string;
  date: string;
  nav: number;
  total_cost: number;
  total_gain: number;
  total_gain_pct: number;
  positions: number;
}

export interface AlgoStrategy {
  id: string;
  name: string;
  description?: string;
  timeframe: string;
  entryConditions: AlgoCondition[];
  exitConditions: AlgoCondition[];
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlgoCondition {
  id: string;
  indicatorA: string;
  paramA?: Record<string, number | string>;
  operator: string;
  compareMode: 'value' | 'indicator';
  valueB?: number;
  indicatorB?: string;
  paramB?: Record<string, number | string>;
  logicGate?: 'AND' | 'OR';
}

export type DeploymentStatus = 'idle' | 'running' | 'stopped' | 'error';

export interface AlgoDeployment {
  id: string;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  capital: number;
  mode: 'paper' | 'live';
  status: DeploymentStatus;
  startedAt?: string;
  stoppedAt?: string;
  pl: number;
  pl_pct: number;
  trades: number;
  wins: number;
  max_drawdown: number;
  lastTickAt?: string;
}

export interface AlgoTrade {
  id: string;
  deployment_id: string;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  total: number;
  executedAt: string;
  pl?: number;
  mode: 'paper' | 'live';
}

export interface BacktestRun {
  id: string;
  provider: string;
  strategy: string;
  symbol: string;
  start: string;
  end: string;
  capital: number;
  ranAt: string;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  total_trades: number;
  win_rate: number;
  resultJson?: string;
}

export type WorkflowStatus = 'draft' | 'idle' | 'running' | 'completed' | 'error';

export interface WorkflowDef {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunDuration?: number;
  lastRunError?: string;
}

export interface WorkflowNode {
  id: string;
  typeId: string;
  label?: string;
  x: number;
  y: number;
  params: Record<string, unknown>;
  disabled?: boolean;
  continueOnFail?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  connectionType: string;
}

export interface WorkflowAuditEntry {
  id: string;
  workflow_id: string;
  event: string;
  detail?: Record<string, unknown>;
  ts: string;
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

const DB_NAME = 'worldmonitor_localdb';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error ?? new Error('Failed to open local-db'));

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbPromise = null; };
      db.onerror = (e) => console.error('[local-db] IDB error', e);
      resolve(db);
    };
  });

  return dbPromise;
}

// ─── Generic CRUD helpers ──────────────────────────────────────────────────────

function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        tx.onerror = () => reject(tx.error);
        const req = fn(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function withStoreCursor<T>(
  storeName: StoreName,
  fn: (store: IDBObjectStore, collect: (item: T) => void) => void,
): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const results: T[] = [];
        const tx = db.transaction(storeName, 'readonly');
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve(results);
        fn(tx.objectStore(storeName), (item) => results.push(item));
      }),
  );
}

// ─── Repository factory ────────────────────────────────────────────────────────

export interface LocalRepository<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  put(item: T): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export function createRepository<T extends { id: string }>(storeName: StoreName): LocalRepository<T> {
  return {
    async get(id) {
      const result = await withStore<T | undefined>(storeName, 'readonly', (s) => s.get(id));
      return result ?? null;
    },

    getAll() {
      return withStoreCursor<T>(storeName, (store, collect) => {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          collect(cursor.value as T);
          cursor.continue();
        };
        req.onerror = () => { /* tx.onerror handles rejection */ };
      });
    },

    async put(item) {
      await withStore<IDBValidKey>(storeName, 'readwrite', (s) => s.put(item));
    },

    async delete(id) {
      await withStore<undefined>(storeName, 'readwrite', (s) => s.delete(id));
    },

    async clear() {
      await withStore<undefined>(storeName, 'readwrite', (s) => s.clear());
    },
  };
}

// ─── Typed repositories (singletons) ─────────────────────────────────────────

export const portfolioRepo         = createRepository<Portfolio>(STORES.portfolios);
export const portfolioAssetRepo    = createRepository<PortfolioAsset>(STORES.portfolioAssets);
export const transactionRepo       = createRepository<Transaction>(STORES.portfolioTransactions);
export const snapshotRepo          = createRepository<PortfolioSnapshot>(STORES.portfolioSnapshots);
export const algoStrategyRepo      = createRepository<AlgoStrategy>(STORES.algoStrategies);
export const algoDeploymentRepo    = createRepository<AlgoDeployment>(STORES.algoDeployments);
export const algoTradeRepo         = createRepository<AlgoTrade>(STORES.algoTrades);
export const backtestRunRepo       = createRepository<BacktestRun>(STORES.backtestRuns);
export const workflowRepo          = createRepository<WorkflowDef>(STORES.workflows);
export const workflowAuditRepo     = createRepository<WorkflowAuditEntry>(STORES.workflowAudit);

// ─── Compatibility API (used by portfolio-repository, workflow-repository, audit-logger) ───

/** Base interface every document stored in local-db must satisfy. */
export interface LocalDbDocument {
  id: string;
}

/** `LOCAL_DB_STORES` — alias for `STORES` (used by repository layer). */
export const LOCAL_DB_STORES = STORES;

/** Compound key helper for portfolio assets. */
export function portfolioAssetId(portfolioId: string, symbol: string): string {
  return `${portfolioId}:${symbol}`;
}

/** Compound key helper for portfolio snapshots. */
export function portfolioSnapshotId(portfolioId: string, date: string): string {
  return `${portfolioId}:${date}`;
}

/** Store interface returned by `createLocalDocumentStore`. */
export interface LocalDocumentStore<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  /** Upserts the item and returns it (useful for chained assignments). */
  put(item: T): Promise<T>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Factory that creates a typed store wrapper.  Each repository class calls
 * this once per store and stores the result as a private field.
 */
export function createLocalDocumentStore<T extends { id: string }>(
  storeName: StoreName,
): LocalDocumentStore<T> {
  return {
    async get(id) {
      const result = await withStore<T | undefined>(storeName, 'readonly', (s) => s.get(id));
      return result ?? null;
    },

    list() {
      return withStoreCursor<T>(storeName, (store, collect) => {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          collect(cursor.value as T);
          cursor.continue();
        };
        req.onerror = () => { /* tx.onerror handles rejection */ };
      });
    },

    async put(item) {
      await withStore<IDBValidKey>(storeName, 'readwrite', (s) => s.put(item));
      return item;
    },

    async delete(id) {
      await withStore<undefined>(storeName, 'readwrite', (s) => s.delete(id));
    },

    async clear() {
      await withStore<undefined>(storeName, 'readwrite', (s) => s.clear());
    },
  };
}

// ─── Convenience query helpers ────────────────────────────────────────────────

/** Returns all assets belonging to a specific portfolio. */
export async function getAssetsForPortfolio(portfolioId: string): Promise<PortfolioAsset[]> {
  const all = await portfolioAssetRepo.getAll();
  return all.filter((a) => a.portfolio_id === portfolioId);
}

/** Returns all transactions for a portfolio, sorted oldest-first. */
export async function getTransactionsForPortfolio(portfolioId: string): Promise<Transaction[]> {
  const all = await transactionRepo.getAll();
  return all
    .filter((t) => t.portfolio_id === portfolioId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns snapshots for a portfolio sorted oldest-first. */
export async function getSnapshotsForPortfolio(portfolioId: string): Promise<PortfolioSnapshot[]> {
  const all = await snapshotRepo.getAll();
  return all
    .filter((s) => s.portfolio_id === portfolioId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns all trades for a deployment, sorted oldest-first. */
export async function getTradesForDeployment(deploymentId: string): Promise<AlgoTrade[]> {
  const all = await algoTradeRepo.getAll();
  return all
    .filter((t) => t.deployment_id === deploymentId)
    .sort((a, b) => a.executedAt.localeCompare(b.executedAt));
}

/** Returns the N most recent backtest runs, newest first. */
export async function getRecentBacktestRuns(limit = 10): Promise<BacktestRun[]> {
  const all = await backtestRunRepo.getAll();
  return all
    .sort((a, b) => b.ranAt.localeCompare(a.ranAt))
    .slice(0, limit);
}

/** Generates a short unique ID (no external deps). */
export function localId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
