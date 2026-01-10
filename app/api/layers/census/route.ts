/**
 * Census Data API Route
 * 
 * Serves pre-fetched Census data from static files.
 * Supports state and county level data.
 * 
 * Endpoints:
 * GET /api/layers/census - List available datasets
 * GET /api/layers/census?dataset=population - Get state-level data
 * GET /api/layers/census?dataset=population&geography=county - Get county-level data
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchCensusData, getAvailableCensusDatasets, getAvailableGeographies, CensusDataset, CensusGeography } from '@/lib/services/census';

const VALID_DATASETS: CensusDataset[] = ['population', 'income', 'poverty', 'employment', 'trade'];
const VALID_GEOGRAPHIES: CensusGeography[] = ['state', 'county'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dataset = searchParams.get('dataset') as CensusDataset | null;
        const geography = (searchParams.get('geography') || 'state') as CensusGeography;

        // If no dataset specified, return available options
        if (!dataset) {
            return NextResponse.json({
                available: getAvailableCensusDatasets(),
                geographies: getAvailableGeographies(),
                usage: 'GET /api/layers/census?dataset=population|income|poverty|employment|trade&geography=state|county'
            });
        }

        // Validate dataset
        if (!VALID_DATASETS.includes(dataset)) {
            return NextResponse.json(
                { error: `Invalid dataset. Valid options: ${VALID_DATASETS.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate geography
        if (!VALID_GEOGRAPHIES.includes(geography)) {
            return NextResponse.json(
                { error: `Invalid geography. Valid options: ${VALID_GEOGRAPHIES.join(', ')}` },
                { status: 400 }
            );
        }

        // Fetch data
        const data = await fetchCensusData(dataset, geography);

        // Return with aggressive caching headers (data changes yearly)
        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800', // 1 day cache, 1 week stale
                'CDN-Cache-Control': 'public, max-age=604800', // 1 week for CDN
            }
        });
    } catch (error) {
        console.error('[Census API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Census data', details: String(error) },
            { status: 500 }
        );
    }
}
