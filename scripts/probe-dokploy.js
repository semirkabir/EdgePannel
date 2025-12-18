
const https = require('https');
const http = require('http');

const API_KEY = 'SluiOOPIzTnhGRXxMkwoejmgSarDmlyCQcQWzwnihdoagZOmulgZlVZHnQrbqehE';
const HOSTS = [
    'https://edgepannel.com',
    'http://72.62.131.136:3000',
    'http://72.62.131.136'
];

async function fetchUrl(baseUrl, path) {
    return new Promise((resolve, reject) => {
        const url = baseUrl + path;
        const client = url.startsWith('https') ? https : http;

        console.log(`Testing ${url}...`);

        const req = client.request(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, data, headers: res.headers });
            });
        });

        req.on('error', (e) => resolve({ error: e.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ error: 'Timeout' });
        });

        req.end();
    });
}

async function main() {
    // Try to find the Dokploy instance
    for (const host of HOSTS) {
        // Try TRPC endpoint for projects which is common in T3 stack (Dokploy uses T3)
        // The format is usually /api/trpc/router.procedure
        const res = await fetchUrl(host, '/api/trpc/project.all');

        if (res.status === 200 && res.headers['content-type']?.includes('application/json')) {
            console.log(`✅ Found Dokploy API at ${host}`);
            console.log('Response:', res.data.substring(0, 200));
            return;
        }

        // Try standard health check or REST endpoint if available
        const res2 = await fetchUrl(host, '/api/health'); // Guess
        if (res2.status === 200) {
            console.log(`✅ Found Dokploy API (Health) at ${host}`);
            return;
        }

        console.log(`❌ Failed at ${host}: Status ${res.status} ${res.error || ''}`);
    }

    console.log('Could not find reachable Dokploy API with provided credentials.');
}

main();
