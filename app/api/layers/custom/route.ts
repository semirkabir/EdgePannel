import { NextResponse } from 'next/server';
import { fetchUSGSEarthquakes } from '@/lib/services/usgs';

export async function GET() {
    try {
        // TODO: Integrate with user-submitted data search results
        // For now, return empty collection as requested (removing earthquake data)
        const data = { type: 'FeatureCollection', features: [] };
        return NextResponse.json(data);
    } catch (error) {
        console.error('Custom Layer API Error:', error);
        return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
    }
}
