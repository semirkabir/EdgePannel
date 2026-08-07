import { NextResponse } from 'next/server';
import { fetchUSNIFleetReport } from '@/lib/services/usni';

export async function GET() {
  try {
    const data = await fetchUSNIFleetReport();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('USNI Fleet API Error:', error);
    return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
  }
}
