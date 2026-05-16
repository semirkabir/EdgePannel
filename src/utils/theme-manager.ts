import { invalidateColorCache } from './theme-colors';
import { setUnifiedThemeForMode, type MapColorMode } from '@/config/basemap';

export type Theme = 'dark' | 'light';
export type ThemePreference = 'auto' | 'dark' | 'light';
export type FontPreference = 'inter' | 'theme' | 'article' | 'poppins';
export type AccentColor = 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'zinc';
export type TextTonePreference = 'default' | 'terminal';

const STORAGE_KEY = 'worldmonitor-theme';
const FONT_STORAGE_KEY = 'worldmonitor-font-preference';
const ACCENT_STORAGE_KEY = 'worldmonitor-accent-color';
const TEXT_TONE_STORAGE_KEY = 'worldmonitor-text-tone';
const DEFAULT_THEME: Theme = 'dark';
const DEFAULT_FONT: FontPreference = 'inter';
const DEFAULT_ACCENT: AccentColor = 'indigo';
const DEFAULT_TEXT_TONE: TextTonePreference = 'default';

/**
 * Read the stored theme preference from localStorage.
 * Returns 'dark' or 'light' if valid, otherwise DEFAULT_THEME.
 */
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage unavailable (e.g., sandboxed iframe, private browsing)
  }
  return DEFAULT_THEME;
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'auto' || stored === 'dark' || stored === 'light') return stored;
  } catch { /* noop */ }
  return 'auto';
}

export function getFontPreference(): FontPreference {
  try {
    const stored = localStorage.getItem(FONT_STORAGE_KEY);
    if (stored === 'inter' || stored === 'theme' || stored === 'article' || stored === 'poppins') return stored;
  } catch { /* noop */ }
  return DEFAULT_FONT;
}

export function getAccentColor(): AccentColor {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored === 'indigo' || stored === 'emerald' || stored === 'amber' || stored === 'sky' || stored === 'rose' || stored === 'zinc') {
      return stored as AccentColor;
    }
  } catch { /* noop */ }
  return DEFAULT_ACCENT;
}

export function getTextTonePreference(): TextTonePreference {
  try {
    const stored = localStorage.getItem(TEXT_TONE_STORAGE_KEY);
    if (stored === 'default' || stored === 'terminal') return stored;
  } catch { /* noop */ }
  return DEFAULT_TEXT_TONE;
}

function applyAccentColor(accent: AccentColor): void {
  if (accent === 'indigo') {
    document.documentElement.removeAttribute('data-accent-color');
  } else {
    document.documentElement.dataset.accentColor = accent;
  }
}

export function setAccentColor(accent: AccentColor): void {
  try { localStorage.setItem(ACCENT_STORAGE_KEY, accent); } catch { /* noop */ }
  applyAccentColor(accent);
  window.dispatchEvent(new CustomEvent('accent-changed', { detail: { accent } }));
}

function applyTextTonePreference(pref: TextTonePreference): void {
  if (pref === 'default') {
    document.documentElement.removeAttribute('data-text-tone');
  } else {
    document.documentElement.dataset.textTone = pref;
  }
  invalidateColorCache();
  window.dispatchEvent(new CustomEvent('text-tone-changed', { detail: { textTonePreference: pref } }));
}

export function setTextTonePreference(pref: TextTonePreference): void {
  try { localStorage.setItem(TEXT_TONE_STORAGE_KEY, pref); } catch { /* noop */ }
  applyTextTonePreference(pref);
}

function resolveAutoTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

let autoMediaQuery: MediaQueryList | null = null;
let autoMediaHandler: (() => void) | null = null;

function teardownAutoListener(): void {
  if (autoMediaQuery && autoMediaHandler) {
    autoMediaQuery.removeEventListener('change', autoMediaHandler);
    autoMediaQuery = null;
    autoMediaHandler = null;
  }
}

export function setThemePreference(pref: ThemePreference): void {
  try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* noop */ }
  teardownAutoListener();
  const effective: Theme = pref === 'auto' ? resolveAutoTheme() : pref;
  setTheme(effective);
  if (pref === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
    autoMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    autoMediaHandler = () => setTheme(resolveAutoTheme());
    autoMediaQuery.addEventListener('change', autoMediaHandler);
  }
}

function applyFontPreference(pref: FontPreference): void {
  document.documentElement.dataset.fontPreference = pref;
  window.dispatchEvent(new CustomEvent('font-changed', { detail: { fontPreference: pref } }));
}

export function setFontPreference(pref: FontPreference): void {
  try { localStorage.setItem(FONT_STORAGE_KEY, pref); } catch { /* noop */ }
  applyFontPreference(pref);
}

/**
 * Read the current theme from the document root's data-theme attribute.
 */
export function getCurrentTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  if (value === 'dark' || value === 'light') return value;
  return DEFAULT_THEME;
}

/**
 * Set the active theme: update DOM attribute, invalidate color cache,
 * persist to localStorage, update meta theme-color, and dispatch event.
 */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  invalidateColorCache();
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    const variant = document.documentElement.dataset.variant;
    meta.content = theme === 'dark' ? '#0a0f0a' : (variant === 'happy' ? '#FAFAF5' : '#f8f9fa');
  }
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
}

export function setThemeWithLinkedMap(theme: Theme): void {
  const nextMapTheme = setUnifiedThemeForMode(theme as MapColorMode);
  window.dispatchEvent(new CustomEvent('map-theme-changed', { detail: { theme: nextMapTheme } }));
  setTheme(theme);
}

/**
 * Apply the stored theme preference to the document before components mount.
 * Only sets the data-theme attribute and meta theme-color — does NOT dispatch
 * events or invalidate the color cache (components aren't mounted yet).
 *
 * The inline script in index.html already handles the fast FOUC-free path.
 * This is a safety net for cases where the inline script didn't run.
 */
export function applyStoredTheme(): void {
  const variant = document.documentElement.dataset.variant;

  // Check raw localStorage to distinguish "no preference" from "explicitly chose dark"
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* noop */ }
  const hasExplicitPreference = raw === 'dark' || raw === 'light' || raw === 'auto';

  let effective: Theme;
  if (raw === 'auto') {
    effective = resolveAutoTheme();
  } else if (hasExplicitPreference) {
    effective = raw as Theme;
  } else {
    effective = DEFAULT_THEME;
  }

  document.documentElement.dataset.theme = effective;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    if (effective === 'dark') {
      meta.content = '#0a0f0a';
    } else {
      meta.content = variant === 'happy' ? '#FAFAF5' : '#f8f9fa';
    }
  }
  applyFontPreference(getFontPreference());
  applyAccentColor(getAccentColor());
  applyTextTonePreference(getTextTonePreference());
}
