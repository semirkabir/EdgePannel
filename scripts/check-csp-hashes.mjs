#!/usr/bin/env node
/**
 * Fails if any inline script in the built site is not allowed by the CSP that
 * will serve it — either the page's own <meta> policy or the `vercel.json`
 * header, both of which are enforced.
 *
 * This exists because the hash list drifted silently: the variant/theme
 * bootstrap in index.html was edited without regenerating its hash, so the
 * browser refused to run it and the saved theme and variant styling stopped
 * applying. Nothing caught it — the page still loads, it just loads wrong, and
 * the only symptom is a console message nobody reads in CI.
 *
 * The <meta> policies are generated at build time by the csp-hashes Vite
 * plugin. `vercel.json` is static, so it is the one that can still fall behind;
 * that is mostly what this checks.
 *
 * Usage: node scripts/check-csp-hashes.mjs [distDir]
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const INLINE_SCRIPT_RE = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g;
const EXECUTABLE_TYPE_RE = /\stype\s*=\s*["']?([^"'\s>]+)/i;
const EXECUTABLE_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript']);

const sha256 = (s) => `sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}`;

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

/** script-src token list from a CSP string, or null if it has no script-src. */
function scriptSrc(csp) {
  const m = csp?.match(/script-src ([^;]*)/);
  return m ? m[1].trim().split(/\s+/) : null;
}

function headerCsp() {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  for (const rule of cfg.headers ?? []) {
    for (const h of rule.headers ?? []) {
      if (h.key?.toLowerCase() === 'content-security-policy') return h.value;
    }
  }
  return null;
}

if (!existsSync(DIST)) {
  console.error(`csp-hashes: ${DIST}/ not found — run the build first.`);
  process.exit(1);
}

const files = htmlFiles(DIST);

// Web deploys are always the 'full' variant — hostname detection picks the
// variant at runtime. A variant build is a desktop (Tauri) bundle, which Vercel
// never serves, so holding it to vercel.json's header would be a false alarm.
// html-variant marks those by hardcoding the variant into the bootstrap.
const isVariantBuild = files.some((f) =>
  /v='(happy|tech|finance|commodity|conflicts)';document\.documentElement\.dataset\.variant/.test(
    readFileSync(f, 'utf8'),
  ),
);
const header = isVariantBuild ? null : scriptSrc(headerCsp());
if (isVariantBuild) {
  console.log('csp-hashes: variant build detected — checking meta CSP only (vercel.json does not serve it).');
}

const problems = [];
let checked = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const metaCsp = html.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/)?.[1];
  const meta = scriptSrc(metaCsp);

  for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT_RE)) {
    const type = attrs.match(EXECUTABLE_TYPE_RE)?.[1]?.toLowerCase() ?? '';
    if (!EXECUTABLE_TYPES.has(type)) continue; // ld+json is data, not script
    checked++;

    const hash = sha256(body);
    // A hash or nonce in script-src makes browsers ignore 'unsafe-inline', so
    // it only counts when the policy declares no hashes at all.
    const allows = (tokens) => {
      if (!tokens) return true; // no policy from this source
      if (!tokens.some((t) => /^'sha(256|384|512)-/.test(t))) {
        return tokens.includes("'unsafe-inline'");
      }
      return tokens.includes(`'${hash}'`);
    };

    const where = relative(process.cwd(), file);
    if (!allows(meta)) problems.push(`${where}: meta CSP blocks ${hash}`);
    if (!allows(header)) problems.push(`${where}: vercel.json header blocks ${hash}`);
  }
}

if (problems.length > 0) {
  console.error(`csp-hashes: ${problems.length} inline script(s) would be blocked:\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`\nFix: add the hash to script-src in vercel.json (the <meta> list is generated`);
  console.error(`by scripts/vite-plugins/csp-hashes.ts and should not need editing).`);
  process.exit(1);
}

const against = isVariantBuild ? 'meta CSP' : 'both meta and vercel.json header CSP';
console.log(`csp-hashes: ${checked} inline script(s) allowed by ${against}.`);
