/**
 * LEI resolver — looks up Legal Entity Identifiers via the GLEIF API.
 *
 * GLEIF API is free and unauthenticated. Rate limit is generous (~60 req/min).
 * https://www.gleif.org/en/lei-data/gleif-lei-look-up-api
 */

export interface LeiRecord {
  lei: string;
  name: string;
  country?: string;
  legalForm?: string;
  status?: string;
  isin?: string[];
}

/** Look up an entity by LEI code. Returns null if not found or on error. */
export async function lookupLei(lei: string): Promise<LeiRecord | null> {
  const upper = lei.toUpperCase().trim();
  if (!upper || upper.length !== 20) return null;

  try {
    const res = await fetch(
      `https://api.gleif.org/api/v1/lei-records/${encodeURIComponent(upper)}`,
      {
        headers: { Accept: 'application/vnd.api+json' },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const attrs = data?.data?.attributes;
    if (!attrs) return null;

    const entity = attrs.entity;
    return {
      lei: upper,
      name: entity?.legalName?.name ?? '',
      country: entity?.legalAddress?.country,
      legalForm: entity?.legalForm?.id,
      status: attrs.registration?.status,
    };
  } catch {
    return null;
  }
}

/**
 * Search GLEIF by company name. Returns top matches.
 * Useful for resolving a company name → LEI without knowing the code.
 */
export async function searchByName(name: string, limit = 5): Promise<LeiRecord[]> {
  try {
    const params = new URLSearchParams({
      'filter[entity.legalName]': name,
      'page[size]': String(limit),
    });
    const res = await fetch(`https://api.gleif.org/api/v1/lei-records?${params}`, {
      headers: { Accept: 'application/vnd.api+json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const records: LeiRecord[] = (data?.data ?? []).map((item: Record<string, unknown>) => {
      const attrs = item.attributes as Record<string, unknown>;
      const entity = attrs?.entity as Record<string, unknown>;
      const legalName = entity?.legalName as Record<string, unknown>;
      const legalAddress = entity?.legalAddress as Record<string, unknown>;
      return {
        lei: (item.id as string) ?? '',
        name: (legalName?.name as string) ?? '',
        country: legalAddress?.country as string | undefined,
        status: (attrs?.registration as Record<string, unknown>)?.status as string | undefined,
      };
    });
    return records.filter((r) => r.lei.length === 20);
  } catch {
    return [];
  }
}
