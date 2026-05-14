import https from 'https';
import zlib from 'zlib';

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'test' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchBuffer(res.headers.location).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function main() {
  const buf = await fetchBuffer('https://github.com/dr5hn/countries-states-cities-database/releases/download/v3.2-export.2/json-countries%2Bstates%2Bcities.json.gz');
  let text;
  try { text = zlib.gunzipSync(buf).toString('utf8'); } catch { text = buf.toString('utf8'); }
  const data = JSON.parse(text);
  console.log('Type:', typeof data);
  if (Array.isArray(data)) {
    console.log('Array length:', data.length);
    console.log('First item keys:', Object.keys(data[0]));
  } else {
    console.log('Top-level keys:', Object.keys(data));
    for (const key of Object.keys(data)) {
      const val = data[key];
      console.log(`  ${key}:`, Array.isArray(val) ? `array[${val.length}]` : typeof val);
      if (Array.isArray(val) && val.length > 0) {
        console.log(`    First item keys:`, Object.keys(val[0]));
      }
    }
  }
}
main().catch(console.error);
