import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const feedsSource = readFileSync(join(root, 'src', 'config', 'feeds.ts'), 'utf8');
const sharedAllowlist = JSON.parse(readFileSync(join(root, 'shared', 'rss-allowed-domains.json'), 'utf8')) as string[];
const apiAllowlist = (await import(pathToFileURL(join(root, 'api', '_rss-allowed-domains.js')).href)).default as string[];

const expandedSources = [
  'GDACS Alerts',
  'USGS Significant Earthquakes',
  'NHC Atlantic GIS',
  'NHC East Pacific GIS',
  'NCSC Threat Reports',
  'CERT-EU Security Advisories',
  'CERT-EU Threat Intelligence',
  'MSRC Security Updates',
  'BIS Press Releases',
  'BIS Central Bank Speeches',
  'ECB Press',
  'WTO Latest News',
  'Council EU Press',
  'NATO News',
  'MercoPress LatAm',
  'Daily Maverick',
  'Mail & Guardian',
  'Rappler',
  'Dawn',
  'Middle East Eye',
  'Al-Monitor',
];

const defaultEnabledExpansion = new Set([
  'GDACS Alerts',
  'USGS Significant Earthquakes',
  'NCSC Threat Reports',
  'CERT-EU Security Advisories',
  'Council EU Press',
]);

const directFeedUrls = [
  'https://www.gdacs.org/xml/rss.xml',
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom',
  'https://www.nhc.noaa.gov/gis-at.xml',
  'https://www.nhc.noaa.gov/gis-ep.xml',
  'https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml',
  'https://cert.europa.eu/publications/security-advisories-rss',
  'https://cert.europa.eu/publications/threat-intelligence-rss',
  'https://www.bis.org/doclist/all_pressrels.rss',
  'https://www.bis.org/doclist/cbspeeches.rss',
  'https://www.ecb.europa.eu/rss/press.html',
  'https://www.wto.org/library/rss/latest_news_e.xml',
  'https://www.consilium.europa.eu/en/about-site/rss/rss-press-releases/',
  'https://en.mercopress.com/rss/latin-america',
  'https://www.dailymaverick.co.za/dmrss/',
  'https://mg.co.za/feed/',
  'https://www.rappler.com/feed/',
  'https://www.dawn.com/feeds/home',
  'https://www.middleeasteye.net/rss',
  'https://www.al-monitor.com/rss',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertAllowlisted(hostname: string, allowlist: string[], label: string): void {
  const bare = hostname.replace(/^www\./, '');
  const withWww = hostname.startsWith('www.') ? hostname : `www.${hostname}`;
  assert.ok(
    allowlist.includes(hostname) || allowlist.includes(bare) || allowlist.includes(withWww),
    `${label} missing ${hostname}`,
  );
}

const defaultSourcesBlock = feedsSource.match(/export const DEFAULT_ENABLED_SOURCES[\s\S]*?};/)?.[0] ?? '';
const defaultIntelBlock = feedsSource.match(/export const DEFAULT_ENABLED_INTEL[\s\S]*?];/)?.[0] ?? '';
const defaultEnabledBlock = `${defaultSourcesBlock}\n${defaultIntelBlock}`;

describe('expanded Settings sources', () => {
  it('registers each curated source in the feed catalog', () => {
    for (const source of expandedSources) {
      assert.match(feedsSource, new RegExp(`name:\\s*['"]${escapeRegExp(source)}['"]`), source);
    }
  });

  it('default-enables only the requested low-noise expansion sources', () => {
    for (const source of expandedSources) {
      const marker = `'${source}'`;
      if (defaultEnabledExpansion.has(source)) {
        assert.ok(defaultEnabledBlock.includes(marker), `${source} should be default-enabled`);
      } else {
        assert.ok(!defaultEnabledBlock.includes(marker), `${source} should remain disabled by default`);
      }
    }
  });

  it('allowlists every direct expanded feed host in both RSS proxy lists', () => {
    for (const rawUrl of directFeedUrls) {
      const hostname = new URL(rawUrl).hostname;
      assertAllowlisted(hostname, sharedAllowlist, 'shared allowlist');
      assertAllowlisted(hostname, apiAllowlist, 'edge allowlist');
    }
  });
});
