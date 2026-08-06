import type { Plugin } from 'vite';
import type { VariantMeta } from '../../src/config/variant-meta';

export interface HtmlVariantPluginOptions {
  activeMeta: VariantMeta;
  activeVariant: string;
  isDesktopBuild: boolean;
}

export function htmlVariantPlugin(options: HtmlVariantPluginOptions): Plugin {
  const { activeMeta, activeVariant, isDesktopBuild } = options;
  return {
    name: 'html-variant',
    transformIndexHtml(html) {
      // Marketing pages own their own static meta tags — never variant-rewritten.
      //
      // Detected from the document itself rather than a hardcoded filename list.
      // The list silently missed every page added after it was written: privacy,
      // terms and contact shipped with their title, description, canonical and
      // all og/twitter tags overwritten by the generic dashboard meta, which is
      // invisible in source and only shows up in the built output. Keying off
      // the marker the shell already sets means a new marketing page is exempt
      // the moment it uses the standard shell.
      if (/<html[^>]*\sdata-page="landing"/.test(html)) return html;
      let result = html
        .replace(/<title>.*?<\/title>/, `<title>${activeMeta.title}</title>`)
        .replace(/<meta name="title" content=".*?" \/>/, `<meta name="title" content="${activeMeta.title}" />`)
        .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${activeMeta.description}" />`)
        .replace(/<meta name="keywords" content=".*?" \/>/, `<meta name="keywords" content="${activeMeta.keywords}" />`)
        .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${activeMeta.url}" />`)
        .replace(/<meta name="application-name" content=".*?" \/>/, `<meta name="application-name" content="${activeMeta.siteName}" />`)
        .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${activeMeta.url}" />`)
        .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${activeMeta.title}" />`)
        .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${activeMeta.description}" />`)
        .replace(/<meta property="og:site_name" content=".*?" \/>/, `<meta property="og:site_name" content="${activeMeta.siteName}" />`)
        .replace(/<meta name="subject" content=".*?" \/>/, `<meta name="subject" content="${activeMeta.subject}" />`)
        .replace(/<meta name="classification" content=".*?" \/>/, `<meta name="classification" content="${activeMeta.classification}" />`)
        .replace(/<meta name="twitter:url" content=".*?" \/>/, `<meta name="twitter:url" content="${activeMeta.url}" />`)
        .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${activeMeta.title}" />`)
        .replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${activeMeta.description}" />`)
        .replace(/"name": "EdgePannel"/, `"name": "${activeMeta.siteName}"`)
        .replace(/"alternateName": "EdgePannel"/, `"alternateName": "${activeMeta.siteName.replace(' ', '')}"`)
        .replace(/"url": "https:\/\/edgepannel\.com\/"/, `"url": "${activeMeta.url}"`)
        .replace(/"description": "Real-time global intelligence dashboard with live news, markets, military tracking, infrastructure monitoring, and geopolitical data."/, `"description": "${activeMeta.description}"`)
        .replace(/"featureList": \[[\s\S]*?\]/, `"featureList": ${JSON.stringify(activeMeta.features, null, 8).replace(/\n/g, '\n      ')}`);

      // Theme-color meta — warm cream for happy variant
      if (activeVariant === 'happy') {
        result = result.replace(
          /<meta name="theme-color" content=".*?" \/>/,
          '<meta name="theme-color" content="#FAFAF5" />'
        );
      }

      // Desktop builds: inject build-time variant into the inline script so data-variant is set
      // before CSS loads. Web builds always use 'full' — runtime hostname detection handles variants.
      if (activeVariant !== 'full') {
        result = result.replace(
          /if\(v\)document\.documentElement\.dataset\.variant=v;/,
          `v='${activeVariant}';document.documentElement.dataset.variant=v;`
        );
      }

      // Desktop CSP: inject localhost wildcard for dynamic sidecar port.
      // Web builds intentionally exclude localhost to avoid exposing attack surface.
      if (isDesktopBuild) {
        result = result
          .replace(
            /connect-src 'self' https: http:\/\/localhost:5173/,
            "connect-src 'self' https: http://localhost:5173 http://127.0.0.1:*"
          )
          .replace(
            /frame-src 'self'/,
            "frame-src 'self' http://127.0.0.1:*"
          );
      }

      // Desktop builds: replace favicon paths with variant-specific subdirectory.
      // Web builds use 'full' favicons in HTML; runtime JS swaps them per hostname.
      if (activeVariant !== 'full') {
        result = result
          .replace(/\/favico\/favicon/g, `/favico/${activeVariant}/favicon`)
          .replace(/\/favico\/apple-touch-icon/g, `/favico/${activeVariant}/apple-touch-icon`)
          .replace(/\/favico\/android-chrome/g, `/favico/${activeVariant}/android-chrome`)
          .replace(/\/favico\/og-image/g, `/favico/${activeVariant}/og-image`);
      }

      // Dev: strip CSP meta tag — Vite injects inline HMR scripts whose
      // hashes change on every cache rebuild, causing CSP violations.
      // Production CSP is enforced via server headers (vercel.json).
      if (process.env.NODE_ENV !== 'production') {
        result = result.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/?>/, '');
      }

      return result;
    },
  };
}
