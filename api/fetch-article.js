import { Readability } from '@mozilla/readability';
import { DOMParser } from 'linkedom';
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { validateApiKey } from './_api-key.js';
import { checkRateLimit } from './_rate-limit.js';
import { redisGet, redisSet } from './_redis.js';
import { isGoogleNewsUrl, resolveGoogleNewsUrl } from './_google-news-resolver.js';

const ARTICLE_CACHE_TTL = 900; // 15 minutes
const NEGATIVE_CACHE_TTL = 120; // 2 minutes for failed fetches

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MIN_CONTENT_LENGTH = 80;
const MIN_FALLBACK_PARAGRAPH_LENGTH = 40;
const MIN_IMAGE_DIMENSION = 64;
const MAX_PARAGRAPHS = 40;
const MAX_REDIRECTS = 5;
const MAX_ARTICLE_BYTES = 1_500_000;
const DOCUMENT_POSITION_FOLLOWING = 4;

let TurndownService;

function isBlockedHostname(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '0.0.0.0' || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('169.254.')) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some(part => part > 255)) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return true;
  return false;
}

function parseFetchableArticleUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Unsupported URL protocol');
  }
  if (url.username || url.password || isBlockedHostname(url.hostname)) {
    throw new Error('Blocked article host');
  }
  return url;
}

function assertArticleResponseHeaders(response) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_ARTICLE_BYTES) {
    throw new Error('Article response too large');
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !/(text\/html|application\/xhtml\+xml|application\/xml|text\/xml|text\/plain)/.test(contentType)) {
    throw new Error('Unsupported article content type');
  }
}

async function fetchArticleDocument(initialUrl) {
  let current = parseFetchableArticleUrl(initialUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current.toString(), {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': CHROME_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Cache-Control': 'max-age=0',
      },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect missing location');
      current = parseFetchableArticleUrl(new URL(location, current).toString());
      continue;
    }

    assertArticleResponseHeaders(response);
    return { response, finalUrl: current.toString() };
  }
  throw new Error('Too many redirects');
}

async function readResponseTextLimited(response) {
  if (!response.body?.getReader) {
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > MAX_ARTICLE_BYTES) {
      throw new Error('Article response too large');
    }
    return html;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ARTICLE_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new Error('Article response too large');
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

const REMOVE_SELECTORS = [
  'script',
  'style',
  'template',
  'iframe',
  'canvas',
  'svg',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'nav',
  'footer',
  'aside',
  '.sidebar',
  '.advertisement',
  '.ad',
  '.ads',
  '.promo',
  '.newsletter',
  '.subscription',
  '.related',
  '.recommended',
  '.comments',
  '.social-share',
  '.share-buttons',
  '.outbrain',
  '.taboola',
  '[role="navigation"]',
  '[role="complementary"]',
  '[role="banner"]',
  '[aria-label*="share" i]',
  '[aria-label*="related" i]',
  '[class*="share" i]',
  '[class*="social" i]',
  '[class*="newsletter" i]',
  '[class*="subscribe" i]',
  '[class*="promo" i]',
  '[class*="recommended" i]',
  '[class*="related" i]',
];

const META_SITE_NAME_SELECTORS = [
  'meta[property="og:site_name"]',
  'meta[name="application-name"]',
];

const META_TITLE_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  'meta[name="title"]',
];

const META_AUTHOR_SELECTORS = [
  'meta[name="author"]',
  'meta[property="author"]',
  'meta[property="article:author"]',
  'meta[name="parsely-author"]',
  'meta[name="dc.creator"]',
];

const META_PUBLISHED_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[name="article:published_time"]',
  'meta[name="pubdate"]',
  'meta[name="publish-date"]',
  'meta[name="publication_date"]',
  'meta[name="date"]',
  'meta[itemprop="datePublished"]',
];

const META_IMAGE_SELECTORS = [
  'meta[property="og:image"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:src"]',
];

const LAZY_IMAGE_ATTRS = [
  'src',
  'data-src',
  'data-original',
  'data-lazy-src',
  'data-td-src-property',
  'data-image',
  'data-url',
];
const DUPLICATE_LEAD_TEXT_THRESHOLD = 40;
const DUPLICATE_LEAD_METADATA_MAX_LENGTH = 160;
const EMPTY_CONTAINER_TAGS = new Set(['div', 'figure', 'p', 'section', 'span']);

function normalizeText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function parseHtml(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

function ensureBaseTag(doc, baseUrl) {
  let head = doc.head;
  if (!head) {
    head = doc.createElement('head');
    if (doc.documentElement.firstChild) doc.documentElement.insertBefore(head, doc.documentElement.firstChild);
    else doc.documentElement.append(head);
  }

  let base = head.querySelector('base');
  if (!base) {
    base = doc.createElement('base');
    head.prepend(base);
  }
  base.setAttribute('href', baseUrl);
}

function absolutizeUrl(rawUrl, baseUrl) {
  if (!rawUrl) return '';
  try {
    const value = new URL(String(rawUrl).trim(), baseUrl);
    if (value.protocol !== 'http:' && value.protocol !== 'https:') return '';
    return value.toString();
  } catch {
    return '';
  }
}

function getMetaContent(doc, selectors) {
  for (const selector of selectors) {
    const value = doc.querySelector(selector)?.getAttribute('content');
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return '';
}

function getPublishedTime(doc) {
  const metaTime = getMetaContent(doc, META_PUBLISHED_SELECTORS);
  if (metaTime) return metaTime;

  const timeEl = doc.querySelector('time[datetime]');
  return normalizeText(timeEl?.getAttribute('datetime'));
}

function getCandidateImageUrl(doc, baseUrl) {
  const metaImage = getMetaContent(doc, META_IMAGE_SELECTORS);
  const normalizedMetaImage = absolutizeUrl(metaImage, baseUrl);
  if (normalizedMetaImage) return normalizedMetaImage;

  for (const img of doc.querySelectorAll('img')) {
    const src = normalizeImageSource(img, baseUrl);
    if (!src) continue;
    if (isTinyImage(img)) continue;
    return src;
  }

  return '';
}

function isTinyImage(img) {
  const width = Number.parseInt(img.getAttribute('width') || '0', 10);
  const height = Number.parseInt(img.getAttribute('height') || '0', 10);
  return (width > 0 && width < MIN_IMAGE_DIMENSION) || (height > 0 && height < MIN_IMAGE_DIMENSION);
}

function normalizeImageSource(img, baseUrl) {
  for (const attr of LAZY_IMAGE_ATTRS) {
    const value = img.getAttribute(attr);
    const normalized = absolutizeUrl(value, baseUrl);
    if (normalized) {
      img.setAttribute('src', normalized);
      return normalized;
    }
  }

  const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
  if (srcset) {
    const first = srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
    const normalized = absolutizeUrl(first, baseUrl);
    if (normalized) {
      img.setAttribute('src', normalized);
      return normalized;
    }
  }

  return '';
}

function getImageIdentity(rawUrl, baseUrl) {
  const normalized = absolutizeUrl(rawUrl, baseUrl);
  if (!normalized) return '';
  try {
    const pathname = new URL(normalized).pathname;
    const filename = pathname.split('/').filter(Boolean).pop() || '';
    let stem = filename;
    for (let i = 0; i < 3; i += 1) {
      const next = stem.replace(/\.(avif|webp|png|jpe?g)$/i, '');
      if (next === stem) break;
      stem = next;
    }
    // Strip common CDN resize suffixes like -w800, _640x360, -custom1, etc.
    stem = stem.replace(/[_-]\d+x\d+$/, '').replace(/[_-]w\d+$/, '').replace(/[_-]custom\d+$/, '');
    return stem.toLowerCase();
  } catch {
    return '';
  }
}

function imageUrlsLikelyMatch(leftUrl, rightUrl, baseUrl) {
  const left = absolutizeUrl(leftUrl, baseUrl);
  const right = absolutizeUrl(rightUrl, baseUrl);
  if (!left || !right) return false;
  if (left === right) return true;

  const leftId = getImageIdentity(left, baseUrl);
  const rightId = getImageIdentity(right, baseUrl);
  if (leftId.length >= 8 && leftId === rightId) return true;

  // Fallback: same base filename after stripping query params and resize tokens
  try {
    const leftName = new URL(left).pathname.split('/').pop()?.replace(/\.(avif|webp|png|jpe?g)$/i, '').toLowerCase() || '';
    const rightName = new URL(right).pathname.split('/').pop()?.replace(/\.(avif|webp|png|jpe?g)$/i, '').toLowerCase() || '';
    if (leftName.length >= 8 && leftName === rightName) return true;
  } catch { /* ignore */ }

  return false;
}

function isPlaceholderImage(img) {
  const src = normalizeText(img.getAttribute('src'));
  const alt = normalizeText(img.getAttribute('alt'));
  const ariaLabel = normalizeText(img.getAttribute('aria-label'));
  if (!src) return false;
  return (
    /placeholder/i.test(src)
    || /image unavailable/i.test(alt)
    || /image unavailable/i.test(ariaLabel)
  );
}

function removeEmptyContainers(root) {
  let removed = true;
  while (removed) {
    removed = false;
    for (const el of Array.from(root.querySelectorAll('*')).reverse()) {
      const tag = el.tagName.toLowerCase();
      if (!EMPTY_CONTAINER_TAGS.has(tag)) continue;
      if (el.querySelector('img, video, iframe, table, ul, ol, blockquote, pre, hr')) continue;
      if (normalizeText(el.textContent)) continue;
      el.remove();
      removed = true;
    }
  }
}

function getDocumentOrderIndex(el, root) {
  // Build a map of element -> document order index for reliable position comparison.
  // This avoids linkedom compareDocumentPosition bugs with special elements like <picture>.
  const all = root.querySelectorAll('*');
  for (let i = 0; i < all.length; i += 1) {
    if (all[i] === el) return i;
  }
  return -1;
}

function getElementTextLength(el) {
  return normalizeText(el?.textContent).length;
}

function getLinkedTextLength(el) {
  return Array.from(el?.querySelectorAll?.('a') || [])
    .reduce((total, anchor) => total + normalizeText(anchor.textContent).length, 0);
}

function isMetadataLikeLeadParagraph(paragraph) {
  const text = normalizeText(paragraph.textContent);
  if (!text || text.length > DUPLICATE_LEAD_METADATA_MAX_LENGTH) return false;

  const linkedTextLength = getLinkedTextLength(paragraph);
  if (linkedTextLength && linkedTextLength / Math.max(text.length, 1) > 0.6) return true;

  const anchors = Array.from(paragraph.querySelectorAll('a'));
  if (anchors.length >= 2 && /(^|[\s,|•])([A-Z][A-Za-z/&+-]+[\s,]*){2,}$/.test(text)) return true;

  return false;
}

function getFirstSubstantiveParagraph(contentDoc) {
  return Array.from(contentDoc.querySelectorAll('p'))
    .find((p) => (
      getElementTextLength(p) >= DUPLICATE_LEAD_TEXT_THRESHOLD
      && !isMetadataLikeLeadParagraph(p)
    ));
}

function stripDuplicateLeadImage(contentHtml, baseUrl, heroImageUrl) {
  if (!contentHtml) return contentHtml;

  const contentDoc = parseHtml(`<html><body>${contentHtml}</body></html>`);
  normalizeDocument(contentDoc, baseUrl);

  contentDoc.querySelectorAll('img').forEach((img) => {
    if (isPlaceholderImage(img)) img.remove();
  });

  const normalizedHero = absolutizeUrl(heroImageUrl, baseUrl);
  if (normalizedHero) {
    const firstMeaningfulParagraph = getFirstSubstantiveParagraph(contentDoc);
    const firstParaIndex = firstMeaningfulParagraph
      ? getDocumentOrderIndex(firstMeaningfulParagraph, contentDoc.body)
      : -1;

    for (const img of Array.from(contentDoc.querySelectorAll('img'))) {
      const src = absolutizeUrl(img.getAttribute('src') || '', baseUrl);
      if (!src || !imageUrlsLikelyMatch(src, normalizedHero, baseUrl)) continue;

      const imgIndex = getDocumentOrderIndex(img, contentDoc.body);
      const appearsBeforeText = firstParaIndex === -1 || imgIndex < firstParaIndex;
      if (!appearsBeforeText) continue;

      // Remove the entire block: prefer figure/image-block/picture, then p, then parent
      let leadBlock = img.closest('figure')
        || img.closest('[data-component="image-block"]')
        || img.closest('picture')
        || img.closest('p');

      // If parent is a bare wrapper with no other meaningful content, remove it too
      if (!leadBlock) {
        const parent = img.parentElement;
        if (parent && parent !== contentDoc.body) {
          const text = normalizeText(parent.textContent);
          const hasOtherMedia = parent.querySelector('img, video, iframe') !== img;
          if (!text && !hasOtherMedia) {
            leadBlock = parent;
          }
        }
      }

      (leadBlock || img).remove();
      // Do NOT break — keep scanning for additional responsive/lazy variants
    }
  }

  removeEmptyContainers(contentDoc.body);
  return contentDoc.body.innerHTML.trim();
}

function pruneDocument(doc) {
  for (const selector of REMOVE_SELECTORS) {
    try {
      doc.querySelectorAll(selector).forEach((el) => el.remove());
    } catch {
      // Ignore invalid selectors for parser edge cases.
    }
  }
}

function normalizeDocument(doc, baseUrl) {
  ensureBaseTag(doc, baseUrl);
  pruneDocument(doc);

  doc.querySelectorAll('a[href]').forEach((anchor) => {
    const href = absolutizeUrl(anchor.getAttribute('href') || '', baseUrl);
    if (href) anchor.setAttribute('href', href);
    else anchor.removeAttribute('href');
  });

  doc.querySelectorAll('img').forEach((img) => {
    const src = normalizeImageSource(img, baseUrl);
    if (!src || isTinyImage(img)) {
      img.remove();
      return;
    }
    img.setAttribute('loading', 'lazy');
  });

  return doc;
}

function extractMetadata(doc, baseUrl) {
  const title = getMetaContent(doc, META_TITLE_SELECTORS)
    || normalizeText(doc.querySelector('h1')?.textContent)
    || normalizeText(doc.title);
  const byline = getMetaContent(doc, META_AUTHOR_SELECTORS)
    || normalizeText(doc.querySelector('[rel="author"]')?.textContent)
    || normalizeText(doc.querySelector('[class*="author" i], [class*="byline" i]')?.textContent);
  const siteName = getMetaContent(doc, META_SITE_NAME_SELECTORS);
  const publishedTime = getPublishedTime(doc);
  const imageUrl = getCandidateImageUrl(doc, baseUrl);

  return {
    title,
    byline,
    siteName,
    publishedTime,
    imageUrl,
  };
}

function getContentImageUrl(contentHtml, baseUrl) {
  if (!contentHtml) return '';
  const contentDoc = parseHtml(`<html><body>${contentHtml}</body></html>`);
  normalizeDocument(contentDoc, baseUrl);
  return getCandidateImageUrl(contentDoc, baseUrl);
}

function buildFallbackArticle(doc, baseUrl, metadata = extractMetadata(doc, baseUrl)) {
  const wrapper = doc.createElement('div');
  const paragraphs = Array.from(doc.querySelectorAll('p'))
    .map((node) => normalizeText(node.textContent))
    .filter((text) => text.length >= MIN_FALLBACK_PARAGRAPH_LENGTH)
    .slice(0, MAX_PARAGRAPHS);

  for (const paragraph of paragraphs) {
    const p = doc.createElement('p');
    p.textContent = paragraph;
    wrapper.append(p);
  }

  const content = wrapper.innerHTML.trim();
  if (!content || normalizeText(wrapper.textContent).length < MIN_CONTENT_LENGTH) {
    return null;
  }

  return {
    title: metadata.title,
    byline: metadata.byline,
    siteName: metadata.siteName,
    publishedTime: metadata.publishedTime,
    imageUrl: metadata.imageUrl,
    content,
  };
}

export function parseArticleHtml(html, baseUrl) {
  const normalizedDoc = normalizeDocument(parseHtml(html), baseUrl);
  const metadata = extractMetadata(normalizedDoc, baseUrl);

  const readabilityDoc = normalizeDocument(parseHtml(html), baseUrl);
  const article = new Readability(readabilityDoc, {
    keepClasses: false,
  }).parse();

  if (article && normalizeText(article.textContent).length >= MIN_CONTENT_LENGTH && normalizeText(article.content).length > 0) {
    const imageUrl = metadata.imageUrl || getContentImageUrl(article.content, baseUrl);
    return {
      title: normalizeText(article.title) || metadata.title,
      byline: normalizeText(article.byline) || metadata.byline,
      siteName: normalizeText(article.siteName) || metadata.siteName,
      publishedTime: normalizeText(article.publishedTime) || metadata.publishedTime,
      imageUrl,
      content: stripDuplicateLeadImage(article.content, baseUrl, imageUrl),
    };
  }

  return buildFallbackArticle(normalizedDoc, baseUrl, metadata);
}

async function getTurndown() {
  if (TurndownService) return new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  try {
    const td = (await import('turndown')).default;
    TurndownService = td;
    return new td({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, POST, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const keyCheck = validateApiKey(req);
  if (keyCheck.required && !keyCheck.valid) {
    return new Response(JSON.stringify({ error: keyCheck.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const rateLimitResponse = await checkRateLimit(req, corsHeaders);
  if (rateLimitResponse) return rateLimitResponse;

  let articleUrl;
  let outputFormat = 'html';
  if (req.method === 'GET') {
    const requestUrl = new URL(req.url);
    articleUrl = requestUrl.searchParams.get('url');
    outputFormat = requestUrl.searchParams.get('format') || 'html';
  } else {
    try {
      const body = await req.json();
      articleUrl = body.url;
      outputFormat = body.format || 'html';
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  if (!['html', 'markdown'].includes(outputFormat)) {
    return new Response(JSON.stringify({ error: 'Invalid format: use html or markdown' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!articleUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    parseFetchableArticleUrl(articleUrl);
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let effectiveUrl = articleUrl;
  let cacheKey = '';
  try {
    if (isGoogleNewsUrl(articleUrl)) {
      try {
        effectiveUrl = await resolveGoogleNewsUrl(articleUrl);
        parseFetchableArticleUrl(effectiveUrl);
      } catch (error) {
        console.error('[fetch-article] Google News resolve failed:', articleUrl, error.message);
        const negKey = `article:v2:${articleUrl}`;
        try { await redisSet(negKey, JSON.stringify('__NEG__'), NEGATIVE_CACHE_TTL); } catch { /* ignore */ }
        return new Response(JSON.stringify({
          error: 'Could not resolve Google News URL',
          url: articleUrl,
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
        });
      }
    }

    cacheKey = `article:v2:${effectiveUrl}`;
    try {
      const cached = await redisGet(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed === '__NEG__') {
          return new Response(JSON.stringify({ error: 'Failed to fetch article', cached: true, url: effectiveUrl }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
          });
        }

        const payload = {
          ...parsed,
          content: outputFormat === 'markdown' && parsed.markdown ? parsed.markdown : parsed.content,
          format: outputFormat,
          cached: true,
        };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
        });
      }
    } catch {
      // Redis unavailable, proceed without shared cache.
    }

    const { response, finalUrl } = await fetchArticleDocument(effectiveUrl);
    effectiveUrl = finalUrl;

    if (!response.ok) {
      try { await redisSet(cacheKey, JSON.stringify('__NEG__'), NEGATIVE_CACHE_TTL); } catch { /* ignore */ }
      return new Response(JSON.stringify({ error: `HTTP ${response.status}`, url: effectiveUrl }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
      });
    }

    const html = await readResponseTextLimited(response);
    const article = parseArticleHtml(html, effectiveUrl);

    if (!article || !article.content || normalizeText(article.content).length < MIN_CONTENT_LENGTH) {
      try { await redisSet(cacheKey, JSON.stringify('__NEG__'), NEGATIVE_CACHE_TTL); } catch { /* ignore */ }
      return new Response(JSON.stringify({ error: 'Could not extract article content', url: effectiveUrl }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
      });
    }

    let markdownContent = null;
    if (outputFormat === 'markdown') {
      const turndown = await getTurndown();
      if (turndown) {
        markdownContent = turndown.turndown(article.content);
      }
    }

    const cacheData = {
      title: article.title || '',
      byline: article.byline || '',
      siteName: article.siteName || '',
      publishedTime: article.publishedTime || '',
      content: article.content,
      markdown: markdownContent,
      imageUrl: article.imageUrl || '',
      url: effectiveUrl,
    };
    try { await redisSet(cacheKey, JSON.stringify(cacheData), ARTICLE_CACHE_TTL); } catch { /* ignore */ }

    const responseData = {
      title: cacheData.title,
      byline: cacheData.byline,
      siteName: cacheData.siteName,
      publishedTime: cacheData.publishedTime,
      content: outputFormat === 'markdown' && markdownContent ? markdownContent : cacheData.content,
      imageUrl: cacheData.imageUrl,
      url: cacheData.url,
      format: outputFormat,
    };

    return new Response(JSON.stringify({ ...responseData, cached: false }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=60, s-maxage=900, stale-while-revalidate=1800',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    console.error('[fetch-article] Error:', effectiveUrl, error.message);

    try {
      if (cacheKey) await redisSet(cacheKey, JSON.stringify('__NEG__'), NEGATIVE_CACHE_TTL);
    } catch {
      // Ignore cache write failures.
    }

    return new Response(JSON.stringify({
      error: isTimeout ? 'Article fetch timeout' : 'Failed to fetch article',
      url: effectiveUrl,
    }), {
      status: isTimeout ? 504 : 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
