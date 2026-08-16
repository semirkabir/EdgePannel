import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  timeController,
  filterByTimeWindow,
  describeTimeWindow,
} from '../src/services/time-controller.ts';
import {
  formatDurationShort,
  getTimeRangeTimelineMs,
  getTimeRangeWindowMs,
  normalizeAbsoluteRange,
  TIMELINE_CONTEXT_FACTOR,
} from '../src/utils/time-range.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The controller lazily touches `localStorage`; in Node there isn't one, so
 * stand up a minimal shim for the tests that persist an absolute range.
 */
function installLocalStorage(): void {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
}

describe('timeController windows', () => {
  beforeEach(() => {
    installLocalStorage();
    timeController.reset();
  });

  afterEach(() => {
    timeController.reset();
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('leaves a rolling preset open-ended so future-dated items survive', () => {
    timeController.setRange('6h');
    const { start, end } = timeController.getWindow();
    assert.equal(end, Infinity);
    assert.ok(Math.abs(Date.now() - 6 * HOUR - start) < 2000);
  });

  it('filters nothing under the "all" preset', () => {
    timeController.setRange('all');
    const { start, end } = timeController.getWindow();
    assert.equal(start, -Infinity);
    assert.equal(end, Infinity);

    const items = [{ at: 0 }, { at: Date.now() }, { at: Date.now() + DAY }];
    assert.equal(filterByTimeWindow(items, (item) => item.at).length, 3);
  });

  it('pins both ends for an absolute range', () => {
    const start = Date.parse('2026-08-10T00:00:00Z');
    const end = Date.parse('2026-08-11T00:00:00Z');
    assert.equal(timeController.setAbsoluteRange({ start, end }), true);

    assert.deepEqual(timeController.getWindow(), { start, end });
    assert.equal(timeController.getMode(), 'absolute');
  });

  it('rejects an absolute range shorter than a minute and keeps the old window', () => {
    timeController.setRange('24h');
    const before = timeController.getWindow();
    const now = Date.now();
    assert.equal(timeController.setAbsoluteRange({ start: now, end: now + 1000 }), false);
    assert.equal(timeController.getWindow().end, before.end);
    assert.equal(timeController.getMode(), 'preset');
  });

  it('normalises a reversed absolute range', () => {
    const start = Date.parse('2026-08-11T00:00:00Z');
    const end = Date.parse('2026-08-10T00:00:00Z');
    timeController.setAbsoluteRange({ start, end });
    const window = timeController.getWindow();
    assert.ok(window.start < window.end);
    assert.equal(window.start, end);
  });

  it('drops back to the preset when the absolute range is cleared', () => {
    timeController.setRange('1h');
    timeController.setAbsoluteRange({ start: Date.now() - DAY, end: Date.now() - HOUR });
    assert.equal(timeController.getMode(), 'absolute');

    timeController.setAbsoluteRange(null);
    assert.equal(timeController.getMode(), 'preset');
    assert.equal(timeController.getWindow().end, Infinity);
  });

  it('draws more context than the preset selects', () => {
    timeController.setRange('24h');
    const { timeline, window } = timeController.getSnapshot();
    assert.equal(timeline.end - timeline.start, 24 * HOUR * TIMELINE_CONTEXT_FACTOR);
    // The selection sits at the recent end of that wider band.
    assert.ok(window.start > timeline.start);
  });

  it('frames a pinned range so the brush has room on both sides', () => {
    const start = Date.parse('2026-08-01T00:00:00Z');
    const end = Date.parse('2026-08-02T00:00:00Z');
    timeController.setAbsoluteRange({ start, end });

    const { timeline, window } = timeController.getSnapshot();
    assert.ok(timeline.start < window.start);
    assert.ok(timeline.end > window.end);
  });

  it('dragging the brush narrows the selection but not the axis', () => {
    timeController.setRange('24h');
    const axis = timeController.getSnapshot().timeline;

    // Two successive drags, as a real pointer drag would produce.
    timeController.setWindowFromTimeline(axis.start + 4 * HOUR, axis.end - 4 * HOUR);
    timeController.setWindowFromTimeline(axis.start + 8 * HOUR, axis.end - 8 * HOUR);

    const after = timeController.getSnapshot();
    assert.deepEqual(after.timeline, axis);
    // …and the window can be widened back out to the full axis.
    timeController.setWindowFromTimeline(axis.start, axis.end);
    assert.deepEqual(timeController.getWindow(), { start: axis.start, end: axis.end });
  });

  it('switching back to a preset restores a live, preset-sized axis', () => {
    timeController.setAbsoluteRange({
      start: Date.parse('2020-01-01T00:00:00Z'),
      end: Date.parse('2020-01-02T00:00:00Z'),
    });
    timeController.setRange('6h');

    const { timeline } = timeController.getSnapshot();
    assert.equal(timeline.end - timeline.start, 6 * HOUR * TIMELINE_CONTEXT_FACTOR);
    assert.ok(Math.abs(timeline.end - Date.now()) < 2000);
  });

  it('initRange seeds the preset without discarding a pinned window', () => {
    const start = Date.parse('2026-08-01T00:00:00Z');
    const end = Date.parse('2026-08-02T00:00:00Z');
    timeController.setAbsoluteRange({ start, end });

    // What a map constructor does on boot — it must not wipe the pinned window.
    timeController.initRange('7d');

    assert.equal(timeController.getMode(), 'absolute');
    assert.deepEqual(timeController.getWindow(), { start, end });
    assert.equal(timeController.getRange(), '7d');
  });

  it('gives the "all" preset a finite axis even though it filters nothing', () => {
    assert.ok(Number.isFinite(getTimeRangeTimelineMs('all')));
    assert.equal(getTimeRangeWindowMs('all'), Infinity);
  });
});

describe('timeController playback', () => {
  beforeEach(() => {
    installLocalStorage();
    timeController.reset();
  });

  afterEach(() => {
    timeController.reset();
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('seeking parks a fixed-width window at the cursor', () => {
    const start = Date.parse('2026-08-01T00:00:00Z');
    const end = Date.parse('2026-08-09T00:00:00Z');
    timeController.setAbsoluteRange({ start, end });

    const width = timeController.getPlaybackWindowMs();
    timeController.seek(start + 3 * DAY);

    const window = timeController.getWindow();
    assert.equal(window.end - window.start, width);
    assert.equal(window.end, start + 3 * DAY);
    assert.equal(timeController.getMode(), 'playback');
  });

  it('clamps the cursor to the timeline', () => {
    const start = Date.parse('2026-08-01T00:00:00Z');
    const end = Date.parse('2026-08-09T00:00:00Z');
    timeController.setAbsoluteRange({ start, end });
    const width = timeController.getPlaybackWindowMs();
    // The axis is padded around the pinned range, so playback can run past it.
    const timeline = timeController.getSnapshot().timeline;
    assert.ok(timeline.start < start && timeline.end > end);

    timeController.seek(start - 10 * DAY);
    assert.equal(timeController.getWindow().end, timeline.start + width);

    timeController.seek(end + 10 * DAY);
    assert.equal(timeController.getWindow().end, timeline.end);
  });

  it('steps by one window width', () => {
    const start = Date.parse('2026-08-01T00:00:00Z');
    const end = Date.parse('2026-08-09T00:00:00Z');
    timeController.setAbsoluteRange({ start, end });
    const width = timeController.getPlaybackWindowMs();

    timeController.seek(start + 4 * DAY);
    const before = timeController.getWindow().end;
    timeController.step(-1);
    assert.equal(timeController.getWindow().end, before - width);
    timeController.step(1);
    assert.equal(timeController.getWindow().end, before);
  });

  it('stop() returns to the underlying window', () => {
    timeController.setRange('24h');
    timeController.seek(Date.now() - 12 * HOUR);
    assert.equal(timeController.getMode(), 'playback');

    timeController.stop();
    assert.equal(timeController.getMode(), 'preset');
    assert.equal(timeController.getWindow().end, Infinity);
  });

  it('notifies subscribers when the window moves', () => {
    const seen: string[] = [];
    const off = timeController.subscribe((snapshot) => seen.push(snapshot.mode));

    timeController.setRange('7d');
    timeController.seekFraction(0.5);
    off();
    timeController.setRange('1h');

    assert.deepEqual(seen, ['preset', 'playback']);
  });

  it('picking a preset abandons playback', () => {
    timeController.setRange('7d');
    timeController.seekFraction(0.3);
    assert.equal(timeController.getMode(), 'playback');

    timeController.setRange('7d');
    assert.equal(timeController.getMode(), 'preset');
  });
});

describe('time window filtering', () => {
  beforeEach(() => {
    installLocalStorage();
    timeController.reset();
  });

  afterEach(() => {
    timeController.reset();
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('keeps items with unparseable timestamps rather than hiding them', () => {
    timeController.setRange('1h');
    const items = [{ at: 'not a date' }, { at: null }, { at: Date.now() }, { at: Date.now() - DAY }];
    const kept = filterByTimeWindow(items, (item) => item.at as string | null);
    assert.equal(kept.length, 3);
  });

  it('excludes items after the end of a pinned window', () => {
    const start = Date.parse('2026-08-01T00:00:00Z');
    const end = Date.parse('2026-08-02T00:00:00Z');
    timeController.setAbsoluteRange({ start, end });

    const items = [
      { at: start - HOUR },
      { at: start + HOUR },
      { at: end + HOUR },
    ];
    const kept = filterByTimeWindow(items, (item) => item.at);
    assert.deepEqual(kept.map((item) => item.at), [start + HOUR]);
  });

  it('describes presets relatively and pinned windows explicitly', () => {
    timeController.setRange('24h');
    assert.equal(describeTimeWindow(), 'the last 24 hours');

    timeController.setAbsoluteRange({
      start: Date.parse('2026-08-01T00:00:00Z'),
      end: Date.parse('2026-08-02T00:00:00Z'),
    });
    assert.match(describeTimeWindow(), /→/);
  });
});

describe('time-range helpers', () => {
  it('normalizeAbsoluteRange rejects junk and orders the endpoints', () => {
    assert.equal(normalizeAbsoluteRange(null), null);
    assert.equal(normalizeAbsoluteRange({ start: NaN, end: 5 }), null);
    assert.equal(normalizeAbsoluteRange({ start: 0, end: 100 }), null); // under a minute
    assert.deepEqual(normalizeAbsoluteRange({ start: 10 * HOUR, end: 0 }), { start: 0, end: 10 * HOUR });
  });

  it('formatDurationShort picks a sensible unit', () => {
    assert.equal(formatDurationShort(45 * 60 * 1000), '45m');
    assert.equal(formatDurationShort(6 * HOUR), '6h');
    assert.equal(formatDurationShort(3 * DAY), '3d');
    assert.equal(formatDurationShort(Infinity), '∞');
  });
});
