import fs from 'fs';
import path from 'path';

const geoDataPath = 'src/generated/geo-data.ts';
const fetcherPath = 'src/services/prediction/country-fetcher.ts';

const geoContent = fs.readFileSync(geoDataPath, 'utf8');
const fetcherContent = fs.readFileSync(fetcherPath, 'utf8');

// Extract countries from geo-data.ts
const countryRe = /name: '([^']+)', lat: ([-\d.]+), lon: ([-\d.]+)/g;
const countries = [];
let m;
while ((m = countryRe.exec(geoContent)) !== null) {
  countries.push({ name: m[1], lat: parseFloat(m[2]), lon: parseFloat(m[3]) });
}

// Extract existing countries from fetcher
const existingCentroidsRe = /'([^']+)': \[([-\d.]+),\s*([-\d.]+)\]/g;
const existingCentroids = new Map();
while ((m = existingCentroidsRe.exec(fetcherContent)) !== null) {
  existingCentroids.set(m[1], [parseFloat(m[2]), parseFloat(m[3])]);
}

// Extract existing tags
const existingTagsRe = /'([^']+)': \[/g;
const existingTags = new Set();
const tagSection = fetcherContent.split('const COUNTRY_TAG_MAP')[1].split('const COUNTRY_CENTROIDS')[0];
while ((m = existingTagsRe.exec(tagSection)) !== null) {
  existingTags.add(m[1]);
}

// Add missing centroids
const newCentroids = [];
for (const c of countries) {
  if (!existingCentroids.has(c.name)) {
    newCentroids.push(`  '${c.name}': [${c.lon.toFixed(2)}, ${c.lat.toFixed(2)}]`);
  }
}

// Add missing tags (use generic tags)
const newTags = [];
for (const c of countries) {
  if (!existingTags.has(c.name)) {
    const tags = ['world', 'politics'];
    newTags.push(`  '${c.name}': [${tags.map(t => `'${t}'`).join(', ')}]`);
  }
}

console.log('=== Missing Centroids ===');
console.log(newCentroids.join(',\n'));
console.log('\n=== Missing Tags ===');
console.log(newTags.join(',\n'));
console.log(`\nTotal new countries: ${newCentroids.length}`);
