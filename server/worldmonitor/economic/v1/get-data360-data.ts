/**
 * RPC: getData360Data -- World Bank Data360 unified API
 *
 * Proxies queries to https://data360api.worldbank.org/data360/data with Redis caching.
 * Supports V-Dem, Polity, GEM, ESG, SSGD, FINDEX, ITU_DH, and WGI databases.
 */

import type {
  ServerContext,
  GetData360DataRequest,
  GetData360DataResponse,
  Data360DataPoint,
} from '../../../../src/generated/server/worldmonitor/economic/v1/service_server';

import { CHROME_UA } from '../../../_shared/constants';
import { cachedFetchJson } from '../../../_shared/redis';

// ---------------------------------------------------------------------------
// Data360 API types
// ---------------------------------------------------------------------------

interface Data360Record {
  OBS_VALUE: string;
  TIME_PERIOD: string;
  INDICATOR: string;
  REF_AREA: string;
  SEX?: string;
  AGE?: string;
  URBANISATION?: string;
  FREQ?: string;
  UNIT_MEASURE?: string;
  DATA_SOURCE?: string;
  DATABASE_ID?: string;
  // Country name comes via a nested structure in some responses
  REF_AREA_DESC?: string;
  // Alternative field names observed in API
  'Dimension.Value'?: string;
  'Attribute.Value'?: string;
}

interface Data360Response {
  count: number;
  value: Data360Record[];
}

// Governance/democracy databases get longer cache since data only updates annually
const GOVERNANCE_DATABASES = new Set(['VDEM_CORE', 'POLITY5_PRC', 'WB_WGI']);
const DEFAULT_TTL = 24 * 3600; // 24 hours
const GOVERNANCE_TTL = 7 * 24 * 3600; // 7 days

// Data360 API base URL
const DATA360_BASE = 'https://data360api.worldbank.org/data360/data';

// Build the query string for Data360 API
function buildData360Url(req: GetData360DataRequest): string {
  const params = new URLSearchParams();

  // Required: DATABASE_ID
  params.set('DATABASE_ID', req.databaseId);

  // Optional filters
  if (req.indicator) params.set('INDICATOR', req.indicator);
  if (req.refArea) params.set('REF_AREA', req.refArea);
  if (req.timePeriodFrom) params.set('timePeriodFrom', String(req.timePeriodFrom));
  if (req.timePeriodTo) params.set('timePeriodTo', String(req.timePeriodTo));
  if (req.freq) params.set('FREQ', req.freq);
  if (req.isLatestData) params.set('isLatestData', 'true');
  if (req.top > 0) params.set('top', String(Math.min(req.top, 1000)));
  else params.set('top', '1000');
  if (req.skip > 0) params.set('skip', String(req.skip));

  params.set('format', 'json');
  return `${DATA360_BASE}?${params.toString()}`;
}

// Map ISO-3 to ISO-2 for consistency with existing system
const ISO3_TO_ISO2: Record<string, string> = {
  AFG:'AF', ALB:'AL', DZA:'DZ', AGO:'AO', ARG:'AR', ARM:'AM', AUS:'AU',
  AUT:'AT', AZE:'AZ', BHR:'BH', BGD:'BD', BLR:'BY', BEL:'BE', BOL:'BO',
  BIH:'BA', BWA:'BW', BRA:'BR', BGR:'BG', CAN:'CA', CHL:'CL', CHN:'CN',
  COL:'CO', COD:'CD', CRI:'CR', HRV:'HR', CZE:'CZ', DNK:'DK', DOM:'DO',
  ECU:'EC', EGY:'EG', ETH:'ET', FIN:'FI', FRA:'FR', GHA:'GH', GRC:'GR',
  GTM:'GT', HND:'HN', HKG:'HK', HUN:'HU', ISL:'IS', IND:'IN', IDN:'ID',
  IRN:'IR', IRQ:'IQ', IRL:'IE', ISR:'IL', ITA:'IT', JPN:'JP', JOR:'JO',
  KAZ:'KZ', KEN:'KE', KWT:'KW', LBN:'LB', LTU:'LT', LVA:'LV', LUX:'LU',
  MYS:'MY', MEX:'MX', MAR:'MA', MOZ:'MZ', MMR:'MM', NLD:'NL', NZL:'NZ',
  NGA:'NG', MKD:'MK', NOR:'NO', OMN:'OM', PAK:'PK', PAN:'PA', PRY:'PY',
  PER:'PE', PHL:'PH', POL:'PL', PRT:'PT', QAT:'QA', ROU:'RO', RUS:'RU',
  SAU:'SA', SEN:'SN', SRB:'RS', SGP:'SG', ZAF:'ZA', KOR:'KR', ESP:'ES',
  LKA:'LK', SDN:'SD', SWE:'SE', CHE:'CH', SYR:'SY', TWN:'TW', TZA:'TZ',
  THA:'TH', TUN:'TN', TUR:'TR', UGA:'UG', UKR:'UA', ARE:'AE', GBR:'GB',
  USA:'US', URY:'UY', UZB:'UZ', VEN:'VE', VNM:'VN', YEM:'YE', ZMB:'ZM',
  ZWE:'ZW', EST:'EE', SVK:'SK', SVN:'SI', CYP:'CY', MLT:'MT', CIV:'CI',
  LBY:'LY', KGZ:'KG', TJK:'TJ', MAC:'MO', BRN:'BN', PSE:'PS', XKX:'XK',
  TTO:'TT', SUR:'SR', GMB:'GM', GNQ:'GQ', MDA:'MD', GEO:'GE',
};

function normalizeRefArea(refArea: string): string {
  // Data360 returns ISO-3 codes; convert to ISO-2 for client consistency
  if (refArea.length === 3 && ISO3_TO_ISO2[refArea]) return ISO3_TO_ISO2[refArea];
  return refArea;
}

async function fetchData360Raw(req: GetData360DataRequest): Promise<Data360DataPoint[]> {
  const url = buildData360Url(req);
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    console.warn(`[data360] API returned ${response.status} for database=${req.databaseId}`);
    return [];
  }

  const data = await response.json() as Data360Response;
  if (!data || !data.value || !Array.isArray(data.value)) return [];

  return data.value
    .filter((r) => r.OBS_VALUE != null && r.REF_AREA != null)
    .map((r): Data360DataPoint => ({
      indicator: r.INDICATOR || '',
      refArea: normalizeRefArea(r.REF_AREA),
      countryName: r.REF_AREA_DESC || r.REF_AREA || '',
      timePeriod: parseInt(r.TIME_PERIOD, 10) || 0,
      obsValue: parseFloat(r.OBS_VALUE) || 0,
      sex: r.SEX || '_T',
      age: r.AGE || '_Z',
      urbanisation: r.URBANISATION || '_Z',
      freq: r.FREQ || 'A',
      unitMeasure: r.UNIT_MEASURE || '',
      dataSource: r.DATA_SOURCE || '',
      databaseId: r.DATABASE_ID || req.databaseId,
    }));
}

export async function getData360Data(
  _ctx: ServerContext,
  req: GetData360DataRequest,
): Promise<GetData360DataResponse> {
  try {
    const { databaseId } = req;
    if (!databaseId) return { data: [], totalCount: 0 };

    // Build cache key from all request parameters
    const cacheKey = `economic:data360:${databaseId}:${req.indicator || 'all'}:${req.refArea || 'all'}:${req.timePeriodFrom || 0}:${req.timePeriodTo || 0}:${req.isLatestData ? 'latest' : 'all'}:${req.freq || 'A'}`;
    const ttl = GOVERNANCE_DATABASES.has(databaseId) ? GOVERNANCE_TTL : DEFAULT_TTL;

    const result = await cachedFetchJson<GetData360DataResponse>(cacheKey, ttl, async () => {
      let allData: Data360DataPoint[] = [];
      let totalCount = 0;
      let skip = req.skip || 0;
      const top = req.top > 0 ? Math.min(req.top, 1000) : 1000;

      // First request to get data and total count
      const firstReq = { ...req, top, skip };
      const firstBatch = await fetchData360Raw(firstReq);
      allData = firstBatch;

      // If requesting all data and the API might have more, paginate
      // (For seed scripts, they'll request specific countries to keep responses small)
      if (firstBatch.length >= top) {
        // Make a lightweight count request to get total
        // The Data360 API provides count in its response; we estimate from first batch
        totalCount = firstBatch.length; // Conservative estimate; caller should paginate
      } else {
        totalCount = firstBatch.length;
      }

      if (allData.length === 0) return null;

      return { data: allData, totalCount };
    });

    return result || { data: [], totalCount: 0 };
  } catch (err) {
    console.warn('[data360] getData360Data error:', err instanceof Error ? err.message : String(err));
    return { data: [], totalCount: 0 };
  }
}