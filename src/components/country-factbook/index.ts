/**
 * Per-tab renderers for the CIA World Factbook tabs on the country brief panel.
 * Each `renderX(data)` returns the full pane contents for a single tab.
 *
 * Design intent: every tab groups fields into 2-5 sub-cards using layouts that
 * fit the data shape (tiles for single numbers, stacked/labeled bars for
 * percentages, chips for categorical lists, callouts for hazards/disputes).
 */

import type { FactbookData, FactbookNode } from '@/services/factbook';
import {
  extractNumber,
  extractPercent,
  fbObj,
  fbText,
  latestYearEntry,
  parseLabeledPercents,
  splitList,
  stripYearTag,
  takeValue,
  extractYear,
} from '@/services/factbook';
import { miniSparkline } from '@/utils/sparkline';
import { getCountryFlag } from '@/utils/country-flags';
import {
  PALETTE,
  abbreviateStat,
  badgeRow,
  calloutCard,
  chipRow,
  collapsible,
  combine,
  el,
  emptyMessage,
  labeledBars,
  personCard,
  prose,
  sectionCard,
  stackedBar,
  statTile,
  stripNoteHtml,
  tileGrid,
} from './widgets';
import type { ChipSpec, ChipTone } from './widgets';

export type TabId =
  | 'overview'
  | 'geography'
  | 'people'
  | 'government'
  | 'economy'
  | 'energy'
  | 'communications'
  | 'transportation'
  | 'military'
  | 'transnational';

export interface TabDef {
  id: TabId;
  label: string;
}

export const FACTBOOK_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'geography', label: 'Geography' },
  { id: 'people', label: 'People' },
  { id: 'government', label: 'Government' },
  { id: 'economy', label: 'Economy' },
  { id: 'energy', label: 'Energy' },
  { id: 'communications', label: 'Comms' },
  { id: 'transportation', label: 'Transport' },
  { id: 'military', label: 'Military' },
  { id: 'transnational', label: 'Issues' },
];

/** Main dispatcher — returns a pane element for a given tab. */
export function renderFactbookTab(tab: TabId, data: FactbookData | null, country: string): HTMLElement {
  if (!data) {
    const wrap = el('div', 'cdp-fb-pane-empty');
    wrap.append(emptyMessage(`Factbook data not available for ${country}.`));
    return wrap;
  }
  const wrap = el('div', 'cdp-fb-pane-inner');
  const body = dispatch(tab, data, country);
  if (!body || body.childElementCount === 0) {
    wrap.append(emptyMessage('Not available for this country.'));
    return wrap;
  }
  wrap.append(body);
  return wrap;
}

function dispatch(tab: TabId, data: FactbookData, country: string): HTMLElement | null {
  switch (tab) {
    case 'geography': return renderGeography(data, country);
    case 'people': return renderPeople(data);
    case 'government': return renderGovernment(data);
    case 'economy': return renderEconomy(data);
    case 'energy': return renderEnergy(data);
    case 'communications': return renderCommunications(data);
    case 'transportation': return renderTransportation(data);
    case 'military': return renderMilitary(data);
    case 'transnational': return renderTransnational(data, country);
    default: return null;
  }
}

interface KeywordChipRule {
  label: string;
  icon: string;
  patterns: RegExp[];
  tone?: ChipTone;
}

interface ItemChipRule {
  icon: string;
  patterns: RegExp[];
  tone?: ChipTone;
}

const CLIMATE_CHIP_RULES: KeywordChipRule[] = [
  { label: 'Tropical', icon: '\u{1F334}', patterns: [/\btropical\b/i], tone: 'success' },
  { label: 'Arid', icon: '\u{1F3DC}', patterns: [/\barid\b/i], tone: 'warn' },
  { label: 'Semi-arid', icon: '\u{1F3DC}', patterns: [/\bsemiarid\b|\bsemi-arid\b/i], tone: 'warn' },
  { label: 'Temperate', icon: '\u{1F33F}', patterns: [/\btemperate\b/i], tone: 'info' },
  { label: 'Arctic', icon: '\u2744\uFE0F', patterns: [/\barctic\b|\bsubarctic\b/i], tone: 'info' },
  { label: 'Monsoon', icon: '\u{1F327}\uFE0F', patterns: [/\bmonsoon\b/i], tone: 'info' },
  { label: 'Mediterranean', icon: '\u2600\uFE0F', patterns: [/\bmediterranean\b/i], tone: 'success' },
  { label: 'Alpine', icon: '\u{1F3D4}\uFE0F', patterns: [/\balpine\b|\bhighland\b/i], tone: 'neutral' },
];

const HAZARD_CHIP_RULES: KeywordChipRule[] = [
  { label: 'Seismic', icon: '\u{1F4A5}', patterns: [/\bearthquakes?\b|\bseismic\b/i], tone: 'danger' },
  { label: 'Volcanic', icon: '\u{1F30B}', patterns: [/\bvolcan(?:ic|o(?:es)?)\b/i], tone: 'danger' },
  { label: 'Tsunami', icon: '\u{1F30A}', patterns: [/\btsunamis?\b/i], tone: 'danger' },
  { label: 'Cyclone', icon: '\u{1F300}', patterns: [/\bcyclones?\b|\bhurricanes?\b|\btyphoons?\b/i], tone: 'warn' },
  { label: 'Drought', icon: '\u{1F3DC}', patterns: [/\bdroughts?\b/i], tone: 'warn' },
  { label: 'Wildfire', icon: '\u{1F525}', patterns: [/\bwildfires?\b|\bforest fires?\b/i], tone: 'danger' },
  { label: 'Flooding', icon: '\u{1F327}\uFE0F', patterns: [/\bfloods?\b|\bflooding\b|\bmudslides?\b/i], tone: 'warn' },
  { label: 'Heat wave', icon: '\u{1F321}\uFE0F', patterns: [/\bheat waves?\b|\bextreme heat\b/i], tone: 'warn' },
];

const RESOURCE_CHIP_RULES: ItemChipRule[] = [
  { icon: '\u26FD', patterns: [/\bpetroleum\b|\bcrude oil\b|\boil\b/i], tone: 'warn' },
  { icon: '\u{1F525}', patterns: [/\bnatural gas\b|\bgas\b/i], tone: 'warn' },
  { icon: '\u26CF\uFE0F', patterns: [/\biron ore\b|\bcopper\b|\bbauxite\b|\bnickel\b|\bcobalt\b|\blithium\b|\buranium\b|\bphosphates?\b|\brare earth\b|\bmolybdenum\b|\bpotash\b|\btungsten\b|\bzinc\b|\blead\b|\bmercury\b|\bcoal\b/i], tone: 'neutral' },
  { icon: '\u{1F48E}', patterns: [/\bdiamonds?\b|\bgems?\b|\bgold\b|\bsilver\b|\bplatinum\b/i], tone: 'info' },
  { icon: '\u{1F332}', patterns: [/\btimber\b|\bforest\b/i], tone: 'success' },
  { icon: '\u26A1', patterns: [/\bhydropower\b|\bhydroelectric/i], tone: 'info' },
  { icon: '\u2600\uFE0F', patterns: [/\bsolar\b/i], tone: 'success' },
  { icon: '\u{1F33E}', patterns: [/\barable land\b|\bagricultural land\b/i], tone: 'success' },
  { icon: '\u{1F41F}', patterns: [/\bfish\b|\bfisher(?:y|ies)\b/i], tone: 'info' },
];

const COMMODITY_CHIP_RULES: ItemChipRule[] = [
  { icon: '\u26FD', patterns: [/\bpetroleum\b|\bcrude oil\b|\boil\b/i], tone: 'warn' },
  { icon: '\u{1F525}', patterns: [/\bnatural gas\b|\blng\b/i], tone: 'warn' },
  { icon: '\u{1F33E}', patterns: [/\bgrains?\b|\bwheat\b|\bcorn\b|\bsoy(?:bean)?s?\b|\brice\b|\bbarley\b/i], tone: 'success' },
  { icon: '\u{1F48E}', patterns: [/\bgems?\b|\bdiamonds?\b|\bgold\b|\bsilver\b/i], tone: 'info' },
  { icon: '\u{1F697}', patterns: [/\bvehicles?\b|\bcars?\b|\bautomobiles?\b|\bautomotive\b/i], tone: 'neutral' },
  { icon: '\u{1F4F1}', patterns: [/\belectronics?\b|\bcomputers?\b|\bsemiconductors?\b|\btelecom/i], tone: 'info' },
  { icon: '\u{1F9F5}', patterns: [/\btextiles?\b|\bgarments?\b|\bclothing\b|\bapparel\b/i], tone: 'neutral' },
  { icon: '\u2697\uFE0F', patterns: [/\bchemicals?\b|\bfertilizers?\b/i], tone: 'neutral' },
  { icon: '\u{1F48A}', patterns: [/\bpharmaceuticals?\b|\bmedicines?\b/i], tone: 'info' },
  { icon: '\u{1F377}', patterns: [/\bbeverages?\b|\bwine\b|\balcohol\b/i], tone: 'success' },
  { icon: '\u2699\uFE0F', patterns: [/\bmachinery\b|\bindustrial goods\b/i], tone: 'neutral' },
];

const MILITARY_BRANCH_CHIP_RULES: ItemChipRule[] = [
  { icon: '\u{1FA96}', patterns: [/\barmy\b|\bland forces?\b/i], tone: 'neutral' },
  { icon: '\u2693', patterns: [/\bnavy\b|\bnaval forces?\b/i], tone: 'info' },
  { icon: '\u2708\uFE0F', patterns: [/\bair force\b|\bair forces?\b/i], tone: 'info' },
  { icon: '\u{1F680}', patterns: [/\bspace force\b|\bspace command\b/i], tone: 'info' },
  { icon: '\u{1F6E1}\uFE0F', patterns: [/\bcoast guard\b|\bguard\b/i], tone: 'neutral' },
  { icon: '\u{1F693}', patterns: [/\bgendarmerie\b|\bpolice\b/i], tone: 'neutral' },
  { icon: '\u2694\uFE0F', patterns: [/\bmarine corps\b|\bspecial operations?\b|\bspecial ops\b/i], tone: 'danger' },
];

function normalizeFactbookText(text: string | undefined): string {
  return stripNoteHtml(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;|&mdash;/gi, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function uniqueChips(chips: ChipSpec[]): ChipSpec[] {
  const seen = new Set<string>();
  return chips.filter((chip) => {
    const key = chip.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectKeywordChips(text: string | undefined, rules: KeywordChipRule[]): ChipSpec[] {
  const haystack = normalizeFactbookText(text);
  if (!haystack) return [];
  const chips = rules
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(haystack)))
    .map((rule) => ({ label: rule.label, icon: rule.icon, tone: rule.tone, title: rule.label }));
  return uniqueChips(chips);
}

function mapItemsToChips(items: string[], rules: ItemChipRule[]): ChipSpec[] {
  return uniqueChips(items.map((item) => {
    const clean = normalizeFactbookText(item);
    const match = rules.find((rule) => rule.patterns.some((pattern) => pattern.test(clean)));
    return {
      label: clean,
      icon: match?.icon,
      tone: match?.tone,
    };
  }).filter((chip) => chip.label.length > 0));
}

function extractLeadingClause(text: string | undefined): string {
  const clean = normalizeFactbookText(text);
  if (!clean) return '';
  return clean.split(/\s*;\s*/)[0]!.trim();
}

function describeGovernmentType(text: string | undefined): ChipSpec | null {
  const clause = extractLeadingClause(text);
  if (!clause) return null;
  const lower = clause.toLowerCase();
  const tone: ChipTone = /monarchy/i.test(lower)
    ? 'warn'
    : /democracy|republic|federal/i.test(lower)
      ? 'info'
      : /authoritarian|military/i.test(lower)
        ? 'danger'
        : 'neutral';
  return {
    label: titleCase(clause),
    icon: '\u{1F3DB}\uFE0F',
    tone,
    title: normalizeFactbookText(text),
  };
}

function describeLegalSystem(text: string | undefined): ChipSpec | null {
  const clause = extractLeadingClause(text);
  if (!clause) return null;
  const lower = clause.toLowerCase();
  let label = clause;
  if (lower.includes('mixed') && lower.includes('civil law') && lower.includes('common law')) {
    label = 'Mixed civil/common law';
  } else if (lower.includes('mixed') && lower.includes('civil law') && lower.includes('islamic law')) {
    label = 'Mixed civil/Islamic law';
  } else if (lower.includes('common law')) {
    label = 'Common law';
  } else if (lower.includes('civil law')) {
    label = 'Civil law';
  } else if (lower.includes('islamic law') || lower.includes('sharia')) {
    label = 'Sharia-based law';
  } else if (lower.includes('mixed')) {
    label = titleCase(clause);
  }

  const tone: ChipTone = /sharia|islamic law/i.test(lower)
    ? 'warn'
    : /common law|civil law/i.test(lower)
      ? 'info'
      : /mixed/i.test(lower)
        ? 'neutral'
        : 'neutral';

  return {
    label,
    icon: '\u2696\uFE0F',
    tone,
    title: normalizeFactbookText(text),
  };
}

function extractMilitaryBranches(text: string | undefined): string[] {
  const clean = normalizeFactbookText(text);
  if (!clean) return [];
  const afterColon = clean.includes(':') ? clean.split(':').slice(1).join(':') : clean;
  const primary = afterColon
    .split(/\bMinistry of\b/i)[0]!
    .replace(/\bincludes\b/gi, ',')
    .replace(/\baka\b/gi, '')
    .replace(/\([^)]*\bUSMC\b[^)]*\)/gi, ', Marine Corps')
    .replace(/\([^)]*\bCoast Guard\b[^)]*\)/gi, ', Coast Guard')
    .replace(/\([^)]*\)/g, '')
    .replace(/\band\b/gi, ',');

  return uniqueChips(primary
    .split(/,(?![^(]*\))/g)
    .map((item) => item.replace(/^\s*(?:or|the)\s+/i, '').trim())
    .filter((item) => item.length > 0 && item.length < 80)
    .map((label) => ({ label }))).map((chip) => chip.label);
}

function describeTipTier(text: string | undefined): { badge: ChipSpec | null; body: string } {
  const clean = normalizeFactbookText(text);
  if (!clean) return { badge: null, body: '' };
  const match = clean.match(/^(Tier\s+[1-3](?:\s+Watch\s+List)?)\s*(?:[-\u2013\u2014:]\s*)?(.*)$/i);
  if (!match) return { badge: null, body: clean };
  const tier = match[1]!;
  const body = match[2]?.trim() || clean;
  const tone: ChipTone = /^Tier 1$/i.test(tier)
    ? 'success'
    : /Watch List/i.test(tier)
      ? 'warn'
      : /^Tier 3$/i.test(tier)
        ? 'danger'
        : 'info';
  return {
    badge: {
      label: tier,
      icon: '\u26A0\uFE0F',
      tone,
      title: tier,
    },
    body,
  };
}

interface AreaReference {
  label: string;
  areaSqKm: number;
  aliases?: string[];
}

interface CountryAliasDef {
  label: string;
  code: string;
  aliases?: string[];
}

const AREA_REFERENCES: AreaReference[] = [
  { label: 'Texas', areaSqKm: 695_662 },
  { label: 'France', areaSqKm: 551_695 },
  { label: 'Brazil', areaSqKm: 8_515_767 },
  { label: 'China', areaSqKm: 9_596_961 },
  { label: 'Russia', areaSqKm: 17_098_246 },
  { label: 'Africa', areaSqKm: 30_370_000 },
  { label: 'South America', areaSqKm: 17_840_000 },
  { label: 'European Union', areaSqKm: 4_233_255, aliases: ['EU', 'European Union'] },
];

const COUNTRY_ALIAS_DEFS: CountryAliasDef[] = [
  { label: 'United States', code: 'US', aliases: ['USA', 'US', 'United States of America', 'America'] },
  { label: 'United Kingdom', code: 'GB', aliases: ['UK', 'Britain', 'Great Britain'] },
  { label: 'France', code: 'FR' },
  { label: 'Germany', code: 'DE' },
  { label: 'Italy', code: 'IT' },
  { label: 'Spain', code: 'ES' },
  { label: 'Portugal', code: 'PT' },
  { label: 'Netherlands', code: 'NL' },
  { label: 'Belgium', code: 'BE' },
  { label: 'Austria', code: 'AT' },
  { label: 'Poland', code: 'PL' },
  { label: 'Latvia', code: 'LV' },
  { label: 'Lithuania', code: 'LT' },
  { label: 'Estonia', code: 'EE' },
  { label: 'Finland', code: 'FI' },
  { label: 'Sweden', code: 'SE' },
  { label: 'Norway', code: 'NO' },
  { label: 'Denmark', code: 'DK' },
  { label: 'Ireland', code: 'IE' },
  { label: 'Switzerland', code: 'CH' },
  { label: 'Czech Republic', code: 'CZ', aliases: ['Czechia'] },
  { label: 'Slovakia', code: 'SK' },
  { label: 'Slovenia', code: 'SI' },
  { label: 'Croatia', code: 'HR' },
  { label: 'Serbia', code: 'RS' },
  { label: 'Bosnia-Herzegovina', code: 'BA', aliases: ['Bosnia and Herzegovina'] },
  { label: 'Kosovo', code: 'XK' },
  { label: 'Greece', code: 'GR' },
  { label: 'Romania', code: 'RO' },
  { label: 'Bulgaria', code: 'BG' },
  { label: 'Ukraine', code: 'UA' },
  { label: 'Russia', code: 'RU', aliases: ['Russian Federation'] },
  { label: 'Turkey', code: 'TR', aliases: ['Turkiye'] },
  { label: 'China', code: 'CN', aliases: ['PRC'] },
  { label: 'Japan', code: 'JP' },
  { label: 'India', code: 'IN' },
  { label: 'Pakistan', code: 'PK' },
  { label: 'South Korea', code: 'KR', aliases: ['Republic of Korea'] },
  { label: 'North Korea', code: 'KP', aliases: ['DPRK'] },
  { label: 'Israel', code: 'IL' },
  { label: 'Iran', code: 'IR' },
  { label: 'Iraq', code: 'IQ' },
  { label: 'Jordan', code: 'JO' },
  { label: 'Lebanon', code: 'LB' },
  { label: 'Syria', code: 'SY' },
  { label: 'Yemen', code: 'YE' },
  { label: 'Saudi Arabia', code: 'SA' },
  { label: 'United Arab Emirates', code: 'AE', aliases: ['UAE'] },
  { label: 'Qatar', code: 'QA' },
  { label: 'Egypt', code: 'EG' },
  { label: 'Djibouti', code: 'DJ' },
  { label: 'Somalia', code: 'SO' },
  { label: 'Algeria', code: 'DZ' },
  { label: 'Morocco', code: 'MA' },
  { label: 'Tunisia', code: 'TN' },
  { label: 'Libya', code: 'LY' },
  { label: 'Mauritania', code: 'MR' },
  { label: 'Mali', code: 'ML' },
  { label: 'Niger', code: 'NE' },
  { label: 'Canada', code: 'CA' },
  { label: 'Mexico', code: 'MX' },
  { label: 'Brazil', code: 'BR' },
  { label: 'Australia', code: 'AU' },
  { label: 'South Africa', code: 'ZA' },
  { label: 'Western Sahara', code: 'EH' },
  { label: 'French Guiana', code: 'GF' },
  { label: 'French Polynesia', code: 'PF' },
  { label: 'French West Indies', code: 'FR' },
  { label: 'Reunion Island', code: 'RE', aliases: ['Reunion'] },
];

const COUNTRY_ALIAS_ENTRIES = COUNTRY_ALIAS_DEFS
  .flatMap((def) => [def.label, ...(def.aliases ?? [])].map((alias) => ({ ...def, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function formatAreaLabel(areaSqKm: number): string {
  if (areaSqKm >= 1_000_000) return `${(areaSqKm / 1_000_000).toFixed(2)}M sq km`;
  if (areaSqKm >= 1_000) return `${(areaSqKm / 1_000).toFixed(0)}K sq km`;
  return `${formatCompactNumber(areaSqKm)} sq km`;
}

function getTotalAreaText(sec: Record<string, unknown>): string | undefined {
  return fbText(sec as Record<string, never>, 'Area', 'total')
    ?? fbText(sec as Record<string, never>, 'Area', 'total ');
}

function resolveAreaReference(text: string | undefined): AreaReference | null {
  const clean = normalizeFactbookText(text).toLowerCase();
  if (!clean) return null;
  const refs = AREA_REFERENCES
    .flatMap((ref) => [ref.label, ...(ref.aliases ?? [])].map((alias) => ({ ref, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
  return refs.find(({ alias }) => clean.includes(alias.toLowerCase()))?.ref ?? null;
}

function buildLandWaterSplit(landText: string | undefined, waterText: string | undefined): HTMLElement | null {
  const land = extractNumber(landText);
  const water = extractNumber(waterText);
  if (!Number.isFinite(land) || !Number.isFinite(water) || land < 0 || water < 0) return null;
  const total = land + water;
  if (total <= 0) return null;
  return stackedBar([
    { label: 'Land', pct: (land / total) * 100, color: '#8b5e34' },
    { label: 'Water', pct: (water / total) * 100, color: '#38bdf8' },
  ]);
}

function buildAreaComparison(countryName: string, totalAreaText: string | undefined, comparativeText: string | undefined): HTMLElement | null {
  const countryArea = extractNumber(totalAreaText);
  const ref = resolveAreaReference(comparativeText);
  if (!Number.isFinite(countryArea) || !ref) return comparativeText ? prose(comparativeText) : null;

  const wrap = el('div', 'cdp-fb-stack-v');
  const visual = el('div', 'cdp-fb-area-compare');
  const maxArea = Math.max(countryArea, ref.areaSqKm);
  const minSide = 28;
  const maxSide = 88;
  const sideFor = (area: number) => minSide + Math.sqrt(area / maxArea) * (maxSide - minSide);

  const left = el('div', 'cdp-fb-area-box-wrap');
  const leftBox = el('div', 'cdp-fb-area-box cdp-fb-area-box-country');
  leftBox.style.width = `${sideFor(countryArea)}px`;
  leftBox.style.height = `${sideFor(countryArea)}px`;
  left.append(
    leftBox,
    el('div', 'cdp-fb-area-label', countryName),
    el('div', 'cdp-fb-area-meta', formatAreaLabel(countryArea)),
  );

  const right = el('div', 'cdp-fb-area-box-wrap');
  const rightBox = el('div', 'cdp-fb-area-box cdp-fb-area-box-reference');
  rightBox.style.width = `${sideFor(ref.areaSqKm)}px`;
  rightBox.style.height = `${sideFor(ref.areaSqKm)}px`;
  right.append(
    rightBox,
    el('div', 'cdp-fb-area-label', ref.label),
    el('div', 'cdp-fb-area-meta', formatAreaLabel(ref.areaSqKm)),
  );

  visual.append(left, right);
  wrap.append(visual);

  const ratio = countryArea / ref.areaSqKm;
  wrap.append(el(
    'div',
    'cdp-fb-chart-note',
    `${ratio >= 1 ? ratio.toFixed(1) : (1 / ratio).toFixed(1)}${ratio >= 1 ? 'x larger than' : 'x smaller than'} ${ref.label}`,
  ));
  if (comparativeText) wrap.append(prose(comparativeText)!);
  return wrap;
}

function buildElevationProfile(highText: string | undefined, meanText: string | undefined, lowText: string | undefined): HTMLElement | null {
  const high = extractNumber(highText);
  const mean = extractNumber(meanText);
  const low = extractNumber(lowText);
  if (!Number.isFinite(high) || !Number.isFinite(mean) || !Number.isFinite(low)) return null;

  const wrap = el('div', 'cdp-fb-elevation');
  const svg = svgEl('svg', { viewBox: '0 0 320 120', class: 'cdp-fb-elevation-svg', role: 'img', 'aria-label': 'Elevation profile' });
  const floorY = 98;
  const topPad = 14;
  const min = Math.min(low, mean, high);
  const max = Math.max(low, mean, high);
  const range = Math.max(1, max - min);
  const points = [
    { x: 28, y: topPad + ((max - low) / range) * 72, label: 'Lowest', value: lowText ?? '' },
    { x: 160, y: topPad + ((max - mean) / range) * 72, label: 'Mean', value: meanText ?? '' },
    { x: 292, y: topPad + ((max - high) / range) * 72, label: 'Highest', value: highText ?? '' },
  ];

  svg.append(
    svgEl('line', { x1: '20', y1: String(floorY), x2: '300', y2: String(floorY), class: 'cdp-fb-elevation-axis' }),
    svgEl('path', {
      d: `M 20 ${floorY} L ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y} L ${points[2]!.x} ${points[2]!.y} L 300 ${floorY} Z`,
      class: 'cdp-fb-elevation-fill',
    }),
    svgEl('polyline', {
      points: points.map((point) => `${point.x},${point.y}`).join(' '),
      class: 'cdp-fb-elevation-line',
    }),
  );

  for (const point of points) {
    svg.append(svgEl('circle', { cx: String(point.x), cy: String(point.y), r: '4', class: 'cdp-fb-elevation-dot' }));
  }

  wrap.append(svg);
  const legend = el('div', 'cdp-fb-elevation-legend');
  for (const point of points) {
    const item = el('div', 'cdp-fb-elevation-item');
    item.append(
      el('div', 'cdp-fb-elevation-label', point.label),
      el('div', 'cdp-fb-elevation-value', takeValue(point.value)),
    );
    legend.append(item);
  }
  wrap.append(legend);
  return wrap;
}

function buildFlowBalance(title: string, productionText: string | undefined, consumptionText: string | undefined): HTMLElement | null {
  const production = extractNumber(productionText);
  const consumption = extractNumber(consumptionText);
  if (!Number.isFinite(production) && !Number.isFinite(consumption)) return null;
  const peak = Math.max(1, Number.isFinite(production) ? production : 0, Number.isFinite(consumption) ? consumption : 0);

  const card = el('div', 'cdp-fb-flow-card');
  card.append(el('div', 'cdp-fb-flow-title', title));

  const chart = el('div', 'cdp-fb-flow-chart');
  const left = el('div', 'cdp-fb-flow-side cdp-fb-flow-side-consumption');
  const leftFill = el('div', 'cdp-fb-flow-fill cdp-fb-flow-fill-consumption');
  leftFill.style.width = `${((Number.isFinite(consumption) ? consumption : 0) / peak) * 100}%`;
  left.append(leftFill);

  const center = el('div', 'cdp-fb-flow-center');
  center.append(el('div', 'cdp-fb-flow-axis'));

  const right = el('div', 'cdp-fb-flow-side cdp-fb-flow-side-production');
  const rightFill = el('div', 'cdp-fb-flow-fill cdp-fb-flow-fill-production');
  rightFill.style.width = `${((Number.isFinite(production) ? production : 0) / peak) * 100}%`;
  right.append(rightFill);

  chart.append(left, center, right);
  card.append(chart);

  const labels = el('div', 'cdp-fb-flow-labels');
  labels.append(
    el('div', 'cdp-fb-flow-label', `Consumption ${takeValue(consumptionText) || '—'}`),
    el('div', 'cdp-fb-flow-label cdp-fb-flow-label-right', `Production ${takeValue(productionText) || '—'}`),
  );
  card.append(labels);
  return card;
}

function iso2ToFlagEmoji(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper.length !== 2) return '\u{1F310}';
  return String.fromCodePoint(
    0x1F1E6 + upper.charCodeAt(0) - 65,
    0x1F1E6 + upper.charCodeAt(1) - 65,
  );
}

function resolveCountryFlagEmoji(name: string): string {
  const clean = normalizeFactbookText(name);
  if (!clean) return '\u{1F310}';
  const alias = COUNTRY_ALIAS_ENTRIES.find((entry) => entry.alias.toLowerCase() === clean.toLowerCase());
  if (alias) return iso2ToFlagEmoji(alias.code);
  return getCountryFlag(clean);
}

function parsePartnerStats(text: string | undefined): Array<{ name: string; pct: number | null }> {
  const labeled = parseLabeledPercents(text);
  if (labeled.length > 0) {
    return labeled.map((row) => ({ name: row.label.trim(), pct: row.pct }));
  }
  return splitList(text).map((item) => {
    const match = item.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?)%)?$/);
    return {
      name: match?.[1]?.trim() || item,
      pct: match?.[2] ? Number.parseFloat(match[2]) : null,
    };
  });
}

function buildPartnerChips(text: string | undefined): ChipSpec[] {
  return parsePartnerStats(text).slice(0, 8).map((row) => ({
    label: row.pct != null ? `${row.name} ${row.pct.toFixed(row.pct % 1 === 0 ? 0 : 1)}%` : row.name,
    icon: resolveCountryFlagEmoji(row.name),
    tone: 'info',
  }));
}

function parseCountryMentions(text: string | undefined, withCounts = false, exclude: string[] = []): ChipSpec[] {
  const clean = normalizeFactbookText(text);
  if (!clean) return [];
  const excluded = new Set(exclude.map((item) => normalizeFactbookText(item).toLowerCase()));
  const seen = new Set<string>();
  const chips: ChipSpec[] = [];

  for (const entry of COUNTRY_ALIAS_ENTRIES) {
    const aliasLower = entry.alias.toLowerCase();
    if (excluded.has(aliasLower) || seen.has(entry.label.toLowerCase())) continue;
    const aliasPattern = new RegExp(`\\b${escapeRegex(entry.alias)}\\b`, 'i');
    if (!aliasPattern.test(clean)) continue;

    let label = entry.label;
    if (withCounts) {
      const before = clean.match(new RegExp(`(\\d[\\d,]*)\\s+${escapeRegex(entry.alias)}\\b`, 'i'));
      const inside = clean.match(new RegExp(`\\b${escapeRegex(entry.alias)}\\s*\\((\\d[\\d,]*)\\)`, 'i'));
      const count = before?.[1] ?? inside?.[1];
      if (count) label = `${entry.label} ${count}`;
    }

    chips.push({
      label,
      icon: iso2ToFlagEmoji(entry.code),
      tone: 'info',
    });
    seen.add(entry.label.toLowerCase());
  }

  return chips;
}

// ─── Geography ────────────────────────────────────────────────────────────────

interface ParsedCoordinates {
  lat: number;
  lon: number;
}

interface PopulationBracket {
  label: string;
  pct: number;
  male: number;
  female: number;
}

interface MetricSeries {
  latestText: string | undefined;
  latestYear: string | undefined;
  values: number[];
  years: string[];
}

interface VisualSegment {
  label: string;
  pct: number;
  color: string;
}

interface GaugeMarker {
  value: number;
  label: string;
}

const HEALTH_WORLD_MEDIANS = {
  physician: { median: 1.8, label: '1.8/1K', higherIsBetter: true },
  beds: { median: 2.7, label: '2.7/1K', higherIsBetter: true },
  maternal: { median: 65, label: '65/100K', higherIsBetter: false },
  school: { median: 12, label: '12 years', higherIsBetter: true },
} as const;

const WORLD_POPULATION_ESTIMATE = 8_200_000_000;

function parseCoordinates(text: string | undefined): ParsedCoordinates | null {
  if (!text) return null;
  const matches = [...normalizeFactbookText(text).matchAll(/(\d{1,3})(?:\s+(\d{1,2}))?(?:\s+(\d{1,2}(?:\.\d+)?))?\s*([NSEW])/gi)];
  if (matches.length < 2) return null;
  const toDecimal = (match: RegExpMatchArray): number => {
    const degrees = Number.parseFloat(match[1] ?? '0');
    const minutes = Number.parseFloat(match[2] ?? '0');
    const seconds = Number.parseFloat(match[3] ?? '0');
    const dir = (match[4] ?? '').toUpperCase();
    const sign = dir === 'S' || dir === 'W' ? -1 : 1;
    return sign * (degrees + (minutes / 60) + (seconds / 3600));
  };
  return {
    lat: toDecimal(matches[0]!),
    lon: toDecimal(matches[1]!),
  };
}

function formatCoordinate(coord: number, positive: string, negative: string): string {
  const abs = Math.abs(coord);
  const decimals = abs >= 100 ? 1 : 2;
  return `${abs.toFixed(decimals)}\u00B0${coord >= 0 ? positive : negative}`;
}

function describeCoordinates(coords: ParsedCoordinates): string {
  return `${formatCoordinate(coords.lat, 'N', 'S')} • ${formatCoordinate(coords.lon, 'E', 'W')}`;
}

function projectWorld(coords: ParsedCoordinates, width: number, height: number): { x: number; y: number } {
  return {
    x: ((coords.lon + 180) / 360) * width,
    y: ((90 - coords.lat) / 180) * height,
  };
}

function buildLocatorMap(
  primaryCoordsText: string | undefined,
  options: { primaryLabel: string; secondaryCoordsText?: string | undefined; secondaryLabel?: string } = { primaryLabel: 'Location' },
): HTMLElement | null {
  const primary = parseCoordinates(primaryCoordsText);
  if (!primary) return null;
  const secondary = parseCoordinates(options.secondaryCoordsText);
  const width = 320;
  const height = 160;
  const primaryPoint = projectWorld(primary, width, height);
  const secondaryPoint = secondary ? projectWorld(secondary, width, height) : null;

  const wrap = el('div', 'cdp-fb-locator');
  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'cdp-fb-locator-svg',
    role: 'img',
    'aria-label': secondary
      ? `${options.primaryLabel} and ${options.secondaryLabel ?? 'reference'} locator`
      : `${options.primaryLabel} locator`,
  });

  svg.append(
    svgEl('rect', { x: '0', y: '0', width: String(width), height: String(height), rx: '16', class: 'cdp-fb-locator-bg' }),
  );

  for (const lon of [-120, -60, 0, 60, 120]) {
    const x = ((lon + 180) / 360) * width;
    svg.append(svgEl('line', {
      x1: x.toFixed(1),
      y1: '10',
      x2: x.toFixed(1),
      y2: String(height - 10),
      class: 'cdp-fb-locator-grid',
    }));
  }
  for (const lat of [-60, -30, 0, 30, 60]) {
    const y = ((90 - lat) / 180) * height;
    svg.append(svgEl('line', {
      x1: '12',
      y1: y.toFixed(1),
      x2: String(width - 12),
      y2: y.toFixed(1),
      class: lat === 0 ? 'cdp-fb-locator-grid cdp-fb-locator-grid-emphasis' : 'cdp-fb-locator-grid',
    }));
  }

  if (secondaryPoint) {
    svg.append(svgEl('line', {
      x1: primaryPoint.x.toFixed(1),
      y1: primaryPoint.y.toFixed(1),
      x2: secondaryPoint.x.toFixed(1),
      y2: secondaryPoint.y.toFixed(1),
      class: 'cdp-fb-locator-link',
    }));
    svg.append(svgEl('circle', {
      cx: secondaryPoint.x.toFixed(1),
      cy: secondaryPoint.y.toFixed(1),
      r: '5.5',
      class: 'cdp-fb-locator-dot-secondary',
    }));
  }

  svg.append(svgEl('circle', {
    cx: primaryPoint.x.toFixed(1),
    cy: primaryPoint.y.toFixed(1),
    r: '6',
    class: 'cdp-fb-locator-dot',
  }));

  wrap.append(svg);

  const legend = el('div', 'cdp-fb-locator-legend');
  const primaryMeta = el('div', 'cdp-fb-locator-meta');
  primaryMeta.append(
    el('div', 'cdp-fb-locator-label', options.primaryLabel),
    el('div', 'cdp-fb-locator-value', describeCoordinates(primary)),
  );
  legend.append(primaryMeta);

  if (secondary) {
    const secondaryMeta = el('div', 'cdp-fb-locator-meta');
    secondaryMeta.append(
      el('div', 'cdp-fb-locator-label', options.secondaryLabel ?? 'Reference'),
      el('div', 'cdp-fb-locator-value', describeCoordinates(secondary)),
    );
    legend.append(secondaryMeta);
  }

  wrap.append(legend);
  return wrap;
}

function parsePopulationBracket(label: string, text: string | undefined): PopulationBracket | null {
  const clean = normalizeFactbookText(text);
  if (!clean) return null;
  const male = clean.match(/\bmale\s+([\d,]+)/i)?.[1];
  const female = clean.match(/\bfemale\s+([\d,]+)/i)?.[1];
  if (!male || !female) return null;
  return {
    label,
    pct: extractPercent(clean),
    male: Number.parseFloat(male.replace(/,/g, '')),
    female: Number.parseFloat(female.replace(/,/g, '')),
  };
}

function buildPopulationPyramid(rows: PopulationBracket[]): HTMLElement | null {
  const valid = rows.filter((row) => Number.isFinite(row.male) && Number.isFinite(row.female));
  if (valid.length === 0) return null;
  const peak = Math.max(1, ...valid.flatMap((row) => [row.male, row.female]));
  const totalMale = valid.reduce((sum, row) => sum + row.male, 0);
  const totalFemale = valid.reduce((sum, row) => sum + row.female, 0);

  const wrap = el('div', 'cdp-fb-pyramid');
  const head = el('div', 'cdp-fb-pyramid-head');
  head.append(
    el('div', 'cdp-fb-pyramid-side-label cdp-fb-pyramid-side-label-male', 'Male'),
    el('div', 'cdp-fb-pyramid-side-label cdp-fb-pyramid-side-label-female', 'Female'),
  );
  wrap.append(head);

  for (const row of valid) {
    const rowEl = el('div', 'cdp-fb-pyramid-row');

    const maleSide = el('div', 'cdp-fb-pyramid-side cdp-fb-pyramid-side-male');
    maleSide.title = `${row.label}: ${formatCompactNumber(row.male)} male`;
    const maleFill = el('div', 'cdp-fb-pyramid-fill cdp-fb-pyramid-fill-male');
    maleFill.style.width = `${Math.max(6, (row.male / peak) * 100)}%`;
    maleSide.append(maleFill);

    const age = el('div', 'cdp-fb-pyramid-age', Number.isFinite(row.pct) ? `${row.label} ${row.pct.toFixed(1)}%` : row.label);

    const femaleSide = el('div', 'cdp-fb-pyramid-side cdp-fb-pyramid-side-female');
    femaleSide.title = `${row.label}: ${formatCompactNumber(row.female)} female`;
    const femaleFill = el('div', 'cdp-fb-pyramid-fill cdp-fb-pyramid-fill-female');
    femaleFill.style.width = `${Math.max(6, (row.female / peak) * 100)}%`;
    femaleSide.append(femaleFill);

    rowEl.append(maleSide, age, femaleSide);
    wrap.append(rowEl);
  }

  wrap.append(el(
    'div',
    'cdp-fb-pyramid-meta',
    `Male ${formatCompactNumber(totalMale)} • Female ${formatCompactNumber(totalFemale)}`,
  ));
  return wrap;
}

function collectMetricSeries(
  obj: Record<string, FactbookNode> | undefined,
  basename: string,
): MetricSeries {
  const latest = latestYearEntry(obj, basename);
  if (!obj) {
    return {
      latestText: latest.text,
      latestYear: latest.year,
      values: [],
      years: [],
    };
  }

  const rows = Object.entries(obj)
    .map(([key, value]) => {
      if (!key.startsWith(basename)) return null;
      const year = key.match(/(\d{4})$/)?.[1];
      const text = typeof value === 'object' && value && 'text' in value
        ? (value as { text?: string }).text
        : undefined;
      const numeric = extractNumber(text);
      if (!year || !text || !Number.isFinite(numeric)) return null;
      return { year, value: numeric };
    })
    .filter((row): row is { year: string; value: number } => !!row)
    .sort((a, b) => Number.parseInt(a.year, 10) - Number.parseInt(b.year, 10));

  return {
    latestText: latest.text,
    latestYear: latest.year,
    values: rows.map((row) => row.value),
    years: rows.map((row) => row.year),
  };
}

function buildSparklineTile(
  label: string,
  obj: Record<string, FactbookNode> | undefined,
  basename: string,
): HTMLElement | null {
  const series = collectMetricSeries(obj, basename);
  if (!series.latestText) return null;
  const tile = statTile(label, takeValue(series.latestText), { year: series.latestYear });
  if (series.values.length >= 2) {
    const change = series.values[series.values.length - 1]! - series.values[0]!;
    const sparkMarkup = miniSparkline(series.values, change, 56, 18);
    if (sparkMarkup) {
      const spark = el('div', 'cdp-fb-tile-spark');
      spark.innerHTML = sparkMarkup;
      spark.title = `${series.years[0]} to ${series.years[series.years.length - 1]}`;
      tile.append(spark);
    }
  }
  return tile;
}

function buildBenchmarkTile(
  label: string,
  text: string | undefined,
  median: number,
  medianLabel: string,
  higherIsBetter: boolean,
): HTMLElement | null {
  const valueText = abbreviateStat(takeValue(text));
  if (!valueText) return null;
  const tile = statTile(label, valueText);
  const value = extractNumber(text);
  if (!Number.isFinite(value) || !Number.isFinite(median) || median <= 0) return tile;

  const favorable = higherIsBetter ? value >= median : value <= median;
  const ceiling = Math.max(median * 2, value);
  const ratio = value / median;
  const relation = value >= median ? 'above' : 'below';

  const benchmark = el('div', 'cdp-fb-benchmark');
  const track = el('div', 'cdp-fb-benchmark-track');
  const fill = el(
    'div',
    favorable ? 'cdp-fb-benchmark-fill cdp-fb-benchmark-fill-good' : 'cdp-fb-benchmark-fill cdp-fb-benchmark-fill-bad',
  );
  fill.style.width = `${Math.max(5, (Math.min(value, ceiling) / ceiling) * 100)}%`;
  const marker = el('div', 'cdp-fb-benchmark-marker');
  marker.style.left = `${(median / ceiling) * 100}%`;
  track.append(fill, marker);

  benchmark.append(
    track,
    el('div', 'cdp-fb-benchmark-meta', `${ratio.toFixed(ratio >= 10 ? 0 : 1)}x ${relation} median • world median ${medianLabel}`),
  );
  tile.append(benchmark);
  return tile;
}

function buildTransportChart(items: Array<{ label: string; icon: string; text: string | undefined; color: string }>): HTMLElement | null {
  const metrics = items
    .map((item) => ({
      ...item,
      value: extractNumber(item.text),
    }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
  if (metrics.length === 0) return null;

  const peak = Math.max(...metrics.map((item) => item.value), 1);
  const wrap = el('div', 'cdp-fb-stack-v');
  const chart = el('div', 'cdp-fb-bars cdp-fb-bars-transport');

  for (const item of metrics) {
    const row = el('div', 'cdp-fb-bar-row');
    const label = el('span', 'cdp-fb-bar-label', `${item.icon} ${item.label}`);
    const track = el('div', 'cdp-fb-bar-track');
    const fill = el('div', 'cdp-fb-bar-fill cdp-fb-bar-fill-transport');
    fill.style.width = `${Math.max(6, (Math.log10(item.value + 1) / Math.log10(peak + 1)) * 100)}%`;
    fill.style.background = `linear-gradient(90deg, ${item.color}, color-mix(in srgb, ${item.color} 55%, white 45%))`;
    track.append(fill);
    row.append(label, track, el('span', 'cdp-fb-bar-val', takeValue(item.text)));
    chart.append(row);
  }

  wrap.append(chart, el('div', 'cdp-fb-chart-note', 'Log scale across mixed units to show infrastructure scale at a glance.'));
  return wrap;
}

function buildPopulationPictogram(popText: string | undefined): HTMLElement | null {
  const population = extractNumber(popText);
  if (!Number.isFinite(population) || population <= 0) return null;

  const share = Math.min(1, population / WORLD_POPULATION_ESTIMATE);
  const scaled = share * 10;
  const fullIcons = Math.floor(scaled);
  const partialIcon = Math.max(0, Math.min(1, scaled - fullIcons));

  const wrap = el('div', 'cdp-fb-pop-pictogram');
  const row = el('div', 'cdp-fb-pop-icons');
  for (let i = 0; i < 10; i += 1) {
    const icon = el('div', 'cdp-fb-pop-icon');
    const fill = el('div', 'cdp-fb-pop-icon-fill');
    const ratio = i < fullIcons ? 1 : i === fullIcons ? partialIcon : 0;
    fill.style.height = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    icon.append(fill);
    row.append(icon);
  }

  const sharePct = (share * 100).toFixed(share >= 0.1 ? 1 : 2);
  wrap.append(
    row,
    el('div', 'cdp-fb-pop-meta', `${sharePct}% of world population`),
  );
  return wrap;
}

function buildDonutChart(segments: VisualSegment[], centerLabel: string): HTMLElement | null {
  const valid = segments.filter((segment) => Number.isFinite(segment.pct) && segment.pct > 0);
  if (valid.length === 0) return null;

  const total = valid.reduce((sum, segment) => sum + segment.pct, 0) || 1;
  const wrap = el('div', 'cdp-fb-donut');
  const svg = svgEl('svg', {
    viewBox: '0 0 120 120',
    class: 'cdp-fb-donut-svg',
    role: 'img',
    'aria-label': `${centerLabel} breakdown donut chart`,
  });
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  svg.append(svgEl('circle', {
    cx: '60',
    cy: '60',
    r: String(radius),
    class: 'cdp-fb-donut-track',
  }));

  for (const segment of valid) {
    const ring = svgEl('circle', {
      cx: '60',
      cy: '60',
      r: String(radius),
      class: 'cdp-fb-donut-segment',
    });
    ring.style.stroke = segment.color;
    ring.style.strokeDasharray = `${(segment.pct / total) * circumference} ${circumference}`;
    ring.style.strokeDashoffset = `${-offset}`;
    offset += (segment.pct / total) * circumference;
    svg.append(ring);
  }

  const center = el('div', 'cdp-fb-donut-center');
  center.append(
    el('div', 'cdp-fb-donut-value', `${Math.round(total)}%`),
    el('div', 'cdp-fb-donut-label', centerLabel),
  );
  wrap.append(svg, center);
  return wrap;
}

function buildGauge(
  value: number,
  options: {
    label: string;
    valueText: string;
    note?: string;
    max: number;
    markers?: GaugeMarker[];
    tone?: 'good' | 'warn' | 'info';
  },
): HTMLElement | null {
  if (!Number.isFinite(value) || !Number.isFinite(options.max) || options.max <= 0) return null;

  const wrap = el('div', 'cdp-fb-gauge');
  const svg = svgEl('svg', {
    viewBox: '0 0 160 160',
    class: 'cdp-fb-gauge-svg',
    role: 'img',
    'aria-label': `${options.label} gauge`,
  });
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(options.max, value));

  const track = svgEl('circle', {
    cx: '80',
    cy: '80',
    r: String(radius),
    class: 'cdp-fb-gauge-track',
  });
  const progress = svgEl('circle', {
    cx: '80',
    cy: '80',
    r: String(radius),
    class: `cdp-fb-gauge-progress cdp-fb-gauge-progress-${options.tone ?? 'info'}`,
  });
  progress.style.strokeDasharray = `${(clamped / options.max) * circumference} ${circumference}`;
  progress.style.strokeDashoffset = '0';
  svg.append(track, progress);

  for (const marker of options.markers ?? []) {
    if (!Number.isFinite(marker.value) || marker.value < 0) continue;
    const ratio = Math.max(0, Math.min(1, marker.value / options.max));
    const angle = -90 + ratio * 360;
    const radians = angle * (Math.PI / 180);
    const cx = 80 + Math.cos(radians) * radius;
    const cy = 80 + Math.sin(radians) * radius;
    svg.append(svgEl('circle', {
      cx: cx.toFixed(1),
      cy: cy.toFixed(1),
      r: '3.5',
      class: 'cdp-fb-gauge-marker-dot',
    }));
  }

  const body = el('div', 'cdp-fb-gauge-body');
  body.append(
    el('div', 'cdp-fb-gauge-value', options.valueText),
    el('div', 'cdp-fb-gauge-label', options.label),
  );
  if (options.note) {
    body.append(el('div', 'cdp-fb-gauge-note', options.note));
  }

  wrap.append(svg, body);

  if ((options.markers ?? []).length > 0) {
    const legend = el('div', 'cdp-fb-gauge-legend');
    for (const marker of options.markers ?? []) {
      const item = el('div', 'cdp-fb-gauge-legend-item');
      item.append(
        el('span', 'cdp-fb-gauge-legend-dot'),
        el('span', 'cdp-fb-gauge-legend-label', marker.label),
      );
      legend.append(item);
    }
    wrap.append(legend);
  }

  return wrap;
}

function renderGeography(data: FactbookData, country: string): HTMLElement | null {
  const sec = data.Geography;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Location + coordinates
  const loc = fbText(sec, 'Location');
  const coords = fbText(sec, 'Geographic coordinates');
  if (loc || coords) {
    const body = el('div', 'cdp-fb-stack-v');
    const locator = buildLocatorMap(coords, { primaryLabel: 'Country center' });
    if (locator) body.append(locator);
    if (loc) body.append(prose(loc)!);
    if (coords) body.append(el('div', 'cdp-fb-coords', `📍 ${coords}`));
    const card = sectionCard('Location', body);
    if (card) stack.append(card);
  }

  // At a glance
  const totalAreaText = getTotalAreaText(sec as Record<string, unknown>);
  const landAreaText = fbText(sec, 'Area', 'land');
  const waterAreaText = fbText(sec, 'Area', 'water');
  const tiles: Array<HTMLElement | null> = [
    statTile('Total area', takeValue(totalAreaText)),
    statTile('Land', takeValue(landAreaText)),
    statTile('Water', takeValue(waterAreaText)),
    statTile('Coastline', takeValue(fbText(sec, 'Coastline'))),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '—') !== '—');
  const glance = sectionCard('At a glance', combine([
    buildLandWaterSplit(landAreaText, waterAreaText),
    tiles.length > 0 ? tileGrid(2, tiles) : null,
  ]));
  if (glance) stack.append(glance);

  // Comparative
  const comp = fbText(sec, 'Area - comparative');
  if (comp) {
    const card = sectionCard('Size comparison', buildAreaComparison(country, totalAreaText, comp));
    if (card) stack.append(card);
  }

  // Elevation
  const highPointText = fbText(sec, 'Elevation', 'highest point');
  const lowPointText = fbText(sec, 'Elevation', 'lowest point');
  const meanElevationText = fbText(sec, 'Elevation', 'mean elevation');
  const elev: Array<HTMLElement | null> = [
    statTile('Highest point', takeValue(highPointText)),
    statTile('Lowest point', takeValue(lowPointText)),
    statTile('Mean elevation', takeValue(meanElevationText)),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '—') !== '—');
  if (elev.length > 0) {
    const card = sectionCard('Elevation', combine([
      buildElevationProfile(highPointText, meanElevationText, lowPointText),
      tileGrid(3, elev),
    ]));
    if (card) stack.append(card);
  }

  // Climate + Terrain
  const climate = fbText(sec, 'Climate');
  const terrain = fbText(sec, 'Terrain');
  if (climate || terrain) {
    const body = el('div', 'cdp-fb-stack-v');
    const climateChips = collectKeywordChips(climate, CLIMATE_CHIP_RULES);
    if (climateChips.length > 0) {
      body.append(chipRow(climateChips));
    }
    if (climate) {
      body.append(collapsible('Climate details', prose(climate) ?? el('div')));
    }
    if (terrain) {
      body.append(el('div', 'cdp-fb-subhead', 'Terrain'));
      body.append(prose(terrain)!);
    }
    const card = sectionCard('Climate & terrain', body);
    if (card) stack.append(card);
  }

  // Natural resources
  const resources = splitList(fbText(sec, 'Natural resources'));
  if (resources.length > 0) {
    const card = sectionCard('Natural resources', chipRow(mapItemsToChips(resources, RESOURCE_CHIP_RULES)));
    if (card) stack.append(card);
  }

  // Natural hazards
  const hazards = fbText(sec, 'Natural hazards');
  if (hazards) {
    const body = el('div', 'cdp-fb-stack-v');
    const hazardChips = collectKeywordChips(hazards, HAZARD_CHIP_RULES);
    if (hazardChips.length > 0) {
      body.append(chipRow(hazardChips));
    }
    body.append(collapsible('Hazard details', prose(hazards) ?? el('div')));
    const card = sectionCard('Natural hazards', body);
    if (card) stack.append(card);
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── People & Society ─────────────────────────────────────────────────────────

function renderPeople(data: FactbookData): HTMLElement | null {
  const sec = data['People and Society'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Population hero
  const pop = fbText(sec, 'Population', 'total') ?? fbText(sec, 'Population');
  const growth = fbText(sec, 'Population growth rate');
  if (pop) {
    const hero = el('div', 'cdp-fb-hero');
    hero.append(
      el('div', 'cdp-fb-hero-value', takeValue(pop)),
      el('div', 'cdp-fb-hero-label', 'Total population'),
    );
    if (growth) {
      hero.append(el('div', 'cdp-fb-hero-meta', `Growth: ${growth}`));
    }
    const pictogram = buildPopulationPictogram(pop);
    if (pictogram) hero.append(pictogram);
    const card = sectionCard('Population', hero);
    if (card) stack.append(card);
  }

  // Age structure
  const ageYoung = extractPercent(fbText(sec, 'Age structure', '0-14 years'));
  const ageMid = extractPercent(fbText(sec, 'Age structure', '15-64 years'));
  const ageOld = extractPercent(fbText(sec, 'Age structure', '65 years and over'));
  const median = takeValue(fbText(sec, 'Median age', 'total'));
  const pyramid = buildPopulationPyramid([
    parsePopulationBracket('0–14', fbText(sec, 'Age structure', '0-14 years')),
    parsePopulationBracket('15–64', fbText(sec, 'Age structure', '15-64 years')),
    parsePopulationBracket('65+', fbText(sec, 'Age structure', '65 years and over')),
  ].filter((row): row is PopulationBracket => !!row));
  if (Number.isFinite(ageYoung) || Number.isFinite(ageMid) || Number.isFinite(ageOld) || median) {
    const body = el('div', 'cdp-fb-stack-v');
    if (pyramid) body.append(pyramid);
    if (Number.isFinite(ageYoung) && Number.isFinite(ageMid) && Number.isFinite(ageOld)) {
      body.append(
        stackedBar([
          { label: '0–14', pct: ageYoung, color: PALETTE.youth },
          { label: '15–64', pct: ageMid, color: PALETTE.working },
          { label: '65+', pct: ageOld, color: PALETTE.elder },
        ]),
      );
    }
    if (median) {
      body.append(tileGrid(2, [statTile('Median age', median)]));
    }
    const card = sectionCard('Age structure', body);
    if (card) stack.append(card);
  }

  // Languages
  const langs = parseLabeledPercents(fbText(sec, 'Languages'));
  if (langs.length > 0) {
    const card = sectionCard('Languages', labeledBars(langs));
    if (card) stack.append(card);
  }

  // Religions
  const rels = parseLabeledPercents(fbText(sec, 'Religions'));
  if (rels.length > 0) {
    const card = sectionCard('Religions', labeledBars(rels));
    if (card) stack.append(card);
  }

  // Vitals
  const vitals: Array<HTMLElement | null> = [
    statTile('Life expectancy', takeValue(fbText(sec, 'Life expectancy at birth', 'total population'))),
    statTile('Urbanization', abbreviateStat(takeValue(fbText(sec, 'Urbanization', 'urban population')))),
    statTile('Birth rate', abbreviateStat(takeValue(fbText(sec, 'Birth rate')))),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '—') !== '—');
  if (vitals.length > 0) {
    const card = sectionCard('Vitals', tileGrid(3, vitals));
    if (card) stack.append(card);
  }

  // Health & education
  const health: Array<HTMLElement | null> = [
    buildBenchmarkTile(
      'Physician density',
      fbText(sec, 'Physician density'),
      HEALTH_WORLD_MEDIANS.physician.median,
      HEALTH_WORLD_MEDIANS.physician.label,
      HEALTH_WORLD_MEDIANS.physician.higherIsBetter,
    ),
    buildBenchmarkTile(
      'Hospital beds',
      fbText(sec, 'Hospital bed density'),
      HEALTH_WORLD_MEDIANS.beds.median,
      HEALTH_WORLD_MEDIANS.beds.label,
      HEALTH_WORLD_MEDIANS.beds.higherIsBetter,
    ),
    buildBenchmarkTile(
      'Maternal mortality',
      fbText(sec, 'Maternal mortality ratio'),
      HEALTH_WORLD_MEDIANS.maternal.median,
      HEALTH_WORLD_MEDIANS.maternal.label,
      HEALTH_WORLD_MEDIANS.maternal.higherIsBetter,
    ),
    buildBenchmarkTile(
      'School life expectancy',
      fbText(sec, 'School life expectancy (primary to tertiary education)', 'total'),
      HEALTH_WORLD_MEDIANS.school.median,
      HEALTH_WORLD_MEDIANS.school.label,
      HEALTH_WORLD_MEDIANS.school.higherIsBetter,
    ),
  ].filter((t) => t && (t.querySelector('.cdp-fb-tile-value')?.textContent ?? '—') !== '—');
  if (health.length > 0) {
    const card = sectionCard('Health & education', tileGrid(2, health));
    if (card) stack.append(card);
  }

  // Ethnic groups — bar chart when percentages are available, prose fallback otherwise
  const ethnicPcts = parseLabeledPercents(fbText(sec, 'Ethnic groups'));
  if (ethnicPcts.length > 0) {
    const card = sectionCard('Ethnic groups', labeledBars(ethnicPcts));
    if (card) stack.append(card);
  } else {
    const ethnicRaw = fbText(sec, 'Ethnic groups');
    if (ethnicRaw) stack.append(collapsible('Ethnic groups', prose(ethnicRaw) ?? el('div')));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Government ───────────────────────────────────────────────────────────────

function renderGovernment(data: FactbookData): HTMLElement | null {
  const sec = data.Government;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Leadership
  const chief = fbText(sec, 'Executive branch', 'chief of state');
  const head = fbText(sec, 'Executive branch', 'head of government');
  if (chief || head) {
    const row = el('div', 'cdp-fb-grid cdp-fb-grid-2');
    row.append(personCard('Chief of state', chief));
    row.append(personCard('Head of government', head));
    const card = sectionCard('Leadership', row);
    if (card) stack.append(card);
  }

  // Structure
  const govType = fbText(sec, 'Government type');
  const legal = fbText(sec, 'Legal system');
  if (govType || legal) {
    const body = el('div', 'cdp-fb-stack-v');
    const badges = badgeRow([describeGovernmentType(govType), describeLegalSystem(legal)]);
    if (badges.childElementCount > 0) {
      body.append(badges);
    }
    if (govType) {
      body.append(el('div', 'cdp-fb-subhead', 'Government type'));
      body.append(prose(govType)!);
    }
    if (legal) {
      body.append(el('div', 'cdp-fb-subhead', 'Legal system'));
      body.append(prose(legal)!);
    }
    const card = sectionCard('Structure', body);
    if (card) stack.append(card);
  }

  // Capital
  const capName = fbText(sec, 'Capital', 'name');
  const capCoords = fbText(sec, 'Capital', 'geographic coordinates');
  const capTz = fbText(sec, 'Capital', 'time difference');
  const countryCoords = fbText(data.Geography, 'Geographic coordinates');
  if (capName) {
    const body = el('div', 'cdp-fb-stack-v');
    const locator = buildLocatorMap(capCoords, {
      primaryLabel: capName,
      secondaryCoordsText: countryCoords,
      secondaryLabel: 'Country center',
    });
    if (locator) body.append(locator);
    body.append(el('div', 'cdp-fb-hero-value', capName));
    const meta: string[] = [];
    if (capCoords) meta.push(`📍 ${capCoords}`);
    if (capTz) meta.push(`🕐 ${capTz}`);
    if (meta.length > 0) body.append(el('div', 'cdp-fb-hero-meta', meta.join('   ')));
    const card = sectionCard('Capital', body);
    if (card) stack.append(card);
  }

  // Independence
  const indep = fbText(sec, 'Independence');
  const holiday = fbText(sec, 'National holiday');
  if (indep || holiday) {
    const body = el('div', 'cdp-fb-stack-v');
    if (indep) {
      body.append(el('div', 'cdp-fb-subhead', 'Independence'));
      body.append(prose(indep)!);
    }
    if (holiday) {
      body.append(el('div', 'cdp-fb-subhead', 'National holiday'));
      body.append(prose(holiday)!);
    }
    const card = sectionCard('History', body);
    if (card) stack.append(card);
  }

  // Constitution (collapsed)
  const consHist = fbText(sec, 'Constitution', 'history');
  if (consHist) {
    stack.append(collapsible('Constitution', prose(consHist) ?? el('div')));
  }

  // Administrative divisions (collapsed, with chips when comma-separated)
  const admin = fbText(sec, 'Administrative divisions');
  if (admin) {
    const chips = splitList(admin);
    const body = chips.length > 2 ? chipRow(chips) : prose(admin) ?? el('div');
    stack.append(collapsible('Administrative divisions', body));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Economy ──────────────────────────────────────────────────────────────────

function renderEconomy(data: FactbookData): HTMLElement | null {
  const sec = data.Economy;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Headline
  const headline: Array<HTMLElement | null> = [
    buildSparklineTile('GDP (PPP)', fbObj(sec, 'Real GDP (purchasing power parity)'), 'Real GDP (purchasing power parity)'),
    buildSparklineTile('GDP per capita', fbObj(sec, 'Real GDP per capita'), 'Real GDP per capita'),
    buildSparklineTile('Real GDP growth', fbObj(sec, 'Real GDP growth rate'), 'Real GDP growth rate'),
  ];
  if (headline.some(Boolean)) {
    const card = sectionCard('Headline', tileGrid(3, headline));
    if (card) stack.append(card);
  }

  // GDP composition
  const ag = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'agriculture'));
  const ind = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'industry'));
  const svc = extractPercent(fbText(sec, 'GDP - composition, by sector of origin', 'services'));
  if (Number.isFinite(ag) && Number.isFinite(ind) && Number.isFinite(svc)) {
    const segments: VisualSegment[] = [
      { label: 'Agriculture', pct: ag, color: PALETTE.agriculture },
      { label: 'Industry', pct: ind, color: PALETTE.industry },
      { label: 'Services', pct: svc, color: PALETTE.services },
    ];
    const card = sectionCard(
      'GDP composition by sector',
      combine([
        buildDonutChart(segments, 'GDP'),
        stackedBar(segments),
      ]),
    );
    if (card) stack.append(card);
  }

  // Fiscal
  const fiscal: Array<HTMLElement | null> = [
    buildSparklineTile('Inflation', fbObj(sec, 'Inflation rate (consumer prices)'), 'Inflation rate (consumer prices)'),
    buildSparklineTile('Unemployment', fbObj(sec, 'Unemployment rate'), 'Unemployment rate'),
    buildSparklineTile('Public debt', fbObj(sec, 'Public debt'), 'Public debt'),
  ];
  if (fiscal.some(Boolean)) {
    const card = sectionCard('Fiscal', tileGrid(3, fiscal));
    if (card) stack.append(card);
  }

  // Trade
  const expVal = latestYearEntry(fbObj(sec, 'Exports'), 'Exports');
  const impVal = latestYearEntry(fbObj(sec, 'Imports'), 'Imports');
  const expPart = buildPartnerChips(fbText(sec, 'Exports - partners'));
  const impPart = buildPartnerChips(fbText(sec, 'Imports - partners'));
  const expCom = splitList(fbText(sec, 'Exports - commodities'));
  const impCom = splitList(fbText(sec, 'Imports - commodities'));
  const hasTrade = expVal.text || impVal.text || expPart.length || impPart.length;
  if (hasTrade) {
    const row = el('div', 'cdp-fb-grid cdp-fb-grid-2');

    const expBody = el('div', 'cdp-fb-stack-v');
    if (expVal.text) {
      expBody.append(el('div', 'cdp-fb-value-big', takeValue(expVal.text)));
      if (expVal.year) expBody.append(el('div', 'cdp-fb-tile-year', expVal.year));
    }
    if (expPart.length > 0) {
      expBody.append(el('div', 'cdp-fb-subhead', 'Partners'));
      expBody.append(chipRow(expPart));
    }
    if (expCom.length > 0) {
      expBody.append(el('div', 'cdp-fb-subhead', 'Commodities'));
      expBody.append(chipRow(mapItemsToChips(expCom.slice(0, 8), COMMODITY_CHIP_RULES)));
    }
    const expCard = el('section', 'cdp-card cdp-fb-card');
    expCard.append(el('h3', 'cdp-card-title', 'Exports'));
    const expCardBody = el('div', 'cdp-card-body');
    expCardBody.append(expBody);
    expCard.append(expCardBody);
    row.append(expCard);

    const impBody = el('div', 'cdp-fb-stack-v');
    if (impVal.text) {
      impBody.append(el('div', 'cdp-fb-value-big', takeValue(impVal.text)));
      if (impVal.year) impBody.append(el('div', 'cdp-fb-tile-year', impVal.year));
    }
    if (impPart.length > 0) {
      impBody.append(el('div', 'cdp-fb-subhead', 'Partners'));
      impBody.append(chipRow(impPart));
    }
    if (impCom.length > 0) {
      impBody.append(el('div', 'cdp-fb-subhead', 'Commodities'));
      impBody.append(chipRow(mapItemsToChips(impCom.slice(0, 8), COMMODITY_CHIP_RULES)));
    }
    const impCard = el('section', 'cdp-card cdp-fb-card');
    impCard.append(el('h3', 'cdp-card-title', 'Imports'));
    const impCardBody = el('div', 'cdp-card-body');
    impCardBody.append(impBody);
    impCard.append(impCardBody);
    row.append(impCard);

    stack.append(row);
  }

  // Economic overview (collapsed if long)
  const overview = fbText(sec, 'Economic overview');
  if (overview) {
    if (overview.length > 400) {
      stack.append(collapsible('Economic overview', prose(overview) ?? el('div')));
    } else {
      const card = sectionCard('Economic overview', prose(overview));
      if (card) stack.append(card);
    }
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Energy ───────────────────────────────────────────────────────────────────

function renderEnergy(data: FactbookData): HTMLElement | null {
  const sec = data.Energy;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Electricity
  const access = takeValue(fbText(sec, 'Electricity access', 'electrification - total population'));
  const accessPct = extractPercent(fbText(sec, 'Electricity access', 'electrification - total population'));
  const capacity = takeValue(fbText(sec, 'Electricity', 'installed generating capacity'));
  const consumption = takeValue(fbText(sec, 'Electricity', 'consumption'));
  const elecTiles: Array<HTMLElement | null> = [
    access ? statTile('Access to electricity', access) : null,
    capacity ? statTile('Installed capacity', capacity) : null,
    consumption ? statTile('Consumption', consumption) : null,
  ];
  const accessGauge = Number.isFinite(accessPct)
    ? buildGauge(accessPct, {
      label: 'Electrification',
      valueText: access ?? `${accessPct.toFixed(1)}%`,
      note: 'Share of population with electricity access',
      max: 100,
      tone: accessPct >= 95 ? 'good' : accessPct >= 75 ? 'info' : 'warn',
    })
    : null;
  if (accessGauge || elecTiles.some(Boolean)) {
    const card = sectionCard('Electricity', combine([
      accessGauge,
      tileGrid(3, elecTiles),
    ]));
    if (card) stack.append(card);
  }

  // Generation mix
  const sources = fbObj(sec, 'Electricity generation sources');
  if (sources) {
    const keyMap: Array<[string, string]> = [
      ['fossil fuels', PALETTE.fossil],
      ['nuclear', PALETTE.nuclear],
      ['hydroelectricity', PALETTE.hydro],
      ['solar', PALETTE.solar],
      ['wind', PALETTE.wind],
      ['geothermal', PALETTE.geothermal],
      ['biomass and waste', PALETTE.biomass],
      ['tide and wave', PALETTE.other],
    ];
    const segments = keyMap
      .map(([k, color]) => ({
        label: k.replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
        pct: extractPercent(fbText(sources, k)),
        color,
      }))
      .filter((s) => Number.isFinite(s.pct) && s.pct > 0);
    if (segments.length > 0) {
      const card = sectionCard('Generation mix', combine([
        buildDonutChart(segments, 'Power'),
        stackedBar(segments),
      ]));
      if (card) stack.append(card);
    }
  }

  // Reserves
  const oilReserve = takeValue(fbText(sec, 'Petroleum', 'crude oil estimated reserves'));
  const gasReserve = takeValue(fbText(sec, 'Natural gas', 'proven reserves'));
  if (oilReserve || gasReserve) {
    const card = sectionCard(
      'Reserves',
      tileGrid(2, [
        oilReserve ? statTile('Crude oil', oilReserve) : null,
        gasReserve ? statTile('Natural gas', gasReserve) : null,
      ]),
    );
    if (card) stack.append(card);
  }

  // Production vs consumption
  const oilProd = takeValue(fbText(sec, 'Petroleum', 'total petroleum production'));
  const oilCons = takeValue(fbText(sec, 'Petroleum', 'refined petroleum consumption'));
  const gasProd = takeValue(fbText(sec, 'Natural gas', 'production'));
  const gasCons = takeValue(fbText(sec, 'Natural gas', 'consumption'));
  if (oilProd || oilCons || gasProd || gasCons) {
    const body = el('div', 'cdp-fb-stack-v');
    if (oilProd || oilCons) {
      body.append(buildFlowBalance('Petroleum', oilProd, oilCons)
        ?? tileGrid(2, [
          oilProd ? statTile('Production', oilProd) : null,
          oilCons ? statTile('Consumption', oilCons) : null,
        ]));
    }
    if (gasProd || gasCons) {
      body.append(buildFlowBalance('Natural gas', gasProd, gasCons)
        ?? tileGrid(2, [
          gasProd ? statTile('Production', gasProd) : null,
          gasCons ? statTile('Consumption', gasCons) : null,
        ]));
    }
    const card = sectionCard('Production vs consumption', body);
    if (card) stack.append(card);
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Communications ───────────────────────────────────────────────────────────

function renderCommunications(data: FactbookData): HTMLElement | null {
  const sec = data.Communications;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Connectivity tiles
  const internet = takeValue(fbText(sec, 'Internet users', 'percent of population'))
    || takeValue(fbText(sec, 'Internet users', 'total'));
  const mobile = takeValue(fbText(sec, 'Telephones - mobile cellular', 'total subscriptions'));
  const broadband = takeValue(fbText(sec, 'Broadband - fixed subscriptions', 'total'))
    || takeValue(fbText(sec, 'Broadband - fixed subscriptions'));
  const fixed = takeValue(fbText(sec, 'Telephones - fixed lines', 'total subscriptions'));

  const tiles: Array<HTMLElement | null> = [
    internet ? statTile('Internet users', internet) : null,
    mobile ? statTile('Mobile subscriptions', mobile) : null,
    broadband ? statTile('Fixed broadband', broadband) : null,
    fixed ? statTile('Fixed lines', fixed) : null,
  ];
  if (tiles.some(Boolean)) {
    const card = sectionCard('Connectivity', tileGrid(2, tiles));
    if (card) stack.append(card);
  }

  // TLD
  const tld = takeValue(fbText(sec, 'Internet country code'));
  if (tld) {
    const card = sectionCard('Country code / TLD', el('div', 'cdp-fb-value-big', tld));
    if (card) stack.append(card);
  }

  // Broadcast media
  const media = fbText(sec, 'Broadcast media');
  if (media) {
    if (media.length > 300) {
      stack.append(collapsible('Broadcast media', prose(media) ?? el('div')));
    } else {
      const card = sectionCard('Broadcast media', prose(media));
      if (card) stack.append(card);
    }
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Transportation ───────────────────────────────────────────────────────────

function renderTransportation(data: FactbookData): HTMLElement | null {
  const sec = data.Transportation;
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  const airports = takeValue(fbText(sec, 'Airports')) || takeValue(fbText(sec, 'Airports', 'total'));
  const heliports = takeValue(fbText(sec, 'Heliports'));
  const railways = takeValue(fbText(sec, 'Railways', 'total'));
  const roadways = takeValue(fbText(sec, 'Roadways', 'total'));
  const waterways = takeValue(fbText(sec, 'Waterways'));
  const pipelines = takeValue(fbText(sec, 'Pipelines'));
  const merchant = takeValue(fbText(sec, 'Merchant marine', 'total'));
  const totalPorts = takeValue(fbText(sec, 'Ports', 'total ports'));
  const chart = buildTransportChart([
    { label: 'Airports', icon: '✈️', text: airports, color: '#3b82f6' },
    { label: 'Railways', icon: '🚆', text: railways, color: '#10b981' },
    { label: 'Roadways', icon: '🛣', text: roadways, color: '#f59e0b' },
    { label: 'Waterways', icon: '🛶', text: waterways, color: '#06b6d4' },
    { label: 'Pipelines', icon: '🛢', text: pipelines, color: '#ef4444' },
    { label: 'Ports', icon: '⚓', text: totalPorts, color: '#0ea5e9' },
    { label: 'Merchant marine', icon: '🚢', text: merchant, color: '#f97316' },
    { label: 'Heliports', icon: '🚁', text: heliports, color: '#8b5cf6' },
  ]);

  const tiles: Array<HTMLElement | null> = [
    airports ? statTile('✈ Airports', airports) : null,
    railways ? statTile('🚂 Railways', railways) : null,
    roadways ? statTile('🛣 Roadways', roadways) : null,
    waterways ? statTile('🛶 Waterways', waterways) : null,
    pipelines ? statTile('🛢 Pipelines', pipelines) : null,
    merchant ? statTile('🚢 Merchant marine', merchant) : null,
    heliports ? statTile('🚁 Heliports', heliports) : null,
  ];
  if (chart || tiles.some(Boolean)) {
    const card = sectionCard('Infrastructure', combine([
      chart,
      tileGrid(3, tiles),
    ]));
    if (card) stack.append(card);
  }

  // Airports breakdown (collapsed)
  const airportsObj = fbObj(sec, 'Airports');
  if (airportsObj) {
    const rows: string[] = [];
    for (const [k, v] of Object.entries(airportsObj)) {
      if (k === 'total' || typeof v === 'string') continue;
      const t = (v as { text?: string }).text;
      if (t) rows.push(`${k}: ${t}`);
    }
    if (rows.length > 0) {
      const body = el('div', 'cdp-fb-stack-v');
      for (const r of rows) body.append(el('div', 'cdp-fb-kv', r));
      stack.append(collapsible('Airports by runway', body));
    }
  }

  // Ports
  const portsObj = fbObj(sec, 'Ports');
  const keyPorts = splitList(fbText(sec, 'Ports', 'key ports')) || splitList(fbText(sec, 'Ports', 'major ports'));
  if (totalPorts || keyPorts.length > 0 || portsObj) {
    const body = el('div', 'cdp-fb-stack-v');
    if (totalPorts) body.append(el('div', 'cdp-fb-value-big', totalPorts));
    if (keyPorts.length > 0) {
      body.append(el('div', 'cdp-fb-subhead', 'Major ports'));
      body.append(chipRow(keyPorts.slice(0, 20)));
    }
    const card = sectionCard('Ports', body);
    if (card) stack.append(card);
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Military & Security ──────────────────────────────────────────────────────

function renderMilitary(data: FactbookData): HTMLElement | null {
  const sec = data['Military and Security'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Spend & size
  const spend = latestYearEntry(fbObj(sec, 'Military expenditures'), 'Military Expenditures');
  const personnel = fbText(sec, 'Military and security service personnel strengths');
  const spendPct = extractPercent(spend.text);
  const spendGauge = Number.isFinite(spendPct)
    ? buildGauge(spendPct, {
      label: 'Military spending',
      valueText: takeValue(spend.text) || `${spendPct.toFixed(1)}%`,
      note: 'Benchmarked against NATO target and world average',
      max: Math.max(4, Math.ceil((Math.max(spendPct, 2.2) + 0.5) * 2) / 2),
      markers: [
        { value: 2, label: 'NATO target 2%' },
        { value: 2.2, label: 'World average 2.2%' },
      ],
      tone: spendPct >= 2 ? 'good' : spendPct >= 1.2 ? 'info' : 'warn',
    })
    : null;
  const tiles: Array<HTMLElement | null> = [
    personnel ? statTile('Personnel', takeValue(personnel)) : null,
  ];
  if (spendGauge || tiles.some(Boolean)) {
    if (spendGauge && spend.year) {
      spendGauge.append(el('div', 'cdp-fb-tile-year', spend.year));
    }
    const card = sectionCard('Spend & size', combine([
      spendGauge,
      tileGrid(2, tiles),
    ]));
    if (card) stack.append(card);
  }

  // Branches (chip-ify from the forces text)
  const forces = fbText(sec, 'Military and security forces');
  if (forces) {
    // Parse the service list into icon chips and keep the full text tucked below.
    const body = el('div', 'cdp-fb-stack-v');
    const candidates = extractMilitaryBranches(forces);
    if (candidates.length > 0) {
      body.append(chipRow(mapItemsToChips(candidates.slice(0, 20), MILITARY_BRANCH_CHIP_RULES)));
    }
    body.append(collapsible('Service structure details', prose(forces) ?? el('div')));
    const card = sectionCard('Branches', body);
    if (card) stack.append(card);
  }

  // Service details
  const serviceAge = fbText(sec, 'Military service age and obligation');
  if (serviceAge) {
    stack.append(collapsible('Service age & obligation', prose(serviceAge) ?? el('div')));
  }

  // Deployments
  const deploy = fbText(sec, 'Military deployments');
  if (deploy) {
    const deploymentChips = parseCountryMentions(deploy, true).slice(0, 8);
    const card = sectionCard('Deployments', combine([
      deploymentChips.length > 0 ? chipRow(deploymentChips) : null,
      prose(deploy),
    ]));
    if (card) stack.append(card);
  }

  // Inventory
  const inv = fbText(sec, 'Military equipment inventories and acquisitions');
  if (inv) {
    stack.append(collapsible('Equipment inventory', prose(inv) ?? el('div')));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// ─── Transnational Issues ─────────────────────────────────────────────────────

function renderTransnational(data: FactbookData, country: string): HTMLElement | null {
  const sec = data['Transnational Issues'];
  if (!sec) return null;
  const stack = el('div', 'cdp-fb-stack-v');

  // Disputes
  const disputes = fbText(sec, 'Disputes - international');
  if (disputes) {
    const disputeChips = parseCountryMentions(disputes, false, [country]).slice(0, 8);
    const card = sectionCard('International disputes', combine([
      disputeChips.length > 0 ? chipRow(disputeChips) : null,
      calloutCard('Summary', disputes, 'warn'),
    ]));
    if (card) stack.append(card);
  }

  // Refugees & IDPs
  const refugees = takeValue(fbText(sec, 'Refugees and internally displaced persons', 'refugees'));
  const idps = takeValue(fbText(sec, 'Refugees and internally displaced persons', 'IDPs'));
  if (refugees || idps) {
    const card = sectionCard(
      'Refugees & IDPs',
      tileGrid(2, [
        refugees ? statTile('Refugees hosted', refugees) : null,
        idps ? statTile('Internally displaced', idps) : null,
      ]),
    );
    if (card) stack.append(card);
  }

  // Trafficking
  const traf = fbText(sec, 'Trafficking in persons')
    ?? fbText(sec, 'Trafficking in persons', 'tier rating');
  if (traf) {
    const { badge: tipBadge, body } = describeTipTier(traf);
    const wrap = el('div', 'cdp-fb-stack-v');
    if (tipBadge) wrap.append(badgeRow([tipBadge]));
    const severity = tipBadge?.tone === 'danger' ? 'danger' : tipBadge?.tone === 'warn' ? 'warn' : 'info';
    wrap.append(calloutCard('Assessment', body, severity));
    const card = sectionCard('Trafficking in persons', wrap);
    if (card) stack.append(card);
  }

  // Illicit drugs
  const drugs = fbText(sec, 'Illicit drugs');
  if (drugs) {
    stack.append(calloutCard('Illicit drugs', drugs, 'info'));
  }

  return stack.childElementCount > 0 ? stack : null;
}

// silence unused imports in case a helper becomes dead after a tweak
void extractYear;
void stripYearTag;
void stripNoteHtml;
void combine;
