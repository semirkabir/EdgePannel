/**
 * RPCs: GetFearGreedIndex, GetGoldIntelligence, GetMarketBreadthHistory
 *
 * These RPCs were added to the generated client by hand (commit 45883458)
 * without protos or a backend. Protos now exist; no data source does yet, so
 * each returns `unavailable: true`, which the panels render as "no data"
 * (previously the routes 404'd). Replace with real implementations when a
 * seed/data source lands.
 */
import type {
  ServerContext,
  GetFearGreedIndexRequest,
  GetFearGreedIndexResponse,
  GetGoldIntelligenceRequest,
  GetGoldIntelligenceResponse,
  GetMarketBreadthHistoryRequest,
  GetMarketBreadthHistoryResponse,
} from '../../../../src/generated/server/worldmonitor/market/v1/service_server';

export async function getFearGreedIndex(
  _ctx: ServerContext,
  _req: GetFearGreedIndexRequest,
): Promise<GetFearGreedIndexResponse> {
  return {
    compositeScore: 0,
    compositeLabel: '',
    previousScore: 0,
    seededAt: '',
    vix: 0,
    hySpread: 0,
    yield10y: 0,
    putCallRatio: 0,
    pctAbove200d: 0,
    cnnFearGreed: 0,
    cnnLabel: '',
    aaiiBull: 0,
    aaiiBear: 0,
    fedRate: '',
    unavailable: true,
  };
}

export async function getGoldIntelligence(
  _ctx: ServerContext,
  _req: GetGoldIntelligenceRequest,
): Promise<GetGoldIntelligenceResponse> {
  return {
    goldPrice: 0,
    goldChangePct: 0,
    goldSparkline: [],
    silverPrice: 0,
    platinumPrice: 0,
    palladiumPrice: 0,
    crossCurrencyPrices: [],
    updatedAt: '',
    unavailable: true,
  };
}

export async function getMarketBreadthHistory(
  _ctx: ServerContext,
  _req: GetMarketBreadthHistoryRequest,
): Promise<GetMarketBreadthHistoryResponse> {
  return { updatedAt: '', history: [], unavailable: true };
}
