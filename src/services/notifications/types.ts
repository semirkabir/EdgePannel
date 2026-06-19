export type NotificationFamily = 'system' | 'finding' | 'alert';

export type NotificationSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type NotificationKind =
  | 'breaking'
  | 'trending'
  | 'intel'
  | 'signal'
  | 'system'
  | 'finding';

export type NotificationDisplay = 'toast' | 'inbox' | 'both' | 'silent';

export type NotificationActionType = 'finding' | 'alert' | 'signal' | 'location' | 'link';

export interface NotificationAction {
  type: NotificationActionType;
  signal?: unknown;
  alert?: unknown;
  lat?: number;
  lon?: number;
  link?: string;
}

export interface AppNotification<TPayload = unknown> {
  id: string;
  kind: NotificationKind;
  family: NotificationFamily;
  severity: NotificationSeverity;
  title: string;
  summary?: string;
  detail?: string;
  sourceLabel?: string;
  timestamp: number;
  read: boolean;
  dismissed: boolean;
  display: NotificationDisplay;
  signalType?: string;
  country?: string;
  action?: NotificationAction;
  payload?: TPayload;
}

export type NotificationKindLabel =
  | 'Breaking'
  | 'Trending'
  | 'Intel'
  | 'Signal'
  | 'System'
  | 'Finding';
