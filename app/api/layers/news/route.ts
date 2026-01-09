import { NextResponse } from 'next/server';
import { fetchGDELTData } from '@/lib/services/gdelt';

export async function GET() {
    try {
        const data = await fetchGDELTData();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
    }
}
