/**
 * Notification Center — the unified Activity Inbox.
 * Bell icon + dropdown feed fed by the NotificationBus (single source of truth).
 * Provides type filters, a dismissed/archive view, and per-type push/toast prefs.
 */

import { notificationBus, type CorrelationSignal, type UnifiedAlert } from '@/services/notifications/notification-bus';
import {
  formatNotificationAge,
  notificationKindIcon,
  notificationKindLabel,
  notificationFamilyLabel,
  type AppNotification,
  type NotificationKind,
} from '@/services/notifications';
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  requestNotificationPermission,
  NOTIFICATION_KINDS,
  type NotificationPrefs,
} from '@/services/notifications/prefs';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type FilterKind = 'all' | NotificationKind;
type ViewMode = 'active' | 'dismissed';

const FILTERS: { id: FilterKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'breaking', label: 'Breaking' },
  { id: 'trending', label: 'Trending' },
  { id: 'intel', label: 'Intel' },
  { id: 'signal', label: 'Signals' },
  { id: 'finding', label: 'Findings' },
  { id: 'system', label: 'System' },
];

function severityClass(s: string): string {
  switch (s) {
    case 'critical': return 'notif-critical';
    case 'high': return 'notif-high';
    case 'medium': return 'notif-medium';
    default: return 'notif-low';
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export class NotificationCenter {
  private el: HTMLElement;
  private badgeEl: HTMLElement;
  private dropdownEl: HTMLElement;
  private listEl: HTMLElement;
  private filtersEl: HTMLElement;
  private viewToggleEl: HTMLElement;
  private prefsEl: HTMLElement;
  private open = false;
  private filter: FilterKind = 'all';
  private view: ViewMode = 'active';
  private prefsOpen = false;
  private unsubscribe: (() => void) | null = null;
  private permissionRequested = false;

  private onLocClick: ((lat: number, lon: number) => void) | null = null;
  private onFindingClick: ((signal: CorrelationSignal) => void) | null = null;
  private onAlertClick: ((alert: UnifiedAlert) => void) | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'notif-center';

    // Bell button
    const btn = document.createElement('button');
    btn.className = 'notif-bell-btn';
    btn.title = 'Activity inbox';
    btn.setAttribute('aria-label', 'Activity inbox');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span class="notif-bell-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>`;
    btn.addEventListener('click', () => this.toggle());
    this.el.appendChild(btn);

    // Badge
    this.badgeEl = document.createElement('span');
    this.badgeEl.className = 'notif-badge';
    this.badgeEl.style.display = 'none';
    btn.appendChild(this.badgeEl);

    // Dropdown
    this.dropdownEl = document.createElement('div');
    this.dropdownEl.className = 'notif-dropdown';
    this.dropdownEl.style.display = 'none';

    this.dropdownEl.appendChild(this.buildHeader());
    this.filtersEl = this.buildFilters();
    this.dropdownEl.appendChild(this.filtersEl);
    this.viewToggleEl = this.buildViewToggle();
    this.dropdownEl.appendChild(this.viewToggleEl);

    this.listEl = document.createElement('div');
    this.listEl.className = 'notif-list';
    this.dropdownEl.appendChild(this.listEl);

    this.prefsEl = this.buildPrefsPanel();
    this.prefsEl.style.display = 'none';
    this.dropdownEl.appendChild(this.prefsEl);

    this.el.appendChild(this.dropdownEl);

    // Subscribe to the bus
    this.unsubscribe = notificationBus.subscribe(() => this.onBusChange());

    // Global listeners
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('click', this.onDocClick);
    window.addEventListener('wm:notif-prefs-changed', this.onPrefsChanged as EventListener);
  }

  mount(parent: HTMLElement, before?: HTMLElement | null): void {
    if (before && before.parentElement === parent) {
      parent.insertBefore(this.el, before);
      return;
    }
    parent.appendChild(this.el);
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('click', this.onDocClick);
    window.removeEventListener('wm:notif-prefs-changed', this.onPrefsChanged as EventListener);
    if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
    this.el.remove();
  }

  setLocationClickHandler(handler: (lat: number, lon: number) => void): void {
    this.onLocClick = handler;
  }

  setFindingClickHandler(handler: (signal: CorrelationSignal) => void): void {
    this.onFindingClick = handler;
  }

  setAlertClickHandler(handler: (alert: UnifiedAlert) => void): void {
    this.onAlertClick = handler;
  }

  /* ---- structure builders ---- */

  private buildHeader(): HTMLElement {
    const hdr = document.createElement('div');
    hdr.className = 'notif-dropdown-header';
    const title = document.createElement('div');
    title.className = 'notif-dropdown-title';
    title.textContent = 'Activity Inbox';
    const actions = document.createElement('div');
    actions.className = 'notif-dropdown-actions';
    const prefsBtn = document.createElement('button');
    prefsBtn.className = 'notif-prefs-btn';
    prefsBtn.title = 'Notification preferences';
    prefsBtn.setAttribute('aria-label', 'Notification preferences');
    prefsBtn.textContent = '⚙';
    prefsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prefsOpen = !this.prefsOpen;
      this.prefsEl.style.display = this.prefsOpen ? '' : 'none';
      this.listEl.style.display = this.prefsOpen ? 'none' : '';
      this.filtersEl.style.display = this.prefsOpen ? 'none' : '';
      this.viewToggleEl.style.display = this.prefsOpen ? 'none' : '';
      if (this.prefsOpen) this.renderPrefs();
    });
    const markAllBtn = document.createElement('button');
    markAllBtn.className = 'notif-mark-all';
    markAllBtn.title = 'Mark all read';
    markAllBtn.textContent = '✓';
    markAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationBus.markAllRead();
    });
    actions.append(prefsBtn, markAllBtn);
    hdr.append(title, actions);
    return hdr;
  }

  private buildFilters(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'notif-filters';
    for (const f of FILTERS) {
      const tab = document.createElement('button');
      tab.className = 'notif-filter-tab';
      tab.dataset.filter = f.id;
      tab.textContent = f.label;
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.filter = f.id;
        this.renderFilters();
        this.renderList();
      });
      wrap.appendChild(tab);
    }
    this.renderFilters();
    return wrap;
  }

  private buildViewToggle(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'notif-view-toggle';
    const activeBtn = document.createElement('button');
    activeBtn.className = 'notif-view-btn';
    activeBtn.dataset.view = 'active';
    activeBtn.textContent = 'Active';
    const dismissedBtn = document.createElement('button');
    dismissedBtn.className = 'notif-view-btn';
    dismissedBtn.dataset.view = 'dismissed';
    dismissedBtn.textContent = 'Dismissed';
    const setView = (v: ViewMode) => {
      this.view = v;
      this.renderViewToggle();
      this.renderList();
    };
    activeBtn.addEventListener('click', (e) => { e.stopPropagation(); setView('active'); });
    dismissedBtn.addEventListener('click', (e) => { e.stopPropagation(); setView('dismissed'); });
    wrap.append(activeBtn, dismissedBtn);
    return wrap;
  }

  private buildPrefsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'notif-prefs';
    panel.innerHTML = '<div class="notif-prefs-title">Notification preferences</div>';
    return panel;
  }

  /* ---- toggle ---- */

  private toggle(): void {
    this.open ? this.close() : this.show();
  }

  private show(): void {
    if (!this.permissionRequested) {
      this.permissionRequested = true;
      notificationBus.requestPermission();
    }
    this.open = true;
    this.el.querySelector('.notif-bell-btn')?.setAttribute('aria-expanded', 'true');
    this.dropdownEl.style.display = '';
    this.renderList();
    requestAnimationFrame(() => this.dropdownEl.classList.add('active'));
  }

  private close(): void {
    this.open = false;
    this.el.querySelector('.notif-bell-btn')?.setAttribute('aria-expanded', 'false');
    this.dropdownEl.classList.remove('active');
    setTimeout(() => { if (!this.open) this.dropdownEl.style.display = 'none'; }, 200);
  }

  /* ---- event handlers ---- */

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      e.stopPropagation();
      this.close();
    }
  };

  private onDocClick = (e: MouseEvent): void => {
    if (this.open && !this.el.contains(e.target as Node)) this.close();
  };

  private onPrefsChanged = (): void => {
    if (this.prefsOpen) this.renderPrefs();
  };

  private onBusChange(): void {
    this.updateBadge();
    this.renderFilters();
    this.renderViewToggle();
    if (this.open) this.renderList();
  }

  /* ---- badge ---- */

  private updateBadge(): void {
    const unread = notificationBus.getUnreadCount();
    if (unread === 0) {
      this.badgeEl.style.display = 'none';
      return;
    }
    this.badgeEl.textContent = unread > 99 ? '99+' : String(unread);
    this.badgeEl.style.display = '';
    const urgent = notificationBus.hasUrgentUnread();
    this.badgeEl.classList.toggle('badge--urgent', urgent);
    this.badgeEl.classList.toggle('badge--attention', !urgent);
    this.badgeEl.classList.remove('badge--neutral');
  }

  /* ---- rendering ---- */

  private renderFilters(): void {
    const counts = notificationBus.getUnreadByKind();
    const total = notificationBus.getUnreadCount();
    for (const tab of Array.from(this.filtersEl.querySelectorAll<HTMLElement>('.notif-filter-tab'))) {
      const id = tab.dataset.filter as FilterKind;
      const active = id === this.filter;
      tab.classList.toggle('active', active);
      const count = id === 'all' ? total : counts[id as NotificationKind] ?? 0;
      const label = FILTERS.find(f => f.id === id)!.label;
      tab.textContent = count > 0 ? `${label} ${count}` : label;
    }
  }

  private renderViewToggle(): void {
    const dismissedCount = notificationBus.getItems().filter(i => i.dismissed).length;
    for (const btn of Array.from(this.viewToggleEl.querySelectorAll<HTMLElement>('.notif-view-btn'))) {
      const v = btn.dataset.view as ViewMode;
      btn.classList.toggle('active', v === this.view);
      if (v === 'dismissed') btn.textContent = dismissedCount > 0 ? `Dismissed ${dismissedCount}` : 'Dismissed';
    }
  }

  private renderList(): void {
    const all = notificationBus.getItems();
    const filtered = all.filter(i => {
      if (this.view === 'dismissed' !== i.dismissed) return false;
      if (this.filter !== 'all' && i.kind !== this.filter) return false;
      return true;
    });

    this.listEl.replaceChildren();

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'notif-empty';
      empty.textContent = this.view === 'dismissed' ? 'No dismissed notifications' : 'No notifications yet';
      this.listEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const item of filtered.slice(0, 100)) {
      frag.appendChild(this.buildRow(item));
    }
    this.listEl.appendChild(frag);
  }

  private buildRow(item: AppNotification): HTMLElement {
    const row = document.createElement('div');
    row.className = `notif-item ${severityClass(item.severity)} ${item.read ? 'read' : 'unread'}${item.dismissed ? ' dismissed' : ''}`;
    row.dataset.id = item.id;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'notif-icon';
    iconSpan.textContent = notificationKindIcon(item.kind, item.signalType);

    const body = document.createElement('div');
    body.className = 'notif-body';
    const kicker = document.createElement('div');
    kicker.className = 'notif-kicker';
    kicker.textContent = `${notificationKindLabel(item.kind)} · ${notificationFamilyLabel(item.family)}`;
    const titleDiv = document.createElement('div');
    titleDiv.className = 'notif-title';
    titleDiv.textContent = item.title;
    body.append(kicker, titleDiv);
    if (item.detail) {
      const detailDiv = document.createElement('div');
      detailDiv.className = 'notif-detail';
      detailDiv.textContent = item.detail;
      body.appendChild(detailDiv);
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'notif-time';
    timeSpan.textContent = formatNotificationAge(item.timestamp);

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'notif-item-dismiss';
    dismissBtn.title = item.dismissed ? 'Restore' : 'Dismiss';
    dismissBtn.setAttribute('aria-label', dismissBtn.title);
    dismissBtn.textContent = item.dismissed ? '↺' : '×';
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.dismissed) notificationBus.restore(item.id);
      else notificationBus.dismiss(item.id);
    });

    row.append(iconSpan, body, timeSpan, dismissBtn);

    row.addEventListener('click', () => {
      if (!item.dismissed) notificationBus.markRead(item.id);
      this.invokeAction(item);
    });

    return row;
  }

  private invokeAction(item: AppNotification): void {
    const action = item.action;
    if (!action) return;
    if (action.type === 'finding' || action.type === 'signal') {
      if (action.signal && this.onFindingClick) { this.onFindingClick(action.signal as CorrelationSignal); this.close(); }
    } else if (action.type === 'alert') {
      if (action.alert && this.onAlertClick) { this.onAlertClick(action.alert as UnifiedAlert); this.close(); }
    } else if (action.type === 'location') {
      if (action.lat != null && action.lon != null && this.onLocClick) { this.onLocClick(action.lat, action.lon); this.close(); }
    } else if (action.type === 'link') {
      if (action.link) window.open(action.link, '_blank', 'noopener');
    }
  }

  /* ---- prefs panel ---- */

  private renderPrefs(): void {
    const prefs = getNotificationPrefs();
    this.prefsEl.replaceChildren();

    const title = document.createElement('div');
    title.className = 'notif-prefs-title';
    title.textContent = 'Notification preferences';
    this.prefsEl.appendChild(title);

    const perm = document.createElement('div');
    perm.className = 'notif-prefs-perm';
    const permStatus = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    perm.textContent = `Desktop push: ${permStatus}`;
    if (permStatus === 'default') {
      const enableBtn = document.createElement('button');
      enableBtn.className = 'notif-prefs-enable';
      enableBtn.textContent = 'Enable';
      enableBtn.addEventListener('click', () => requestNotificationPermission().then(() => this.renderPrefs()));
      perm.append(enableBtn);
    }
    this.prefsEl.appendChild(perm);

    // Header row
    const header = document.createElement('div');
    header.className = 'notif-prefs-header';
    header.innerHTML = '<span>Type</span><span>Toast</span><span>Push</span>';
    this.prefsEl.appendChild(header);

    for (const kind of NOTIFICATION_KINDS) {
      const row = document.createElement('div');
      row.className = 'notif-prefs-row';
      const label = document.createElement('span');
      label.className = 'notif-prefs-label';
      label.textContent = `${notificationKindIcon(kind)} ${notificationKindLabel(kind)}`;
      row.appendChild(label);
      row.appendChild(this.buildToggle('toast', kind, prefs.toast[kind]));
      row.appendChild(this.buildToggle('push', kind, prefs.push[kind]));
      this.prefsEl.appendChild(row);
    }

    // Sound
    const soundRow = document.createElement('div');
    soundRow.className = 'notif-prefs-row notif-prefs-sound';
    const soundLabel = document.createElement('span');
    soundLabel.className = 'notif-prefs-label';
    soundLabel.textContent = '🔊 Sound';
    soundRow.appendChild(soundLabel);
    const soundToggle = document.createElement('button');
    soundToggle.className = `notif-prefs-switch ${prefs.sound ? 'on' : ''}`;
    soundToggle.textContent = prefs.sound ? 'ON' : 'OFF';
    soundToggle.addEventListener('click', () => {
      updateNotificationPrefs({ sound: !prefs.sound });
    });
    soundRow.appendChild(soundToggle);
    this.prefsEl.appendChild(soundRow);

    // Clear dismissed
    const clearRow = document.createElement('div');
    clearRow.className = 'notif-prefs-clear-row';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'notif-prefs-clear';
    clearBtn.textContent = 'Clear dismissed';
    clearBtn.addEventListener('click', () => notificationBus.clearDismissed());
    clearRow.appendChild(clearBtn);
    this.prefsEl.appendChild(clearRow);
  }

  private buildToggle(channel: 'toast' | 'push', kind: NotificationKind, on: boolean): HTMLElement {
    const btn = document.createElement('button');
    btn.className = `notif-prefs-switch ${on ? 'on' : ''}`;
    btn.textContent = on ? 'ON' : 'OFF';
    btn.addEventListener('click', () => {
      const prefs = getNotificationPrefs();
      if (channel === 'toast') {
        updateNotificationPrefs({ toast: { ...prefs.toast, [kind]: !prefs.toast[kind] } });
      } else {
        updateNotificationPrefs({ push: { ...prefs.push, [kind]: !prefs.push[kind] } });
      }
    });
    return btn;
  }
}
