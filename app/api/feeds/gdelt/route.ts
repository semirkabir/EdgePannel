import { NextResponse } from 'next/server';
import { fetchGdeltFeed, GDELTFeedType } from '@/lib/api/gdelt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const feedType = (searchParams.get('type') || 'GENERAL') as GDELTFeedType;

    try {
        const data = await fetchGdeltFeed(feedType);
        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error) {
        return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
    }
}
