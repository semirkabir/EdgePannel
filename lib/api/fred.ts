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

export function getMockFredData(seriesId: EconomicIndicator): FredSeriesData {
    const now = new Date();
    const observations: FredObservation[] = [];
    
    if (seriesId === 'M2SL') {
        // Return last 24 months of M2 Money Supply in Billions (fluctuating around $20.8T)
        let val = 20850;
        for (let i = 24; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            val = val * (1 + (Math.sin(i) * 0.0015 + 0.0008));
            observations.push({
                date: d.toISOString().split('T')[0],
                value: parseFloat(val.toFixed(1))
            });
        }
    } else if (seriesId === 'FEDFUNDS') {
        // Return Fed Funds Rate history (holding at 5.33% for the last 15 months, preceded by hikes from 0.08%)
        let rate = 5.33;
        for (let i = 24; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            if (i > 15) {
                rate = 5.33 - (i - 15) * 0.35;
                if (rate < 0.08) rate = 0.08;
            } else {
                rate = 5.33;
            }
            observations.push({
                date: d.toISOString().split('T')[0],
                value: parseFloat(rate.toFixed(2))
            });
        }
    } else {
        // CPIAUCSL (steady historical CPI around 312.2)
        let cpi = 312.2;
        for (let i = 24; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            cpi = cpi * (1 - 0.0022);
            observations.push({
                date: d.toISOString().split('T')[0],
                value: parseFloat(cpi.toFixed(3))
            });
        }
    }

    // Reverse so newest is first as expected by FRED client
    observations.reverse();

    return {
        id: seriesId,
        title: SERIES_INFO[seriesId]?.title || seriesId,
        observations,
        lastUpdated: now.toISOString()
    };
}

export async function fetchFredData(seriesId: EconomicIndicator): Promise<FredSeriesData | null> {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
        console.warn('FRED_API_KEY is not set, returning realistic mock economic observations.');
        return getMockFredData(seriesId);
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
            console.error(`FRED API error: ${response.status} ${response.statusText}, falling back to mock observations.`);
            return getMockFredData(seriesId);
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
        console.error('Failed to fetch FRED data, falling back to mock observations:', error);
        return getMockFredData(seriesId);
    }
}
