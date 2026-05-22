import { getCorsHeaders } from './_cors.js';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!FINNHUB_API_KEY) {
    return new Response(JSON.stringify({ error: 'FINNHUB_API_KEY not configured — add in Settings' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  const symbol = url.searchParams.get('symbol');
  const transcriptId = url.searchParams.get('id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!endpoint) {
    return new Response(JSON.stringify({ error: 'Missing endpoint parameter' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    let finnhubUrl;
    switch (endpoint) {
      case 'earnings-calendar':
        finnhubUrl = new URL('https://finnhub.io/api/v1/calendar/earnings');
        finnhubUrl.searchParams.set('symbol', symbol || '');
        finnhubUrl.searchParams.set('from', from || new Date().toISOString().split('T')[0]);
        finnhubUrl.searchParams.set('to', to || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
        break;

      case 'earnings-transcripts-list':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for earnings-transcripts-list' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/transcripts/list');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'earnings-transcript':
        if (!transcriptId) {
          return new Response(JSON.stringify({ error: 'id is required for earnings-transcript' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/transcripts');
        finnhubUrl.searchParams.set('id', transcriptId);
        break;

      case 'ipo-calendar':
        finnhubUrl = new URL('https://finnhub.io/api/v1/calendar/ipo');
        finnhubUrl.searchParams.set('from', from || new Date().toISOString().split('T')[0]);
        finnhubUrl.searchParams.set('to', to || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
        break;

      case 'insider-transactions':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for insider-transactions' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/insider-transactions');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'social-sentiment':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for social-sentiment' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/social-sentiment');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'recommendation-trends':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for recommendation-trends' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/recommendation');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'option-chain':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for option-chain' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/option-chain');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'quote':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for quote' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/quote');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'company-profile':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for company-profile' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/profile2');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'company-metrics':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for company-metrics' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/metric');
        finnhubUrl.searchParams.set('symbol', symbol);
        finnhubUrl.searchParams.set('metric', 'all');
        break;

      case 'company-peers':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for company-peers' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/peers');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'company-news':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for company-news' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/company-news');
        finnhubUrl.searchParams.set('symbol', symbol);
        finnhubUrl.searchParams.set('from', from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
        finnhubUrl.searchParams.set('to', to || new Date().toISOString().split('T')[0]);
        break;

      case 'price-target':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for price-target' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/price-target');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'financials-reported':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for financials-reported' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/financials-reported');
        finnhubUrl.searchParams.set('symbol', symbol);
        finnhubUrl.searchParams.set('freq', url.searchParams.get('freq') || 'annual');
        break;

      case 'stock-ownership':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for stock-ownership' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/ownership');
        finnhubUrl.searchParams.set('symbol', symbol);
        finnhubUrl.searchParams.set('limit', '10');
        break;

      case 'earnings-surprises':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for earnings-surprises' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/earnings');
        finnhubUrl.searchParams.set('symbol', symbol);
        finnhubUrl.searchParams.set('limit', '8');
        break;

      case 'eps-estimates':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for eps-estimates' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/eps-estimate');
        finnhubUrl.searchParams.set('symbol', symbol);
        finnhubUrl.searchParams.set('freq', url.searchParams.get('freq') || 'quarterly');
        break;

      case 'revenue-estimates':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for revenue-estimates' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/revenue-estimate');
        finnhubUrl.searchParams.set('symbol', symbol);
        finnhubUrl.searchParams.set('freq', url.searchParams.get('freq') || 'quarterly');
        break;

      case 'stock-dividends':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for stock-dividends' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/dividend');
        finnhubUrl.searchParams.set('symbol', symbol);
        finnhubUrl.searchParams.set('from', from || new Date(Date.now() - 3650 * 86400000).toISOString().split('T')[0]);
        finnhubUrl.searchParams.set('to', to || new Date().toISOString().split('T')[0]);
        break;

      case 'revenue-breakdown':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for revenue-breakdown' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/revenue-breakdown');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'upgrade-downgrade':
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for upgrade-downgrade' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        finnhubUrl = new URL('https://finnhub.io/api/v1/stock/upgrade-downgrade');
        finnhubUrl.searchParams.set('symbol', symbol);
        break;

      case 'yahoo-quote': {
        // Yahoo Finance fallback — no API key required, proxied server-side to avoid CORS
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'symbol is required for yahoo-quote' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        try {
          const yahooResp = await fetch(yahooUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          });
          if (!yahooResp.ok) {
            return new Response(JSON.stringify({ error: `Yahoo Finance returned ${yahooResp.status}` }), {
              status: yahooResp.status,
              headers: { ...cors, 'Content-Type': 'application/json' },
            });
          }
          const yahooData = await yahooResp.json();
          const meta = yahooData?.chart?.result?.[0]?.meta ?? {};
          // Normalize to same shape as Finnhub quote {c, d, dp, h, l, o, pc}
          const regularPrice = meta.regularMarketPrice ?? 0;
          const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? regularPrice;
          const change = regularPrice - prevClose;
          const changePct = prevClose ? (change / prevClose) * 100 : 0;
          return new Response(JSON.stringify({
            c: regularPrice,
            d: change,
            dp: changePct,
            h: meta.regularMarketDayHigh ?? regularPrice,
            l: meta.regularMarketDayLow ?? regularPrice,
            o: meta.regularMarketOpen ?? regularPrice,
            pc: prevClose,
            currency: meta.currency ?? '',
            shortName: meta.shortName ?? meta.symbol ?? symbol,
          }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
    }

    finnhubUrl.searchParams.set('token', FINNHUB_API_KEY);

    const resp = await fetch(finnhubUrl.toString());
    const data = await resp.json();

    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}
