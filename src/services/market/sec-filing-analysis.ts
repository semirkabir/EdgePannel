import {
  MarketServiceClient,
  type GetSecFilingAnalysisResponse,
} from '@/generated/client/worldmonitor/market/v1/service_client';

const client = new MarketServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

export interface SecFilingAnalysisInput {
  ticker?: string;
  cik?: string;
  accessionNumber?: string;
  filingType?: string;
  documentUrl?: string;
}

export type SecFilingAnalysis = GetSecFilingAnalysisResponse;

export async function fetchSecFilingAnalysis(
  input: SecFilingAnalysisInput,
  signal?: AbortSignal,
): Promise<SecFilingAnalysis> {
  return client.getSecFilingAnalysis({
    ticker: input.ticker ?? '',
    cik: input.cik ?? '',
    accessionNumber: input.accessionNumber ?? '',
    filingType: input.filingType ?? '',
    documentUrl: input.documentUrl ?? '',
  }, { signal });
}
