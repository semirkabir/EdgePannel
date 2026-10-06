import { expect, test } from '@playwright/test';

/** Phase 7: light theme parity for the design-system token layer. */

function luminance([r, g, b]: number[]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}

function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

test.describe('light theme (full variant)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('worldmonitor-variant', 'full');
      localStorage.setItem('worldmonitor-theme', 'light');
      localStorage.removeItem('wm-settings-open');
    });
    await page.goto('/');
    await page.waitForSelector('#headerThemeToggle', { state: 'attached', timeout: 30000 });
  });

  test('light theme applies design-system tokens', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return { bg: cs.getPropertyValue('--bg').trim(), accent: cs.getPropertyValue('--accent').trim() };
    });
    expect(tokens.bg.toLowerCase()).toBe('#f7f7f8');
    expect(tokens.accent.toLowerCase()).toBe('#d9480f');
  });

  test('body text and secondary tokens meet contrast on the light background', async ({ page }) => {
    const colors = await page.evaluate(() => {
      const probe = (value: string): number[] => {
        const el = document.createElement('div');
        el.style.color = value;
        document.body.appendChild(el);
        const m = getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number);
        el.remove();
        return m.slice(0, 3);
      };
      const root = getComputedStyle(document.documentElement);
      const tok = (n: string) => root.getPropertyValue(n).trim();
      return {
        bodyColor: getComputedStyle(document.body).color.match(/[\d.]+/g)!.map(Number).slice(0, 3),
        bg: probe(tok('--bg')),
        surface: probe(tok('--surface')),
        text: probe(tok('--text')),
        textSecondary: probe(tok('--text-secondary')),
        textDim: probe(tok('--text-dim')),
        textFaint: probe(tok('--text-faint')),
        accent: probe(tok('--accent')),
      };
    });
    expect(contrast(colors.bodyColor, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.text, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.text, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textSecondary, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textDim, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textFaint, colors.bg)).toBeGreaterThanOrEqual(4.5);
    // Accent is the fixed ember brand colour (#d9480f), used for fills/icons/large text: WCAG non-text 3:1 applies.
    expect(contrast(colors.accent, colors.surface)).toBeGreaterThanOrEqual(3);
  });

  test('filled active controls and channel tabs meet 4.5:1', async ({ page }) => {
    await page.waitForSelector('.time-btn.active', { state: 'attached', timeout: 30000 });
    const pairs = await page.evaluate(() => {
      const rgb = (c: string): number[] => {
        const m = c.match(/[\d.]+/g)!.map(Number);
        return c.startsWith('color(') ? m.slice(0, 3).map((v) => v * 255) : m.slice(0, 3);
      };
      return ['.time-btn.active', '.map-dim-btn.active', '.live-channel-btn.active'].flatMap((sel) => {
        const el = document.querySelector(sel);
        if (!el) return [];
        const cs = getComputedStyle(el);
        return [{ sel, fg: rgb(cs.color), bg: rgb(cs.backgroundColor) }];
      });
    });
    expect(pairs.length).toBeGreaterThan(0);
    for (const { sel, fg, bg } of pairs) {
      expect(contrast(fg, bg), sel).toBeGreaterThanOrEqual(4.5);
    }
  });
});
