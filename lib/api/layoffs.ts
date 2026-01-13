export interface LayoffEvent {
    id: string;
    company: string;
    date: string;
    employees: number;
    location: string;
    industry: string;
    source: string;
    lat?: number;
    lng?: number;
}

// Since Layoffs.fyi doesn't have a public API, we maintain a 
// recently updated list or use this structure to feed manual updates
export function getRecentLayoffs(): LayoffEvent[] {
    return [
        {
            id: 'l-1',
            company: 'TechCorp Global',
            date: new Date().toISOString().split('T')[0],
            employees: 1500,
            location: 'San Francisco, CA',
            industry: 'Software',
            source: 'Internal Memo',
            lat: 37.7749,
            lng: -122.4194
        },
        {
            id: 'l-2',
            company: 'FinStream',
            date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
            employees: 300,
            location: 'New York, NY',
            industry: 'Finance',
            source: 'News Report',
            lat: 40.7128,
            lng: -74.0060
        },
        {
            id: 'l-3',
            company: 'AutoDrive AI',
            date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
            employees: 850,
            location: 'Austin, TX',
            industry: 'AI/Auto',
            source: 'WARN Notice',
            lat: 30.2672,
            lng: -97.7431
        },
        {
            id: 'l-4',
            company: 'LogiChain',
            date: new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0],
            employees: 2000,
            location: 'Seattle, WA',
            industry: 'Logistics',
            source: 'Press Release',
            lat: 47.6062,
            lng: -122.3321
        }
    ];
}
