import { StockMover, IndexData, SectorData } from '@/types/exchange';

const BASE_URL = 'https://query1.finance.yahoo.com';
const BASE_URL_V2 = 'https://query2.finance.yahoo.com';

export class YahooFinanceClient {
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  /**
   * Get market movers for a specific region
   */
  async getMarketMovers(region: string = 'US', count: number = 5): Promise<{
    gainers: StockMover[];
    losers: StockMover[];
    mostActive: StockMover[];
  }> {
    try {
      const [gainers, losers, mostActive] = await Promise.all([
        this.fetchMovers('gainers', region, count),
        this.fetchMovers('losers', region, count),
        this.fetchMovers('most-active', region, count),
      ]);

      return { gainers, losers, mostActive };
    } catch (error) {
      console.error('[YahooFinance] Error fetching market movers:', error);
      return { gainers: [], losers: [], mostActive: [] };
    }
  }

  /**
   * Fetch specific type of movers
   */
  private async fetchMovers(
    type: 'gainers' | 'losers' | 'most-active',
    region: string,
    count: number
  ): Promise<StockMover[]> {
    try {
      const url = `${BASE_URL}/v1/finance/screener/predefined/saved?formatted=true&lang=en-US&region=${region}&scrIds=day_${type}&count=${count}`;

      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const quotes = data?.finance?.result?.[0]?.quotes || [];

      return quotes.map((quote: any) => ({
        ticker: quote.symbol || '',
        name: quote.shortName || quote.longName || quote.symbol,
        price: quote.regularMarketPrice?.raw || quote.regularMarketPrice || 0,
        change: quote.regularMarketChange?.raw || quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent?.raw || quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume?.raw || quote.regularMarketVolume || 0,
        marketCap: quote.marketCap?.raw || quote.marketCap,
        sector: quote.sector,
      }));
    } catch (error) {
      console.error(`[YahooFinance] Error fetching ${type}:`, error);
      return [];
    }
  }

  /**
   * Get quotes for specific symbols
   */
  async getQuotes(symbols: string[]): Promise<StockMover[]> {
    try {
      const symbolsStr = symbols.join(',');
      const url = `${BASE_URL}/v7/finance/quote?symbols=${symbolsStr}&fields=symbol,shortName,longName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap`;

      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const quotes = data?.quoteResponse?.result || [];

      return quotes.map((quote: any) => ({
        ticker: quote.symbol || '',
        name: quote.shortName || quote.longName || quote.symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        marketCap: quote.marketCap,
      }));
    } catch (error) {
      console.error('[YahooFinance] Error fetching quotes:', error);
      return [];
    }
  }

  /**
   * Get sparkline data for a symbol
   */
  async getSparkline(symbol: string, range: string = '1d'): Promise<number[]> {
    try {
      const url = `${BASE_URL}/v8/finance/spark?symbols=${symbol}&range=${range}&interval=5m`;

      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const spark = data?.[symbol]?.close || [];

      return spark;
    } catch (error) {
      console.error(`[YahooFinance] Error fetching sparkline for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get major index quotes
   */
  async getIndices(symbols: string[]): Promise<IndexData[]> {
    try {
      const quotes = await this.getQuotes(symbols);

      return quotes.map(quote => ({
        symbol: quote.ticker,
        name: quote.name,
        value: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      console.error('[YahooFinance] Error fetching indices:', error);
      return [];
    }
  }
}

export const yahooFinance = new YahooFinanceClient();
