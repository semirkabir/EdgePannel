#!/usr/bin/env node
/**
 * Generates the static /docs portal into public/docs/.
 *
 * Inputs (all already in the repo — nothing here is hand-authored prose):
 *   - docs/*.md            curated guide pages (explicit allowlist, see PAGES)
 *   - docs/api/*.json      27 OpenAPI specs -> service + per-endpoint reference
 *   - CHANGELOG.md         release history
 *
 * Output lands in public/docs/, which Vite copies verbatim into dist/. The
 * directory is gitignored: it is regenerated on every build so the published
 * docs can never drift from the specs they describe.
 *
 * Page layout uses <dir>/index.html so URLs stay extensionless (/docs/architecture/).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'public/docs');
const SITE = 'https://edgepannel.com';
const API_HOST = 'https://api.edgepannel.com';

/**
 * Explicit allowlist — deliberately NOT a glob over docs/.
 * docs/internal/, docs/plans/, and operational notes must never be published,
 * and a glob would pick them up the moment someone adds a file.
 */
const PAGES = [
  { file: 'DOCUMENTATION.md', slug: 'overview', title: 'Platform Overview', group: 'Getting Started',
    blurb: 'What EdgePannel is, the variant system, and the panel/layer catalogue.' },
  { file: 'ARCHITECTURE.md', slug: 'architecture', title: 'Architecture', group: 'Architecture',
    blurb: 'System design, caching tiers, bootstrap hydration, and edge functions.' },
  { file: 'MAP_ENGINE.md', slug: 'map-engine', title: 'Map Engine', group: 'Architecture',
    blurb: 'MapLibre GL + deck.gl rendering, layer stack, and clustering.' },
  { file: 'MAPS_AND_GEOCODING.md', slug: 'maps-and-geocoding', title: 'Maps & Geocoding', group: 'Architecture',
    blurb: 'Basemap assets, country geometry, and geocoding services.' },
  { file: 'ALGORITHMS.md', slug: 'algorithms', title: 'Algorithms & Scoring', group: 'Intelligence',
    blurb: 'Scoring formulas, detection algorithms, and classification pipelines.' },
  { file: 'AI_INTELLIGENCE.md', slug: 'ai-intelligence', title: 'AI Intelligence', group: 'Intelligence',
    blurb: 'LLM fallback chain, RAG, threat classification, and deduction.' },
  { file: 'DATA_SOURCES.md', slug: 'data-sources', title: 'Data Sources', group: 'Intelligence',
    blurb: 'Every feed, its cadence, tier, and fallback order.' },
  { file: 'FINANCE_DATA.md', slug: 'finance-data', title: 'Finance Data', group: 'Intelligence',
    blurb: 'Market radar, Gulf FDI, stablecoins, BIS, and WTO coverage.' },
  { file: 'ADDING_ENDPOINTS.md', slug: 'adding-endpoints', title: 'Adding Endpoints', group: 'API',
    blurb: 'Add a proto-first RPC and regenerate typed clients and servers.' },
  { file: 'API_KEY_DEPLOYMENT.md', slug: 'api-keys', title: 'API Keys & Deployment', group: 'API',
    blurb: 'Provisioning keys and wiring them through the deployment.' },
  { file: 'CORS.md', slug: 'cors', title: 'CORS', group: 'API',
    blurb: 'Cross-origin rules and the allowlist model.' },
  { file: 'DESKTOP_APP.md', slug: 'desktop-app', title: 'Desktop App', group: 'Deployment',
    blurb: 'Tauri architecture, the Rust sidecar, and secret management.' },
  { file: 'RELAY_PARAMETERS.md', slug: 'relay-parameters', title: 'Relay Parameters', group: 'Deployment',
    blurb: 'Environment variables for the RSS/AIS relay.' },
];

const GROUP_ORDER = ['Getting Started', 'Architecture', 'Intelligence', 'API', 'Deployment', 'Release'];

// ── helpers ────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function write(relPath, content) {
  const full = join(OUT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Strip markdown to a plain-text blob for the search index. */
function plain(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── markdown rendering ─────────────────────────────────────────────────────
const headings = [];
const renderer = new marked.Renderer();

renderer.heading = function ({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  const raw = text.replace(/<[^>]*>/g, '');
  const id = slugify(raw);
  if (depth === 2 || depth === 3) headings.push({ id, text: raw, depth });
  const anchor = depth <= 3 ? `<a class="d-anchor" href="#${id}" aria-label="Link to ${esc(raw)}">#</a>` : '';
  return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`;
};

// Wrap tables so wide ones scroll inside the column instead of the page.
renderer.table = function (token) {
  const header = `<tr>${token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('')}</tr>`;
  const rows = token.rows
    .map((row) => `<tr>${row.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="d-table-wrap"><table><thead>${header}</thead><tbody>${rows}</tbody></table></div>\n`;
};

/**
 * Rewrite in-repo markdown links to their published docs URL. Anything we do
 * not publish falls back to the GitHub blob so no link silently 404s.
 */
function rewriteLinks(html) {
  const bySource = new Map(PAGES.map((p) => [p.file, p.slug]));
  return html.replace(/href="([^"]+)"/g, (match, href) => {
    if (/^(https?:|#|mailto:)/.test(href)) return match;
    const clean = href.replace(/^\.\//, '').replace(/^\.\.\//, '');
    const [path, hash = ''] = clean.split('#');
    const name = basename(path);
    if (bySource.has(name)) return `href="/docs/${bySource.get(name)}/${hash ? '#' + hash : ''}"`;
    if (name === 'README.md') return 'href="/docs/"';
    if (path.startsWith('api/') || path === 'api' || path === 'api/') return `href="/docs/api-reference/"`;
    // Unpublished internal docs have no public URL now the source is proprietary,
    // so the link is dropped rather than pointed at a repo nobody can read.
    if (name.endsWith('.md')) return 'href="/docs/"';
    return match;
  });
}

function renderMarkdown(md) {
  headings.length = 0;
  const html = marked.parse(md, { renderer, async: false, gfm: true, breaks: false });
  return { html: rewriteLinks(html), toc: headings.slice() };
}

// ── page shell ─────────────────────────────────────────────────────────────
function sidebar(currentSlug, services) {
  const groups = new Map();
  for (const g of GROUP_ORDER) groups.set(g, []);
  groups.get('Getting Started').unshift({ slug: '', title: 'Introduction' });
  for (const p of PAGES) groups.get(p.group).push({ slug: p.slug, title: p.title });
  groups.get('Release').push({ slug: 'changelog', title: 'Changelog' });

  let out = '';
  for (const [group, items] of groups) {
    if (!items.length) continue;
    out += `<div class="d-side-group"><p class="d-side-title">${esc(group)}</p>`;
    for (const item of items) {
      const href = item.slug ? `/docs/${item.slug}/` : '/docs/';
      const cls = item.slug === currentSlug ? ' class="is-current"' : '';
      out += `<a href="${href}"${cls}>${esc(item.title)}</a>`;
    }
    // The API reference is a tree, so it hangs under the API group.
    if (group === 'API') {
      const open = currentSlug.startsWith('api-reference') ? ' open' : '';
      out += `<details${open}><summary>API Reference<span class="d-side-count">${services.reduce((n, s) => n + s.operations.length, 0)}</span></summary><div class="d-side-sub">`;
      out += `<a href="/docs/api-reference/"${currentSlug === 'api-reference' ? ' class="is-current"' : ''}>All services</a>`;
      for (const svc of services) {
        const cls = currentSlug === `api-reference/${svc.slug}` ? ' class="is-current"' : '';
        out += `<a href="/docs/api-reference/${svc.slug}/"${cls}>${esc(svc.label)}<span class="d-side-count">${svc.operations.length}</span></a>`;
      }
      out += `</div></details>`;
    }
    out += `</div>`;
  }
  return out;
}

function layout({ title, description, slug, crumb, body, toc = [], services, canonical }) {
  const tocHtml = toc.length
    ? `<aside class="d-toc"><p class="d-toc-title">On this page</p>${toc
        .map((h) => `<a class="${h.depth === 3 ? 'd-toc-h3' : ''}" href="#${h.id}">${esc(h.text)}</a>`)
        .join('')}</aside>`
    : '<aside class="d-toc"></aside>';

  return `<!DOCTYPE html>
<html lang="en" data-docs-base="/docs/">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} | EdgePannel Docs</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta name="theme-color" content="#04080a" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="EdgePannel Docs" />
<meta property="og:title" content="${esc(title)} | EdgePannel Docs" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${SITE}/favico/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favico/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/favico/favicon-32x32.png" />
<link rel="apple-touch-icon" href="/favico/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;550;650;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/docs/docs.css" />
<script defer src="/docs/docs.js"></script>
</head>
<body>
<a class="d-skip" href="#main">Skip to content</a>
<header class="d-top">
  <button class="d-burger" id="d-burger" aria-label="Toggle navigation" aria-expanded="false" aria-controls="d-side">☰</button>
  <a class="d-brand" href="/docs/">
    <img src="/docs/edgepannel-logo.png" alt="EdgePannel" height="26" width="129" />
    <span class="d-brand-tag">docs</span>
  </a>
  <div class="d-search">
    <input id="d-search-input" type="search" placeholder="Search docs…  /" autocomplete="off" aria-label="Search documentation" />
    <div class="d-search-results" id="d-search-results" role="listbox" aria-label="Search results"></div>
  </div>
  <nav class="d-top-links" aria-label="Site">
    <a href="/">Home</a>
    <a href="/pricing">Pricing</a>
    <a href="/docs/api-reference/">API</a>
    <a href="/app">Dashboard →</a>
  </nav>
</header>
<div class="d-shell">
  <nav class="d-side" id="d-side" aria-label="Documentation">${sidebar(slug, services)}</nav>
  <main class="d-main" id="main">
    ${crumb ? `<nav class="d-crumb" aria-label="Breadcrumb">${crumb}</nav>` : ''}
    <div class="d-body">${body}</div>
    <footer class="d-foot">
      <span>© 2026 EdgePannel</span>
      <a href="/terms">Terms</a>
      <a href="/docs/llms.txt">llms.txt</a>
      <a href="/docs/changelog/">Changelog</a>
    </footer>
  </main>
  ${tocHtml}
</div>
</body>
</html>`;
}

// ── OpenAPI → reference pages ──────────────────────────────────────────────
function typeOf(schema, spec) {
  if (!schema) return 'any';
  if (schema.$ref) return schema.$ref.replace('#/components/schemas/', '');
  if (schema.type === 'array') return `${typeOf(schema.items, spec)}[]`;
  if (schema.format && schema.type) return `${schema.type}<${schema.format}>`;
  return schema.type || 'object';
}

function resolveRef(ref, spec) {
  if (!ref || !ref.startsWith('#/components/schemas/')) return null;
  return spec.components?.schemas?.[ref.replace('#/components/schemas/', '')] || null;
}

/** Render a schema's top-level fields as a table; nested objects link to their own section. */
function schemaTable(schema, spec, seen = new Set()) {
  let resolved = schema;
  if (schema?.$ref) {
    const name = schema.$ref.replace('#/components/schemas/', '');
    if (seen.has(name)) return `<p class="d-type">${esc(name)} (recursive)</p>`;
    seen.add(name);
    resolved = resolveRef(schema.$ref, spec);
  }
  if (!resolved) return '';
  if (resolved.type === 'array') return schemaTable(resolved.items, spec, seen);
  const props = resolved.properties;
  if (!props || !Object.keys(props).length) return '';
  const required = new Set(resolved.required || []);
  const rows = Object.entries(props)
    .map(([name, prop]) => {
      const desc = prop.description || (prop.$ref ? `See ${typeOf(prop, spec)}.` : '');
      return `<tr><td class="d-schema-name">${esc(name)}${required.has(name) ? ' <span class="d-pill d-pill-req">required</span>' : ''}</td><td class="d-type">${esc(typeOf(prop, spec))}</td><td>${esc(desc)}</td></tr>`;
    })
    .join('');
  return `<div class="d-table-wrap"><table><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/**
 * A copy-pasteable example. Required query params get a placeholder; optional
 * ones are left off entirely rather than emitted as empty `?a=&b=` pairs,
 * which would not actually run.
 */
function curlFor(method, path, params) {
  const required = (params || []).filter((p) => p.in === 'query' && p.required);
  const query = required.map((p) => `${p.name}=VALUE`).join('&');
  const url = `${API_HOST}${path}${query ? `?${query}` : ''}`;
  if (method === 'get') return `curl -s '${url}'`;
  return `curl -s -X ${method.toUpperCase()} '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{}'`;
}

function loadServices() {
  const dir = resolve(ROOT, 'docs/api');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.openapi.json'))
    .map((file) => {
      const spec = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const name = file.replace('.openapi.json', '');
      const operations = [];
      for (const [path, item] of Object.entries(spec.paths || {})) {
        for (const [method, op] of Object.entries(item)) {
          if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
          const id = op.operationId || `${method}-${path}`;
          operations.push({
            id,
            slug: slugify(id),
            method,
            path,
            summary: op.summary || id,
            description: op.description || '',
            parameters: op.parameters || [],
            requestBody: op.requestBody,
            responses: op.responses || {},
          });
        }
      }
      operations.sort((a, b) => a.id.localeCompare(b.id));
      return { name, slug: slugify(name), label: name.replace(/Service$/, ''), spec, operations };
    })
    .filter((s) => s.operations.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function endpointPage(svc, op, services, searchIndex) {
  const url = `${SITE}/docs/api-reference/${svc.slug}/${op.slug}/`;
  const params = op.parameters.filter((p) => p.in === 'query' || p.in === 'path');
  const okSchema = op.responses?.['200']?.content?.['application/json']?.schema;

  let body = `<h1>${esc(op.id)}</h1>`;
  body += `<p>${esc(op.description || op.summary)}</p>`;
  body += `<div class="d-endpoint"><span class="d-method d-method-${op.method}">${op.method}</span><span class="d-endpoint-path">${esc(op.path)}</span></div>`;

  if (params.length) {
    const rows = params
      .map((p) => `<tr><td class="d-schema-name">${esc(p.name)}${p.required ? ' <span class="d-pill d-pill-req">required</span>' : ''}</td><td class="d-type">${esc(typeOf(p.schema, svc.spec))}</td><td>${esc(p.description || '')}</td></tr>`)
      .join('');
    body += `<h2 id="parameters">Parameters<a class="d-anchor" href="#parameters">#</a></h2>`;
    body += `<div class="d-table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  const reqSchema = op.requestBody?.content?.['application/json']?.schema;
  if (reqSchema) {
    const table = schemaTable(reqSchema, svc.spec);
    if (table) {
      body += `<h2 id="request-body">Request body<a class="d-anchor" href="#request-body">#</a></h2>${table}`;
    }
  }

  body += `<h2 id="example">Example<a class="d-anchor" href="#example">#</a></h2>`;
  body += `<pre><code>${esc(curlFor(op.method, op.path, op.parameters))}</code></pre>`;
  body += `<div class="d-note">Call <code>api.edgepannel.com</code> rather than <code>edgepannel.com</code> — the primary domain requires browser origin headers.</div>`;

  if (okSchema) {
    const table = schemaTable(okSchema, svc.spec);
    body += `<h2 id="response">Response<a class="d-anchor" href="#response">#</a></h2>`;
    body += `<p><code>200</code> — <span class="d-type">${esc(typeOf(okSchema, svc.spec))}</span></p>`;
    body += table || '';
  }

  const errors = Object.entries(op.responses).filter(([code]) => code !== '200');
  if (errors.length) {
    const rows = errors
      .map(([code, r]) => `<tr><td class="d-schema-name">${esc(code)}</td><td>${esc(r.description || '')}</td></tr>`)
      .join('');
    body += `<h2 id="errors">Errors<a class="d-anchor" href="#errors">#</a></h2>`;
    body += `<div class="d-table-wrap"><table><thead><tr><th>Status</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  const toc = [
    params.length && { id: 'parameters', text: 'Parameters', depth: 2 },
    reqSchema && { id: 'request-body', text: 'Request body', depth: 2 },
    { id: 'example', text: 'Example', depth: 2 },
    okSchema && { id: 'response', text: 'Response', depth: 2 },
    errors.length && { id: 'errors', text: 'Errors', depth: 2 },
  ].filter(Boolean);

  searchIndex.push({
    t: op.id,
    u: `/docs/api-reference/${svc.slug}/${op.slug}/`,
    s: `${svc.label} · ${op.method.toUpperCase()} ${op.path}`,
    d: plain(`${op.summary} ${op.description}`).slice(0, 400),
  });

  write(`api-reference/${svc.slug}/${op.slug}/index.html`, layout({
    title: op.id,
    description: (op.description || op.summary).slice(0, 180),
    slug: `api-reference/${svc.slug}`,
    canonical: url,
    crumb: `<a href="/docs/">Docs</a> / <a href="/docs/api-reference/">API</a> / <a href="/docs/api-reference/${svc.slug}/">${esc(svc.label)}</a> / ${esc(op.id)}`,
    body,
    toc,
    services,
  }));

  return url;
}

// ── main ───────────────────────────────────────────────────────────────────
function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const services = loadServices();
  const searchIndex = [];
  const urls = [];
  const totalOps = services.reduce((n, s) => n + s.operations.length, 0);

  // Static assets. These pages live under public/ and are copied verbatim by
  // Vite, so they never get its asset-hashing pass — every URL they reference
  // must resolve on its own. That is why the logo is copied in here rather than
  // linked at /src/assets/... the way the Vite-processed marketing pages do.
  for (const asset of ['docs.css', 'docs.js']) {
    copyFileSync(resolve(__dirname, 'docs-assets', asset), join(OUT, asset));
  }
  copyFileSync(resolve(ROOT, 'src/assets/edgepannel-logo.png'), join(OUT, 'edgepannel-logo.png'));

  // ── Introduction ────────────────────────────────────────────────────────
  const introBody = `
<h1>EdgePannel Documentation</h1>
<p>EdgePannel is a real-time global intelligence dashboard — AI-powered news aggregation, geopolitical monitoring, and infrastructure tracking in one situational-awareness interface. A single codebase builds six specialised variants.</p>
<h2 id="start">Start here<a class="d-anchor" href="#start">#</a></h2>
<div class="d-cards">
  <a class="d-card" href="/docs/overview/"><div class="d-card-title">Platform Overview</div><div class="d-card-desc">Variants, panels, and the map-layer catalogue.</div></a>
  <a class="d-card" href="/docs/architecture/"><div class="d-card-title">Architecture</div><div class="d-card-desc">Design principles, caching tiers, and data flow.</div></a>
  <a class="d-card" href="/docs/api-reference/"><div class="d-card-title">API Reference</div><div class="d-card-desc">${totalOps} endpoints across ${services.length} services.</div></a>
  <a class="d-card" href="/docs/data-sources/"><div class="d-card-title">Data Sources</div><div class="d-card-desc">Every feed, its cadence, and fallback order.</div></a>
</div>
<h2 id="quickstart">Quickstart<a class="d-anchor" href="#quickstart">#</a></h2>
<p>Every data endpoint is reachable without a browser:</p>
<pre><code>curl -s '${API_HOST}/api/seismology/v1/list-earthquakes'</code></pre>
<div class="d-note">Use <code>api.edgepannel.com</code>, not <code>edgepannel.com</code> — the primary domain requires browser origin headers.</div>
<p>The dashboard itself runs at <a href="/app">/app</a> — no install required.</p>
<h2 id="agents">For agents<a class="d-anchor" href="#agents">#</a></h2>
<p>Every page in this portal is also served as raw Markdown at the same path with a <code>.md</code> suffix, and <a href="/docs/llms.txt">/docs/llms.txt</a> indexes the whole site for automated consumption.</p>
<h2 id="license">License<a class="d-anchor" href="#license">#</a></h2>
<p>EdgePannel is proprietary software offered as a hosted service. The scoring
methodology is published in full so results stay auditable, but no right to the
source code is granted. See the <a href="/terms">Terms of Service</a>.</p>`;

  write('index.html', layout({
    title: 'Introduction',
    description: `EdgePannel documentation — architecture, data sources, and an API reference covering ${totalOps} endpoints across ${services.length} services.`,
    slug: '',
    canonical: `${SITE}/docs/`,
    crumb: '',
    body: introBody,
    toc: [
      { id: 'start', text: 'Start here', depth: 2 },
      { id: 'quickstart', text: 'Quickstart', depth: 2 },
      { id: 'agents', text: 'For agents', depth: 2 },
      { id: 'license', text: 'License', depth: 2 },
    ],
    services,
  }));
  urls.push(`${SITE}/docs/`);
  searchIndex.push({ t: 'Introduction', u: '/docs/', s: 'Getting Started', d: plain(introBody).slice(0, 400) });

  // ── Guide pages from markdown ───────────────────────────────────────────
  for (const page of PAGES) {
    const src = resolve(ROOT, 'docs', page.file);
    if (!existsSync(src)) {
      console.warn(`[docs] skipping missing ${page.file}`);
      continue;
    }
    const md = readFileSync(src, 'utf8');
    const { html, toc } = renderMarkdown(md);
    const url = `${SITE}/docs/${page.slug}/`;

    write(`${page.slug}/index.html`, layout({
      title: page.title,
      description: page.blurb,
      slug: page.slug,
      canonical: url,
      crumb: `<a href="/docs/">Docs</a> / ${esc(page.title)}`,
      body: html,
      toc,
      services,
    }));
    // Raw markdown passthrough, mirroring the reference site's .md endpoints.
    write(`${page.slug}.md`, md);

    urls.push(url);
    searchIndex.push({ t: page.title, u: `/docs/${page.slug}/`, s: page.group, d: plain(md).slice(0, 600) });
    for (const h of toc) {
      searchIndex.push({ t: h.text, u: `/docs/${page.slug}/#${h.id}`, s: page.title, d: '' });
    }
  }

  // ── Changelog ───────────────────────────────────────────────────────────
  const changelogMd = readFileSync(resolve(ROOT, 'CHANGELOG.md'), 'utf8');
  const { html: clHtml, toc: clToc } = renderMarkdown(changelogMd);
  write('changelog/index.html', layout({
    title: 'Changelog',
    description: 'Notable changes to EdgePannel, by release.',
    slug: 'changelog',
    canonical: `${SITE}/docs/changelog/`,
    crumb: `<a href="/docs/">Docs</a> / Changelog`,
    body: clHtml,
    toc: clToc.slice(0, 40),
    services,
  }));
  write('changelog.md', changelogMd);
  urls.push(`${SITE}/docs/changelog/`);
  searchIndex.push({ t: 'Changelog', u: '/docs/changelog/', s: 'Release', d: plain(changelogMd).slice(0, 600) });

  // ── API reference ───────────────────────────────────────────────────────
  const svcCards = services
    .map((s) => `<a class="d-card" href="/docs/api-reference/${s.slug}/"><div class="d-card-title">${esc(s.label)}</div><div class="d-card-desc">${esc(s.operations[0]?.description || s.operations[0]?.summary || '').slice(0, 110)}</div><div class="d-card-meta">${s.operations.length} endpoint${s.operations.length === 1 ? '' : 's'}</div></a>`)
    .join('');

  write('api-reference/index.html', layout({
    title: 'API Reference',
    description: `${totalOps} REST endpoints across ${services.length} EdgePannel services, generated from the OpenAPI contracts.`,
    slug: 'api-reference',
    canonical: `${SITE}/docs/api-reference/`,
    crumb: `<a href="/docs/">Docs</a> / API Reference`,
    body: `<h1>API Reference</h1>
<p>${totalOps} endpoints across ${services.length} services. Every route is defined proto-first, so this reference is generated directly from the OpenAPI contracts — it cannot drift from the running API.</p>
<div class="d-endpoint"><span class="d-method d-method-get">base</span><span class="d-endpoint-path">${API_HOST}</span></div>
<div class="d-note">Use <code>api.edgepannel.com</code>, not <code>edgepannel.com</code> — the primary domain requires browser origin headers. Read-only RPCs accept <code>GET</code> with query parameters; all routes also accept <code>POST</code> with a JSON body.</div>
<h2 id="services">Services<a class="d-anchor" href="#services">#</a></h2>
<div class="d-cards">${svcCards}</div>
<h2 id="specs">OpenAPI specifications<a class="d-anchor" href="#specs">#</a></h2>
<p>Machine-readable OpenAPI specs for every service are available to API customers on request — importable straight into Postman, Insomnia, or an SDK generator.</p>`,
    toc: [
      { id: 'services', text: 'Services', depth: 2 },
      { id: 'specs', text: 'OpenAPI specifications', depth: 2 },
    ],
    services,
  }));
  urls.push(`${SITE}/docs/api-reference/`);
  searchIndex.push({ t: 'API Reference', u: '/docs/api-reference/', s: 'API', d: `${totalOps} endpoints across ${services.length} services` });

  for (const svc of services) {
    const rows = svc.operations
      .map((op) => `<li><a href="/docs/api-reference/${svc.slug}/${op.slug}/"><span class="d-method d-method-${op.method}">${op.method}</span><span class="d-op-name">${esc(op.id)}</span><span class="d-op-desc">${esc((op.description || op.summary).slice(0, 90))}</span></a></li>`)
      .join('');

    write(`api-reference/${svc.slug}/index.html`, layout({
      title: `${svc.label} Service`,
      description: `${svc.operations.length} endpoints in the EdgePannel ${svc.label} service.`,
      slug: `api-reference/${svc.slug}`,
      canonical: `${SITE}/docs/api-reference/${svc.slug}/`,
      crumb: `<a href="/docs/">Docs</a> / <a href="/docs/api-reference/">API</a> / ${esc(svc.label)}`,
      body: `<h1>${esc(svc.label)} Service</h1>
<p>${svc.operations.length} endpoint${svc.operations.length === 1 ? '' : 's'}. Spec: <code>${esc(svc.name)}.openapi.json</code></p>
<h2 id="endpoints">Endpoints<a class="d-anchor" href="#endpoints">#</a></h2>
<ul class="d-op-list">${rows}</ul>`,
      toc: [{ id: 'endpoints', text: 'Endpoints', depth: 2 }],
      services,
    }));
    urls.push(`${SITE}/docs/api-reference/${svc.slug}/`);
    searchIndex.push({
      t: `${svc.label} Service`,
      u: `/docs/api-reference/${svc.slug}/`,
      s: 'API Reference',
      d: svc.operations.map((o) => o.id).join(' '),
    });

    for (const op of svc.operations) urls.push(endpointPage(svc, op, services, searchIndex));
  }

  // ── search index ────────────────────────────────────────────────────────
  write('search-index.json', JSON.stringify(searchIndex));

  // ── llms.txt (agent-readable index) ─────────────────────────────────────
  let llms = `# EdgePannel Documentation\n\n`;
  llms += `> Real-time global intelligence dashboard. This index lists every documentation page; each is also available as raw Markdown at the same path with a .md suffix.\n\n`;
  llms += `## Guides\n\n`;
  llms += `- [Introduction](${SITE}/docs/): Start here — quickstart, API basics, and license\n`;
  for (const page of PAGES) {
    if (!existsSync(resolve(ROOT, 'docs', page.file))) continue;
    llms += `- [${page.title}](${SITE}/docs/${page.slug}/): ${page.blurb}\n`;
  }
  llms += `- [Changelog](${SITE}/docs/changelog/): Notable changes by release\n`;
  llms += `\n## API Reference\n\n`;
  llms += `- [All services](${SITE}/docs/api-reference/): ${totalOps} endpoints across ${services.length} services\n`;
  for (const svc of services) {
    llms += `\n### ${svc.label}\n\n`;
    for (const op of svc.operations) {
      const desc = (op.description || op.summary).replace(/\s+/g, ' ').slice(0, 110);
      llms += `- [${op.id}](${SITE}/docs/api-reference/${svc.slug}/${op.slug}/): ${op.method.toUpperCase()} ${op.path} — ${desc}\n`;
    }
  }
  llms += `\n## OpenAPI Specifications\n\n`;
  for (const svc of services) {
    llms += `- ${svc.name}.openapi.yaml (available to API customers on request)\n`;
  }
  write('llms.txt', llms);

  // ── sitemap (referenced from robots.txt) ────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`)
    .join('\n')}\n</urlset>\n`;
  write('sitemap.xml', sitemap);

  console.log(`[docs] ${urls.length} pages · ${services.length} services · ${totalOps} endpoints · ${searchIndex.length} search entries → public/docs/`);
}

main();
