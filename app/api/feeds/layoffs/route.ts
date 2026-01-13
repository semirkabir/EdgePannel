import { NextResponse } from 'next/server';
import { getRecentLayoffs } from '@/lib/api/layoffs';

export async function GET() {
    // Cache for 24 hours
    try {
        const layoffs = getRecentLayoffs();
        return NextResponse.json({ layoffs }, {
            headers: {
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
            }
        });
    } catch (error) {
        return NextResponse.json({ layoffs: [] }, { status: 500 });
    }
}
