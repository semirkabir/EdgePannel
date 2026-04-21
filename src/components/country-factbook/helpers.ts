/**
 * Text parsing, chip extraction, area comparison, text normalization, and DOM helpers
 * for the CIA World Factbook tab renderers.
 */

import {
  fbText,
  parseLabeledPercents,
  splitList,
} from '@/services/factbook';
import { getCountryFlag } from '@/utils/country-flags';
import { stripNoteHtml } from './widgets';
import type { ChipSpec, ChipTone } from './widgets';

export { splitList, parseLabeledPercents };

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface KeywordChipRule {
  label: string;
  icon: string;
  patterns: RegExp[];
  tone?: ChipTone;
}

export interface ItemChipRule {
  icon: string;
  patterns: RegExp[];
  tone?: ChipTone;
}

export interface AreaReference {
  label: string;
  areaSqKm: number;
  aliases?: string[];
}

interface CountryAliasDef {
  label: string;
  code: string;
  aliases?: string[];
}

// ─── Chip Rule Constants ───────────────────────────────────────────────────────

export const CLIMATE_CHIP_RULES: KeywordChipRule[] = [
  { label: 'Tropical', icon: '\u{1F334}', patterns: [/\btropical\b/i], tone: 'success' },
  { label: 'Arid', icon: '\u{1F3DC}', patterns: [/\barid\b/i], tone: 'warn' },
  { label: 'Semi-arid', icon: '\u{1F3DC}', patterns: [/\bsemiarid\b|\bsemi-arid\b/i], tone: 'warn' },
  { label: 'Temperate', icon: '\u{1F33F}', patterns: [/\btemperate\b/i], tone: 'info' },
  { label: 'Arctic', icon: '\u2744\uFE0F', patterns: [/\barctic\b|\bsubarctic\b/i], tone: 'info' },
  { label: 'Monsoon', icon: '\u{1F327}\uFE0F', patterns: [/\bmonsoon\b/i], tone: 'info' },
  { label: 'Mediterranean', icon: '\u2600\uFE0F', patterns: [/\bmediterranean\b/i], tone: 'success' },
  { label: 'Alpine', icon: '\u{1F3D4}\uFE0F', patterns: [/\balpine\b|\bhighland\b/i], tone: 'neutral' },
];

export const HAZARD_CHIP_RULES: KeywordChipRule[] = [
  { label: 'Seismic', icon: '\u{1F4A5}', patterns: [/\bearthquakes?\b|\bseismic\b/i], tone: 'danger' },
  { label: 'Volcanic', icon: '\u{1F30B}', patterns: [/\bvolcan(?:ic|o(?:es)?)\b/i], tone: 'danger' },
  { label: 'Tsunami', icon: '\u{1F30A}', patterns: [/\btsunamis?\b/i], tone: 'danger' },
  { label: 'Cyclone', icon: '\u{1F300}', patterns: [/\bcyclones?\b|\bhurricanes?\b|\btyphoons?\b/i], tone: 'warn' },
  { label: 'Drought', icon: '\u{1F3DC}', patterns: [/\bdroughts?\b/i], tone: 'warn' },
  { label: 'Wildfire', icon: '\u{1F525}', patterns: [/\bwildfires?\b|\bforest fires?\b/i], tone: 'danger' },
  { label: 'Flooding', icon: '\u{1F327}\uFE0F', patterns: [/\bfloods?\b|\bflooding\b|\bmudslides?\b/i], tone: 'warn' },
  { label: 'Heat wave', icon: '\u{1F321}\uFE0F', patterns: [/\bheat waves?\b|\bextreme heat\b/i], tone: 'warn' },
];

export const RESOURCE_CHIP_RULES: ItemChipRule[] = [
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

export const COMMODITY_CHIP_RULES: ItemChipRule[] = [
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

export const MILITARY_BRANCH_CHIP_RULES: ItemChipRule[] = [
  { icon: '\u{1FA96}', patterns: [/\barmy\b|\bland forces?\b/i], tone: 'neutral' },
  { icon: '\u2693', patterns: [/\bnavy\b|\bnaval forces?\b/i], tone: 'info' },
  { icon: '\u2708\uFE0F', patterns: [/\bair force\b|\bair forces?\b/i], tone: 'info' },
  { icon: '\u{1F680}', patterns: [/\bspace force\b|\bspace command\b/i], tone: 'info' },
  { icon: '\u{1F6E1}\uFE0F', patterns: [/\bcoast guard\b|\bguard\b/i], tone: 'neutral' },
  { icon: '\u{1F693}', patterns: [/\bgendarmerie\b|\bpolice\b/i], tone: 'neutral' },
  { icon: '\u2694\uFE0F', patterns: [/\bmarine corps\b|\bspecial operations?\b|\bspecial ops\b/i], tone: 'danger' },
];

// ─── Area Reference Data ───────────────────────────────────────────────────────

export const AREA_REFERENCES: AreaReference[] = [
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

export const COUNTRY_ALIAS_ENTRIES = COUNTRY_ALIAS_DEFS
  .flatMap((def) => [def.label, ...(def.aliases ?? [])].map((alias) => ({ ...def, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);

// ─── Text Normalization ────────────────────────────────────────────────────────

export function normalizeFactbookText(text: string | undefined): string {
  return stripNoteHtml(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;|&mdash;/gi, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── DOM Helpers ───────────────────────────────────────────────────────────────

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

export function svgText(attrs: Record<string, string>, content: string): SVGTextElement {
  const node = svgEl('text', attrs);
  node.textContent = content;
  return node;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

// ─── Chip Helpers ──────────────────────────────────────────────────────────────

export function uniqueChips(chips: ChipSpec[]): ChipSpec[] {
  const seen = new Set<string>();
  return chips.filter((chip) => {
    const key = chip.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collectKeywordChips(text: string | undefined, rules: KeywordChipRule[]): ChipSpec[] {
  const haystack = normalizeFactbookText(text);
  if (!haystack) return [];
  const chips = rules
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(haystack)))
    .map((rule) => ({ label: rule.label, icon: rule.icon, tone: rule.tone, title: rule.label }));
  return uniqueChips(chips);
}

export function mapItemsToChips(items: string[], rules: ItemChipRule[]): ChipSpec[] {
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

// ─── Government / Legal Descriptors ────────────────────────────────────────────

export function extractLeadingClause(text: string | undefined): string {
  const clean = normalizeFactbookText(text);
  if (!clean) return '';
  return clean.split(/\s*;\s*/)[0]!.trim();
}

export function describeGovernmentType(text: string | undefined): ChipSpec | null {
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

export function describeLegalSystem(text: string | undefined): ChipSpec | null {
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

// ─── Military Branch Extraction ────────────────────────────────────────────────

export function extractMilitaryBranches(text: string | undefined): string[] {
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

// ─── TIP Tier Descriptor ───────────────────────────────────────────────────────

export function describeTipTier(text: string | undefined): { badge: ChipSpec | null; body: string } {
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

// ─── Area Comparison Helpers ───────────────────────────────────────────────────

export function formatAreaLabel(areaSqKm: number): string {
  if (areaSqKm >= 1_000_000) return `${(areaSqKm / 1_000_000).toFixed(2)}M sq km`;
  if (areaSqKm >= 1_000) return `${(areaSqKm / 1_000).toFixed(0)}K sq km`;
  return `${formatCompactNumber(areaSqKm)} sq km`;
}

export function getTotalAreaText(sec: Record<string, unknown>): string | undefined {
  return fbText(sec as Record<string, never>, 'Area', 'total')
    ?? fbText(sec as Record<string, never>, 'Area', 'total ');
}

export function resolveAreaReference(text: string | undefined): AreaReference | null {
  const clean = normalizeFactbookText(text).toLowerCase();
  if (!clean) return null;
  const refs = AREA_REFERENCES
    .flatMap((ref) => [ref.label, ...(ref.aliases ?? [])].map((alias) => ({ ref, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
  return refs.find(({ alias }) => clean.includes(alias.toLowerCase()))?.ref ?? null;
}

// ─── Flag Emoji Helpers ────────────────────────────────────────────────────────

export function iso2ToFlagEmoji(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper.length !== 2) return '\u{1F310}';
  return String.fromCodePoint(
    0x1F1E6 + upper.charCodeAt(0) - 65,
    0x1F1E6 + upper.charCodeAt(1) - 65,
  );
}

export function resolveCountryFlagEmoji(name: string): string {
  const clean = normalizeFactbookText(name);
  if (!clean) return '\u{1F310}';
  const alias = COUNTRY_ALIAS_ENTRIES.find((entry) => entry.alias.toLowerCase() === clean.toLowerCase());
  if (alias) return iso2ToFlagEmoji(alias.code);
  return getCountryFlag(clean);
}

// ─── Partner / Country Mention Parsing ─────────────────────────────────────────

export function parsePartnerStats(text: string | undefined): Array<{ name: string; pct: number | null }> {
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

export function buildPartnerChips(text: string | undefined): ChipSpec[] {
  return parsePartnerStats(text).slice(0, 8).map((row) => ({
    label: row.pct != null ? `${row.name} ${row.pct.toFixed(row.pct % 1 === 0 ? 0 : 1)}%` : row.name,
    icon: resolveCountryFlagEmoji(row.name),
    tone: 'info',
  }));
}

export function parseCountryMentions(text: string | undefined, withCounts = false, exclude: string[] = []): ChipSpec[] {
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
