import { NextResponse } from 'next/server';
import { fetchCryptoMarket, getWhaleMovements } from '@/lib/api/coingecko';

export async function GET() {
    // Cache for 5 minutes
    try {
        const [market, whales] = await Promise.all([
            fetchCryptoMarket(),
            Promise.resolve(getWhaleMovements())
        ]);

        return NextResponse.json({ market, whales }, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
            }
        });
    } catch (error) {
        return NextResponse.json({ market: [], whales: [] }, { status: 500 });
    }
}
