import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/**
 * Recomputes the `script-src` sha256 allowlist in each page's CSP meta tag from
 * the inline scripts actually present in the emitted HTML.
 *
 * The list used to be maintained by hand, and it drifted: the variant/theme
 * bootstrap in index.html was edited without regenerating its hash, so the
 * browser refused to execute it. That script sets `data-variant`, `data-theme`
 * and `data-accent-color` on <html> before CSS loads, so with it blocked the
 * saved theme and variant styling never applied and the page flashed.
 *
 * Hand-maintenance could not have kept working anyway: html-variant rewrites
 * the bootstrap per variant, so every variant build produces a different hash.
 * Six hashes were declared and five were dead versions of that same script.
 *
 * Runs with `order: 'post'` so it sees the final HTML, after html-variant has
 * done its rewrites.
 *
 * Only executable scripts are hashed. `application/ld+json` is data, not script,
 * and is not subject to script-src.
 */

const INLINE_SCRIPT_RE = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g;
const EXECUTABLE_TYPE_RE = /\stype\s*=\s*["']?([^"'\s>]+)/i;
const EXECUTABLE_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript']);

export function sha256Csp(source: string): string {
  return `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;
}

/** Hashes of every inline executable script in an HTML document, in order. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT_RE)) {
    const type = attrs.match(EXECUTABLE_TYPE_RE)?.[1]?.toLowerCase() ?? '';
    if (!EXECUTABLE_TYPES.has(type)) continue;
    const hash = sha256Csp(body);
    if (!hashes.includes(hash)) hashes.push(hash);
  }
  return hashes;
}

export function cspHashPlugin(): Plugin {
  return {
    name: 'csp-hashes',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Dev strips the CSP meta entirely (html-variant does this because Vite's
        // inline HMR scripts change hash on every rebuild), so there is nothing
        // to rewrite and no policy to keep in sync.
        if (!/http-equiv="Content-Security-Policy"/.test(html)) return html;

        const hashes = inlineScriptHashes(html);
        if (hashes.length === 0) return html;

        return html.replace(/(content="[^"]*?script-src )([^;"]*)/, (whole, prefix: string, value: string) => {
          // Drop every existing sha256 entry, keep the rest of the directive
          // ('self', 'wasm-unsafe-eval', host allowlists) exactly as authored.
          const kept = value
            .split(/\s+/)
            .filter((token) => token && !/^'sha(256|384|512)-/.test(token));
          // A hash in script-src makes browsers ignore 'unsafe-inline'. Pages
          // that opted into 'unsafe-inline' instead of hashes keep working only
          // if we leave them alone.
          if (kept.includes("'unsafe-inline'")) return whole;
          const selfIndex = kept.indexOf("'self'");
          const insertAt = selfIndex >= 0 ? selfIndex + 1 : 0;
          kept.splice(insertAt, 0, ...hashes.map((h) => `'${h}'`));
          return prefix + kept.join(' ');
        });
      },
    },
  };
}
