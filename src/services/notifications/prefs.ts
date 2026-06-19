import type { NotificationKind } from './types';

export interface NotificationPrefs {
  toast: Record<NotificationKind, boolean>;
  push: Record<NotificationKind, boolean>;
  sound: boolean;
}

const PREFS_KEY = 'wm-notif-prefs-v1';

const ALL_KINDS: NotificationKind[] = ['breaking', 'trending', 'intel', 'signal', 'system', 'finding'];

const DEFAULT_PREFS: NotificationPrefs = {
  toast: { breaking: false, trending: true, intel: false, signal: false, system: true, finding: false },
  push: { breaking: true, trending: false, intel: false, signal: false, system: false, finding: false },
  sound: true,
};

let cached: NotificationPrefs | null = null;
let storageListener: ((e: StorageEvent) => void) | null = null;

function sanitize(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS };
  const obj = raw as Partial<NotificationPrefs>;
  const toast = { ...DEFAULT_PREFS.toast, ...(obj.toast ?? {}) };
  const push = { ...DEFAULT_PREFS.push, ...(obj.push ?? {}) };
  for (const k of ALL_KINDS) {
    if (typeof toast[k] !== 'boolean') toast[k] = DEFAULT_PREFS.toast[k];
    if (typeof push[k] !== 'boolean') push[k] = DEFAULT_PREFS.push[k];
  }
  return { toast, push, sound: typeof obj.sound === 'boolean' ? obj.sound : DEFAULT_PREFS.sound };
}

export function getNotificationPrefs(): NotificationPrefs {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) cached = sanitize(JSON.parse(raw));
    else cached = { ...DEFAULT_PREFS };
  } catch {
    cached = { ...DEFAULT_PREFS };
  }
  return cached;
}

export function updateNotificationPrefs(partial: Partial<NotificationPrefs>): void {
  const current = getNotificationPrefs();
  const next: NotificationPrefs = {
    toast: { ...current.toast, ...(partial.toast ?? {}) },
    push: { ...current.push, ...(partial.push ?? {}) },
    sound: typeof partial.sound === 'boolean' ? partial.sound : current.sound,
  };
  cached = next;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new CustomEvent('wm:notif-prefs-changed'));
}

export function setToastEnabled(kind: NotificationKind, enabled: boolean): void {
  const prefs = getNotificationPrefs();
  updateNotificationPrefs({ toast: { ...prefs.toast, [kind]: enabled } });
}

export function setPushEnabled(kind: NotificationKind, enabled: boolean): void {
  const prefs = getNotificationPrefs();
  updateNotificationPrefs({ push: { ...prefs.push, [kind]: enabled } });
}

export function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission();
}

export function initNotificationPrefs(): void {
  if (storageListener) return;
  storageListener = (e: StorageEvent) => {
    if (e.key === PREFS_KEY) cached = null;
  };
  window.addEventListener('storage', storageListener);
}

export function destroyNotificationPrefs(): void {
  if (storageListener) {
    window.removeEventListener('storage', storageListener);
    storageListener = null;
  }
  cached = null;
}

export const NOTIFICATION_KINDS = ALL_KINDS;
