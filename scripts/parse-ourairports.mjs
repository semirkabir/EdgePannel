import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const AIRPORTS_CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const COUNTRIES_CSV_URL = 'https://davidmegginson.github.io/ourairports-data/countries.csv';
const OUTPUT_FILE = path.resolve('public/data/airports.generated.json');

// Region mapping based on country and continent
function determineRegion(countryCode, continent) {
  const code = countryCode.toUpperCase();
  
  // MENA (Middle East & North Africa) + Central Asia / nearby strategic zones
  const menaCountries = new Set([
    'AE', 'QA', 'SA', 'EG', 'IL', 'JO', 'BH', 'KW', 'OM', 'MA', 'DZ', 'TN', 'IR', 'IQ', 'LB', 'SY', 'YE', 'LY', 'SD', 'AF'
  ]);
  
  if (menaCountries.has(code)) {
    return 'mena';
  }
  
  // Continent checks
  const cont = continent.toUpperCase();
  if (cont === 'EU') {
    return 'europe';
  }
  if (cont === 'NA' || cont === 'SA') {
    return 'americas';
  }
  if (cont === 'AF') {
    return 'africa'; // Non-MENA Africa
  }
  // Asia (AS) and Oceania (OC)
  return 'apac';
}

async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  return await res.text();
}

async function main() {
  console.log('--- Fetching OurAirports Datasets ---');
  
  try {
    // 1. Fetch datasets in parallel
    const [airportsCsvText, countriesCsvText] = await Promise.all([
      fetchCSV(AIRPORTS_CSV_URL),
      fetchCSV(COUNTRIES_CSV_URL)
    ]);
    
    console.log('Successfully fetched datasets. Parsing countries...');
    
    // 2. Parse countries
    const countriesData = Papa.parse(countriesCsvText, { header: true, skipEmptyLines: true }).data;
    const countryMap = new Map();
    for (const row of countriesData) {
      if (row.code && row.name) {
        countryMap.set(row.code.toUpperCase(), row.name.trim());
      }
    }
    
    console.log(`Parsed ${countryMap.size} country mappings. Parsing airports...`);
    
    // 3. Parse airports
    const airportsData = Papa.parse(airportsCsvText, { header: true, skipEmptyLines: true }).data;
    console.log(`Loaded ${airportsData.length} airports. Filtering and cleaning...`);
    
    const processedAirports = [];
    
    for (const row of airportsData) {
      // Filter: only large and medium active airports
      const type = row.type ? row.type.trim() : '';
      if (type !== 'large_airport' && type !== 'medium_airport') {
        continue;
      }
      
      // Filter: must have valid IATA and ICAO (ident) codes
      const iata = row.iata_code ? row.iata_code.trim().toUpperCase() : '';
      const icao = row.ident ? row.ident.trim().toUpperCase() : '';
      
      // Exclude invalid/placeholder IATA/ICAO codes
      if (!iata || iata === '\\N' || iata.length !== 3 || !icao || icao.length !== 4) {
        continue;
      }
      
      const lat = parseFloat(row.latitude_deg);
      const lon = parseFloat(row.longitude_deg);
      
      if (isNaN(lat) || isNaN(lon)) {
        continue;
      }
      
      const countryCode = row.iso_country ? row.iso_country.trim().toUpperCase() : '';
      const countryName = countryMap.get(countryCode) || countryCode;
      
      const city = row.municipality ? row.municipality.trim() : 'Unknown';
      const name = row.name ? row.name.trim() : `${city} Airport`;
      const continent = row.continent ? row.continent.trim() : 'AS';
      
      const region = determineRegion(countryCode, continent);
      
      processedAirports.push({
        iata,
        icao,
        name,
        city,
        country: countryName,
        lat,
        lon,
        region
      });
    }
    
    console.log(`Filter results: ${processedAirports.length} strategic airports selected.`);
    
    // 4. Ensure directories exist and write JSON
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedAirports, null, 2), 'utf8');
    console.log(`Saved clean dynamic airport dataset to ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB)`);
    
  } catch (err) {
    console.error('Execution failed:', err);
    process.exit(1);
  }
}

main();
