import './styles/base-layer.css';
import './styles/happy-theme.css';
import './styles/cursors.css';
import { enqueueSentryCall, installPreInitErrorQueue, scheduleSentryInit } from '@/bootstrap/sentry-defer';
import { inject } from '@vercel/analytics';
import { App } from './App';
import { initCustomSelects } from '@/utils/custom-select';
import { initTooltips } from '@/utils/tooltip';
import { installCursorDiagnostics } from '@/utils/cursor-diagnostics';
import { installForcedCursor } from '@/utils/forced-cursor';

// Buffer errors that fire before the deferred Sentry SDK loads.
installPreInitErrorQueue();

// Schedule deferred Sentry init off the critical path (~81 KiB / ~1.96 s blocked main-thread).
void scheduleSentryInit();

// Suppress NotAllowedError from YouTube IFrame API's internal play() — browser autoplay policy,
// not actionable. The YT IFrame API doesn't expose the play() promise so it leaks as unhandled.
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.name === 'NotAllowedError') e.preventDefault();
});

import { debugGetCells, getCellCount } from '@/services/geo-convergence';
import { initMetaTags } from '@/services/meta-tags';
import { installRuntimeFetchPatch, installWebApiRedirect, isDesktopRuntime } from '@/services/runtime';
import { loadDesktopSecrets } from '@/services/runtime-config';
import { applyStoredTheme } from '@/utils/theme-manager';
import { SITE_VARIANT } from '@/config/variant';
import { clearChunkReloadGuard, installChunkReloadGuard } from '@/bootstrap/chunk-reload';
import { onAuthChange, isFirebaseConfigured } from '@/services/firebase-auth';
import { onUserLogin, onUserLogout } from '@/services/preferences-sync';

const FONT_STYLESHEETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Tajawal:wght@200;300;400;500;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Playfair+Display:wght@700;900&family=Montserrat:wght@800;900&family=Poppins:wght@300;400;500;600&display=swap',
];

function loadDeferredFontStylesheets(): void {
  for (const href of FONT_STYLESHEETS) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.fontSheet = 'google';
    document.head.appendChild(link);
  }
}

function scheduleDeferredFontStylesheets(): void {
  requestAnimationFrame(() => requestAnimationFrame(loadDeferredFontStylesheets));
}

// Auto-reload on stale chunk 404s after deployment (Vite fires this for modulepreload failures).
const chunkReloadStorageKey = installChunkReloadGuard(__APP_VERSION__);

// Initialize Vercel Analytics
inject();

// Initialize dynamic meta tags for sharing
initMetaTags();

// In desktop mode, route /api/* calls to the local Tauri sidecar backend.
installRuntimeFetchPatch();
// In web production, route RPC calls through api.edgepannel.app (Cloudflare edge).
installWebApiRedirect();
loadDesktopSecrets().catch(() => {});

// Apply stored theme preference before app initialization (safety net for inline script)
applyStoredTheme();

// Keep first paint off the Google Fonts CSS path; load font faces immediately after.
scheduleDeferredFontStylesheets();

// Cloud preferences sync — TradingView-style session persistence.
// Only active when Firebase auth is configured (not in anonymous/local-only mode).
if (isFirebaseConfigured()) {
  let prevUid: string | null = null;
  onAuthChange((user) => {
    if (user) {
      if (user.uid !== prevUid) {
        prevUid = user.uid;
        void onUserLogin();
      }
    } else {
      prevUid = null;
      onUserLogout();
    }
  });
}

// Initialize custom selects early so dropdowns are ready before heavy app init
initCustomSelects();
// Replace browser-default title tooltips with styled custom tooltips site-wide
initTooltips();

// Set data-variant on <html> so CSS theme overrides activate
document.documentElement.dataset.buildTarget = __APP_BUILD_TARGET__;
if (isDesktopRuntime()) {
  document.documentElement.dataset.runtime = 'desktop';
}

if (SITE_VARIANT && SITE_VARIANT !== 'full') {
  document.documentElement.dataset.variant = SITE_VARIANT;

  // Swap favicons to variant-specific versions before browser finishes fetching defaults
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(link => {
    link.href = link.href
      .replace(/\/favico\/favicon/g, `/favico/${SITE_VARIANT}/favicon`)
      .replace(/\/favico\/apple-touch-icon/g, `/favico/${SITE_VARIANT}/apple-touch-icon`);
  });
}

// Remove no-transition class after first paint to enable smooth theme transitions
requestAnimationFrame(() => {
  document.documentElement.classList.remove('no-transition');
});

// Clear stale settings-open flag (survives ungraceful shutdown)
localStorage.removeItem('wm-settings-open');

// CSP violation reporting via deferred Sentry
document.addEventListener('securitypolicyviolation', (e) => {
  enqueueSentryCall((s) => s.captureMessage(`CSP violation: ${e.blockedURI}`, {
    level: 'warning',
    tags: { directive: e.violatedDirective, uri: e.blockedURI },
  }));
});

// Standalone windows: ?settings=1 = panel display settings, ?live-channels=1 = channel management
// Both need i18n initialized so t() does not return undefined.
const urlParams = new URL(location.href).searchParams;
if (urlParams.get('settings') === '1') {
  void Promise.all([import('./services/i18n'), import('./settings-window')]).then(
    async ([i18n, m]) => {
      await i18n.initI18n();
      m.initSettingsWindow();
    }
  );
} else if (urlParams.get('live-channels') === '1') {
  void Promise.all([import('./services/i18n'), import('./live-channels-window')]).then(
    async ([i18n, m]) => {
      await i18n.initI18n();
      m.initLiveChannelsWindow();
    }
  );
} else {
  const app = new App('app');
  app
    .init()
    .then(() => {
      clearChunkReloadGuard(chunkReloadStorageKey);
    })
    .catch(console.error);
}

// Debug helpers for geo-convergence testing (development only)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).geoDebug = {
    cells: debugGetCells,
    count: getCellCount,
  };
}

// Beta mode toggle: type `beta=true` / `beta=false` in console
Object.defineProperty(window, 'beta', {
  get() {
    const on = localStorage.getItem('worldmonitor-beta-mode') === 'true';
    console.log(`[Beta] ${on ? 'ON' : 'OFF'}`);
    return on;
  },
  set(v: boolean) {
    if (v) localStorage.setItem('worldmonitor-beta-mode', 'true');
    else localStorage.removeItem('worldmonitor-beta-mode');
    location.reload();
  },
});

// Suppress native WKWebView context menu in Tauri — allows custom JS context menus
if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    // Allow native menu on text inputs/textareas for copy/paste
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    e.preventDefault();
  });
}

if (!('__TAURI_INTERNALS__' in window) && !('__TAURI__' in window) && 'serviceWorker' in navigator && import.meta.env.PROD) {
  // Auto-reload when a new SW takes control (fixes stale HTML after deploys)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[PWA] Service worker registered');
      const swUpdateInterval = setInterval(async () => {
        if (!navigator.onLine) return;
        try { await registration.update(); } catch {}
      }, 5 * 60 * 1000);
      (window as unknown as Record<string, unknown>).__swUpdateInterval = swUpdateInterval;
    })
    .catch((err) => {
      console.warn('[PWA] Service worker registration failed:', err);
    });
}

installCursorDiagnostics();
installForcedCursor();
