/**
 * Turns live feeds into scrubber markers.
 *
 * Each function keeps only what a reader would call a *key event* — the
 * timeline is a summary, not a second copy of every layer. Thresholds live
 * here so they can be tuned in one place.
 */
import type { Earthquake } from '@/services/earthquakes';
import type { CyberThreat, NewsItem, SocialUnrestEvent } from '@/types';
import { publishTimeMarkers, type TimeMarker, type TimeMarkerSeverity } from '@/services/time-markers';

/** Below this magnitude a quake is routine and stays off the timeline. */
const EARTHQUAKE_MIN_MAGNITUDE = 5;

function toMs(value: Date | string | number | undefined | null): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function publishNewsMarkers(items: readonly NewsItem[]): void {
  const markers: TimeMarker[] = [];
  for (const item of items) {
    const level = item.threat?.level;
    // Only headlines the classifier already flagged as consequential.
    if (level !== 'critical' && level !== 'high' && !item.isAlert) continue;
    const time = toMs(item.pubDate);
    if (time === null) continue;
    const severity: TimeMarkerSeverity = level === 'critical' ? 'critical' : level === 'high' ? 'high' : 'medium';
    markers.push({
      id: `news:${item.link || item.title}`,
      time,
      category: item.threat?.category === 'conflict' ? 'conflict' : 'news',
      severity,
      title: item.title,
      source: item.source,
      url: item.link,
    });
  }
  publishTimeMarkers('news', markers);
}

export function publishEarthquakeMarkers(quakes: readonly Earthquake[]): void {
  const markers: TimeMarker[] = [];
  for (const quake of quakes) {
    if (!(quake.magnitude >= EARTHQUAKE_MIN_MAGNITUDE)) continue;
    const time = toMs(quake.occurredAt);
    if (time === null) continue;
    markers.push({
      id: `quake:${quake.id}`,
      time,
      category: 'disaster',
      severity: quake.magnitude >= 7 ? 'critical' : quake.magnitude >= 6 ? 'high' : 'medium',
      title: `M${quake.magnitude.toFixed(1)} — ${quake.place}`,
      detail: `Depth ${Math.round(quake.depthKm)} km`,
      source: 'USGS',
      url: quake.sourceUrl,
    });
  }
  publishTimeMarkers('earthquakes', markers);
}

export function publishUnrestMarkers(events: readonly SocialUnrestEvent[]): void {
  const markers: TimeMarker[] = [];
  for (const event of events) {
    if (event.severity !== 'high') continue;
    const time = toMs(event.time);
    if (time === null) continue;
    markers.push({
      id: `unrest:${event.id}`,
      time,
      category: 'unrest',
      severity: event.severity,
      title: event.title,
      detail: [event.city, event.country].filter(Boolean).join(', '),
      source: event.sources?.[0],
    });
  }
  publishTimeMarkers('unrest', markers);
}

export function publishCyberMarkers(threats: readonly CyberThreat[]): void {
  const markers: TimeMarker[] = [];
  for (const threat of threats) {
    if (threat.severity !== 'critical' && threat.severity !== 'high') continue;
    const time = toMs(threat.lastSeen ?? threat.firstSeen);
    if (time === null) continue;
    markers.push({
      id: `cyber:${threat.id}`,
      time,
      category: 'cyber',
      severity: threat.severity,
      title: `${threat.type}: ${threat.indicator}`,
      detail: threat.malwareFamily,
      source: threat.source,
    });
  }
  publishTimeMarkers('cyber', markers);
}
