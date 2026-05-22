import fs from 'fs';
import path from 'path';

const URL = 'https://raw.githubusercontent.com/cristianst85/GeoNuclearData/master/data/csv/denormalized/nuclear_power_plants.csv';
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'data', 'nuclear.generated.json');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function run() {
  console.log('[Nuclear Parser] Fetching WNA/IAEA nuclear database...');
  try {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
      throw new Error('CSV file empty or invalid');
    }

    const headers = parseCSVLine(lines[0]);
    const headerIndices = {};
    headers.forEach((h, idx) => {
      headerIndices[h] = idx;
    });

    const parsedReactors = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < headers.length) continue;

      const rawId = row[headerIndices['Id']];
      const name = row[headerIndices['Name']];
      const lat = parseFloat(row[headerIndices['Latitude']]);
      const lon = parseFloat(row[headerIndices['Longitude']]);
      const country = row[headerIndices['Country']];
      const rawStatus = row[headerIndices['Status']];
      const reactorType = row[headerIndices['ReactorType']];
      const reactorModel = row[headerIndices['ReactorModel']];
      const constructionStart = row[headerIndices['ConstructionStartAt']];
      const operationalFrom = row[headerIndices['OperationalFrom']];
      const operationalTo = row[headerIndices['OperationalTo']];
      const capacity = parseFloat(row[headerIndices['Capacity']]);

      if (isNaN(lat) || isNaN(lon)) continue;

      // Status mapping
      let status = 'active';
      if (rawStatus === 'Operational') {
        status = 'active';
      } else if (rawStatus === 'Under Construction') {
        status = 'construction';
      } else if (rawStatus === 'Permanent Shutdown') {
        status = 'decommissioned';
      } else {
        // Skip suspended or other unverified statuses to keep the dataset clean
        continue;
      }

      parsedReactors.push({
        id: `nuc-pris-${rawId}`,
        name: name || `Reactor PRIS-${rawId}`,
        lat,
        lon,
        type: 'plant',
        status,
        operator: country || undefined,
        capacity: isNaN(capacity) ? undefined : capacity,
        reactorType: reactorType || undefined,
        reactorModel: reactorModel || undefined,
        constructionStart: constructionStart || undefined,
        operationalFrom: operationalFrom || undefined,
        operationalTo: operationalTo || undefined
      });
    }

    // Ensure target directories exist
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsedReactors, null, 2), 'utf-8');
    console.log(`[Nuclear Parser] Successfully parsed ${parsedReactors.length} reactors to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('[Nuclear Parser] Ingestion failed:', err);
    process.exit(1);
  }
}

run();
