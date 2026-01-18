
const GDELT_API_BASE = 'https://api.gdeltproject.org/api/v2/geo/geo';
const query = '(Venezuela OR Iran OR Israel OR Gaza OR Taiwan OR Ukraine OR Russia) AND (war OR conflict OR military OR weapon)';
const params = new URLSearchParams({
    query: query,
    format: 'geojson',
    timespan: '7d',
    limit: '100'
});

async function run() {
    const url = `${GDELT_API_BASE}?${params.toString()}`;
    console.log(`Fetching: ${url}`);
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(`Status: ${response.status}`);
        if (data.features) {
            console.log(`Feature count: ${data.features.length}`);
            data.features.forEach((f, i) => {
                if (i < 5) console.log(`Feature ${i}:`, JSON.stringify(f.geometry));
            });
            // Count 0,0
            const zeros = data.features.filter((f) => f.geometry.coordinates[0] === 0 && f.geometry.coordinates[1] === 0);
            console.log(`Features at 0,0: ${zeros.length}`);
        } else {
            console.log('No features found', data);
        }
    } catch (e) {
        console.error(e);
    }
}

run();
