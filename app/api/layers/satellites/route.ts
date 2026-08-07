import { NextResponse } from 'next/server';
import { fetchSatelliteLayerData } from '@/lib/services/celestrak';

export async function GET() {
  try {
    const data = await fetchSatelliteLayerData();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120' // Satellites move fast, keep cache short (5 mins)
      }
    });
  } catch (error) {
    console.error('Celestrak Satellites API Error:', error);
    return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
  }
}
