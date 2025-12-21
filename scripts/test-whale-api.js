
const fetch = require('node-fetch');

async function testWhaleActivity() {
    const url = 'http://localhost:3000/api/whale-activity?timeframe=24h&minAmount=5000&limit=5';
    console.log('Testing Whale Activity API...');
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'empty'
            }
        });
        console.log('Status:', res.status);
        const data = await res.json();
        if (res.ok) {
            console.log('Success, trades found:', data.trades ? data.trades.length : 0);
            if (data.trades && data.trades.length > 0) {
                console.log('Top trade:', data.trades[0].marketTitle, 'Amount:', data.trades[0].amount);
            }
        } else {
            console.log('Error:', data);
        }
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}

testWhaleActivity();
