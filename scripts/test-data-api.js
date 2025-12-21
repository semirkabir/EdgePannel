
const fetch = require('node-fetch');

async function testDataApi() {
    const minAmount = 5000;
    const url = `https://data-api.polymarket.com/trades?limit=10&filterType=CASH&filterAmount=${minAmount}&takerOnly=true`;
    console.log('Testing Data API:', url);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        console.log('Status:', res.status);
        if (res.ok) {
            const data = await res.json();
            console.log('Success, trades count:', data.length);
        } else {
            const body = await res.text();
            console.log('Error:', body.substring(0, 100));
        }
    } catch (e) {
        console.error(e);
    }
}

testDataApi();
