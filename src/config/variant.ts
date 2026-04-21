// SITE_VARIANT is injected at build time via Vite define.
// For web builds, runtime detection still works via the fallback below.
// The build-time constant enables tree-shaking of dead variant code.
const buildTimeVariant: string = (globalThis as Record<string, unknown>).SITE_VARIANT as string || 'full';

export const SITE_VARIANT: string = (() => {
  if (typeof window === 'undefined') return buildTimeVariant;

  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  if (isTauri) {
    const stored = localStorage.getItem('worldmonitor-variant');
    if (stored === 'tech' || stored === 'full' || stored === 'finance' || stored === 'happy' || stored === 'commodity' || stored === 'conflicts') return stored;
    return buildTimeVariant;
  }

  const h = location.hostname;
  if (h.startsWith('tech.')) return 'tech';
  if (h.startsWith('finance.')) return 'finance';
  if (h.startsWith('happy.')) return 'happy';
  if (h.startsWith('commodity.')) return 'commodity';
  if (h.startsWith('conflicts.')) return 'conflicts';

  if (h === 'localhost' || h === '127.0.0.1') {
    const stored = localStorage.getItem('worldmonitor-variant');
    if (stored === 'tech' || stored === 'full' || stored === 'finance' || stored === 'happy' || stored === 'commodity' || stored === 'conflicts') return stored;
    return buildTimeVariant;
  }

  return buildTimeVariant;
})();
