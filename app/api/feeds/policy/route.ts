import { NextResponse } from 'next/server';
import { fetchRecentBills } from '@/lib/api/congress';

export async function GET() {
    // Cache for 1 hour
    try {
        const bills = await fetchRecentBills();
        return NextResponse.json({ bills }, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
            }
        });
    } catch (error) {
        return NextResponse.json({ bills: [] }, { status: 500 });
    }
}
