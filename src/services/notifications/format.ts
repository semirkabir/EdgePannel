import type { NotificationFamily, NotificationKind, NotificationSeverity } from './types';

export function notificationSeverityFromConfidence(confidence: number): NotificationSeverity {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

export function formatNotificationAge(value: Date | number): string {
  const timestamp = value instanceof Date ? value.getTime() : value;
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function notificationFamilyLabel(family: NotificationFamily): string {
  switch (family) {
    case 'alert': return 'Alert';
    case 'finding': return 'Finding';
    case 'system': return 'System';
  }
}

export function notificationSeverityLabel(severity: NotificationSeverity): string {
  return severity === 'info' ? 'INFO' : severity.toUpperCase();
}

export function notificationKindLabel(kind: NotificationKind): string {
  switch (kind) {
    case 'breaking': return 'Breaking';
    case 'trending': return 'Trending';
    case 'intel': return 'Intel';
    case 'signal': return 'Signal';
    case 'system': return 'System';
    case 'finding': return 'Finding';
  }
}

export function notificationKindIcon(kind: NotificationKind, signalType?: string): string {
  switch (kind) {
    case 'breaking': return '🚨';
    case 'trending': return '📈';
    case 'intel': return '🧠';
    case 'system': return '⚙️';
    case 'finding': return '🎯';
    case 'signal': return SIGNAL_ICON_MAP[signalType as keyof typeof SIGNAL_ICON_MAP] ?? '📡';
  }
}

const SIGNAL_ICON_MAP = {
  internet_outage: '🌐',
  military_flight: '✈️',
  military_vessel: '🚢',
  protest: '📢',
  ais_disruption: '📡',
  satellite_fire: '🔥',
  temporal_anomaly: '📊',
  active_strike: '💥',
  supplemental: '🧩',
} as const;

