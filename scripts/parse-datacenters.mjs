import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'src', 'config', 'ai-datacenters.ts');
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'data', 'datacenters.generated.json');
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function extractBaseDataCenters() {
  console.log('[Datacenter Ingestion] Extracting base Epoch AI database...');
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const startIndex = content.indexOf('export const AI_DATA_CENTERS');
    if (startIndex === -1) {
      throw new Error('Could not find AI_DATA_CENTERS export in config');
    }
    
    // Find the opening bracket of the array
    const arrayStart = content.indexOf('[', startIndex);
    if (arrayStart === -1) {
      throw new Error('Could not find array start');
    }

    // Find the closing bracket of the array
    const arrayEnd = content.lastIndexOf(']');
    if (arrayEnd === -1 || arrayEnd < arrayStart) {
      throw new Error('Could not find array end');
    }

    const arrayText = content.substring(arrayStart, arrayEnd + 1);
    
    // Evaluate safely by creating a clean function
    const evaluator = new Function(`return ${arrayText};`);
    return evaluator();
  } catch (err) {
    console.error('[Datacenter Ingestion] Failed to extract base clusters:', err);
    return [];
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = Math.abs(lat1 - lat2);
  const dLon = Math.abs(lon1 - lon2);
  return Math.sqrt(dLat * dLat + dLon * dLon); // Simple Euclidean for short distance deduplication
}

async function run() {
  const baseDataCenters = extractBaseDataCenters();
  console.log(`[Datacenter Ingestion] Extracted ${baseDataCenters.length} base Epoch AI records.`);

  const query = `[out:json][timeout:60];
(
  node["telecom"="data_center"];
  way["telecom"="data_center"];
  node["industrial"="data_center"];
  way["industrial"="data_center"];
);
out center;`;

  try {
    console.log('[Datacenter Ingestion] Fetching OSM Overpass AI/Hyperscale data centers...');
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(45_000)
    });

    if (!response.ok) {
      throw new Error(`OSM Overpass HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const elements = data.elements || [];
    console.log(`[Datacenter Ingestion] Fetched ${elements.length} raw data center candidates from OSM.`);

    const hyperscaleKeywords = [
      'amazon', 'aws', 'google', 'gcp', 'microsoft', 'azure', 
      'meta', 'facebook', 'oracle', 'equinix', 'digital realty'
    ];

    const osmDataCenters = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags.operator || tags.brand || '';
      const operator = tags.operator || tags.owner || tags.brand || 'Unknown';
      
      // Match keywords
      const nameLower = name.toLowerCase();
      const opLower = operator.toLowerCase();
      const isHyperscale = hyperscaleKeywords.some(keyword => 
        nameLower.includes(keyword) || opLower.includes(keyword)
      );

      if (!isHyperscale) continue;

      const lat = el.lat !== undefined ? el.lat : (el.center ? el.center.lat : undefined);
      const lon = el.lon !== undefined ? el.lon : (el.center ? el.center.lon : undefined);

      if (lat === undefined || lon === undefined) continue;

      // Extract power details if available
      let powerMW = undefined;
      const rawPower = tags.power || tags['power:capacity'] || tags['power_capacity'];
      if (rawPower) {
        const val = parseFloat(rawPower);
        if (!isNaN(val)) powerMW = val;
      }

      osmDataCenters.push({
        id: `dc-osm-${el.id}`,
        name: tags.name || `${operator} Data Center`,
        owner: operator,
        country: tags['addr:country'] || 'Global',
        lat,
        lon,
        status: 'existing',
        chipType: 'Unknown',
        chipCount: 0,
        powerMW,
        sector: 'Private'
      });
    }

    console.log(`[Datacenter Ingestion] Filtered ${osmDataCenters.length} hyperscale centers from OSM.`);

    // Deduplicate against base list (2km / 0.02 degree coordinate radius)
    const merged = [...baseDataCenters];
    let addedCount = 0;

    for (const osm of osmDataCenters) {
      const isDuplicate = baseDataCenters.some(base => 
        calculateDistance(base.lat, base.lon, osm.lat, osm.lon) < 0.02
      );

      if (!isDuplicate) {
        merged.push(osm);
        addedCount++;
      }
    }

    console.log(`[Datacenter Ingestion] Merged successfully: Added ${addedCount} new OSM data centers.`);
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    console.log(`[Datacenter Ingestion] Output written to ${OUTPUT_FILE} (Total: ${merged.length} datacenters).`);

  } catch (err) {
    console.warn('[Datacenter Ingestion] Fetch failed or timed out. Falling back to static Epoch AI database.', err);
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(baseDataCenters, null, 2), 'utf-8');
    console.log(`[Datacenter Ingestion] Fallback output written to ${OUTPUT_FILE} (Total: ${baseDataCenters.length} datacenters).`);
  }
}

run();
