const CONGRESS_API_BASE = 'https://api.congress.gov/v3';

export interface Bill {
    id: string;
    number: string;
    title: string;
    congress: string;
    lastActionDate: string;
    url: string;
    policyArea?: string;
    originChamber: 'House' | 'Senate';
}

export async function fetchRecentBills(): Promise<Bill[]> {
    const apiKey = process.env.CONGRESS_API_KEY;
    if (!apiKey) {
        console.warn('CONGRESS_API_KEY is not set');
        return [];
    }

    // Determine current congress (e.g., 119th in 2025/2026)
    // For simplicity we can just list recent bills from the endpoint without knowing the number strictly,
    // but api.congress.gov usually requires a congress number or specialized 'bill' endpoint navigation.
    // We'll use the /bill endpoint which lists bills. We can filter by sort desc.

    try {
        const params = new URLSearchParams({
            api_key: apiKey,
            format: 'json',
            limit: '20',
            sort: 'updateDate+desc'
        });

        const response = await fetch(`${CONGRESS_API_BASE}/bill?${params.toString()}`);
        if (!response.ok) {
            console.error(`Congress API error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const bills = data.bills || [];

        return bills.map((b: any) => ({
            id: `${b.congress}-${b.type}-${b.number}`,
            number: b.number,
            title: b.title,
            congress: b.congress,
            lastActionDate: b.updateDate,
            url: b.url,
            policyArea: b.policyArea?.name,
            originChamber: b.originChamber
        }));

    } catch (error) {
        console.error('Failed to fetch Congress bills:', error);
        return [];
    }
}
