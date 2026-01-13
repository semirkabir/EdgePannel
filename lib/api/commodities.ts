// Using a free commodities API or Yahoo Finance scraper equivalent if feasible
// For now, we will use a static/mock implementation pattern that can be swapped 
// with a real API key (e.g. commodities-api.com) later

export interface CommodityPrice {
    symbol: string;
    name: string;
    price: number;
    currency: string;
    unit: string;
    change: number;
}

export async function fetchCommodities(): Promise<CommodityPrice[]> {
    // In a real implementation with API key:
    // const response = await fetch('https://commodities-api.com/api/latest?access_key=API_KEY');

    // Return realistic mock data for prototype
    return [
        {
            symbol: 'BRENT',
            name: 'Brent Crude Oil',
            price: 82.50,
            currency: 'USD',
            unit: 'Barrel',
            change: 1.2
        },
        {
            symbol: 'WTI',
            name: 'WTI Crude Oil',
            price: 78.40,
            currency: 'USD',
            unit: 'Barrel',
            change: 0.8
        },
        {
            symbol: 'XAU',
            name: 'Gold',
            price: 2350.10,
            currency: 'USD',
            unit: 't oz',
            change: -0.5
        },
        {
            symbol: 'WHEAT',
            name: 'Wheat',
            price: 550.25,
            currency: 'USD',
            unit: 'Bushel',
            change: 2.1
        },
        {
            symbol: 'NG',
            name: 'Natural Gas',
            price: 2.85,
            currency: 'USD',
            unit: 'MMBtu',
            change: -1.5
        }
    ];
}
