import { createCircuitBreaker } from '@/utils';

export interface SanctionEntity {
  id: string;
  name: string;
  type: 'person' | 'company' | 'vessel' | 'aircraft' | 'other';
  countries: string[];
  programs: string[];
  dateAdded: string;
  source: string;
  aliases?: string[];
  opensanctionsId?: string;
}

const FALLBACK_SANCTIONS: SanctionEntity[] = [
  { id: 'ofac-sovcomflot-ns-century', name: 'Sovcomflot Vessel NS Century', type: 'vessel', countries: ['RU'], programs: ['OFAC SDN', 'Ukraine-Related'], dateAdded: '2024-01-01T00:00:00.000Z', source: 'OFAC', aliases: ['NS Century'] },
  { id: 'ofac-arctic-lng-2', name: 'Arctic LNG 2 LLC', type: 'company', countries: ['RU'], programs: ['EU Consolidated List', 'OFAC'], dateAdded: '2024-01-01T00:00:00.000Z', source: 'EU/OFAC' },
  { id: 'un-kim-jong-un', name: 'Kim Jong Un', type: 'person', countries: ['KP'], programs: ['UN Security Council', 'OFAC'], dateAdded: '2006-10-14T00:00:00.000Z', source: 'UN' },
  { id: 'eu-iran-air', name: 'Iran Air', type: 'company', countries: ['IR'], programs: ['EU Sanctions Map', 'OFAC'], dateAdded: '2011-01-01T00:00:00.000Z', source: 'EU' },
  { id: 'ofac-pdvsa', name: 'PDVSA', type: 'company', countries: ['VE'], programs: ['OFAC SDN'], dateAdded: '2019-01-28T00:00:00.000Z', source: 'OFAC' },
  { id: 'un-al-shabaab-network', name: 'Al-Shabaab Financial Network', type: 'company', countries: ['SO'], programs: ['UN Security Council'], dateAdded: '2010-04-12T00:00:00.000Z', source: 'UN' },
  { id: 'ofac-mehpl', name: 'Myanmar Economic Holdings Public Company Limited', type: 'company', countries: ['MM'], programs: ['UK Sanctions List', 'OFAC'], dateAdded: '2021-03-25T00:00:00.000Z', source: 'UK/OFAC', aliases: ['MEHL'] },
  { id: 'ofac-tornado-cash', name: 'Tornado Cash', type: 'other', countries: ['NL'], programs: ['OFAC SDN'], dateAdded: '2022-08-08T00:00:00.000Z', source: 'OFAC' },
];

interface SanctionsApiResponse {
  entities: SanctionEntity[];
  publishDate?: string;
  error?: string;
}

const breaker = createCircuitBreaker<SanctionEntity[]>({
  name: 'OFAC Sanctions',
  cacheTtlMs: 6 * 60 * 60 * 1000,
  persistCache: true,
});

let cachedSanctions: SanctionEntity[] = [];

export async function fetchSanctions(): Promise<SanctionEntity[]> {
  const result = await breaker.execute(async () => {
    const response = await fetch('/api/sanctions', {
      signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: SanctionsApiResponse = await response.json();
    if (!Array.isArray(data.entities) || data.entities.length === 0) {
      throw new Error('Empty OFAC response');
    }
    return data.entities;
  }, FALLBACK_SANCTIONS);

  cachedSanctions = result;
  return result;
}

export function getCachedSanctions(): SanctionEntity[] {
  return cachedSanctions;
}

export function searchSanctions(query: string, limit = 25): SanctionEntity[] {
  const q = query.trim().toLowerCase();
  if (!q || cachedSanctions.length === 0) return [];

  return cachedSanctions
    .filter((entity) => {
      if (entity.name.toLowerCase().includes(q)) return true;
      if (entity.source.toLowerCase().includes(q)) return true;
      if (entity.countries.some((c) => c.toLowerCase().includes(q))) return true;
      if (entity.programs.some((p) => p.toLowerCase().includes(q))) return true;
      if (entity.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
      return false;
    })
    .slice(0, limit);
}
