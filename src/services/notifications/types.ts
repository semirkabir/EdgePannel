export type NotificationFamily = 'system' | 'finding' | 'alert';

export type NotificationSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface AppNotification<TPayload = unknown> {
  id: string;
  family: NotificationFamily;
  severity: NotificationSeverity;
  title: string;
  summary?: string;
  sourceLabel?: string;
  timestamp: Date;
  read?: boolean;
  payload?: TPayload;
}

