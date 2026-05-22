export interface SecCompanyFactPeriod {
  value: number;
  fy: number | null;
  fp: string;
  form: string;
  filed: string;
  start: string;
  end: string;
  accession: string;
}

export interface SecCompanyFactMetric {
  id: string;
  label: string;
  concept: string;
  unit: 'USD' | 'shares';
  annual: SecCompanyFactPeriod | null;
  quarterly: SecCompanyFactPeriod | null;
  annualYoY: number | null;
  quarterlyYoY: number | null;
}

export interface SecCompanyFactSignal {
  label: string;
  value: number;
  kind: 'positive' | 'negative' | 'neutral';
  format: 'percent' | 'multiple';
}

export interface SecCompanyFacts {
  ticker: string;
  cik: string;
  entityName: string;
  sourceUrl: string;
  metrics: SecCompanyFactMetric[];
  signals: SecCompanyFactSignal[];
}

export async function fetchSecCompanyFacts(ticker: string): Promise<SecCompanyFacts | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return null;

  const url = new URL('/api/sec-company-facts', window.location.origin);
  url.searchParams.set('ticker', symbol);

  const resp = await fetch(url.toString());
  if (!resp.ok) return null;

  const data = await resp.json() as Partial<SecCompanyFacts> & { error?: string };
  if (data.error || !Array.isArray(data.metrics)) return null;

  return {
    ticker: data.ticker || symbol,
    cik: data.cik || '',
    entityName: data.entityName || symbol,
    sourceUrl: data.sourceUrl || '',
    metrics: data.metrics,
    signals: Array.isArray(data.signals) ? data.signals : [],
  };
}

export function getSecMetric(facts: SecCompanyFacts | null, id: string): SecCompanyFactMetric | null {
  return facts?.metrics.find((metric) => metric.id === id) ?? null;
}
