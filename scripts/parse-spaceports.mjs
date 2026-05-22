import fs from 'fs';
import path from 'path';

const SPACEPORTS_GEOJSON_URL = 'https://raw.githubusercontent.com/visionscarto/spaceports/master/spaceports.geojson';
const OUTPUT_FILE = path.resolve('public/data/spaceports.generated.json');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function determineLaunches(name) {
  const n = name.toLowerCase();
  const highVolume = [
    'kennedy', 'boca chica', 'starbase', 'cape canaveral', 'jiuquan', 'xichang', 'wenchang'
  ];
  const mediumVolume = [
    'vandenberg', 'baikonur', 'plesetsk', 'guiana', 'kourou', 'satish dhawan', 'sriharikota', 'tanegashima', 'wallops', 'taiyuan', 'semnan'
  ];
  
  if (highVolume.some(keyword => n.includes(keyword))) {
    return 'High';
  }
  if (mediumVolume.some(keyword => n.includes(keyword))) {
    return 'Medium';
  }
  return 'Low';
}

function determineStatus(opened, closed) {
  const currentYear = new Date().getFullYear();
  
  if (closed && String(closed).trim() !== '' && String(closed).trim() !== '0') {
    return 'inactive';
  }
  
  if (opened) {
    const yearMatch = String(opened).match(/\b(20\d{2}|19\d{2})\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year > currentYear) {
        return 'construction';
      }
    }
  }
  
  return 'active';
}

async function main() {
  console.log('--- Fetching Visionscarto Spaceports GeoJSON ---');
  
  try {
    const res = await fetch(SPACEPORTS_GEOJSON_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch GeoJSON: HTTP ${res.status}`);
    }
    const geojson = await res.json();
    const features = geojson.features || [];
    
    console.log(`Successfully fetched GeoJSON. Processing ${features.length} spaceports...`);
    
    const processedSpaceports = [];
    
    for (const feature of features) {
      if (!feature.geometry || !feature.properties) {
        continue;
      }
      
      const props = feature.properties;
      const designation = props.Designation || props.name || props.Name;
      if (!designation || String(designation).trim() === '') {
        continue;
      }
      
      const name = designation.trim();
      const id = slugify(name);
      
      let lon, lat;
      if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
        lon = parseFloat(feature.geometry.coordinates[0]);
        lat = parseFloat(feature.geometry.coordinates[1]);
      } else {
        lon = parseFloat(props.lon);
        lat = parseFloat(props.lat);
      }
      
      if (isNaN(lat) || isNaN(lon)) {
        continue;
      }
      
      const country = (props.Country || props["Main nationality"] || 'Unknown').trim();
      const operator = (props.Operators || props.operator || 'Unknown Operator').trim();
      
      const status = determineStatus(props.Open, props.Closed);
      const launches = determineLaunches(name);
      
      processedSpaceports.push({
        id,
        name,
        lat,
        lon,
        country,
        operator,
        status,
        launches
      });
    }
    
    console.log(`Processed ${processedSpaceports.length} valid orbital launch sites.`);
    
    // Ensure directory exists and write JSON
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedSpaceports, null, 2), 'utf8');
    console.log(`Saved clean spaceport dataset to ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB)`);
    
  } catch (err) {
    console.error('Execution failed:', err);
    process.exit(1);
  }
}

main();
