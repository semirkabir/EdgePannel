const USASPENDING_API_BASE = 'https://api.usaspending.gov/api/v2';

export interface ContractAward {
    id: string;
    piid: string;
    description: string;
    amount: number;
    agency: string;
    recipient: string;
    date: string;
    location?: {
        lat: number;
        lng: number;
        city: string;
        state: string;
    };
}

// Major agency HQs for mapping when specific location is missing or generic
const AGENCY_LOCATIONS: Record<string, { lat: number, lng: number, name: string }> = {
    'Department of Defense': { lat: 38.8719, lng: -77.0563, name: 'The Pentagon' },
    'Department of Health and Human Services': { lat: 38.8867, lng: -77.0183, name: 'HHS HQ' },
    'Department of Energy': { lat: 38.8870, lng: -77.0260, name: 'DOE HQ' },
    'National Aeronautics and Space Administration': { lat: 38.8831, lng: -77.0163, name: 'NASA HQ' },
    'Department of Homeland Security': { lat: 38.9199, lng: -77.0700, name: 'DHS NAC' },
    'Department of State': { lat: 38.8945, lng: -77.0476, name: 'Harry S Truman Building' }
};

export async function fetchLargeContracts(): Promise<ContractAward[]> {
    try {
        // Search for recent high-value contracts
        // We utilize the advanced search endpoint which is a POST request
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const body = {
            filters: {
                time_period: [
                    {
                        start_date: thirtyDaysAgo.toISOString().split('T')[0],
                        end_date: today.toISOString().split('T')[0]
                    }
                ],
                award_type_codes: ["A", "B", "C", "D"], // Contract types
                min_award_amount: 10000000 // $10M+
            },
            fields: [
                "Award ID",
                "Description",
                "Total Obligated Amount",
                "Awarding Agency",
                "Recipient Name",
                "Action Date",
                "Place of Performance City Name",
                "Place of Performance State Code"
            ],
            limit: 50,
            page: 1,
            sort: "Total Obligated Amount",
            order: "desc"
        };

        const response = await fetch(`${USASPENDING_API_BASE}/search/spending_by_award/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.error(`USA Spending API error: ${response.status}`);
            return [];
        }

        const data = await response.json();

        return (data.results || []).map((cmd: any) => {
            // Try to determine location
            let location;
            const agencyName = cmd["Awarding Agency"];

            // Fallback to Agency HQ if no specific location or for better visibility of major players
            if (AGENCY_LOCATIONS[agencyName]) {
                location = {
                    ...AGENCY_LOCATIONS[agencyName],
                    city: 'Washington',
                    state: 'DC'
                };
            }

            return {
                id: cmd["Award ID"],
                piid: cmd["Award ID"],
                description: cmd["Description"],
                amount: cmd["Total Obligated Amount"],
                agency: agencyName,
                recipient: cmd["Recipient Name"],
                date: cmd["Action Date"],
                location
            };
        });

    } catch (error) {
        console.error('Failed to fetch Gov contracts:', error);
        return [];
    }
}
