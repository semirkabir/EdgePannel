/**
 * RPC: GetSecFilingAnalysis
 * Interprets a SEC filing into structured metrics and disclosure events.
 */
import type {
  ServerContext,
  GetSecFilingAnalysisRequest,
  GetSecFilingAnalysisResponse,
} from '../../../../src/generated/server/worldmonitor/market/v1/service_server';
import { buildSecFilingAnalysis } from './sec-edgar';

export async function getSecFilingAnalysis(
  _ctx: ServerContext,
  req: GetSecFilingAnalysisRequest,
): Promise<GetSecFilingAnalysisResponse> {
  return buildSecFilingAnalysis(req);
}
