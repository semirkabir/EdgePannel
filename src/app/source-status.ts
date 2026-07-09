/**
 * Pure formatting helpers for the data-source status dropdown.
 *
 * Extracted from EventHandlerManager to keep event-handlers.ts within its
 * size budget and to keep this presentation logic independently testable.
 */

/** Source ids delivered over a live WebSocket connection. */
export const WS_SOURCES = new Set(['ais', 'opensky', 'wingbits', 'polymarket', 'predictions']);

/** Source ids delivered via RSS / feed polling. */
export const RSS_SOURCES = new Set(['rss', 'gdelt_doc', 'pizzint', 'outages', 'cyber_threats', 'gpsjam', 'webcams', 'security_advisories']);

/** Maps a freshness status to the dropdown dot/badge severity class. */
export function getSourceDotClass(status: string, isWs: boolean): string {
  if (isWs) return 'live';
  if (status === 'error' || status === 'no_data') return 'error';
  if (status === 'very_stale') return 'error';
  if (status === 'stale') return 'stale';
  if (status === 'fresh') return 'fresh';
  return 'stale';
}

/** Human-readable relative age, e.g. "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** Badge label for a source row: LIVE / ERROR / NO DATA / relative age. */
export function getSourceLabel(
  source: { status: string; lastUpdate: Date | null; lastError: string | null },
  isWs: boolean,
): string {
  if (isWs) return 'LIVE';
  if (source.status === 'error') return 'ERROR';
  if (source.status === 'no_data' || !source.lastUpdate) return 'NO DATA';
  return timeAgo(source.lastUpdate);
}
