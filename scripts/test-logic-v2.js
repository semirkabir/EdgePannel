
const fetch = require('node-fetch');

async function testAnalytics() {
    const url = 'https://gamma-api.polymarket.com/markets?limit=100&active=true&closed=false';
    console.log('Testing Analytics logic...');
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.log('Fail:', res.status);
            return;
        }
        const nodes = await res.json();
        console.log('Success, fetched:', nodes.length);
        nodes.sort((a, b) => parseFloat(b.volume || 0) - parseFloat(a.volume || 0));
        const top = nodes.slice(0, 5);
        top.forEach(m => console.log(`- ${m.question} (Vol: ${m.volume})`));
    } catch (e) {
        console.error(e);
    }
}

testAnalytics();
