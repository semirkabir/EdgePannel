
const fetch = require('node-fetch');

async function testImageFetch() {
    const url = 'https://images.kalshi.com/kalshi-logo-square.png';
    console.log('Fetching:', url);
    try {
        const res = await fetch(url);
        console.log('Status:', res.status);
        console.log('Content-Type:', res.headers.get('content-type'));
        if (res.ok) {
            console.log('Fetch successful');
        } else {
            const body = await res.text();
            console.log('Error body (first 100 chars):', body.substring(0, 100));
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

testImageFetch();
