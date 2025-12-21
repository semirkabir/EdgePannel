
const fetch = require('node-fetch');

async function test(sortParam) {
    const url = `https://gamma-api.polymarket.com/markets?limit=10&active=true&closed=false${sortParam ? `&sort=${sortParam}&order=desc` : ''}`;
    console.log('Testing URL:', url);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const text = await res.text();
            console.log(`Failed with ${res.status}: ${text}`);
        } else {
            const data = await res.json();
            console.log('Success! Count:', data.length);
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

async function runTests() {
    await test(null);
    await test('volumeNum');
    await test('volume');
    await test('liquidity');
}

runTests();
