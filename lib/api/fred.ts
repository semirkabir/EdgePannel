const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export type EconomicIndicator = 'M2SL' | 'FEDFUNDS' | 'CPIAUCSL';

export interface FredObservation {
    date: string;
    value: number;
}

export interface FredSeriesData {
    id: string;
    title: string;
    observations: FredObservation[];
    lastUpdated: string;
}

const SERIES_INFO: Record<string, { title: string }> = {
    M2SL: { title: 'M2 Money Supply' },
    FEDFUNDS: { title: 'Federal Funds Rate' },
    CPIAUCSL: { title: 'Consumer Price Index (CPI)' }
};

export async function fetchFredData(seriesId: EconomicIndicator): Promise<FredSeriesData | null> {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
        console.warn('FRED_API_KEY is not set');
        return null;
    }

    const params = new URLSearchParams({
        series_id: seriesId,
        api_key: apiKey,
        file_type: 'json',
        sort_order: 'desc',
        limit: '50' // Last 50 observations
    });

    try {
        const response = await fetch(`${FRED_API_BASE}?${params.toString()}`);
        if (!response.ok) {
            console.error(`FRED API error: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();

        // Transform observations
        const observations = (data.observations || [])
            .map((obs: any) => ({
                date: obs.date,
                value: parseFloat(obs.value)
            }))
            .filter((obs: any) => !isNaN(obs.value));

        return {
            id: seriesId,
            title: SERIES_INFO[seriesId]?.title || seriesId,
            observations,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Failed to fetch FRED data:', error);
        return null;
    }
}
