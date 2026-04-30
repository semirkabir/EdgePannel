import { createEventBus } from '@/app/event-bus';
import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import { listManyOhlcv, listOhlcv } from './market/ohlcv';
import { portfolioRepository, type AddTransactionInput } from './portfolio-repository';
import { computePortfolioMetrics } from './portfolio-metrics';
import type {
  ComputedMetrics,
  HoldingWithQuote,
  ImportMode,
  Portfolio,
  PortfolioExportV1,
  PortfolioSummary,
  Transaction,
} from './portfolio-types';

export interface PortfolioServiceState {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
}

const DEMO_PORTFOLIO_NAME = 'Demo Portfolio';

const client = new MarketServiceClient('', {
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});

function latestClose(values: number[]): number {
  return values.length > 0 ? values[values.length - 1] ?? 0 : 0;
}

function pctChange(values: number[]): number {
  if (values.length < 2) return 0;
  const previous = values[values.length - 2] ?? 0;
  const current = values[values.length - 1] ?? 0;
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class PortfolioService {
  public readonly events = createEventBus();
  private demoEnsurePromise: Promise<Portfolio> | null = null;

  public async list_portfolios(): Promise<Portfolio[]> {
    await this.ensure_demo_portfolio();
    return portfolioRepository.list_portfolios();
  }

  public async ensure_demo_portfolio(): Promise<Portfolio> {
    if (this.demoEnsurePromise) return this.demoEnsurePromise;

    this.demoEnsurePromise = (async () => {
      const existing = (await portfolioRepository.list_portfolios())
        .find((portfolio) => portfolio.name === DEMO_PORTFOLIO_NAME);
      if (existing) return existing;

      const response = await fetch('/demo_portfolio.json');
      if (!response.ok) throw new Error('Unable to load demo_portfolio.json');
      const payload: unknown = await response.json();
      const portfolio = await portfolioRepository.import_portfolio_json(payload, 'New');
      this.events.emit('portfolio:created', portfolio);
      return portfolio;
    })();

    return this.demoEnsurePromise;
  }

  public async get_portfolio(id: string): Promise<Portfolio | null> {
    return portfolioRepository.get_portfolio(id);
  }

  public async get_summary(portfolioId: string): Promise<PortfolioSummary> {
    const portfolio = await portfolioRepository.get_portfolio(portfolioId);
    if (!portfolio) throw new Error(`Portfolio ${portfolioId} not found`);

    const assets = await portfolioRepository.get_assets(portfolioId);
    const symbols = assets.map((asset) => asset.symbol);
    const sampleData = symbols.length > 0
      ? await listManyOhlcv(symbols, { limit: 64, preferApi: false })
      : {};

    const quoteMap = new Map<string, { price: number; change: number; sparkline: number[]; name: string }>();
    if (symbols.length > 0) {
      try {
        const response = await client.listMarketQuotes({ symbols });
        for (const quote of response.quotes) {
          quoteMap.set(quote.symbol, {
            price: quote.price,
            change: quote.change,
            sparkline: quote.sparkline,
            name: quote.name,
          });
        }
      } catch {
        // Bundled OHLCV remains the browser-first fallback.
      }
    }

    const provisional = assets.map((asset) => {
      const sample = sampleData[asset.symbol];
      const closes = sample?.bars.map((bar) => bar.close) ?? [];
      const quote = quoteMap.get(asset.symbol);
      const currentPrice = quote?.price || latestClose(closes);
      const dayChangePercent = quote?.change ?? pctChange(closes);
      const marketValue = currentPrice * asset.quantity;
      const costBasis = asset.avg_buy_price * asset.quantity;
      const unrealizedPnl = marketValue - costBasis;
      return {
        symbol: asset.symbol,
        quantity: asset.quantity,
        avg_buy_price: asset.avg_buy_price,
        sector: asset.sector,
        current_price: currentPrice,
        market_value: marketValue,
        cost_basis: costBasis,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_percent: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0,
        day_change: marketValue * (dayChangePercent / 100),
        day_change_percent: dayChangePercent,
        weight: 0,
        sparkline: quote?.sparkline?.length ? quote.sparkline : closes,
        name: quote?.name,
      };
    });

    const totalMarketValue = provisional.reduce((sum, holding) => sum + holding.market_value, 0);
    const holdings: HoldingWithQuote[] = provisional
      .map((holding) => ({
        ...holding,
        weight: totalMarketValue > 0 ? (holding.market_value / totalMarketValue) * 100 : 0,
      }))
      .sort((a, b) => b.market_value - a.market_value);

    const totalCostBasis = holdings.reduce((sum, holding) => sum + holding.cost_basis, 0);
    const totalPnl = totalMarketValue - totalCostBasis;
    const totalDayChange = holdings.reduce((sum, holding) => sum + holding.day_change, 0);

    return {
      portfolio,
      holdings,
      total_market_value: totalMarketValue,
      total_cost_basis: totalCostBasis,
      total_unrealized_pnl: totalPnl,
      total_unrealized_pnl_percent: totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0,
      total_day_change: totalDayChange,
      total_day_change_percent: totalMarketValue > 0 ? (totalDayChange / totalMarketValue) * 100 : 0,
      total_positions: holdings.length,
      gainers: holdings.filter((holding) => holding.unrealized_pnl >= 0).slice(0, 5),
      losers: holdings.filter((holding) => holding.unrealized_pnl < 0).slice(0, 5),
      last_updated: new Date().toISOString(),
    };
  }

  public async get_metrics(portfolioId: string): Promise<ComputedMetrics> {
    const summary = await this.get_summary(portfolioId);
    const series = await this.get_portfolio_value_series(summary.holdings);
    const benchmark = await listOhlcv({ symbol: 'SPY', limit: series.length || 64, preferApi: false }).then((result) =>
      result.bars.map((bar) => bar.close)
    );
    return computePortfolioMetrics(summary.holdings, series, benchmark);
  }

  public async get_portfolio_value_series(holdings: HoldingWithQuote[]): Promise<number[]> {
    if (holdings.length === 0) return [];
    const data = await listManyOhlcv(holdings.map((holding) => holding.symbol), { limit: 64, preferApi: false });
    const minLength = Math.min(
      ...holdings.map((holding) => data[holding.symbol]?.bars.length ?? 0).filter((length) => length > 0),
    );
    if (!Number.isFinite(minLength) || minLength <= 0) return [];

    return Array.from({ length: minLength }, (_, index) =>
      holdings.reduce((sum, holding) => {
        const bars = data[holding.symbol]?.bars ?? [];
        const offset = bars.length - minLength;
        return sum + ((bars[offset + index]?.close ?? 0) * holding.quantity);
      }, 0)
    );
  }

  public async get_transactions(portfolioId: string, symbol?: string): Promise<Transaction[]> {
    return portfolioRepository.get_transactions(portfolioId, symbol);
  }

  public async record_transaction(input: AddTransactionInput): Promise<Transaction> {
    const transaction = await portfolioRepository.add_transaction(input);
    this.events.emit('portfolio:transaction_recorded', transaction);
    this.events.emit('portfolio:updated', input.portfolio_id);
    return transaction;
  }

  public async buy(portfolioId: string, symbol: string, quantity: number, price: number, notes = ''): Promise<Transaction> {
    return this.record_transaction({
      portfolio_id: portfolioId,
      symbol,
      transaction_type: 'BUY',
      quantity,
      price,
      transaction_date: today(),
      notes,
    });
  }

  public async sell(portfolioId: string, symbol: string, quantity: number, price: number, notes = ''): Promise<Transaction> {
    return this.record_transaction({
      portfolio_id: portfolioId,
      symbol,
      transaction_type: 'SELL',
      quantity,
      price,
      transaction_date: today(),
      notes,
    });
  }

  public async dividend(portfolioId: string, symbol: string, amount: number, notes = ''): Promise<Transaction> {
    return this.record_transaction({
      portfolio_id: portfolioId,
      symbol,
      transaction_type: 'DIVIDEND',
      quantity: 0,
      price: amount,
      total_value: amount,
      transaction_date: today(),
      notes,
    });
  }

  public async import_json(payload: unknown, mode: ImportMode = 'New'): Promise<Portfolio> {
    const portfolio = await portfolioRepository.import_portfolio_json(payload, mode);
    this.events.emit('portfolio:imported', portfolio);
    return portfolio;
  }

  public async export_json(portfolioId: string): Promise<PortfolioExportV1> {
    return portfolioRepository.export_portfolio_json(portfolioId);
  }
}

export const portfolioService = new PortfolioService();
