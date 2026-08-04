import { expect, test } from '@playwright/test';

/**
 * Live aircraft tracking: dead-reckoned glide and follow-mode camera lock.
 *
 * Guards the two defects this feature was built to fix:
 *  - icons were drawn at the reported position of a fix that was already
 *    5–60s old, and froze once extrapolation hit its 25s cap while fixes
 *    arrive every 60–120s;
 *  - "following" eased the camera once per poll, so the map lurched every
 *    minute instead of staying attached to the aircraft.
 */

type HarnessAircraft = {
  icao24: string;
  callsign?: string;
  lat: number;
  lon: number;
  trackDeg?: number;
  groundSpeedKts?: number;
  observedSecondsAgo?: number;
};

type HarnessWindow = Window & {
  __mapHarness?: {
    ready: boolean;
    setLayersForSnapshot: (enabledLayers: string[]) => void;
    setCamera: (camera: { lon: number; lat: number; zoom: number }) => void;
    seedAircraft: (aircraft: HarnessAircraft[]) => void;
    getAircraftScreenPoint: (icao24: string) => { x: number; y: number } | null;
    getAircraftGeoPosition: (icao24: string) => { lat: number; lon: number } | null;
    getMapCenter: () => { lat: number; lon: number; zoom: number } | null;
    followAircraft: (icao24: string) => void;
    unfollowAircraft: () => void;
    getFollowedAircraft: () => string | null;
    tickFollowCamera: () => void;
    simulateUserPan: () => void;
  };
};

const KNOTS_TO_MS = 0.514444;
const METERS_PER_DEGREE_LAT = 111_320;

const TEST_HEX = 'aa1111';
const TEST_LAT = 51.47;
const TEST_LON = -0.28;
const TEST_SPEED_KTS = 450;

/** Metres per degree of longitude at the test latitude. */
const METERS_PER_DEGREE_LON = METERS_PER_DEGREE_LAT * Math.cos((TEST_LAT * Math.PI) / 180);

const gotoHarness = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.goto('/tests/map-harness.html');
  await expect(page.locator('.deckgl-map-wrapper')).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => Boolean((window as HarnessWindow).__mapHarness?.ready)), {
      timeout: 45000,
    })
    .toBe(true);
};

/** Seed a single eastbound aircraft with the flights layer on. */
const seedTracked = async (
  page: import('@playwright/test').Page,
  observedSecondsAgo = 0,
): Promise<void> => {
  await page.evaluate(
    ({ hex, lat, lon, kts, age }) => {
      const harness = (window as HarnessWindow).__mapHarness;
      if (!harness) throw new Error('map harness unavailable');
      harness.setLayersForSnapshot(['flights']);
      harness.setCamera({ lat: 0, lon: 0, zoom: 5 });
      harness.seedAircraft([
        {
          icao24: hex,
          callsign: 'TEST01',
          lat,
          lon,
          trackDeg: 90, // due east — keeps assertions one-dimensional
          groundSpeedKts: kts,
          observedSecondsAgo: age,
        },
      ]);
    },
    { hex: TEST_HEX, lat: TEST_LAT, lon: TEST_LON, kts: TEST_SPEED_KTS, age: observedSecondsAgo },
  );
};

test.describe('live aircraft tracking', () => {
  test.describe.configure({ retries: 1 });

  test('draws a stale fix where the aircraft is now, not where it was reported', async ({ page }) => {
    await gotoHarness(page);
    await seedTracked(page, 30);

    const drawn = await page.evaluate((hex) => {
      return (window as HarnessWindow).__mapHarness?.getAircraftGeoPosition(hex) ?? null;
    }, TEST_HEX);

    expect(drawn).not.toBeNull();
    const catchUpMeters = (drawn!.lon - TEST_LON) * METERS_PER_DEGREE_LON;
    const expected = TEST_SPEED_KTS * KNOTS_TO_MS * 30;

    // Within 2% — the icon leads the raw fix by the report age.
    expect(Math.abs(catchUpMeters - expected)).toBeLessThan(expected * 0.02);
  });

  test('keeps gliding at ground speed instead of freezing between fixes', async ({ page }) => {
    await gotoHarness(page);
    await seedTracked(page);

    const samples = await page.evaluate(
      async ({ hex, metersPerDegreeLon }) => {
        const harness = (window as HarnessWindow).__mapHarness;
        if (!harness) throw new Error('map harness unavailable');
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const readings: Array<{ dtSec: number; metersPerSecond: number }> = [];
        let previous = { t: performance.now(), lon: harness.getAircraftGeoPosition(hex)!.lon };

        for (let i = 0; i < 4; i++) {
          await wait(700);
          const t = performance.now();
          const position = harness.getAircraftGeoPosition(hex);
          if (!position) break;
          const dtSec = (t - previous.t) / 1000;
          readings.push({
            dtSec,
            metersPerSecond: ((position.lon - previous.lon) * metersPerDegreeLon) / dtSec,
          });
          previous = { t, lon: position.lon };
        }
        return readings;
      },
      { hex: TEST_HEX, metersPerDegreeLon: METERS_PER_DEGREE_LON },
    );

    const expectedMps = TEST_SPEED_KTS * KNOTS_TO_MS;
    expect(samples.length).toBeGreaterThanOrEqual(3);
    for (const sample of samples) {
      // Never stalls, and never runs fast — the old model did both.
      expect(Math.abs(sample.metersPerSecond - expectedMps)).toBeLessThan(expectedMps * 0.05);
    }
  });

  test('pins the followed aircraft to the centre of the viewport', async ({ page }) => {
    await gotoHarness(page);
    await seedTracked(page);

    const result = await page.evaluate(
      async ({ hex }) => {
        const harness = (window as HarnessWindow).__mapHarness;
        if (!harness) throw new Error('map harness unavailable');
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        harness.followAircraft(hex);

        const screenPoints: Array<{ x: number; y: number }> = [];
        const centerLons: number[] = [];
        for (let i = 0; i < 4; i++) {
          harness.tickFollowCamera();
          const point = harness.getAircraftScreenPoint(hex);
          const center = harness.getMapCenter();
          if (point) screenPoints.push(point);
          if (center) centerLons.push(center.lon);
          await wait(500);
        }
        return { screenPoints, centerLons, followed: harness.getFollowedAircraft() };
      },
      { hex: TEST_HEX },
    );

    expect(result.followed).toBe(TEST_HEX);
    expect(result.screenPoints.length).toBeGreaterThanOrEqual(3);

    const viewport = page.viewportSize();
    const centreX = (viewport?.width ?? 1280) / 2;
    const centreY = (viewport?.height ?? 720) / 2;

    for (const point of result.screenPoints) {
      // Sub-pixel: the icon is stationary on screen while the basemap slides.
      expect(Math.abs(point.x - centreX)).toBeLessThan(1);
      expect(Math.abs(point.y - centreY)).toBeLessThan(1);
    }

    // ...and the camera really is chasing the aircraft eastward.
    const firstLon = result.centerLons[0]!;
    const lastLon = result.centerLons[result.centerLons.length - 1]!;
    expect(lastLon).toBeGreaterThan(firstLon);
  });

  test('holds the tracked aircraft when a viewport fetch comes back empty', async ({ page }) => {
    await gotoHarness(page);
    await seedTracked(page);

    const result = await page.evaluate((hex) => {
      const harness = (window as HarnessWindow).__mapHarness;
      if (!harness) throw new Error('map harness unavailable');
      harness.followAircraft(hex);
      harness.seedAircraft([]); // a poll that returned nothing
      return {
        stillDrawn: Boolean(harness.getAircraftGeoPosition(hex)),
        stillFollowing: harness.getFollowedAircraft(),
      };
    }, TEST_HEX);

    expect(result.stillDrawn).toBe(true);
    expect(result.stillFollowing).toBe(TEST_HEX);
  });

  test('releases the lock on a user pan but not on its own camera moves', async ({ page }) => {
    await gotoHarness(page);
    await seedTracked(page);

    const result = await page.evaluate((hex) => {
      const harness = (window as HarnessWindow).__mapHarness;
      if (!harness) throw new Error('map harness unavailable');
      harness.followAircraft(hex);

      harness.tickFollowCamera();
      harness.tickFollowCamera();
      const afterOwnMoves = harness.getFollowedAircraft();

      harness.simulateUserPan();
      return { afterOwnMoves, afterUserPan: harness.getFollowedAircraft() };
    }, TEST_HEX);

    expect(result.afterOwnMoves).toBe(TEST_HEX);
    expect(result.afterUserPan).toBeNull();
  });

  test('shows and clears the follow HUD', async ({ page }) => {
    await gotoHarness(page);
    await seedTracked(page);

    const hud = page.locator('.aircraft-follow-hud');
    await expect(hud).toHaveCount(0);

    await page.evaluate((hex) => {
      (window as HarnessWindow).__mapHarness?.followAircraft(hex);
    }, TEST_HEX);

    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Following');
    await expect(hud).toContainText('TEST01');

    await hud.locator('.aircraft-follow-hud-exit').click();
    await expect(hud).toHaveCount(0);

    const followed = await page.evaluate(() => {
      return (window as HarnessWindow).__mapHarness?.getFollowedAircraft() ?? null;
    });
    expect(followed).toBeNull();
  });
});
