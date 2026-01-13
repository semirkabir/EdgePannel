import { NextResponse } from 'next/server';
import { fetchFredData, EconomicIndicator } from '@/lib/api/fred';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const seriesId = (searchParams.get('series') || 'M2SL') as EconomicIndicator;

    // Cache for 24 hours (86400 seconds) since economic data changes slowly
    try {
        const data = await fetchFredData(seriesId);
        return NextResponse.json(data || {}, {
            headers: {
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
            }
        });
    } catch (error) {
        return NextResponse.json({}, { status: 500 });
    }
}
