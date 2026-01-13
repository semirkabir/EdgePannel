import { NextResponse } from 'next/server';
import { fetchGdeltFeed, GDELTFeedType } from '@/lib/api/gdelt';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const feedType = (searchParams.get('type') || 'GENERAL') as GDELTFeedType;

    // Cache for 15 minutes (900 seconds) to avoid rate limits
    try {
        const data = await fetchGdeltFeed(feedType);
        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60'
            }
        });
    } catch (error) {
        return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
    }
}
