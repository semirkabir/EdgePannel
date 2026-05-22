import { getCorsHeaders } from './_cors.js';

export const config = { runtime: 'edge' };

const SEC_USER_AGENT = 'EdgePannel/1.0 (contact@worldmonitor.io)';
const CACHE_TTL_SECONDS = 3600;
const cache = new Map();

const CONCEPTS = {
  revenue: {
    label: 'Revenue',
    unit: 'USD',
    names: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  },
  netIncome: {
    label: 'Net income',
    unit: 'USD',
    names: ['NetIncomeLoss', 'ProfitLoss'],
  },
  operatingIncome: {
    label: 'Operating income',
    unit: 'USD',
    names: ['OperatingIncomeLoss'],
  },
  assets: {
    label: 'Assets',
    unit: 'USD',
    names: ['Assets'],
  },
  liabilities: {
    label: 'Liabilities',
    unit: 'USD',
    names: ['Liabilities'],
  },
  equity: {
    label: 'Stockholders equity',
    unit: 'USD',
    names: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  },
  cash: {
    label: 'Cash & equivalents',
    unit: 'USD',
    names: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  },
  debt: {
    label: 'Debt',
    unit: 'USD',
    names: ['LongTermDebtAndFinanceLeaseObligations', 'LongTermDebtAndFinanceLeaseObligationsCurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebt'],
  },
  rAndD: {
    label: 'R&D expense',
    unit: 'USD',
    names: ['ResearchAndDevelopmentExpense'],
  },
  sharesDiluted: {
    label: 'Diluted shares',
    unit: 'shares',
    names: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
  },
};

function jsonResponse(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
      'Cache-Control': status >= 200 && status < 300
        ? `public, max-age=300, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`
        : 'public, max-age=30, s-maxage=60',
    },
  });
}

function padCik(cik) {
  return String(cik || '').replace(/\D/g, '').padStart(10, '0');
}

function isCacheFresh(entry) {
  return entry && Date.now() - entry.ts < CACHE_TTL_SECONDS * 1000;
}

async function fetchJson(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': SEC_USER_AGENT,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!resp.ok) throw new Error(`SEC returned HTTP ${resp.status}`);
  return resp.json();
}

async function resolveTickerCik(ticker) {
  const cacheKey = 'company-tickers';
  const cached = cache.get(cacheKey);
  let directory = cached?.data;

  if (!isCacheFresh(cached)) {
    directory = await fetchJson('https://www.sec.gov/files/company_tickers.json');
    cache.set(cacheKey, { ts: Date.now(), data: directory });
  }

  const upper = ticker.toUpperCase();
  for (const entry of Object.values(directory || {})) {
    if (String(entry.ticker || '').toUpperCase() === upper) {
      return {
        cik: padCik(entry.cik_str),
        name: entry.title || upper,
      };
    }
  }
  return null;
}

function getConceptUnits(facts, conceptNames) {
  const usGaap = facts?.facts?.['us-gaap'] || {};
  for (const name of conceptNames) {
    const units = usGaap[name]?.units;
    if (units) return { concept: name, units };
  }
  return null;
}

function pickUnitEntries(units, preferredUnit) {
  if (!units) return [];
  if (preferredUnit === 'shares') {
    return units.shares || units.Shares || [];
  }
  return units.USD || units.usd || units['USD/shares'] || [];
}

function sortFacts(entries) {
  return [...entries]
    .filter((entry) => Number.isFinite(entry.val) && entry.filed)
    .sort((a, b) => String(b.filed).localeCompare(String(a.filed)));
}

function durationDays(entry) {
  if (!entry?.start || !entry?.end) return null;
  const start = Date.parse(entry.start);
  const end = Date.parse(entry.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function latestFact(entries, annual) {
  const candidates = sortFacts(entries).filter((entry) => {
    const form = String(entry.form || '').toUpperCase();
    if (annual) return form === '10-K' || form === '20-F' || form === '40-F';
    return form === '10-Q';
  });

  const preferred = candidates.filter((entry) => {
    const days = durationDays(entry);
    if (days === null) return true;
    return annual ? days >= 250 : days <= 120;
  });

  return preferred[0] || candidates[0] || null;
}

function matchingPriorYear(entries, current) {
  if (!current?.fy) return null;
  const targetFy = Number(current.fy) - 1;
  const fp = String(current.fp || '');
  const currentDays = durationDays(current);
  return sortFacts(entries).find((entry) =>
    Number(entry.fy) === targetFy &&
    String(entry.fp || '') === fp &&
    String(entry.form || '').toUpperCase() === String(current.form || '').toUpperCase() &&
    isComparableDuration(currentDays, durationDays(entry))
  ) || null;
}

function isComparableDuration(currentDays, candidateDays) {
  if (currentDays === null || candidateDays === null) return true;
  const currentIsQuarter = currentDays <= 120;
  const candidateIsQuarter = candidateDays <= 120;
  return currentIsQuarter === candidateIsQuarter;
}

function toPeriod(entry) {
  if (!entry) return null;
  return {
    value: entry.val,
    fy: Number(entry.fy) || null,
    fp: entry.fp || '',
    form: entry.form || '',
    filed: entry.filed || '',
    start: entry.start || '',
    end: entry.end || '',
    accession: entry.accn || '',
  };
}

function buildMetric(facts, id, spec) {
  const found = getConceptUnits(facts, spec.names);
  const entries = pickUnitEntries(found?.units, spec.unit);
  const annual = latestFact(entries, true);
  const quarterly = latestFact(entries, false);
  const annualPrior = matchingPriorYear(entries, annual);
  const quarterlyPrior = matchingPriorYear(entries, quarterly);

  return {
    id,
    label: spec.label,
    concept: found?.concept || '',
    unit: spec.unit,
    annual: toPeriod(annual),
    quarterly: toPeriod(quarterly),
    annualYoY: annual && annualPrior?.val ? (annual.val - annualPrior.val) / Math.abs(annualPrior.val) : null,
    quarterlyYoY: quarterly && quarterlyPrior?.val ? (quarterly.val - quarterlyPrior.val) / Math.abs(quarterlyPrior.val) : null,
  };
}

function findMetric(metrics, id) {
  return metrics.find((metric) => metric.id === id);
}

function metricValue(metrics, id, period = 'quarterly') {
  const metric = findMetric(metrics, id);
  return metric?.[period]?.value ?? metric?.annual?.value ?? null;
}

function buildSignals(metrics) {
  const signals = [];
  const revenue = findMetric(metrics, 'revenue');
  const netIncome = findMetric(metrics, 'netIncome');
  const debt = metricValue(metrics, 'debt');
  const equity = metricValue(metrics, 'equity');
  const cash = metricValue(metrics, 'cash');
  const rAndD = metricValue(metrics, 'rAndD');
  const revenueValue = metricValue(metrics, 'revenue');

  if (revenue?.quarterlyYoY !== null && revenue?.quarterlyYoY !== undefined) {
    signals.push({
      label: 'Revenue YoY',
      value: revenue.quarterlyYoY,
      kind: revenue.quarterlyYoY >= 0 ? 'positive' : 'negative',
      format: 'percent',
    });
  }

  const netMargin = revenueValue ? metricValue(metrics, 'netIncome') / revenueValue : null;
  if (netMargin !== null && Number.isFinite(netMargin)) {
    signals.push({
      label: 'Net margin',
      value: netMargin,
      kind: netMargin >= 0 ? 'positive' : 'negative',
      format: 'percent',
    });
  }

  const debtEquity = equity ? debt / Math.abs(equity) : null;
  if (debtEquity !== null && Number.isFinite(debtEquity)) {
    signals.push({
      label: 'Debt / equity',
      value: debtEquity,
      kind: debtEquity > 2 ? 'negative' : 'neutral',
      format: 'multiple',
    });
  }

  const cashDebt = debt ? cash / Math.abs(debt) : null;
  if (cashDebt !== null && Number.isFinite(cashDebt)) {
    signals.push({
      label: 'Cash / debt',
      value: cashDebt,
      kind: cashDebt >= 1 ? 'positive' : 'neutral',
      format: 'multiple',
    });
  }

  const rAndDIntensity = revenueValue ? rAndD / revenueValue : null;
  if (rAndDIntensity !== null && Number.isFinite(rAndDIntensity)) {
    signals.push({
      label: 'R&D intensity',
      value: rAndDIntensity,
      kind: 'neutral',
      format: 'percent',
    });
  }

  if (netIncome?.quarterlyYoY !== null && netIncome?.quarterlyYoY !== undefined) {
    signals.push({
      label: 'Net income YoY',
      value: netIncome.quarterlyYoY,
      kind: netIncome.quarterlyYoY >= 0 ? 'positive' : 'negative',
      format: 'percent',
    });
  }

  return signals;
}

export default async function handler(req) {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return jsonResponse(req, { error: 'Method not allowed' }, 405);

  const requestUrl = new URL(req.url);
  const ticker = (requestUrl.searchParams.get('ticker') || '').trim().toUpperCase();
  const requestedCik = padCik(requestUrl.searchParams.get('cik') || '');

  if (!ticker && !requestedCik.replace(/^0+/, '')) {
    return jsonResponse(req, { error: 'ticker or cik is required' }, 400);
  }

  try {
    const resolved = requestedCik.replace(/^0+/, '')
      ? { cik: requestedCik, name: ticker || requestedCik }
      : await resolveTickerCik(ticker);

    if (!resolved?.cik) {
      return jsonResponse(req, { ticker, cik: '', entityName: ticker, metrics: [], signals: [] });
    }

    const cacheKey = `companyfacts:${resolved.cik}`;
    const cached = cache.get(cacheKey);
    let facts = cached?.data;

    if (!isCacheFresh(cached)) {
      facts = await fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${resolved.cik}.json`);
      cache.set(cacheKey, { ts: Date.now(), data: facts });
    }

    const metrics = Object.entries(CONCEPTS).map(([id, spec]) => buildMetric(facts, id, spec));
    const sourceUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${resolved.cik}.json`;

    return jsonResponse(req, {
      ticker: ticker || facts.cik || '',
      cik: resolved.cik,
      entityName: facts.entityName || resolved.name,
      sourceUrl,
      metrics,
      signals: buildSignals(metrics),
    });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : String(error) }, 502);
  }
}
