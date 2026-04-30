import { TIER1_COUNTRIES } from '@/services/country-instability';
import { ME_STRIKE_BOUNDS } from '@/services/country-geometry';

type IntlDisplayNamesCtor = new (
  locales: string | string[],
  options: { type: 'region' }
) => { of: (code: string) => string | undefined };

export const COUNTRY_BOUNDS: Record<string, { n: number; s: number; e: number; w: number }> = {
  ...ME_STRIKE_BOUNDS,
  CN: { n: 53.6, s: 18.2, e: 134.8, w: 73.5 }, TW: { n: 25.3, s: 21.9, e: 122, w: 120 },
  JP: { n: 45.5, s: 24.2, e: 153.9, w: 122.9 }, KR: { n: 38.6, s: 33.1, e: 131.9, w: 124.6 },
  KP: { n: 43.0, s: 37.7, e: 130.7, w: 124.2 }, IN: { n: 35.5, s: 6.7, e: 97.4, w: 68.2 },
  PK: { n: 37, s: 24, e: 77, w: 61 }, AF: { n: 38.5, s: 29.4, e: 74.9, w: 60.5 },
  UA: { n: 52.4, s: 44.4, e: 40.2, w: 22.1 }, RU: { n: 82, s: 41.2, e: 180, w: 19.6 },
  BY: { n: 56.2, s: 51.3, e: 32.8, w: 23.2 }, PL: { n: 54.8, s: 49, e: 24.1, w: 14.1 },
  EG: { n: 31.7, s: 22, e: 36.9, w: 25 }, LY: { n: 33, s: 19.5, e: 25, w: 9.4 },
  SD: { n: 22, s: 8.7, e: 38.6, w: 21.8 }, US: { n: 49, s: 24.5, e: -66.9, w: -125 },
  GB: { n: 58.7, s: 49.9, e: 1.8, w: -8.2 }, DE: { n: 55.1, s: 47.3, e: 15.0, w: 5.9 },
  FR: { n: 51.1, s: 41.3, e: 9.6, w: -5.1 }, TR: { n: 42.1, s: 36, e: 44.8, w: 26 },
  BR: { n: 5.3, s: -33.8, e: -34.8, w: -73.9 },
};

export const COUNTRY_ALIASES: Record<string, string[]> = {
  IL: ['israel', 'israeli', 'gaza', 'hamas', 'hezbollah', 'netanyahu', 'idf', 'west bank', 'tel aviv', 'jerusalem'],
  IR: ['iran', 'iranian', 'tehran', 'persian', 'irgc', 'khamenei'],
  RU: ['russia', 'russian', 'moscow', 'kremlin', 'putin', 'ukraine war'],
  UA: ['ukraine', 'ukrainian', 'kyiv', 'zelensky', 'zelenskyy'],
  CN: ['china', 'chinese', 'beijing', 'taiwan strait', 'south china sea', 'xi jinping'],
  TW: ['taiwan', 'taiwanese', 'taipei'],
  KP: ['north korea', 'pyongyang', 'kim jong'],
  KR: ['south korea', 'seoul'],
  SA: ['saudi', 'riyadh', 'mbs'],
  SY: ['syria', 'syrian', 'damascus', 'assad'],
  YE: ['yemen', 'houthi', 'sanaa'],
  IQ: ['iraq', 'iraqi', 'baghdad'],
  AF: ['afghanistan', 'afghan', 'kabul', 'taliban'],
  PK: ['pakistan', 'pakistani', 'islamabad'],
  IN: ['india', 'indian', 'new delhi', 'modi'],
  EG: ['egypt', 'egyptian', 'cairo', 'suez'],
  LB: ['lebanon', 'lebanese', 'beirut'],
  TR: ['turkey', 'turkish', 'ankara', 'erdogan', 'türkiye'],
  US: ['united states', 'u.s.', 'u.s', 'usa', 'us', 'american', 'washington', 'pentagon', 'white house'],
  GB: ['united kingdom', 'u.k.', 'u.k', 'uk', 'british', 'london'],
  BR: ['brazil', 'brazilian', 'brasilia', 'lula', 'bolsonaro'],
  AE: ['united arab emirates', 'uae', 'emirati', 'dubai', 'abu dhabi'],
};

export function getCountryFlagEmoji(code: string): string {
  const upperCode = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upperCode)) return '🏳️';
  return upperCode
    .split('')
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('');
}

export function resolveCountryName(code: string): string {
  if (TIER1_COUNTRIES[code]) return TIER1_COUNTRIES[code];

  try {
    const displayNamesCtor = (Intl as unknown as { DisplayNames?: IntlDisplayNamesCtor }).DisplayNames;
    if (!displayNamesCtor) return code;
    const displayNames = new displayNamesCtor(['en'], { type: 'region' });
    const resolved = displayNames.of(code);
    if (resolved && resolved.toUpperCase() !== code) return resolved;
  } catch {
    // Intl.DisplayNames unavailable in older runtimes.
  }

  return code;
}

export function getCountrySearchTerms(country: string, code: string): string[] {
  const aliases = COUNTRY_ALIASES[code];
  if (aliases) return aliases;
  if (/^[A-Z]{2}$/i.test(country.trim())) return [];
  return [country.toLowerCase()];
}

function getOtherCountryTerms(code: string): string[] {
  const cached = otherCountryTermsCache.get(code);
  if (cached) return cached;

  const dedup = new Set<string>();
  Object.entries(COUNTRY_ALIASES).forEach(([countryCode, aliases]) => {
    if (countryCode === code) return;
    aliases.forEach((alias) => {
      const normalized = alias.toLowerCase();
      if (normalized.trim().length > 0) dedup.add(normalized);
    });
  });

  const terms = [...dedup];
  otherCountryTermsCache.set(code, terms);
  return terms;
}

const otherCountryTermsCache: Map<string, string[]> = new Map();

export function firstMentionPosition(text: string, terms: string[]): number {
  let earliest = Infinity;
  for (const term of terms) {
    const idx = findTermPosition(text, term);
    if (idx !== -1 && idx < earliest) earliest = idx;
  }
  return earliest;
}

function findTermPosition(text: string, rawTerm: string): number {
  const term = rawTerm.trim().toLowerCase();
  if (!term) return -1;

  const shortToken = /^[a-z.]{2,4}$/.test(term);
  if (!shortToken) return text.indexOf(term);

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`, 'i').exec(text);
  if (!match || match.index < 0) return -1;
  return match.index + (match[1]?.length ?? 0);
}

export { getOtherCountryTerms };
