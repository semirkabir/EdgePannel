
const fetch = require('node-fetch');

async function checkFields() {
    const url = 'https://gamma-api.polymarket.com/markets?limit=5&active=true&closed=false';
    try {
        const res = await fetch(url);
        const data = await res.json();
        data.forEach(m => {
            console.log(`Market: ${m.question}`);
            const hits = Object.keys(m).filter(k => k.toLowerCase().includes('change') || k.toLowerCase().includes('24h') || k.toLowerCase().includes('one_day'));
            hits.forEach(k => console.log(`  ${k}: ${m[k]}`));
        });
    } catch (e) {
        console.error(e);
    }
}

checkFields();
