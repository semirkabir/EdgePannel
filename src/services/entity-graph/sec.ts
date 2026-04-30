import type { PopupType } from '@/components/MapPopup';
import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import type { SecFiling } from '@/generated/client/worldmonitor/market/v1/service_client';
import { fetchInstitutionFilingHistory } from '@/services/market/normalized-13f';
import type { InstitutionFilingHistoryEntry } from '@/services/market/normalized-13f';
import type { EntityGraphIdentifier, EntityGraphNode, EntityGraphSecFiling } from './types';

const client = new MarketServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

export interface SecEntityContext {
  ticker: string;
  cik: string;
  name: string;
  filings: EntityGraphSecFiling[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(data: unknown, key: string): string {
  if (!isRecord(data)) return '';
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function secCompanyUrl(cik: string): string {
  return `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(cik)}`;
}

function fromCompanyFiling(filing: SecFiling): EntityGraphSecFiling {
  return {
    filingType: filing.filingType,
    filedAt: filing.filedAt,
    url: filing.url,
  };
}

function fromInstitutionFiling(filing: InstitutionFilingHistoryEntry): EntityGraphSecFiling {
  return {
    filingType: filing.filingType,
    filedAt: filing.filedAt,
    url: filing.url,
  };
}

async function fetchCompanySecContext(data: unknown, signal: AbortSignal): Promise<SecEntityContext | null> {
  const ticker = normalizeTicker(getString(data, 'ticker') || getString(data, 'symbol'));
  if (!ticker) return null;

  try {
    const response = await client.listSecFilings({ ticker, filingTypes: [], limit: 6 }, { signal });
    const issuerCik = response.filings.find(filing => filing.issuerCik)?.issuerCik || '';
    const issuerName = response.companyName || response.filings.find(filing => filing.issuerName)?.issuerName || getString(data, 'name');
    return {
      ticker,
      cik: issuerCik,
      name: issuerName || ticker,
      filings: response.filings.slice(0, 4).map(fromCompanyFiling),
    };
  } catch {
    return {
      ticker,
      cik: '',
      name: getString(data, 'name') || ticker,
      filings: [],
    };
  }
}

async function fetchInstitutionSecContext(data: unknown): Promise<SecEntityContext | null> {
  const cik = getString(data, 'cik').replace(/\D/g, '');
  const name = getString(data, 'name') || getString(data, 'institutionName');
  if (!cik && !name) return null;

  try {
    const filings = cik ? await fetchInstitutionFilingHistory(cik, name) : [];
    const filingName = filings.find(filing => filing.institutionName)?.institutionName || name || 'Institution';
    return {
      ticker: '',
      cik,
      name: filingName,
      filings: filings.slice(0, 4).map(fromInstitutionFiling),
    };
  } catch {
    return {
      ticker: '',
      cik,
      name: name || 'Institution',
      filings: [],
    };
  }
}

export async function fetchSecEntityContext(
  type: PopupType,
  data: unknown,
  signal: AbortSignal,
): Promise<SecEntityContext | null> {
  if (type === 'company') return fetchCompanySecContext(data, signal);
  if (type === 'institution') return fetchInstitutionSecContext(data);
  return null;
}

export function secIdentifiers(context: SecEntityContext): EntityGraphIdentifier[] {
  const identifiers: EntityGraphIdentifier[] = [];
  if (context.ticker) {
    identifiers.push({ label: 'Ticker', value: context.ticker, source: 'sec-edgar' });
  }
  if (context.cik) {
    identifiers.push({
      label: 'CIK',
      value: context.cik,
      source: 'sec-edgar',
      url: secCompanyUrl(context.cik),
    });
  }
  return identifiers;
}

export function secCompanyNode(context: SecEntityContext): EntityGraphNode | null {
  if (!context.cik && !context.ticker) return null;
  return {
    id: context.cik ? `cik:${context.cik}` : `ticker:${context.ticker}`,
    label: context.name || context.ticker || context.cik,
    kind: context.cik ? 'sec-filer' as const : 'security' as const,
    source: 'sec-edgar' as const,
    cik: context.cik || undefined,
    ticker: context.ticker || undefined,
    url: context.cik ? secCompanyUrl(context.cik) : undefined,
  };
}
