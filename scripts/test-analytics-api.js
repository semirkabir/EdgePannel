
const fetch = require('node-fetch');

async function testAnalytics() {
    const url = 'http://localhost:3000/api/markets/analytics?timeframe=24h&platform=all&limit=5';
    console.log('Testing Analytics API...');
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        console.log('Status:', res.status);
        const data = await res.json();
        if (res.ok) {
            console.log('Success summary:', data.summary);
            console.log('Top Gainers count:', data.topGainers ? data.topGainers.length : 0);
        } else {
            console.log('Error:', data);
        }
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}

testAnalytics();
