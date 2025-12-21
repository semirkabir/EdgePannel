
const fetch = require('node-fetch');

async function testLogic() {
    try {
        console.log('Fetching markets...');
        const marketsRes = await fetch('https://gamma-api.polymarket.com/markets?limit=15&active=true&closed=false&sort=volume24hr&order=desc');

        if (!marketsRes.ok) {
            console.log('Markets req failed:', marketsRes.status);
            return;
        }

        const markets = await marketsRes.json();
        console.log('Markets type:', typeof markets);
        console.log('Markets isArray:', Array.isArray(markets));

        if (!Array.isArray(markets)) {
            console.log('Markets response:', JSON.stringify(markets).substring(0, 200));
            return;
        }

        console.log('Markets fetched:', markets.length);

        // ... rest of the logic
    } catch (e) {
        console.error('Error:', e);
    }
}
testLogic();
