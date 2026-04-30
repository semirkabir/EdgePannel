import {
  createLocalDocumentStore,
  LOCAL_DB_STORES,
  portfolioAssetId,
  portfolioSnapshotId,
} from './local-db';
import type {
  ImportMode,
  Portfolio,
  PortfolioAsset,
  PortfolioExportV1,
  PortfolioSnapshot,
  PortfolioTransactionType,
  Transaction,
} from './portfolio-types';
import { getTickerSector } from './market/portfolio';

export interface CreatePortfolioInput {
  name: string;
  owner?: string;
  currency?: string;
  description?: string;
}

export interface AddAssetInput {
  portfolio_id: string;
  symbol: string;
  qty: number;
  price: number;
  date: string;
  sector?: string;
}

export interface AddTransactionInput {
  portfolio_id: string;
  symbol: string;
  transaction_type: PortfolioTransactionType;
  quantity: number;
  price: number;
  total_value?: number;
  transaction_date: string;
  notes?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isPortfolioExportV1(value: unknown): value is PortfolioExportV1 {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PortfolioExportV1>;
  return candidate.format_version === '1.0'
    && typeof candidate.portfolio_name === 'string'
    && Array.isArray(candidate.transactions);
}

export class PortfolioRepository {
  private readonly portfolios = createLocalDocumentStore<Portfolio>(LOCAL_DB_STORES.portfolios);
  private readonly assets = createLocalDocumentStore<PortfolioAsset>(LOCAL_DB_STORES.portfolioAssets);
  private readonly transactions = createLocalDocumentStore<Transaction>(LOCAL_DB_STORES.portfolioTransactions);
  private readonly snapshots = createLocalDocumentStore<PortfolioSnapshot>(LOCAL_DB_STORES.portfolioSnapshots);

  public async list_portfolios(): Promise<Portfolio[]> {
    return (await this.portfolios.list()).sort((a, b) => a.name.localeCompare(b.name));
  }

  public async get_portfolio(id: string): Promise<Portfolio | null> {
    return this.portfolios.get(id);
  }

  public async create_portfolio(input: CreatePortfolioInput): Promise<Portfolio> {
    const createdAt = nowIso();
    const portfolio: Portfolio = {
      id: makeId('pf'),
      name: input.name,
      owner: input.owner ?? '',
      currency: input.currency ?? 'USD',
      description: input.description ?? '',
      created_at: createdAt,
      updated_at: createdAt,
    };
    return this.portfolios.put(portfolio);
  }

  public async update_portfolio(
    id: string,
    name: string,
    owner: string,
    currency: string,
    description: string,
  ): Promise<Portfolio | null> {
    const portfolio = await this.portfolios.get(id);
    if (!portfolio) return null;
    const updated: Portfolio = { ...portfolio, name, owner, currency, description, updated_at: nowIso() };
    return this.portfolios.put(updated);
  }

  public async delete_portfolio(id: string): Promise<void> {
    const assets = await this.get_assets(id);
    const transactions = await this.get_transactions(id);
    const snapshots = await this.get_snapshots(id);
    await Promise.all([
      ...assets.map((asset) => this.assets.delete(asset.id)),
      ...transactions.map((transaction) => this.transactions.delete(transaction.id)),
      ...snapshots.map((snapshot) => this.snapshots.delete(snapshot.id)),
      this.portfolios.delete(id),
    ]);
  }

  public async get_assets(portfolio_id: string): Promise<PortfolioAsset[]> {
    return (await this.assets.list())
      .filter((asset) => asset.portfolio_id === portfolio_id)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  public async add_asset(input: AddAssetInput): Promise<PortfolioAsset> {
    const symbol = normalizeSymbol(input.symbol);
    const existing = await this.assets.get(portfolioAssetId(input.portfolio_id, symbol));
    const sector = input.sector || existing?.sector || getTickerSector(symbol);

    if (!existing) {
      const asset: PortfolioAsset = {
        id: portfolioAssetId(input.portfolio_id, symbol),
        portfolio_id: input.portfolio_id,
        symbol,
        quantity: input.qty,
        avg_buy_price: input.price,
        first_purchase_date: input.date,
        last_updated: nowIso(),
        sector,
      };
      return this.assets.put(asset);
    }

    const nextQty = existing.quantity + input.qty;
    const nextAvg = nextQty <= 0
      ? 0
      : ((existing.quantity * existing.avg_buy_price) + (input.qty * input.price)) / nextQty;
    const updated: PortfolioAsset = {
      ...existing,
      quantity: nextQty,
      avg_buy_price: nextAvg,
      last_updated: nowIso(),
      sector,
    };
    return this.assets.put(updated);
  }

  public async update_asset(portfolio_id: string, symbol: string, qty: number, avg_price: number): Promise<PortfolioAsset | null> {
    const id = portfolioAssetId(portfolio_id, symbol);
    const asset = await this.assets.get(id);
    if (!asset) return null;
    return this.assets.put({ ...asset, quantity: qty, avg_buy_price: avg_price, last_updated: nowIso() });
  }

  public async set_asset_sector(portfolio_id: string, symbol: string, sector: string): Promise<PortfolioAsset | null> {
    const id = portfolioAssetId(portfolio_id, symbol);
    const asset = await this.assets.get(id);
    if (!asset) return null;
    return this.assets.put({ ...asset, sector, last_updated: nowIso() });
  }

  public async get_transactions(portfolio_id: string, symbol?: string): Promise<Transaction[]> {
    const normalizedSymbol = symbol ? normalizeSymbol(symbol) : null;
    return (await this.transactions.list())
      .filter((transaction) => transaction.portfolio_id === portfolio_id)
      .filter((transaction) => !normalizedSymbol || transaction.symbol === normalizedSymbol)
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }

  public async add_transaction(input: AddTransactionInput): Promise<Transaction> {
    const symbol = normalizeSymbol(input.symbol);
    const transaction: Transaction = {
      id: makeId('ptx'),
      portfolio_id: input.portfolio_id,
      symbol,
      transaction_type: input.transaction_type,
      quantity: input.quantity,
      price: input.price,
      total_value: input.total_value ?? input.quantity * input.price,
      transaction_date: input.transaction_date,
      notes: input.notes ?? '',
      created_at: nowIso(),
    };

    await this.transactions.put(transaction);
    await this.replay_asset_transaction(transaction);
    return transaction;
  }

  public async replay_asset_transaction(transaction: Transaction): Promise<void> {
    if (transaction.transaction_type === 'BUY') {
      await this.add_asset({
        portfolio_id: transaction.portfolio_id,
        symbol: transaction.symbol,
        qty: transaction.quantity,
        price: transaction.price,
        date: transaction.transaction_date,
      });
      return;
    }

    if (transaction.transaction_type === 'SELL') {
      const asset = await this.assets.get(portfolioAssetId(transaction.portfolio_id, transaction.symbol));
      if (!asset) return;
      await this.assets.put({
        ...asset,
        quantity: Math.max(0, asset.quantity - transaction.quantity),
        last_updated: nowIso(),
      });
    }
  }

  public async add_snapshot(snapshot: Omit<PortfolioSnapshot, 'id'>): Promise<PortfolioSnapshot> {
    const next: PortfolioSnapshot = {
      ...snapshot,
      id: portfolioSnapshotId(snapshot.portfolio_id, snapshot.snapshot_date),
    };
    return this.snapshots.put(next);
  }

  public async get_snapshots(portfolio_id: string): Promise<PortfolioSnapshot[]> {
    return (await this.snapshots.list())
      .filter((snapshot) => snapshot.portfolio_id === portfolio_id)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  }

  public async import_portfolio_json(payload: unknown, mode: ImportMode = 'New'): Promise<Portfolio> {
    if (!isPortfolioExportV1(payload)) {
      throw new Error('Portfolio import must use format_version "1.0" with transaction replay data.');
    }

    const existing = mode === 'Merge'
      ? (await this.list_portfolios()).find((portfolio) => portfolio.name === payload.portfolio_name) ?? null
      : null;
    const portfolio = existing ?? await this.create_portfolio({
      name: payload.portfolio_name,
      owner: payload.owner,
      currency: payload.currency,
      description: 'Imported Fincept transaction-replay portfolio',
    });

    for (const transaction of payload.transactions) {
      await this.add_transaction({
        portfolio_id: portfolio.id,
        symbol: transaction.symbol,
        transaction_type: transaction.type,
        quantity: transaction.quantity,
        price: transaction.price,
        total_value: transaction.total_value,
        transaction_date: transaction.date,
        notes: transaction.notes,
      });
    }

    return portfolio;
  }

  public async export_portfolio_json(portfolio_id: string): Promise<PortfolioExportV1> {
    const portfolio = await this.get_portfolio(portfolio_id);
    if (!portfolio) throw new Error(`Portfolio ${portfolio_id} not found`);
    const transactions = (await this.get_transactions(portfolio_id)).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    return {
      format_version: '1.0',
      portfolio_name: portfolio.name,
      owner: portfolio.owner,
      currency: portfolio.currency,
      export_date: nowIso(),
      transactions: transactions.map((transaction) => ({
        date: transaction.transaction_date,
        symbol: transaction.symbol,
        type: transaction.transaction_type,
        quantity: transaction.quantity,
        price: transaction.price,
        total_value: transaction.total_value,
        notes: transaction.notes,
      })),
    };
  }
}

export const portfolioRepository = new PortfolioRepository();
