import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Real RustGIS output: 20 km viewshed from a 30 m mast at Zaporizhzhia NPP
// (Copernicus GLO-90), captured by src-tauri/sidecar/rustgis-terrain.mjs.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/terrain-viewshed-znpp.json', import.meta.url), 'utf8'));

type Harness = {
  ready: boolean;
  setAnalysisOverlay: (id: string, overlay: unknown) => void;
  getDeckLayerSnapshot: () => Array<{ id: string; dataCount: number }>;
};

test('agent terrain viewshed renders as a deck.gl overlay and clears', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tests/map-harness.html');
  await page.waitForFunction(() => Boolean((window as unknown as { __mapHarness?: Harness }).__mapHarness?.ready), null, { timeout: 30_000 });

  const ids = () => page.evaluate(() => (window as unknown as { __mapHarness: Harness }).__mapHarness.getDeckLayerSnapshot().map(l => l.id));
  expect(await ids()).not.toContain('analysis-overlay-terrain');

  await page.evaluate(overlay => (window as unknown as { __mapHarness: Harness }).__mapHarness.setAnalysisOverlay('terrain', overlay), fixture.overlay);
  const snapshot = await page.evaluate(() => (window as unknown as { __mapHarness: Harness }).__mapHarness.getDeckLayerSnapshot());
  const layer = snapshot.find(l => l.id === 'analysis-overlay-terrain');
  expect(layer, 'overlay layer built').toBeTruthy();
  expect(layer?.dataCount).toBeGreaterThan(0);
  // Drawn on top of every other layer.
  expect(snapshot[snapshot.length - 1]?.id).toBe('analysis-overlay-terrain');

  await page.evaluate(() => (window as unknown as { __mapHarness: Harness }).__mapHarness.setAnalysisOverlay('terrain', null));
  expect(await ids()).not.toContain('analysis-overlay-terrain');
  expect(errors).toEqual([]);
});
