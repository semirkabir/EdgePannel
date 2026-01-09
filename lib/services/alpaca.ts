import Alpaca from '@alpacahq/alpaca-trade-api';

// Initialize Alpaca API
// User must provide env variables: NEXT_PUBLIC_ALPACA_KEY_ID and NEXT_PUBLIC_ALPACA_SECRET_KEY
// We use server-side variables usually, but for this demo ensuring it works
const alpaca = new Alpaca({
    keyId: process.env.ALPACA_KEY_ID || 'PK_MISSING_ID',
    secretKey: process.env.ALPACA_SECRET_KEY || 'MISSING_SECRET',
    paper: true,
});

export interface FinancialAsset {
    symbol: string;
    price: number;
    changePercent: number;
    type: 'stock' | 'crypto' | 'index';
}

export async function fetchLiveMarketData(): Promise<GeoJSON.FeatureCollection> {
    const assets = [
        { symbol: 'SPY', lat: 40.7, lng: -74.0, name: 'S&P 500 (NY)' },
        { symbol: 'QQQ', lat: 37.7, lng: -122.4, name: 'Nasdaq (SF/Tech)' },
        { symbol: 'GLD', lat: 51.5, lng: -0.1, name: 'Gold (London)' },
        { symbol: 'USO', lat: 29.7, lng: -95.3, name: 'Oil (Houston)' },
        { symbol: 'EWJ', lat: 35.7, lng: 139.7, name: 'Japan Index (Tokyo)' },
        { symbol: 'EWG', lat: 52.5, lng: 13.4, name: 'German Index (Berlin)' },
        { symbol: 'EWZ', lat: -23.5, lng: -46.6, name: 'Brazil Index (Sao Paulo)' },
    ];

    try {
        // Check if keys are actually present to avoid crashing
        if (!process.env.ALPACA_KEY_ID) {
            console.warn('Alpaca keys missing. Returning mock data.');
            return mockFinanceData(assets);
        }

        const features = await Promise.all(assets.map(async (asset) => {
            try {
                // Fetch snapshot (latest trade/quote)
                // Note: Free tier might not support 'snapshot' for all symbols or might be delayed.
                // We will try fetching latest bar or trade.
                const bar = await alpaca.getLatestBar(asset.symbol);

                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [asset.lng, asset.lat] },
                    properties: {
                        type: 'FINANCE',
                        symbol: asset.symbol,
                        title: `${asset.symbol} - ${asset.name}`,
                        price: (bar as any)?.c || (bar as any)?.Close || 0,
                        // Calculate pseudo-change if not available directly from single bar
                        // In real app, we'd get previous close. For now, assume open vs close
                        change: (((bar as any)?.c || 0) - ((bar as any)?.o || 0)) / ((bar as any)?.o || 1) * 100 + '%',
                        volume: (bar as any)?.v || (bar as any)?.Volume,
                        source: 'Alpaca'
                    }
                };
            } catch (e) {
                console.warn(`Failed to fetch ${asset.symbol}:`, e);
                return null;
            }
        }));

        return {
            type: 'FeatureCollection',
            features: features.filter(f => f !== null) as any[]
        };

    } catch (error) {
        console.error('Alpaca service error:', error);
        return mockFinanceData(assets);
    }
}

// Helper to get diverse US tickers for "movers" simulation
const US_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC', 'F', 'BAC', 'DIS', 'KO', 'PEP', 'JPM', 'V', 'SPY', 'QQQ', 'IWM', 'COIN', 'MSTR', 'PLTR', 'HOOD', 'GME', 'AMC'];

export async function getTopMovers(region: string, type: 'gainers' | 'losers' | 'active') {
    // Alpaca is primarily US market data.
    // If region is US, we fetch real snapshots for a basket of stocks and sort them.
    // For International, we must mock or use a different provider (Alpaca doesn't support global data well on free tier).

    if (region === 'US') {
        try {
            if (!process.env.ALPACA_KEY_ID) throw new Error('No Alpaca Keys');

            // Fetch snapshots for our watchlist
            const snapshots = await alpaca.getSnapshots(US_TICKERS);

            const movers = US_TICKERS.map(symbol => {
                const snap = (snapshots as any)[symbol];
                if (!snap || !snap.dailyBar) return null;

                const prevClose = snap.prevDailyBar?.c || snap.dailyBar.o; // Fallback to open if prev close missing
                const current = snap.dailyBar.c;
                const change = ((current - prevClose) / prevClose) * 100;

                return {
                    ticker: symbol,
                    name: symbol, // Alpaca snapshot doesn't have company name, would need ref data
                    price: current,
                    changePercent: change,
                    volume: snap.dailyBar.v
                };
            }).filter(item => item !== null) as any[];

            // Sort based on type
            if (type === 'gainers') {
                return movers.sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
            } else if (type === 'losers') {
                return movers.sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
            } else {
                return movers.sort((a, b) => b.volume - a.volume).slice(0, 5);
            }

        } catch (e) {
            console.error('Alpaca Movers Error:', e);
            // Fallback to mock US data if API fails
            return getMockMovers('US', type);
        }
    }

    // Non-US Regions - Fallback to specialized mock data
    return getMockMovers(region, type);
}

function getMockMovers(region: string, type: 'gainers' | 'losers' | 'active') {
    const isGainer = type === 'gainers';
    const isLoser = type === 'losers';

    // Multipliers for direction
    const dir = isGainer ? 1 : isLoser ? -1 : 0;

    // Regional tickers with proper company names
    const REGION_DATA: Record<string, Array<{ ticker: string; name: string; basePrice: number }>> = {
        'US': [
            { ticker: 'AAPL', name: 'Apple Inc.', basePrice: 185 },
            { ticker: 'NVDA', name: 'NVIDIA Corporation', basePrice: 480 },
            { ticker: 'TSLA', name: 'Tesla, Inc.', basePrice: 250 },
            { ticker: 'AMD', name: 'Advanced Micro Devices', basePrice: 135 },
            { ticker: 'AMZN', name: 'Amazon.com, Inc.', basePrice: 178 },
            { ticker: 'MSFT', name: 'Microsoft Corporation', basePrice: 380 },
            { ticker: 'GOOGL', name: 'Alphabet Inc.', basePrice: 140 },
            { ticker: 'META', name: 'Meta Platforms, Inc.', basePrice: 350 },
        ],
        'CA': [
            { ticker: 'SHOP', name: 'Shopify Inc.', basePrice: 80 },
            { ticker: 'RY', name: 'Royal Bank of Canada', basePrice: 95 },
            { ticker: 'TD', name: 'Toronto-Dominion Bank', basePrice: 60 },
            { ticker: 'CNR', name: 'Canadian National Railway', basePrice: 120 },
            { ticker: 'ENB', name: 'Enbridge Inc.', basePrice: 35 },
        ],
        'GB': [
            { ticker: 'AZN', name: 'AstraZeneca PLC', basePrice: 115 },
            { ticker: 'HSBA', name: 'HSBC Holdings plc', basePrice: 42 },
            { ticker: 'SHEL', name: 'Shell plc', basePrice: 62 },
            { ticker: 'BP', name: 'BP p.l.c.', basePrice: 35 },
            { ticker: 'ULVR', name: 'Unilever PLC', basePrice: 48 },
        ],
        'JP': [
            { ticker: '7203', name: 'Toyota Motor Corp', basePrice: 2850 },
            { ticker: '6758', name: 'Sony Group Corporation', basePrice: 12500 },
            { ticker: '9984', name: 'SoftBank Group Corp', basePrice: 6800 },
            { ticker: '7974', name: 'Nintendo Co., Ltd.', basePrice: 6500 },
            { ticker: '6861', name: 'Keyence Corporation', basePrice: 58000 },
        ],
        'AU': [
            { ticker: 'BHP', name: 'BHP Group Limited', basePrice: 48 },
            { ticker: 'CBA', name: 'Commonwealth Bank', basePrice: 115 },
            { ticker: 'CSL', name: 'CSL Limited', basePrice: 280 },
            { ticker: 'NAB', name: 'National Australia Bank', basePrice: 32 },
            { ticker: 'WBC', name: 'Westpac Banking Corp', basePrice: 24 },
        ],
        'IN': [
            { ticker: 'RELIANCE', name: 'Reliance Industries', basePrice: 2450 },
            { ticker: 'TCS', name: 'Tata Consultancy Services', basePrice: 3800 },
            { ticker: 'HDFCBANK', name: 'HDFC Bank Limited', basePrice: 1650 },
            { ticker: 'INFY', name: 'Infosys Limited', basePrice: 1480 },
            { ticker: 'ITC', name: 'ITC Limited', basePrice: 460 },
        ],
        'CN': [
            { ticker: '600519', name: 'Kweichow Moutai', basePrice: 1800 },
            { ticker: '601398', name: 'ICBC', basePrice: 5.2 },
            { ticker: '601288', name: 'Agricultural Bank of China', basePrice: 3.8 },
            { ticker: '601857', name: 'PetroChina', basePrice: 8.5 },
            { ticker: '600036', name: 'China Merchants Bank', basePrice: 35 },
        ],
        'HK': [
            { ticker: '0700', name: 'Tencent Holdings', basePrice: 380 },
            { ticker: '9988', name: 'Alibaba Group', basePrice: 85 },
            { ticker: '0005', name: 'HSBC Holdings', basePrice: 58 },
            { ticker: '1299', name: 'AIA Group Limited', basePrice: 65 },
            { ticker: '0941', name: 'China Mobile', basePrice: 72 },
        ],
        'KR': [
            { ticker: '005930', name: 'Samsung Electronics', basePrice: 72000 },
            { ticker: '000660', name: 'SK Hynix Inc.', basePrice: 135000 },
            { ticker: '207940', name: 'Samsung Biologics', basePrice: 850000 },
            { ticker: '035420', name: 'NAVER Corporation', basePrice: 195000 },
            { ticker: '051910', name: 'LG Chem', basePrice: 520000 },
        ],
        'DE': [
            { ticker: 'SAP', name: 'SAP SE', basePrice: 155 },
            { ticker: 'SIE', name: 'Siemens AG', basePrice: 165 },
            { ticker: 'ALV', name: 'Allianz SE', basePrice: 245 },
            { ticker: 'DTE', name: 'Deutsche Telekom AG', basePrice: 22 },
            { ticker: 'VOW3', name: 'Volkswagen AG', basePrice: 115 },
        ],
        'FR': [
            { ticker: 'MC', name: 'LVMH', basePrice: 850 },
            { ticker: 'TTE', name: 'TotalEnergies SE', basePrice: 62 },
            { ticker: 'OR', name: "L'Oréal S.A.", basePrice: 445 },
            { ticker: 'SAN', name: 'Sanofi', basePrice: 95 },
            { ticker: 'AIR', name: 'Airbus SE', basePrice: 145 },
        ],
        'CH': [
            { ticker: 'NESN', name: 'Nestlé S.A.', basePrice: 105 },
            { ticker: 'ROG', name: 'Roche Holding AG', basePrice: 265 },
            { ticker: 'NOVN', name: 'Novartis AG', basePrice: 98 },
            { ticker: 'UBSG', name: 'UBS Group AG', basePrice: 28 },
            { ticker: 'ZURN', name: 'Zurich Insurance', basePrice: 470 },
        ],
        'SA': [
            { ticker: '2222', name: 'Saudi Aramco', basePrice: 32 },
            { ticker: '1180', name: 'Al Rajhi Bank', basePrice: 95 },
            { ticker: '2010', name: 'SABIC', basePrice: 85 },
            { ticker: '1120', name: 'Al Rajhi Holdings', basePrice: 75 },
            { ticker: '2350', name: 'Saudi Kayan', basePrice: 15 },
        ],
        'IL': [
            { ticker: 'NICE', name: 'NICE Ltd.', basePrice: 195 },
            { ticker: 'CHKP', name: 'Check Point Software', basePrice: 145 },
            { ticker: 'TEVA', name: 'Teva Pharmaceutical', basePrice: 12 },
            { ticker: 'WIXW', name: 'Wix.com Ltd.', basePrice: 125 },
            { ticker: 'MNDY', name: 'monday.com Ltd.', basePrice: 180 },
        ],
        'BR': [
            { ticker: 'VALE3', name: 'Vale S.A.', basePrice: 68 },
            { ticker: 'PETR4', name: 'Petrobras', basePrice: 38 },
            { ticker: 'ITUB4', name: 'Itaú Unibanco', basePrice: 32 },
            { ticker: 'BBDC4', name: 'Bradesco', basePrice: 15 },
            { ticker: 'ABEV3', name: 'Ambev S.A.', basePrice: 13 },
        ],
        'SG': [
            { ticker: 'D05', name: 'DBS Group Holdings', basePrice: 35 },
            { ticker: 'O39', name: 'OCBC Bank', basePrice: 13 },
            { ticker: 'U11', name: 'United Overseas Bank', basePrice: 30 },
            { ticker: 'Z74', name: 'Singapore Telecommunications', basePrice: 2.8 },
            { ticker: 'C6L', name: 'Singapore Airlines', basePrice: 6.5 },
        ],
        'ZA': [
            { ticker: 'NPN', name: 'Naspers Limited', basePrice: 3200 },
            { ticker: 'SOL', name: 'Sasol Limited', basePrice: 180 },
            { ticker: 'FSR', name: 'FirstRand Limited', basePrice: 68 },
            { ticker: 'SBK', name: 'Standard Bank Group', basePrice: 175 },
            { ticker: 'AGL', name: 'Anglo American plc', basePrice: 520 },
        ],
    };

    const stocks = REGION_DATA[region] || REGION_DATA['US'];

    return stocks.slice(0, 5).map(stock => {
        const change = dir !== 0
            ? (Math.random() * 5 * dir) + (Math.random() * dir)
            : (Math.random() * 10 - 5);

        // Add some variation to base price
        const priceVariation = stock.basePrice * (0.95 + Math.random() * 0.1);

        return {
            ticker: stock.ticker,
            name: stock.name,
            price: priceVariation,
            changePercent: change,
            volume: Math.floor(Math.random() * 10000000 + 1000000)
        };
    }).sort((a, b) => {
        if (isGainer) return b.changePercent - a.changePercent;
        if (isLoser) return a.changePercent - b.changePercent;
        return b.volume - a.volume;
    });
}

function mockFinanceData(assets: any[]): GeoJSON.FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: assets.map(a => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
            properties: {
                type: 'FINANCE',
                symbol: a.symbol,
                title: a.name,
                price: (Math.random() * 400 + 100).toFixed(2),
                change: (Math.random() * 4 - 2).toFixed(2) + '%',
                source: 'Mock (Setup Keys)'
            }
        }))
    };
}
