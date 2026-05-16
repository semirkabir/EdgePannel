const colorCache = new Map<string, string>();
let cacheSignature = '';

/**
 * Read a CSS custom property value from the document root.
 * Caches values per active appearance signature so theme, text-tone, and
 * accent changes all refresh dependent service colors.
 * @param varName CSS variable name including -- prefix (e.g., '--semantic-critical')
 * @returns The computed color value string
 */
export function getCSSColor(varName: string): string {
  const root = document.documentElement;
  const currentSignature = [
    root.dataset.theme || 'dark',
    root.dataset.textTone || 'default',
    root.dataset.accentColor || 'indigo',
  ].join('|');
  if (currentSignature !== cacheSignature) {
    colorCache.clear();
    cacheSignature = currentSignature;
  }
  const cached = colorCache.get(varName);
  if (cached) return cached;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName).trim();
  colorCache.set(varName, value);
  return value;
}

/**
 * Invalidate the color cache. Call when theme changes to ensure
 * next getCSSColor() reads reflect the new theme.
 */
export function invalidateColorCache(): void {
  colorCache.clear();
  cacheSignature = '';
}
