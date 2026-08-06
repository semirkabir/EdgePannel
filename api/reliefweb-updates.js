/**
 * ReliefWeb humanitarian updates — RSS proxy (no API key).
 * Official API requires an approved appname; RSS is used as the no-key path.
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const RELIEFWEB_RSS = 'https://reliefweb.int/updates/rss.xml';
const MAX_ITEMS = 20;

function decodeHtml(text) {
  return (text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractCountry(link, categories) {
  const slugMatch = (link || '').match(/\/report\/([^/]+)\//i);
  if (slugMatch) {
    return slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const countryTag = categories.find((c) => !/source|press|news|health|food|protection|safety/i.test(c));
  return countryTag || '';
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < MAX_ITEMS) {
    const block = match[1];
    const title = decodeHtml(extractTag(block, 'title'));
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    if (!title || !link) continue;

    const categories = [];
    const categoryRegex = /<category>([^<]+)<\/category>/gi;
    let catMatch;
    while ((catMatch = categoryRegex.exec(block)) !== null) {
      categories.push(decodeHtml(catMatch[1]));
    }

    const description = decodeHtml(extractTag(block, 'description')).slice(0, 280);
    const country = extractCountry(link, categories);

    items.push({
      id: `reliefweb-${link.split('/').pop() || items.length}`,
      title,
      link,
      pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      country,
      categories: categories.slice(0, 4),
      summary: description,
      source: 'ReliefWeb',
    });
  }

  return items;
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const response = await fetchWithTimeout(
      RELIEFWEB_RSS,
      {
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
          'User-Agent': 'WorldMonitor/1.0 (edgepannel.com)',
        },
      },
      15000,
    );

    if (!response.ok) {
      throw new Error(`ReliefWeb RSS HTTP ${response.status}`);
    }

    const xml = await response.text();
    const updates = parseRssItems(xml);

    return new Response(JSON.stringify({ updates, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[reliefweb-updates] error:', error?.message);
    return new Response(
      JSON.stringify({ updates: [], error: isTimeout ? 'ReliefWeb timeout' : 'Failed to fetch ReliefWeb updates' }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}