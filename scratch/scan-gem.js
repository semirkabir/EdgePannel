import fs from 'fs';
import path from 'path';

const liquidDir = 'c:/Users/kabir/worldmonitor/scratch/gem-pipelines/data/individual-routes/liquid-pipelines';
const gasDir = 'c:/Users/kabir/worldmonitor/scratch/gem-pipelines/data/individual-routes/gas-pipelines';

function scanDir(dir, label) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    return;
  }
  
  const files = fs.readdirSync(dir).filter(f => /^P\d+\.geojson$/.test(f));
  console.log(`\n=== Scanning ${label} (${dir}) ===`);
  console.log(`Total files matching P\\d+.geojson: ${files.length}`);
  
  let emptyGeometryCount = 0;
  let hasNameCount = 0;
  let hasPropertiesCount = 0;
  let nonEmtpyCount = 0;
  let coordinateLengths = [];
  
  const samples = [];
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      const geojson = JSON.parse(content);
      const features = geojson.features || [];
      if (features.length === 0) {
        emptyGeometryCount++;
        continue;
      }
      
      const feature = features[0];
      if (!feature.geometry) {
        emptyGeometryCount++;
        continue;
      }
      
      nonEmtpyCount++;
      
      const props = feature.properties || {};
      const name = props.name || props.Name;
      if (name) {
        hasNameCount++;
      }
      if (Object.keys(props).length > 0) {
        hasPropertiesCount++;
      }
      
      // Calculate coordinate length
      let ptCount = 0;
      const geomType = feature.geometry.type;
      const coords = feature.geometry.coordinates;
      if (geomType === 'LineString') {
        ptCount = coords.length;
      } else if (geomType === 'MultiLineString') {
        ptCount = coords.reduce((acc, segment) => acc + segment.length, 0);
      }
      
      coordinateLengths.push(ptCount);
      
      if (samples.length < 5 && name) {
        samples.push({
          file,
          name,
          geomType,
          ptCount,
          properties: props
        });
      }
      
    } catch (e) {
      console.error(`Error parsing ${file}:`, e.message);
    }
  }
  
  console.log(`Empty/Null geometries: ${emptyGeometryCount}`);
  console.log(`Non-empty geometries: ${nonEmtpyCount}`);
  console.log(`Has non-empty properties: ${hasPropertiesCount}`);
  console.log(`Has Name/name property: ${hasNameCount}`);
  
  if (coordinateLengths.length > 0) {
    coordinateLengths.sort((a, b) => a - b);
    const min = coordinateLengths[0];
    const max = coordinateLengths[coordinateLengths.length - 1];
    const avg = Math.round(coordinateLengths.reduce((a, b) => a + b, 0) / coordinateLengths.length);
    const median = coordinateLengths[Math.floor(coordinateLengths.length / 2)];
    console.log(`Coordinate points per file - Min: ${min}, Max: ${max}, Avg: ${avg}, Median: ${median}`);
  }
  
  console.log('Sample files with names:');
  console.log(JSON.stringify(samples, null, 2));
}

scanDir(liquidDir, 'Liquid Pipelines (Oil)');
scanDir(gasDir, 'Gas Pipelines');
