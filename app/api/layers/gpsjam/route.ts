import { NextResponse } from 'next/server';
import { fetchGPSJammingData } from '@/lib/services/gpsjam';

export async function GET() {
  try {
    const data = await fetchGPSJammingData();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=600' // GPS jamming changes slowly, 30m cache is good
      }
    });
  } catch (error) {
    console.error('GPS Jamming API Error:', error);
    return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
  }
}
