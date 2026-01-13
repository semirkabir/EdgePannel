const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

export interface CryptoAsset {
    id: string;
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    marketCap: number;
    image: string;
}

export interface WhaleTransaction {
    id: string;
    symbol: string;
    amount: number;
    amountUsd: number;
    from: string;
    to: string;
    timestamp: string;
    isMock: boolean;
}

export async function fetchCryptoMarket(): Promise<CryptoAsset[]> {
    try {
        const params = new URLSearchParams({
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: '20',
            page: '1',
            sparkline: 'false'
        });

        const response = await fetch(`${COINGECKO_API_BASE}/coins/markets?${params.toString()}`);
        if (!response.ok) {
            console.warn(`CoinGecko API limit or error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.map((coin: any) => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            price: coin.current_price,
            change24h: coin.price_change_percentage_24h,
            marketCap: coin.market_cap,
            image: coin.image
        }));
    } catch (error) {
        console.error('Failed to fetch crypto market:', error);
        return [];
    }
}

// Since free Whale Alert API is restrictive, we'll simulate whale movements
// based on high volume movements or just mock it for the "Whale Watch" feed pattern
export function getWhaleMovements(): WhaleTransaction[] {
    // Static mock data for common whale movements
    return [
        {
            id: 'tx-1',
            symbol: 'BTC',
            amount: 1500,
            amountUsd: 1500 * 65000,
            from: 'Unknown Wallet',
            to: 'Binance',
            timestamp: new Date().toISOString(),
            isMock: true
        },
        {
            id: 'tx-2',
            symbol: 'ETH',
            amount: 25000,
            amountUsd: 25000 * 3500,
            from: 'Coinbase Cold Storage',
            to: 'Unknown Wallet',
            timestamp: new Date().toISOString(),
            isMock: true
        },
        {
            id: 'tx-3',
            symbol: 'USDT',
            amount: 100000000,
            amountUsd: 100000000,
            from: 'Tether Treasury',
            to: 'Bitfinex',
            timestamp: new Date().toISOString(),
            isMock: true
        }
    ];
}
