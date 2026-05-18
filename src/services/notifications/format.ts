import type { NotificationFamily, NotificationSeverity } from './types';

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

