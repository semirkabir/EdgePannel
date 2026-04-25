import { getCorsHeaders } from './_cors.js';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SEC_UA = 'WorldMonitor/1.0 (contact@worldmonitor.io)';
const UPSTREAM_TIMEOUT = 15000;

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

      latestFilingDate = filingDates[i] || '';
      if (!latestAccession) {
        latestAccession = accession;
        latestPrimaryDoc = primaryDoc;
      }
    }
  }

  // If we found a 13F filing, try to get the holdings XML
  if (latestAccession) {
    const cleanAccession = latestAccession.replace(/-/g, '');
    const holdingsUrl = `https://data.sec.gov/Archives/edgar/data/${paddedCik}/${cleanAccession}`;

    let infoTableName = '';

    try {
      // Strategy 1: Use index.json to discover the infoTable file name
      const indexResp = await fetch(`${holdingsUrl}/index.json`, {
        headers: { 'User-Agent': SEC_UA, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
      });

      if (indexResp.ok) {
        const indexData = await indexResp.json();
        const items = indexData.directory?.item || [];
        const infoTableItem = items.find(item =>
          item.name && (/infotable/i.test(item.name) || /form13f/i.test(item.name)) && item.name.endsWith('.xml')
        );
        if (infoTableItem) {
          infoTableName = infoTableItem.name;
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
                issuer: nameMatch[2],
                title: titleMatch?.[2] || '',
                cusip: cusipMatch?.[2] || '',
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

  // Sort by value descending
  holdings.sort((a, b) => b.value - a.value);
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);

  const result = {
    name: data.name || '',
    cik: cik,
    filingDate: latestFilingDate,
    filingHistory: filingHistory.slice(0, 12),
    holdings: holdings.slice(0, 50), // Top 50 positions
    totalHoldings: holdings.length,
    totalValue,
  };

  setCache(cacheKey, result);

  return new Response(JSON.stringify(result), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
