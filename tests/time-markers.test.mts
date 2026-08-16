import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  clearTimeMarkers,
  getTimeMarkers,
  getTimeMarkersInRange,
  publishTimeMarkers,
  subscribeTimeMarkers,
  type TimeMarker,
} from '../src/services/time-markers.ts';

const HOUR = 60 * 60 * 1000;
const BASE = Date.parse('2026-08-01T00:00:00Z');

function marker(overrides: Partial<TimeMarker> & { id: string; time: number }): TimeMarker {
  return {
    category: 'news',
    severity: 'medium',
    title: `event ${overrides.id}`,
    ...overrides,
  };
}

describe('time marker registry', () => {
  beforeEach(() => {
    clearTimeMarkers();
  });

  it('merges sources and returns them in time order', () => {
    publishTimeMarkers('news', [marker({ id: 'b', time: BASE + 2 * HOUR })]);
    publishTimeMarkers('quakes', [marker({ id: 'a', time: BASE + HOUR })]);

    assert.deepEqual(getTimeMarkers().map((m) => m.id), ['a', 'b']);
  });

  it('republishing a source replaces its markers rather than appending', () => {
    publishTimeMarkers('news', [marker({ id: 'a', time: BASE }), marker({ id: 'b', time: BASE + HOUR })]);
    publishTimeMarkers('news', [marker({ id: 'c', time: BASE + 2 * HOUR })]);

    assert.deepEqual(getTimeMarkers().map((m) => m.id), ['c']);
  });

  it('publishing an empty list drops the source', () => {
    publishTimeMarkers('news', [marker({ id: 'a', time: BASE })]);
    publishTimeMarkers('quakes', [marker({ id: 'b', time: BASE + HOUR })]);
    publishTimeMarkers('news', []);

    assert.deepEqual(getTimeMarkers().map((m) => m.id), ['b']);
  });

  it('skips markers with an unusable time or an empty title', () => {
    publishTimeMarkers('news', [
      marker({ id: 'ok', time: BASE }),
      marker({ id: 'nan', time: Number.NaN }),
      marker({ id: 'blank', time: BASE + HOUR, title: '   ' }),
    ]);

    assert.deepEqual(getTimeMarkers().map((m) => m.id), ['ok']);
  });

  it('keeps the most severe markers when a source floods the registry', () => {
    const flood = Array.from({ length: 400 }, (_, i) =>
      marker({ id: `low-${i}`, time: BASE + i * 1000, severity: 'low' }),
    );
    flood.push(marker({ id: 'critical', time: BASE, severity: 'critical' }));
    publishTimeMarkers('news', flood);

    const kept = getTimeMarkers();
    assert.ok(kept.length < flood.length);
    assert.ok(kept.some((m) => m.id === 'critical'));
  });

  it('filters to a range inclusively', () => {
    publishTimeMarkers('news', [
      marker({ id: 'before', time: BASE - HOUR }),
      marker({ id: 'edge', time: BASE }),
      marker({ id: 'inside', time: BASE + HOUR }),
      marker({ id: 'after', time: BASE + 5 * HOUR }),
    ]);

    const ids = getTimeMarkersInRange(BASE, BASE + 2 * HOUR).map((m) => m.id);
    assert.deepEqual(ids, ['edge', 'inside']);
  });

  it('notifies subscribers until they unsubscribe', () => {
    let calls = 0;
    const off = subscribeTimeMarkers(() => { calls += 1; });

    publishTimeMarkers('news', [marker({ id: 'a', time: BASE })]);
    assert.equal(calls, 1);

    off();
    publishTimeMarkers('news', [marker({ id: 'b', time: BASE })]);
    assert.equal(calls, 1);
  });
});
