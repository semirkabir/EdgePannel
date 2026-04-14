/**
 * RPC: listWorldBankIndicators -- World Bank + IMF WEO development indicator data
 *
 * Routing logic:
 *   - Indicator codes containing a dot (e.g. "NY.GDP.MKTP.KD.ZG") → World Bank API
 *   - All other codes (e.g. "NGDP_RPCH", "LUR", "LP")             → IMF WEO DataMapper API
 */

import type {
  ServerContext,
  ListWorldBankIndicatorsRequest,
  ListWorldBankIndicatorsResponse,
  WorldBankCountryData,
} from '../../../../src/generated/server/worldmonitor/economic/v1/service_server';

import { CHROME_UA } from '../../../_shared/constants';
import { cachedFetchJson } from '../../../_shared/redis';

// ---------------------------------------------------------------------------
// IMF WEO support
// ---------------------------------------------------------------------------

/** ISO-2 → ISO-3 mapping for countries commonly displayed in the app. */
const ISO2_TO_ISO3: Record<string, string> = {
  AF:'AFG', AL:'ALB', DZ:'DZA', AO:'AGO', AR:'ARG', AM:'ARM', AU:'AUS',
  AT:'AUT', AZ:'AZE', BH:'BHR', BD:'BGD', BY:'BLR', BE:'BEL', BO:'BOL',
  BA:'BIH', BW:'BWA', BR:'BRA', BG:'BGR', CA:'CAN', CL:'CHL', CN:'CHN',
  CO:'COL', CD:'COD', CR:'CRI', HR:'HRV', CZ:'CZE', DK:'DNK', DO:'DOM',
  EC:'ECU', EG:'EGY', ET:'ETH', FI:'FIN', FR:'FRA', GH:'GHA', GR:'GRC',
  GT:'GTM', HN:'HND', HK:'HKG', HU:'HUN', IS:'ISL', IN:'IND', ID:'IDN',
  IR:'IRN', IQ:'IRQ', IE:'IRL', IL:'ISR', IT:'ITA', JP:'JPN', JO:'JOR',
  KZ:'KAZ', KE:'KEN', KW:'KWT', LB:'LBN', LT:'LTU', LV:'LVA', LU:'LUX',
  MY:'MYS', MX:'MEX', MA:'MAR', MZ:'MOZ', MM:'MMR', NL:'NLD', NZ:'NZL',
  NG:'NGA', MK:'MKD', NO:'NOR', OM:'OMN', PK:'PAK', PA:'PAN', PY:'PRY',
  PE:'PER', PH:'PHL', PL:'POL', PT:'PRT', QA:'QAT', RO:'ROU', RU:'RUS',
  SA:'SAU', SN:'SEN', RS:'SRB', SG:'SGP', ZA:'ZAF', KR:'KOR', ES:'ESP',
  LK:'LKA', SD:'SDN', SE:'SWE', CH:'CHE', SY:'SYR', TW:'TWN', TZ:'TZA',
  TH:'THA', TN:'TUN', TR:'TUR', UG:'UGA', UA:'UKR', AE:'ARE', GB:'GBR',
  US:'USA', UY:'URY', UZ:'UZB', VE:'VEN', VN:'VNM', YE:'YEM', ZM:'ZMB',
  ZW:'ZWE', EE:'EST', SK:'SVK', SI:'SVN', CY:'CYP', MT:'MLT', CI:'CIV',
  LY:'LBY', KG:'KGZ', TJ:'TJK', MO:'MAC', BN:'BRN',
};

/** IMF WEO indicator codes do not contain dots (e.g. "NGDP_RPCH", "LUR"). */
function isImfIndicator(code: string): boolean {
  return code.length > 0 && !code.includes('.');
}

/** WGI (Worldwide Governance Indicators) codes start with "GOV_WGI_". */
function isWgiIndicator(code: string): boolean {
  return code.startsWith('GOV_WGI_');
}

/** Fetch a single IMF WEO indicator for one country. Returns records keyed by ISO-3. */
async function fetchImfWeoIndicator(
  indicatorCode: string,
  rawCountryCode: string,
): Promise<WorldBankCountryData[]> {
  try {
    // Convert ISO-2 → ISO-3 if needed; fall back to raw code for ISO-3 inputs
    const iso3 = rawCountryCode.length === 2
      ? (ISO2_TO_ISO3[rawCountryCode.toUpperCase()] ?? rawCountryCode)
      : rawCountryCode.toUpperCase();

    const url = `https://www.imf.org/external/datamapper/api/v1/${indicatorCode}/${iso3}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];

    const data = await response.json() as Record<string, unknown>;
    const yearMap = (data?.values as any)?.[indicatorCode]?.[iso3] as Record<string, number> | undefined;
    if (!yearMap || typeof yearMap !== 'object') return [];

    const currentYear = new Date().getFullYear();

    return Object.entries(yearMap)
      .filter(([yr, v]) => v != null && parseInt(yr, 10) <= currentYear)
      .map(([yr, value]): WorldBankCountryData => ({
        countryCode: iso3,
        countryName: '',
        indicatorCode,
        indicatorName: indicatorCode,
        year: parseInt(yr, 10),
        value: value as number,
      }));
  } catch {
    return [];
  }
}

const REDIS_CACHE_KEY = 'economic:worldbank:v1';
const REDIS_CACHE_TTL = 86400; // 24 hr — annual data

const TECH_COUNTRIES = [
  'USA', 'CHN', 'JPN', 'DEU', 'KOR', 'GBR', 'IND', 'ISR', 'SGP', 'TWN',
  'FRA', 'CAN', 'SWE', 'NLD', 'CHE', 'FIN', 'IRL', 'AUS', 'BRA', 'IDN',
  'ARE', 'SAU', 'QAT', 'BHR', 'EGY', 'TUR',
  'MYS', 'THA', 'VNM', 'PHL',
  'ESP', 'ITA', 'POL', 'CZE', 'DNK', 'NOR', 'AUT', 'BEL', 'PRT', 'EST',
  'MEX', 'ARG', 'CHL', 'COL',
  'ZAF', 'NGA', 'KEN',
];

async function fetchWorldBankIndicators(
  req: ListWorldBankIndicatorsRequest,
): Promise<WorldBankCountryData[]> {
  try {
    const indicator = req.indicatorCode;
    if (!indicator) return [];

    const countryList = req.countryCode || TECH_COUNTRIES.join(';');
    const currentYear = new Date().getFullYear();
    const years = req.year > 0 ? req.year : 5;
    const startYear = currentYear - years;

    let wbUrl: string;
    if (isWgiIndicator(indicator)) {
      // WGI data is under source=3; needs all countries and recent years
      const countries = req.countryCode || 'all';
      wbUrl = `https://api.worldbank.org/v2/country/${countries}/indicator/${indicator}?format=json&date=${startYear}:${currentYear}&per_page=5000&source=3`;
    } else {
      wbUrl = `https://api.worldbank.org/v2/country/${countryList}/indicator/${indicator}?format=json&date=${startYear}:${currentYear}&per_page=1000`;
    }

    const response = await fetch(wbUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': CHROME_UA,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!data || !Array.isArray(data) || data.length < 2 || !data[1]) return [];

    const records: any[] = data[1];
    const indicatorName = records[0]?.indicator?.value || indicator;

    return records
      .filter((r: any) => r.countryiso3code && r.value !== null)
      .map((r: any): WorldBankCountryData => ({
        countryCode: r.countryiso3code || r.country?.id || '',
        countryName: r.country?.value || '',
        indicatorCode: indicator,
        indicatorName,
        year: parseInt(r.date, 10) || 0,
        value: r.value,
      }));
  } catch {
    return [];
  }
}

export async function listWorldBankIndicators(
  _ctx: ServerContext,
  req: ListWorldBankIndicatorsRequest,
): Promise<ListWorldBankIndicatorsResponse> {
  try {
    const cacheKey = `${REDIS_CACHE_KEY}:${req.indicatorCode}:${req.countryCode || 'all'}:${req.year || 0}`;
    const ttl = isWgiIndicator(req.indicatorCode) ? REDIS_CACHE_TTL * 7 : REDIS_CACHE_TTL; // WGI: 7 days
    const result = await cachedFetchJson<ListWorldBankIndicatorsResponse>(cacheKey, ttl, async () => {
      let data: WorldBankCountryData[];
      if (isImfIndicator(req.indicatorCode)) {
        const countries = req.countryCode
          ? req.countryCode.split(';').filter(Boolean)
          : TECH_COUNTRIES;
        const chunks = await Promise.all(
          countries.map(cc => fetchImfWeoIndicator(req.indicatorCode, cc)),
        );
        data = chunks.flat();
      } else {
        data = await fetchWorldBankIndicators(req);
      }
      return data.length > 0 ? { data, pagination: undefined } : null;
    });
    return result || { data: [], pagination: undefined };
  } catch {
    return { data: [], pagination: undefined };
  }
}
