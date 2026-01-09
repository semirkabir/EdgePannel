import { NextResponse } from 'next/server';
import { fetchLiveMarketData } from '@/lib/services/alpaca';
import { fetchFREDData } from '@/lib/services/fred';
import { fetchWorldBankData } from '@/lib/services/worldbank';
import { fetchSECFilings } from '@/lib/services/sec';

export async function GET() {
    try {
        // Fetch live markets, macro data, world bank, and SEC
        const [marketData, fredData, wbData, secData] = await Promise.all([
            fetchLiveMarketData(),
            fetchFREDData(),
            fetchWorldBankData(),
            fetchSECFilings()
        ]);

        // Merge feature collections
        const features = [
            ...marketData.features,
            ...fredData.features,
            ...wbData.features,
            ...secData.features
        ];

        return NextResponse.json({
            type: 'FeatureCollection',
            features
        });
    } catch (error) {
        console.error('Finance API Error:', error);
        return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
    }
}
