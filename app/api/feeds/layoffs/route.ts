import { NextRequest, NextResponse } from 'next/server';
import { getRecentLayoffs } from '@/lib/api/layoffs';
import { LayoffsQuerySchema } from '@/lib/api/schemas';
import { validateQuery } from '@/lib/api/validate';

export async function GET(request: NextRequest) {
    // Cache for 24 hours
    try {
        const { searchParams } = new URL(request.url);
        const params = validateQuery(LayoffsQuerySchema, searchParams);
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
