import { getCorsHeaders } from './_cors.js';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Streams + gunzips large SEC/13F payloads with node:zlib, so this route must
// run on the Node.js runtime (Vercel's default), never Edge.
export const config = { runtime: 'nodejs' };

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SEC_UA = 'EdgePannel/1.0 (contact@edgepannel.com)';
const UPSTREAM_TIMEOUT = 15000;
const SEC_13F_LIST_PAGE = 'https://www.sec.gov/rules-regulations/staff-guidance/official-list-section-13f-securities';
const SEC_TICKER_DIRECTORY_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const IAPD_SEARCH_BASE = 'https://api.adviserinfo.sec.gov/search';
const IAPD_REPORTS_BASE = 'https://reports.adviserinfo.sec.gov';
const IAPD_COMPILATION_MANIFEST = `${IAPD_REPORTS_BASE}/reports/CompilationReports/CompilationReports.manifest.json`;

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  // Evict old entries
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\betf t\b/g, ' etf trust ')
    .replace(/\btr\b/g, ' trust ')
    .replace(/\bser\b/g, ' series ')
    .replace(/\bfd\b/g, ' fund ')
    .replace(/\bpete\b/g, ' petroleum ')
    .replace(/\bbank america\b/g, ' bank of america ')
    .replace(/\bcorp\b/g, ' corporation ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|group|holdings|holding|class|cl|common|stock|shares|adr|new|de|the|of)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getXmlAttr(block, tag, attr) {
  const tagMatch = block.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'));
  if (!tagMatch) return '';
  const attrMatch = tagMatch[1].match(new RegExp(`\\b${attr}="([^"]*)"`, 'i'));
  return attrMatch ? decodeXml(attrMatch[1]) : '';
}

function parseNumberAttr(block, tag, attr) {
  const value = getXmlAttr(block, tag, attr).replace(/[$,]/g, '').trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson(url, headers = {}) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': SEC_UA, 'Accept': 'application/json', ...headers },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function fetchText(url, headers = {}) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': SEC_UA, 'Accept': 'text/plain,text/html,application/xml;q=0.9,*/*;q=0.8', ...headers },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

function parse13FList(text) {
  const byCusip = new Map();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.padEnd(80, ' ');
    const cusip = line.slice(0, 9).trim().toUpperCase();
    if (!/^[A-Z0-9]{9}$/.test(cusip)) continue;
    byCusip.set(cusip, {
      cusip,
      issuer: line.slice(10, 40).trim(),
      title: line.slice(40, 67).trim(),
      option: line[9] === '*',
      status: line.slice(67, 70).trim(),
    });
  }
  return byCusip;
}

async function fetchCurrent13FList() {
  const cached = getCached('sec:13f-list');
  if (cached) return cached;

  let textUrl = 'https://www.sec.gov/files/investment/13flist2026q1.txt';
  try {
    const page = await fetchText(SEC_13F_LIST_PAGE, { Accept: 'text/html' });
    const txtMatch = page.match(/href="([^"]*13flist[^"]*\.txt)"/i);
    if (txtMatch?.[1]) {
      textUrl = new URL(txtMatch[1], SEC_13F_LIST_PAGE).toString();
    }
  } catch (err) {
    console.warn('[Portfolio] 13F list page lookup failed:', err.message);
  }

  const text = await fetchText(textUrl);
  const result = { url: textUrl, byCusip: parse13FList(text) };
  setCache('sec:13f-list', result);
  return result;
}

async function fetchTickerReference() {
  const cached = getCached('sec:ticker-reference');
  if (cached) return cached;

  const directory = await fetchJson(SEC_TICKER_DIRECTORY_URL);
  const fields = directory.fields || [];
  const data = Array.isArray(directory.data) ? directory.data : [];
  const nameIdx = fields.indexOf('name');
  const tickerIdx = fields.indexOf('ticker');
  const entries = [];
  const byName = new Map();
  const byFirstToken = new Map();

  for (const row of data) {
    const name = String(row[nameIdx] || '').trim();
    const ticker = String(row[tickerIdx] || '').trim().toUpperCase();
    if (!name || !ticker) continue;
    const normalized = normalizeName(name);
    if (!normalized) continue;
    const entry = { name, normalized, ticker };
    entries.push(entry);
    if (!byName.has(normalized)) byName.set(normalized, entry);
    const firstToken = normalized.split(' ')[0];
    if (firstToken) {
      if (!byFirstToken.has(firstToken)) byFirstToken.set(firstToken, []);
      byFirstToken.get(firstToken).push(entry);
    }
  }

  const result = { entries, byName, byFirstToken };
  setCache('sec:ticker-reference', result);
  return result;
}

function resolveTickerFromReference(holding, reference, list13f) {
  const candidates = [];
  const addCandidate = (value) => {
    if (!value) return;
    candidates.push(value);
    candidates.push(String(value).replace(/^STATE\s+(STR|STREET)\s+/i, ''));
  };
  addCandidate(holding.issuer);
  addCandidate(`${holding.issuer} ${holding.title || ''}`);
  const listEntry = holding.cusip ? list13f.byCusip.get(String(holding.cusip).toUpperCase()) : null;
  if (listEntry) {
    addCandidate(listEntry.issuer);
    addCandidate(`${listEntry.issuer} ${listEntry.title || ''}`);
  }

  for (const candidate of candidates) {
    const normalized = normalizeName(candidate);
    if (!normalized) continue;
    const exact = reference.byName.get(normalized);
    if (exact) {
      return {
        ticker: exact.ticker,
        source: listEntry && normalizeName(listEntry.issuer) === normalized ? 'sec_13f_list' : 'sec_company_tickers',
      };
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeName(candidate);
    const tokens = normalized.split(' ').filter(Boolean);
    const tokenCount = tokens.length;
    if (!normalized || normalized.length < 4 || tokenCount < 2) continue;
    const fuzzyPool = reference.byFirstToken.get(tokens[0]) || [];
    const fuzzy = fuzzyPool.find(entry =>
      entry.normalized.split(' ').filter(Boolean).length >= 2 &&
      (
        entry.normalized === normalized ||
        entry.normalized.startsWith(`${normalized} `) ||
        normalized.startsWith(`${entry.normalized} `)
      )
    );
    if (fuzzy) {
      return {
        ticker: fuzzy.ticker,
        source: listEntry ? 'sec_13f_list' : 'sec_company_tickers',
      };
    }
  }

  return { ticker: '', source: '' };
}

async function enrichHoldingsTickers(holdings) {
  if (!holdings.length) return holdings;
  try {
    const [reference, list13f] = await Promise.all([
      fetchTickerReference(),
      fetchCurrent13FList(),
    ]);
    return holdings.map((holding) => {
      const mapped = resolveTickerFromReference(holding, reference, list13f);
      return mapped.ticker
        ? { ...holding, ticker: mapped.ticker, tickerMappingSource: mapped.source }
        : holding;
    });
  } catch (err) {
    console.warn('[Portfolio] 13F ticker enrichment failed:', err.message);
    return holdings;
  }
}

function parseIapdAddress(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const address = parsed?.officeAddress || parsed || {};
    return {
      street1: address.street1 || '',
      street2: address.street2 || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || '',
      postalCode: address.postalCode || '',
    };
  } catch {
    return {};
  }
}

function scoreAdviserSearchResult(source, managerName) {
  const query = normalizeName(managerName);
  const name = normalizeName(source.firm_name || source.ia_firm_name || '');
  const otherNames = Array.isArray(source.firm_other_names) ? source.firm_other_names.map(normalizeName) : [];
  let score = 0;
  if (source.firm_ia_scope === 'ACTIVE') score += 25;
  if (source.firm_ia_full_sec_number) score += 20;
  if (name === query) score += 100;
  else if (name.includes(query) || query.includes(name)) score += 60;
  if (otherNames.some(other => other === query)) score += 80;
  else if (otherNames.some(other => other.includes(query) || query.includes(other))) score += 35;
  return score;
}

async function fetchIapdFirmSearch(managerName) {
  const query = managerName.trim();
  if (!query) return null;
  const url = `${IAPD_SEARCH_BASE}/firm?query=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  const hits = data?.hits?.hits || [];
  const ranked = hits
    .map(hit => hit?._source)
    .filter(Boolean)
    .map(source => ({ source, score: scoreAdviserSearchResult(source, query) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 0 ? ranked[0].source : null;
}

async function fetchIapdFirmDetail(firmId) {
  if (!firmId) return null;
  const url = `${IAPD_SEARCH_BASE}/firm/${encodeURIComponent(firmId)}?hl=true&nrows=12&query=smith&r=25&sort=score%20desc&wt=json`;
  const data = await fetchJson(url);
  const content = data?.hits?.hits?.[0]?._source?.iacontent;
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function buildAdvProfileFromXml(block, manifestFile) {
  const firmCrd = getXmlAttr(block, 'Info', 'FirmCrdNb');
  const secNumber = getXmlAttr(block, 'Info', 'SECNb');
  const businessName = getXmlAttr(block, 'Info', 'BusNm');
  const legalName = getXmlAttr(block, 'Info', 'LegalNm');
  const filingDate = getXmlAttr(block, 'Filing', 'Dt');
  const registrationStatus = getXmlAttr(block, 'Rgstn', 'St');
  const registrationType = getXmlAttr(block, 'Rgstn', 'FirmType');
  const regulatoryAum = parseNumberAttr(block, 'Item5F', 'Q5F2C');
  const discretionaryAum = parseNumberAttr(block, 'Item5F', 'Q5F2A');
  const nonDiscretionaryAum = parseNumberAttr(block, 'Item5F', 'Q5F2B');
  const totalAccounts = parseNumberAttr(block, 'Item5F', 'Q5F2F');
  const discretionaryAccounts = parseNumberAttr(block, 'Item5F', 'Q5F2D');
  const nonDiscretionaryAccounts = parseNumberAttr(block, 'Item5F', 'Q5F2E');
  const employees = parseNumberAttr(block, 'Item5A', 'TtlEmp');
  return {
    firmCrd,
    secNumber,
    businessName,
    legalName,
    filingDate,
    registrationStatus,
    registrationType,
    regulatoryAum,
    discretionaryAum,
    nonDiscretionaryAum,
    totalAccounts,
    discretionaryAccounts,
    nonDiscretionaryAccounts,
    employees,
    source: 'IAPD Form ADV compilation',
    sourceFile: manifestFile,
  };
}

async function fetchAdvCompilationForFirm(firmCrd) {
  if (!firmCrd) return null;
  const cacheKey = `iapd:adv-xml:${firmCrd}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const manifest = await fetchJson(IAPD_COMPILATION_MANIFEST, { Accept: 'application/json' });
  const file = (manifest.files || []).find(item => String(item.name || '').includes('IA_FIRM_SEC_Feed'));
  if (!file?.name) return null;

  const resp = await fetch(`${IAPD_REPORTS_BASE}/reports/CompilationReports/${file.name}`, {
    headers: { 'User-Agent': SEC_UA, Accept: 'application/gzip,application/xml,*/*' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok || !resp.body) {
    resp.body?.cancel().catch(() => {});
    return null;
  }

  const source = Readable.fromWeb(resp.body);
  const gunzip = createGunzip();
  // pipeline() forwards source errors (e.g. the timeout abort) into gunzip and
  // tears both streams down. A bare .pipe() leaves the source's 'error' event
  // unhandled, which kills the whole process mid-download.
  const piped = pipeline(source, gunzip).catch(() => {});
  try {
    let buffer = '';
    for await (const chunk of gunzip) {
      buffer += chunk.toString('latin1');
      let endIdx = buffer.indexOf('</Firm>');
      while (endIdx >= 0) {
        const block = buffer.slice(0, endIdx + '</Firm>'.length);
        buffer = buffer.slice(endIdx + '</Firm>'.length);
        if (block.includes(`FirmCrdNb="${firmCrd}"`)) {
          const result = buildAdvProfileFromXml(block, file.name);
          setCache(cacheKey, result);
          return result;
        }
        endIdx = buffer.indexOf('</Firm>');
      }
      if (buffer.length > 500_000) buffer = buffer.slice(-250_000);
    }

    setCache(cacheKey, null);
    return null;
  } finally {
    gunzip.destroy();
    source.destroy();
    await piped;
  }
}

async function fetchAdviserProfile(managerName) {
  const cacheKey = `iapd:profile:${normalizeName(managerName)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const search = await fetchIapdFirmSearch(managerName);
    if (!search?.firm_source_id) return null;

    const detail = await fetchIapdFirmDetail(search.firm_source_id);
    const basic = detail?.basicInformation || {};
    const firmId = String(basic.firmId || search.firm_source_id);
    const address = parseIapdAddress(detail?.iaFirmAddressDetails?.officeAddress || search.firm_ia_address_details);
    const adv = await fetchAdvCompilationForFirm(firmId).catch((err) => {
      console.warn('[Portfolio] ADV compilation lookup failed:', err.message);
      return null;
    });

    const result = {
      firmId,
      name: basic.firmName || search.firm_name || managerName,
      secNumber: basic.iaSECNumber
        ? `${basic.iaSECNumberType || '801'}-${basic.iaSECNumber}`
        : (search.firm_ia_full_sec_number || adv?.secNumber || ''),
      status: basic.iaScope || search.firm_ia_scope || adv?.registrationStatus || '',
      advFilingDate: basic.advFilingDate || adv?.filingDate || '',
      registrationStatus: adv?.registrationStatus || detail?.registrationStatus?.[0]?.status || '',
      registrationType: adv?.registrationType || '',
      address,
      regulatoryAum: adv?.regulatoryAum ?? null,
      discretionaryAum: adv?.discretionaryAum ?? null,
      nonDiscretionaryAum: adv?.nonDiscretionaryAum ?? null,
      totalAccounts: adv?.totalAccounts ?? null,
      employees: adv?.employees ?? null,
      relyingAdvisers: Array.isArray(detail?.relyingAdvisors) ? detail.relyingAdvisors.length : 0,
      brochureCount: detail?.brochures?.brochuredetails?.length || 0,
      formAdvUrl: `${IAPD_REPORTS_BASE}/reports/ADV/${firmId}/PDF/${firmId}.pdf`,
      iapdUrl: `https://adviserinfo.sec.gov/firm/summary/${firmId}`,
      source: adv?.source || 'IAPD firm search',
      sourceFile: adv?.sourceFile || '',
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[Portfolio] Adviser profile lookup failed:', err.message);
    return null;
  }
}

export default async function handler(req) {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(req.url);
  const source = url.searchParams.get('source');

  try {
    switch (source) {
      case 'congress-trades':
        return await handleCongressTrades(cors);

      case '13f-holdings': {
        const cik = url.searchParams.get('cik');
        if (!cik) {
          return new Response(JSON.stringify({ error: 'cik is required' }), {
            status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        return await handle13FHoldings(cik, cors);
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown source: ${source}` }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}

// ─── Congressional Trading Data ────────────────────────────────────────────

async function handleCongressTrades(cors) {
  const cached = getCached('congress-trades');
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Try House Stock Watcher (public S3 JSON)
  let houseTrades = [];
  try {
    const resp = await fetch(
      'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json',
      { headers: { 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) },
    );
    if (resp.ok) {
      const data = await resp.json();
      houseTrades = Array.isArray(data) ? data : [];
    }
  } catch (e) {
    console.warn('[Portfolio] House stock watcher error:', e.message);
  }

  // Try Senate Stock Watcher
  let senateTrades = [];
  try {
    const resp = await fetch(
      'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json',
      { headers: { 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) },
    );
    if (resp.ok) {
      const data = await resp.json();
      senateTrades = Array.isArray(data) ? data : [];
    }
  } catch (e) {
    console.warn('[Portfolio] Senate stock watcher error:', e.message);
  }

  // Normalize and merge, take the most recent 200
  const normalized = [
    ...houseTrades.map(t => normalizeHouseTrade(t)),
    ...senateTrades.map(t => normalizeSenateTrade(t)),
  ]
    .filter(t => t && t.ticker && t.ticker !== '--' && t.ticker !== 'N/A')
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, 200);

  const result = { trades: normalized, updatedAt: new Date().toISOString() };
  setCache('congress-trades', result);

  return new Response(JSON.stringify(result), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function normalizeHouseTrade(t) {
  if (!t) return null;
  return {
    politician: t.representative || 'Unknown',
    chamber: 'House',
    ticker: (t.ticker || '').replace(/\s/g, ''),
    assetDescription: t.asset_description || '',
    transactionType: t.type || '',
    transactionDate: t.transaction_date || '',
    disclosureDate: t.disclosure_date || '',
    amount: t.amount || '',
    party: t.party || '',
    district: t.district || '',
    state: t.state || '',
  };
}

function normalizeSenateTrade(t) {
  if (!t) return null;
  return {
    politician: (t.first_name || '') + ' ' + (t.last_name || ''),
    chamber: 'Senate',
    ticker: (t.ticker || '').replace(/\s/g, ''),
    assetDescription: t.asset_description || '',
    transactionType: t.type || '',
    transactionDate: t.transaction_date || '',
    disclosureDate: t.disclosure_date || '',
    amount: t.amount || '',
    party: t.party || '',
    district: '',
    state: t.state || '',
  };
}

// ─── 13F Institutional Holdings ────────────────────────────────────────────

async function handle13FHoldings(cik, cors) {
  const cacheKey = `13f:${cik}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Pad CIK to 10 digits
  const paddedCik = cik.padStart(10, '0');
  const edgarUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  const resp = await fetch(edgarUrl, {
    headers: { 'User-Agent': SEC_UA, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });

  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `SEC EDGAR returned ${resp.status}` }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const data = await resp.json();
  // SEC submissions API nests recent filings under `filings.recent`, not top-level `recent`
  const recent = data.filings?.recent || {};
  const forms = recent.form || [];
  const filingDates = recent.filingDate || [];
  const accessions = recent.accessionNumber || [];
  const primaryDocs = recent.primaryDocument || [];
  const acceptanceDateTimes = recent.acceptanceDateTime || [];

  // Find most recent 13F-HR filing
  const holdings = [];
  const filingHistory = [];
  let latestFilingDate = '';
  let latestAccession = '';
  let latestPrimaryDoc = '';

  for (let i = 0; i < forms.length; i++) {
    const form = (forms[i] || '').trim().toUpperCase();
    if (form === '13F-HR' || form === '13F-HR/A') {
      const accession = accessions[i] || '';
      const primaryDoc = primaryDocs[i] || '';
      const cleanAccession = accession.replace(/-/g, '');
      const filingDate = filingDates[i] || '';
      const filingUrl = accession && primaryDoc
        ? `https://www.sec.gov/Archives/edgar/data/${paddedCik}/${cleanAccession}/${primaryDoc}`
        : accession
          ? `https://www.sec.gov/Archives/edgar/data/${paddedCik}/${cleanAccession}/index.html`
          : '';

      filingHistory.push({
        id: accession || `${paddedCik}-${i}`,
        filingType: form,
        filingDate,
        acceptedAt: acceptanceDateTimes[i] || '',
        accessionNumber: accession,
        primaryDocument: primaryDoc,
        url: filingUrl,
      });

      if (!latestAccession) {
        latestFilingDate = filingDate;
        latestAccession = accession;
        latestPrimaryDoc = primaryDoc;
      }
    }
  }

  // If we found a 13F filing, try to get the holdings XML
  if (latestAccession) {
    const cleanAccession = latestAccession.replace(/-/g, '');
    const holdingsUrl = `https://www.sec.gov/Archives/edgar/data/${paddedCik}/${cleanAccession}`;

    let infoTableName = '';

    try {
      // Strategy 1: Use index.json to discover XML files and pick the one containing infoTable rows.
      const indexResp = await fetch(`${holdingsUrl}/index.json`, {
        headers: { 'User-Agent': SEC_UA, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
      });

      if (indexResp.ok) {
        const indexData = await indexResp.json();
        const items = indexData.directory?.item || [];
        const preferred = items
          .map(item => item.name || '')
          .filter(name => /\.xml$/i.test(name))
          .sort((a, b) => {
            const score = (name) =>
              (/infotable/i.test(name) ? 3 : 0) +
              (/form13f/i.test(name) ? 2 : 0) -
              (/primary_doc/i.test(name) ? 1 : 0);
            return score(b) - score(a);
          });

        for (const name of preferred) {
          try {
            const probeResp = await fetch(`${holdingsUrl}/${name}`, {
              headers: { 'User-Agent': SEC_UA, 'Accept': 'application/xml,text/xml,*/*' },
              signal: AbortSignal.timeout(8000),
            });
            if (!probeResp.ok) continue;
            const probeText = await probeResp.text();
            if (/<(\w+:)?infoTable\b/i.test(probeText)) {
              infoTableName = name;
              break;
            }
          } catch { /* ignore probe failure */ }
        }
      }
    } catch (e) {
      console.warn('[Portfolio] index.json lookup failed:', e.message);
    }

    // Strategy 2: Fallback to common filenames if index.json didn't help
    if (!infoTableName && latestPrimaryDoc) {
      const primary = latestPrimaryDoc.trim();
      if (/\.xml$/i.test(primary)) {
        infoTableName = primary;
      }
    }

    // Strategy 3: Hardcoded common names
    if (!infoTableName) {
      const commonNames = ['form13fInfoTable.xml', 'primary_doc.xml', 'Infotable.xml'];
      for (const name of commonNames) {
        try {
          const probeResp = await fetch(`${holdingsUrl}/${name}`, {
            headers: { 'User-Agent': SEC_UA },
            signal: AbortSignal.timeout(8000),
          });
          if (probeResp.ok) {
            infoTableName = name;
            break;
          }
        } catch { /* ignore probe failure */ }
      }
    }

    // Fetch and parse the holdings XML
    if (infoTableName) {
      try {
        const xmlResp = await fetch(`${holdingsUrl}/${infoTableName}`, {
          headers: { 'User-Agent': SEC_UA },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
        });

        if (xmlResp.ok) {
          const xmlText = await xmlResp.text();
          // Match <infoTable> or namespaced <n1:infoTable> etc.
          const infoTableRegex = /<(\w+:)?infoTable[^>]*>([\s\S]*?)<\/(\w+:)?infoTable>/gi;
          let match;
          while ((match = infoTableRegex.exec(xmlText)) !== null) {
            const entry = match[2];
            const nameMatch = entry.match(/<(\w+:)?nameOfIssuer[^>]*>(.*?)<\/(\w+:)?nameOfIssuer>/i);
            const titleMatch = entry.match(/<(\w+:)?titleOfClass[^>]*>(.*?)<\/(\w+:)?titleOfClass>/i);
            const cusipMatch = entry.match(/<(\w+:)?cusip[^>]*>(.*?)<\/(\w+:)?cusip>/i);
            const valueMatch = entry.match(/<(\w+:)?value[^>]*>(.*?)<\/(\w+:)?value>/i);
            const sharesMatch = entry.match(/<(\w+:)?sshPrnamt[^>]*>(.*?)<\/(\w+:)?sshPrnamt>/i);

            if (nameMatch) {
              holdings.push({
                issuer: decodeXml(nameMatch[2]),
                title: decodeXml(titleMatch?.[2] || ''),
                cusip: decodeXml(cusipMatch?.[2] || ''),
                value: valueMatch ? parseInt(valueMatch[2]) * 1000 : 0, // Values in thousands
                shares: sharesMatch ? parseInt(sharesMatch[2]) : 0,
              });
            }
          }
        }
      } catch (e) {
        console.warn('[Portfolio] 13F holdings parse error:', e.message);
      }
    }
  }

  // Sort by value descending and enrich issuer/CUSIP rows with free SEC ticker references.
  holdings.sort((a, b) => b.value - a.value);
  const enrichedHoldings = await enrichHoldingsTickers(holdings);
  const totalValue = enrichedHoldings.reduce((sum, holding) => sum + holding.value, 0);
  const adviser = await fetchAdviserProfile(data.name || '').catch((err) => {
    console.warn('[Portfolio] Adviser profile enrichment failed:', err.message);
    return null;
  });

  const result = {
    name: data.name || '',
    cik: cik,
    filingDate: latestFilingDate,
    filingHistory: filingHistory.slice(0, 12),
    holdings: enrichedHoldings.slice(0, 50), // Top 50 positions
    totalHoldings: enrichedHoldings.length,
    totalValue,
    adviser,
  };

  setCache(cacheKey, result);

  return new Response(JSON.stringify(result), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
