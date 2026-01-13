import { NextResponse } from 'next/server';
import { fetchLargeContracts } from '@/lib/api/usaspending.ts';

export async function GET() {
    // Cache for 1 hour (3600 seconds)
    try {
        const contracts = await fetchLargeContracts();

        // Convert to GeoJSON here to simplify frontend usage?
        // Let's return raw array and let the hook transform it like markets
        return NextResponse.json({ contracts }, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
            }
        });
    } catch (error) {
        return NextResponse.json({ contracts: [] }, { status: 500 });
    }
}
