import fs from 'fs';
import path from 'path';

const MISP_THREAT_ACTOR_URL = 'https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/threat-actor.json';
const OUTPUT_FILE = path.resolve('public/data/apt_groups.generated.json');

// Base tactical HQs for state sponsors
const BASE_COORDINATES = {
  'RU': { lat: 55.7558, lon: 37.6173, country: 'Russia' },
  'CN': { lat: 39.9042, lon: 116.4074, country: 'China' },
  'IR': { lat: 35.6892, lon: 51.3890, country: 'Iran' },
  'KP': { lat: 39.0392, lon: 125.7625, country: 'North Korea' },
  'US': { lat: 39.1009, lon: -76.7412, country: 'USA' },
  'IL': { lat: 32.0736, lon: 34.7917, country: 'Israel' },
  'GB': { lat: 51.8995, lon: -2.1244, country: 'UK' },
  'FR': { lat: 48.8647, lon: 2.3490, country: 'France' },
  'IN': { lat: 28.6139, lon: 77.2090, country: 'India' },
  'PK': { lat: 33.6844, lon: 73.0479, country: 'Pakistan' },
  'VN': { lat: 21.0285, lon: 105.8542, country: 'Vietnam' },
  'TR': { lat: 39.9334, lon: 32.8597, country: 'Turkey' },
  'UA': { lat: 50.4501, lon: 30.5234, country: 'Ukraine' },
  'BY': { lat: 53.9006, lon: 27.5590, country: 'Belarus' },
  'SY': { lat: 33.5138, lon: 36.2913, country: 'Syria' }
};

const COUNTRY_NAME_TO_ISO = {
  'russia': 'RU', 'russian federation': 'RU',
  'china': 'CN', 'peoples republic of china': 'CN',
  'iran': 'IR', 'islamic republic of iran': 'IR',
  'north korea': 'KP', 'dprk': 'KP', "korea, democratic people's republic of": 'KP',
  'united states': 'US', 'usa': 'US', 'united states of america': 'US',
  'israel': 'IL',
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
  'france': 'FR',
  'india': 'IN',
  'pakistan': 'PK',
  'vietnam': 'VN',
  'turkey': 'TR'
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Generate stable offsets using a string hash
function getStableJitter(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Spiral/ring distribution around central base coords
  const radius = 0.12 + (Math.abs(hash % 100) / 100) * 0.45; // Spreads them out between 0.12 to 0.57 degrees
  const angle = (Math.abs(hash % 360) * Math.PI) / 180;
  
  return {
    latOffset: Math.sin(angle) * radius,
    lonOffset: Math.cos(angle) * radius
  };
}

function resolveSponsor(meta, descText) {
  // 1. Check meta.country (ISO or full country names)
  if (meta.country) {
    const countries = Array.isArray(meta.country) ? meta.country : [meta.country];
    for (const c of countries) {
      const clean = String(c).trim().toUpperCase();
      if (BASE_COORDINATES[clean]) {
        return clean;
      }
      const cleanLower = String(c).trim().toLowerCase();
      const iso = COUNTRY_NAME_TO_ISO[cleanLower];
      if (iso) {
        return iso;
      }
    }
  }
  
  // 2. Check meta["cfr-suspected-state-sponsor"]
  const sponsorKey = meta["cfr-suspected-state-sponsor"] || meta.sponsor;
  if (sponsorKey) {
    const sponsors = Array.isArray(sponsorKey) ? sponsorKey : [sponsorKey];
    for (const s of sponsors) {
      const cleanLower = String(s).trim().toLowerCase();
      const iso = COUNTRY_NAME_TO_ISO[cleanLower];
      if (iso) return iso;
      
      // Check if it matches ISO directly
      const cleanUpper = String(s).trim().toUpperCase();
      if (BASE_COORDINATES[cleanUpper]) return cleanUpper;
    }
  }
  
  // 3. Fallback: Search keywords in description text
  if (descText) {
    const text = descText.toLowerCase();
    if (text.includes('russian') || text.includes('gru ') || text.includes('svr ') || text.includes('fsb ')) {
      return 'RU';
    }
    if (text.includes('chinese') || text.includes('ministry of state security') || text.includes('mss ')) {
      return 'CN';
    }
    if (text.includes('iranian') || text.includes('islamic revolutionary guard') || text.includes('irgc')) {
      return 'IR';
    }
    if (text.includes('north korean') || text.includes('lazarus group') || text.includes('pyongyang')) {
      return 'KP';
    }
    if (text.includes('united states') || text.includes('nsa ') || text.includes('equation group')) {
      return 'US';
    }
    if (text.includes('israeli') || text.includes('mossad') || text.includes('unit 8200')) {
      return 'IL';
    }
  }
  
  return null;
}

async function main() {
  console.log('--- Fetching MISP Galaxy Threat Actors ---');
  
  try {
    const res = await fetch(MISP_THREAT_ACTOR_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch MISP Galaxy: HTTP ${res.status}`);
    }
    
    const galaxy = await res.json();
    const clusters = galaxy.values || [];
    
    console.log(`Successfully fetched MISP Galaxy. Processing ${clusters.length} clusters...`);
    
    const processedAPTs = [];
    
    for (const cluster of clusters) {
      const name = cluster.value;
      if (!name || String(name).trim() === '') {
        continue;
      }
      
      const desc = cluster.description || '';
      const meta = cluster.meta || {};
      
      // Determine sponsor country ISO code
      const sponsorIso = resolveSponsor(meta, desc);
      if (!sponsorIso) {
        // Skip threat actors without a clearly geocodable state-sponsor to keep the visual list clean
        continue;
      }
      
      const baseCoords = BASE_COORDINATES[sponsorIso];
      const jitter = getStableJitter(name);
      
      const lat = baseCoords.lat + jitter.latOffset;
      const lon = baseCoords.lon + jitter.lonOffset;
      
      const id = slugify(name);
      
      // Build synonyms (aka)
      let aka = '';
      if (meta.synonyms) {
        const synList = Array.isArray(meta.synonyms) ? meta.synonyms : [meta.synonyms];
        aka = synList.slice(0, 4).join(', ');
      }
      
      // Extract targets
      let targets = [];
      if (meta.target) {
        targets = Array.isArray(meta.target) ? meta.target : [meta.target];
        // Clean target strings
        targets = targets.map(t => String(t).trim()).filter(t => t !== '');
      }
      
      // Extract techniques (or default techniques if empty)
      let techniques = [];
      if (meta.capability) {
        techniques = Array.isArray(meta.capability) ? meta.capability : [meta.capability];
      } else {
        techniques = ['Spear phishing', 'Credential theft', 'Zero-day vulnerability exploitation', 'Custom backdoors'];
      }
      
      // Parse known operations from references
      const knownOps = [];
      if (meta.refs && Array.isArray(meta.refs)) {
        let opCount = 0;
        for (const ref of meta.refs) {
          if (opCount >= 4) break;
          try {
            const url = new URL(ref);
            let opName = url.hostname.replace('www.', '');
            
            if (ref.includes('wikipedia.org/wiki/')) {
              opName = decodeURIComponent(ref.split('/wiki/')[1])
                .replace(/_/g, ' ')
                .replace(/%26/g, '&');
            } else if (opName.length > 25) {
              opName = opName.substring(0, 25) + '...';
            }
            
            knownOps.push({
              name: opName,
              url: ref
            });
            opCount++;
          } catch {
            // Ignore malformed URLs
          }
        }
      }
      
      // Map threat level
      let threatLevel = 'medium';
      const rawThreat = String(meta["threat-level"] || '').toLowerCase();
      if (rawThreat.includes('high') || desc.toLowerCase().includes('critical') || desc.toLowerCase().includes('major damage')) {
        threatLevel = 'high';
      }
      if (rawThreat.includes('critical') || name.toLowerCase().includes('lazarus') || name.toLowerCase().includes('fancy bear') || name.toLowerCase().includes('cozy bear') || name.toLowerCase().includes('apt28') || name.toLowerCase().includes('apt29') || name.toLowerCase().includes('apt41')) {
        threatLevel = 'critical';
      }
      
      processedAPTs.push({
        id,
        name,
        aka: aka || 'No known aliases',
        sponsor: baseCoords.country,
        lat,
        lon,
        description: desc || `State-sponsored threat actor group attributed to ${baseCoords.country}.`,
        targets: targets.length > 0 ? targets.slice(0, 6) : ['Government', 'Defense', 'Infrastructure'],
        techniques: techniques.slice(0, 5),
        knownOps: knownOps.length > 0 ? knownOps : [{ name: 'Operations details' }],
        active: meta.active || 'Active campaigns detected',
        threatLevel
      });
    }
    
    console.log(`Processed ${processedAPTs.length} strategic APT threat groups.`);
    
    // Ensure directory exists and write JSON
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedAPTs, null, 2), 'utf8');
    console.log(`Saved clean APT groups dataset to ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB)`);
    
  } catch (err) {
    console.error('Execution failed:', err);
    process.exit(1);
  }
}

main();
