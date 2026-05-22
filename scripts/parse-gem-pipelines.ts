import fs from 'fs';
import path from 'path';
import type { Pipeline } from '../src/types/index';

const liquidDir = 'c:/Users/kabir/worldmonitor/scratch/gem-pipelines/data/individual-routes/liquid-pipelines';
const gasDir = 'c:/Users/kabir/worldmonitor/scratch/gem-pipelines/data/individual-routes/gas-pipelines';
const outputFilePath = 'c:/Users/kabir/worldmonitor/public/data/pipelines.generated.json';

// Clean and downsample points so we don't blow up bundle sizes
function downsamplePoints(points: [number, number][], maxPoints: number = 50): [number, number][] {
  if (points.length <= maxPoints) return points;
  
  const downsampled: [number, number][] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), points.length - 1);
    downsampled.push(points[idx]);
  }
  
  return downsampled;
}

function processFolder(dir: string, type: 'oil' | 'gas'): Pipeline[] {
  const pipelines: Pipeline[] = [];
  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return pipelines;
  }
  
  const files = fs.readdirSync(dir).filter(f => /^P\d+\.geojson$/.test(f));
  console.log(`Processing ${files.length} files in ${type} folder...`);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const projectId = file.replace('.geojson', '');
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const geojson = JSON.parse(content);
      const features = geojson.features || [];
      
      let featureIndex = 0;
      for (const feature of features) {
        if (!feature.geometry) continue;
        
        const props = feature.properties || {};
        // Make sure we have a valid name. The primary check for a transmission trunk
        // is that it has a valid human-readable name in its attributes.
        const rawName = props.name || props.Name;
        if (!rawName) continue;
        
        const name = String(rawName).trim();
        if (name === '' || name.toLowerCase() === 'none') continue;
        
        const geomType = feature.geometry.type;
        const coords = feature.geometry.coordinates;
        
        let segments: [number, number][][] = [];
        if (geomType === 'LineString') {
          segments = [coords];
        } else if (geomType === 'MultiLineString') {
          segments = coords;
        } else {
          // Unsupported geometry type for active routing
          continue;
        }
        
        let segmentIndex = 0;
        for (const rawPoints of segments) {
          if (!Array.isArray(rawPoints) || rawPoints.length < 2) continue;
          
          segmentIndex++;
          
          // Clean coordinate pairs
          const cleanedPoints: [number, number][] = [];
          for (const pt of rawPoints) {
            if (Array.isArray(pt) && pt.length >= 2) {
              const lon = Number(pt[0]);
              const lat = Number(pt[1]);
              if (!isNaN(lon) && !isNaN(lat)) {
                cleanedPoints.push([lon, lat]);
              }
            }
          }
          
          if (cleanedPoints.length < 2) continue;
          
          // Downsample high-resolution coordinates for Snappy UI and lightweight bundle
          const points = downsamplePoints(cleanedPoints, 60);
          
          // Technical metadata extraction
          const operator = props.operator || props.Operator || props.owner || props.Owner;
          
          // Status mapping
          let status: 'operating' | 'construction' = 'operating';
          const rawStatus = String(props.status || props.Status || props.PrjType || '').toLowerCase();
          if (rawStatus.includes('construction') || rawStatus.includes('development') || rawStatus.includes('planned')) {
            status = 'construction';
          }
          
          // Capacity string formatting
          let capacity: string | undefined = undefined;
          const rawCapacity = props.Capacity || props.capacity;
          const rawUnits = props.Units || props.units;
          if (rawCapacity) {
            if (rawUnits) {
              capacity = `${rawCapacity} ${rawUnits}`;
            } else {
              const capNum = Number(rawCapacity);
              if (!isNaN(capNum)) {
                capacity = type === 'oil' 
                  ? `${capNum.toLocaleString()} bpd` 
                  : `${capNum.toLocaleString()} MMscf/d`;
              } else {
                capacity = String(rawCapacity);
              }
            }
          }
          
          // Length formatting
          let length: string | undefined = undefined;
          const rawLength = props.Length || props.length;
          if (rawLength) {
            const lenNum = Number(rawLength);
            if (!isNaN(lenNum)) {
              length = `${Math.round(lenNum).toLocaleString()} km`;
            } else {
              length = String(rawLength);
            }
          }
          
          // Country mapping
          let countries: string[] | undefined = undefined;
          const rawCountry = props.Country || props.country || props.countries || props.Countries || props.State || props.state;
          if (rawCountry) {
            countries = String(rawCountry)
              .split(/[,;/]+/)
              .map(c => c.trim())
              .filter(c => c !== '');
          }
          
          // Unique segment ID
          const uniqueId = segments.length > 1 
            ? `${projectId}-${featureIndex}-${segmentIndex}`.toLowerCase()
            : `${projectId}-${featureIndex}`.toLowerCase();
          
          pipelines.push({
            id: uniqueId,
            name: segments.length > 1 ? `${name} (Segment ${segmentIndex})` : name,
            type,
            status,
            points,
            ...(capacity && { capacity }),
            ...(length && { length }),
            ...(operator && { operator }),
            ...(countries && { countries }),
          });
        }
        
        featureIndex++;
      }
      
    } catch (e: any) {
      console.error(`Error processing file ${file}:`, e.message);
    }
  }
  
  return pipelines;
}

function generateJSON() {
  console.log('--- Ingesting GEM Pipeline Geospatial Data ---');
  
  const oilPipelines = processFolder(liquidDir, 'oil');
  const gasPipelines = processFolder(gasDir, 'gas');
  const allPipelines = [...oilPipelines, ...gasPipelines];
  
  console.log(`Successfully parsed ${oilPipelines.length} oil pipeline segments.`);
  console.log(`Successfully parsed ${gasPipelines.length} gas pipeline segments.`);
  console.log(`Total: ${allPipelines.length} global transmission pipelines.`);
  
  // Write pure JSON to public data directory
  fs.writeFileSync(outputFilePath, JSON.stringify(allPipelines, null, 2), 'utf8');
  console.log(`Generated configuration successfully written to: ${outputFilePath}`);
}

generateJSON();
