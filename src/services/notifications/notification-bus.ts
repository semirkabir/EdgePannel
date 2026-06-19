import type { AppNotification, NotificationDisplay, NotificationFamily, NotificationKind, NotificationSeverity } from './types';
import { getNotificationPrefs, requestNotificationPermission } from './prefs';
import { signalAggregator, type SignalType } from '@/services/signal-aggregator';
import { getRecentSignals, type CorrelationSignal } from '@/services/correlation';
import { getRecentAlerts, type UnifiedAlert } from '@/services/cross-module-integration';
import { notificationSeverityFromConfidence } from './format';

const STORAGE_KEY = 'wm-notif-bus-v1';
const MAX_ITEMS = 500;
const PRUNE_AFTER_MS = 72 * 60 * 60 * 1000;
const INGEST_INTERVAL_MS = 30_000;

export interface NotificationInput {
  id: string;
  kind: NotificationKind;
  family?: NotificationFamily;
  severity?: NotificationSeverity;
  title: string;
  summary?: string;
  detail?: string;
  sourceLabel?: string;
  timestamp?: number;
  display?: NotificationDisplay;
  signalType?: string;
  country?: string;
  action?: AppNotification['action'];
  payload?: unknown;
}

type Listener = () => void;
type ToastRenderer = (n: AppNotification) => void;

function familyForKind(kind: NotificationKind): NotificationFamily {
  if (kind === 'breaking') return 'alert';
  if (kind === 'intel' || kind === 'system') return 'system';
  return 'finding';
}

function severityIcon(severity: NotificationSeverity): string {
  if (severity === 'critical') return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23ef4444" width="64" height="64" rx="12"/><text x="32" y="44" text-anchor="middle" fill="white" font-size="36">⚠</text></svg>';
  if (severity === 'high') return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23f97316" width="64" height="64" rx="12"/><text x="32" y="44" text-anchor="middle" fill="white" font-size="36">!</text></svg>';
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%233b82f6" width="64" height="64" rx="12"/><text x="32" y="44" text-anchor="middle" fill="white" font-size="36">•</text></svg>';
}

class NotificationBus {
  private items: AppNotification[] = [];
  private listeners = new Set<Listener>();
  private toastRenderer: ToastRenderer | null = null;
  private ingestedIds = new Set<string>();
  private ingestTimer: ReturnType<typeof setInterval> | null = null;
  private intelListener: ((e: Event) => void) | null = null;
  private started = false;

  init(): void {
    this.load();
    if (this.started) return;
    this.started = true;
    this.startIngestion();
    this.intelListener = () => this.emit({
      id: `intel-${Date.now()}`,
      kind: 'intel',
      title: 'Intelligence assessment updated',
      severity: 'medium',
      display: 'inbox',
    });
    document.addEventListener('wm:intelligence-updated', this.intelListener);
  }

  destroy(): void {
    this.stopIngestion();
    if (this.intelListener) {
      document.removeEventListener('wm:intelligence-updated', this.intelListener);
      this.intelListener = null;
    }
    this.listeners.clear();
    this.toastRenderer = null;
    this.started = false;
  }

  setToastRenderer(renderer: ToastRenderer | null): void {
    this.toastRenderer = renderer;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /* ---- emission ---- */

  emit(input: NotificationInput): AppNotification | null {
    if (this.items.some(i => i.id === input.id) || this.ingestedIds.has(input.id)) {
      this.ingestedIds.add(input.id);
      return null;
    }
    this.ingestedIds.add(input.id);
    if (this.ingestedIds.size > 2000) this.ingestedIds = new Set([...this.ingestedIds].slice(-1000));

    const kind = input.kind;
    const prefs = getNotificationPrefs();
    const display = input.display ?? 'both';
    const n: AppNotification = {
      id: input.id,
      kind,
      family: input.family ?? familyForKind(kind),
      severity: input.severity ?? 'info',
      title: input.title,
      summary: input.summary,
      detail: input.detail,
      sourceLabel: input.sourceLabel,
      timestamp: input.timestamp ?? Date.now(),
      read: false,
      dismissed: false,
      display,
      signalType: input.signalType,
      country: input.country,
      action: input.action,
      payload: input.payload,
    };

    this.items.unshift(n);
    if (this.items.length > MAX_ITEMS) this.items.length = MAX_ITEMS;
    this.save();
    this.notify();

    if ((display === 'toast' || display === 'both') && prefs.toast[kind] && this.toastRenderer) {
      try { this.toastRenderer(n); } catch { /* renderer isolated */ }
    }
    if ((display === 'toast' || display === 'both') && prefs.push[kind]) {
      this.sendDesktopPush(n);
    }
    return n;
  }

  /* ---- mutations ---- */

  dismiss(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item && !item.dismissed) {
      item.dismissed = true;
      item.read = true;
      this.save();
      this.notify();
    }
  }

  restore(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item && item.dismissed) {
      item.dismissed = false;
      this.save();
      this.notify();
    }
  }

  markRead(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item && !item.read) {
      item.read = true;
      this.save();
      this.notify();
    }
  }

  markAllRead(): void {
    let changed = false;
    for (const item of this.items) {
      if (!item.read) { item.read = true; changed = true; }
    }
    if (changed) { this.save(); this.notify(); }
  }

  clearDismissed(): void {
    const before = this.items.length;
    this.items = this.items.filter(i => !i.dismissed);
    if (this.items.length !== before) { this.save(); this.notify(); }
  }

  clearAll(): void {
    this.items = [];
    this.save();
    this.notify();
  }

  /* ---- queries ---- */

  getItems(): readonly AppNotification[] {
    return this.items;
  }

  getUnreadCount(): number {
    return this.items.reduce((n, i) => n + (i.dismissed || i.read ? 0 : 1), 0);
  }

  getUnreadByKind(): Record<NotificationKind, number> {
    const acc: Record<NotificationKind, number> = { breaking: 0, trending: 0, intel: 0, signal: 0, system: 0, finding: 0 };
    for (const i of this.items) {
      if (!i.dismissed && !i.read) acc[i.kind]++;
    }
    return acc;
  }

  hasUrgentUnread(): boolean {
    return this.items.some(i => !i.dismissed && !i.read && (i.severity === 'critical' || i.severity === 'high'));
  }

  /* ---- ingestion (signals + findings) ---- */

  private startIngestion(): void {
    if (this.ingestTimer) return;
    this.ingest();
    this.ingestTimer = setInterval(() => this.ingest(), INGEST_INTERVAL_MS);
  }

  private stopIngestion(): void {
    if (this.ingestTimer) {
      clearInterval(this.ingestTimer);
      this.ingestTimer = null;
    }
  }

  private ingest(): void {
    try { this.ingestSignals(); } catch { /* isolated */ }
    try { this.ingestFindings(); } catch { /* isolated */ }
  }

  private ingestSignals(): void {
    const summary = signalAggregator.getSummary();
    if (summary.totalSignals === 0) return;
    for (const cluster of summary.topCountries) {
      for (const sig of cluster.signals) {
        const id = `sig-${sig.type}-${sig.country}-${sig.timestamp.getTime()}`;
        this.emit({
          id,
          kind: 'signal',
          family: 'finding',
          title: sig.title,
          detail: sig.countryName,
          severity: sig.severity,
          signalType: sig.type as string,
          country: sig.country,
          timestamp: sig.timestamp.getTime(),
          display: 'inbox',
          action: { type: 'location', lat: sig.lat, lon: sig.lon },
        });
      }
    }
  }

  private ingestFindings(): void {
    const signals = getRecentSignals();
    const alerts = getRecentAlerts(6);

    for (const sig of signals) {
      const id = `finding-signal-${sig.id}`;
      this.emit({
        id,
        kind: 'finding',
        family: 'finding',
        title: sig.title,
        detail: sig.description?.slice(0, 120) || sig.type,
        severity: notificationSeverityFromConfidence(sig.confidence),
        timestamp: sig.timestamp.getTime(),
        display: 'inbox',
        action: { type: 'signal', signal: sig },
        payload: sig,
      });
    }

    for (const alert of alerts) {
      const id = `finding-alert-${alert.id}`;
      this.emit({
        id,
        kind: 'finding',
        family: 'finding',
        title: alert.title,
        detail: alert.summary?.slice(0, 120) || alert.type,
        severity: alert.priority,
        timestamp: alert.timestamp.getTime(),
        display: 'inbox',
        action: { type: 'alert', alert },
        payload: alert,
      });
    }
  }

  /* ---- desktop push ---- */

  private sendDesktopPush(n: AppNotification): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try {
      const tag = `wm-${n.kind}-${n.id}`;
      const notif = new Notification(`EdgePannel — ${n.kind.toUpperCase()}`, {
        body: n.title,
        tag,
        icon: severityIcon(n.severity),
        requireInteraction: n.severity === 'critical',
      });
      if (n.action?.type === 'link' && n.action.link) {
        notif.onclick = () => { window.focus(); window.open(n.action!.link!, '_blank', 'noopener'); notif.close(); };
      } else {
        notif.onclick = () => { window.focus(); notif.close(); };
      }
    } catch { /* mobile Safari, etc. */ }
  }

  requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    return requestNotificationPermission();
  }

  /* ---- internal ---- */

  private notify(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* isolated */ }
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch { /* quota */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      const cutoff = Date.now() - PRUNE_AFTER_MS;
      this.items = arr
        .filter((i: AppNotification) => i && typeof i.id === 'string' && i.timestamp > cutoff)
        .map((i: AppNotification) => ({
          ...i,
          read: i.read ?? false,
          dismissed: i.dismissed ?? false,
          display: i.display ?? 'inbox',
          kind: i.kind ?? 'system',
          family: i.family ?? familyForKind(i.kind ?? 'system'),
        }));
      for (const i of this.items) this.ingestedIds.add(i.id);
    } catch { /* corrupt */ }
  }
}

export const notificationBus = new NotificationBus();

export type { CorrelationSignal, UnifiedAlert, SignalType };
