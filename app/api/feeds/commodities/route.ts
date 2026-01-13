import { NextResponse } from 'next/server';
import { fetchCommodities } from '@/lib/api/commodities';

export async function GET() {
    // Cache for 1 hour
    try {
        const commodities = await fetchCommodities();
        return NextResponse.json({ commodities }, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
            }
        });
    } catch (error) {
        return NextResponse.json({ commodities: [] }, { status: 500 });
    }
}
