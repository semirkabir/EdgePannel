const fetch = require('node-fetch');

async function inspect() {
    try {
        const url = 'https://gamma-api.polymarket.com/markets?limit=1&active=true&closed=false&sort=volume24hr&order=desc';
        console.log('Fetching:', url);
        const res = await fetch(url);
        if (!res.ok) {
            console.error('Failed:', res.status, res.statusText);
            return;
        }
        const data = await res.json();
        if (data && data.length > 0) {
            console.log('--- MARKET DATA START ---');
            console.log(JSON.stringify(data[0], null, 2));
            console.log('--- MARKET DATA END ---');

            // Also check keys specifically
            console.log('Top Level Keys:', Object.keys(data[0]));
        } else {
            console.log('No markets found');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

inspect();
