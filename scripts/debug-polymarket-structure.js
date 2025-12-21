
const fetch = require('node-fetch');

async function checkPolymarketAPI() {
    try {
        // Test sort
        const urlCombined = 'https://gamma-api.polymarket.com/markets?limit=5&active=true&closed=false&sort=volume24hr&order=desc';
        console.log('Fetching sorted:', urlCombined);
        const res = await fetch(urlCombined);
        const data = await res.json();

        if (data.length > 0) {
            console.log('Top Volume Market:', data[0].question);
            console.log('Volume:', data[0].volume24hr);

            // Check for history
            const id = data[0].conditionId || data[0].id; // Gamma usually uses conditionId or id
            // Try CLOB history
            const historyUrl = `https://clob.polymarket.com/prices-history?market=${data[0].clobTokenIds ? JSON.parse(data[0].clobTokenIds)[0] : id}&interval=1d`;
            console.log('Checking history:', historyUrl);
            const histRes = await fetch(historyUrl);
            if (histRes.ok) {
                const histData = await histRes.json();
                console.log('History data length:', histData.history ? histData.history.length : 'N/A');
                console.log('Sample history:', histData.history ? histData.history.slice(0, 1) : histData);
            } else {
                console.log('History fetch failed:', histRes.status);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

checkPolymarketAPI();
