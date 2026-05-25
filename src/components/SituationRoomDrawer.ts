import { loginWithGoogle } from '@/services/firebase-auth';
import {
  buildCurrentSituationRoomViewAttachment,
  fetchSituationRoomMessages,
  getDefaultSituationRoom,
  getSituationRoomLabel,
  isSituationRoomRealtimeConfigured,
  sendSituationRoomMessage,
  SITUATION_ROOMS,
  subscribeSituationRoomMessages,
  type SituationRoomId,
  type SituationRoomMessage,
  type SituationRoomViewAttachment,
} from '@/services/situation-room';
import { subscribeToAuth, type AuthState } from '@/services/user-auth';
import { escapeHtml } from '@/utils/sanitize';

const PREVIEW_POLL_INTERVAL_MS = 30_000;
const LAST_READ_PREFIX = 'wm-situation-room-last-read:';

interface SituationRoomDrawerOptions {
  getViewerCount: () => number;
  onUnreadCountChange?: (count: number) => void;
}

function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roomLastReadKey(room: SituationRoomId): string {
  return `${LAST_READ_PREFIX}${room}`;
}

function readLastReadAt(room: SituationRoomId): number {
  const raw = localStorage.getItem(roomLastReadKey(room));
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeLastReadAt(room: SituationRoomId, timestamp: number): void {
  localStorage.setItem(roomLastReadKey(room), String(timestamp));
}

export class SituationRoomDrawer {
  private overlay: HTMLElement;
  private drawer: HTMLElement;
  private messagesEl: HTMLElement;
  private statusEl: HTMLElement;
  private composerEl: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private attachBtn: HTMLButtonElement;
  private roomTabsEl: HTMLElement;
  private authState: AuthState | null = null;
  private authUnsubscribe: (() => void) | null = null;
  private previewPollTimer: number | null = null;
  private roomSubscription: (() => void) | null = null;
  private activeRoom: SituationRoomId = getDefaultSituationRoom();
  private messages: SituationRoomMessage[] = [];
  private attachment: SituationRoomViewAttachment | null = null;
  private readonly getViewerCount: () => number;
  private readonly onUnreadCountChange?: (count: number) => void;
  private isOpen = false;
  private isLoading = false;
  private isSending = false;

  constructor(options: SituationRoomDrawerOptions) {
    this.getViewerCount = options.getViewerCount;
    this.onUnreadCountChange = options.onUnreadCountChange;

    this.overlay = document.createElement('div');
    this.overlay.className = 'situation-room-overlay';
    this.overlay.hidden = true;

    this.drawer = document.createElement('aside');
    this.drawer.className = 'situation-room-drawer';
    this.drawer.setAttribute('role', 'dialog');
    this.drawer.setAttribute('aria-label', 'Situation Room');
    this.drawer.innerHTML = `
      <header class="situation-room-header">
        <div>
          <h2>Situation Room</h2>
          <p class="situation-room-subtitle"></p>
        </div>
        <button type="button" class="situation-room-close" aria-label="Close">&times;</button>
      </header>
      <div class="situation-room-body">
        <nav class="situation-room-tabs" aria-label="Situation Room channels"></nav>
        <section class="situation-room-main">
          <div class="situation-room-status" aria-live="polite"></div>
          <div class="situation-room-messages" role="log" aria-live="polite"></div>
          <form class="situation-room-form">
            <div class="situation-room-attachment" hidden></div>
            <textarea class="situation-room-input" rows="3" maxlength="600" placeholder="Message the room…"></textarea>
            <div class="situation-room-actions">
              <button type="button" class="situation-room-attach">Attach current view</button>
              <button type="submit" class="situation-room-send">Send</button>
            </div>
          </form>
        </section>
      </div>
    `;

    this.overlay.appendChild(this.drawer);
    document.body.appendChild(this.overlay);

    this.messagesEl = this.drawer.querySelector<HTMLElement>('.situation-room-messages')!;
    this.statusEl = this.drawer.querySelector<HTMLElement>('.situation-room-status')!;
    this.composerEl = this.drawer.querySelector<HTMLTextAreaElement>('.situation-room-input')!;
    this.sendBtn = this.drawer.querySelector<HTMLButtonElement>('.situation-room-send')!;
    this.attachBtn = this.drawer.querySelector<HTMLButtonElement>('.situation-room-attach')!;
    this.roomTabsEl = this.drawer.querySelector<HTMLElement>('.situation-room-tabs')!;

    this.renderRoomTabs();
    this.updateHeader();
    this.updateComposerState();

    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay || (event.target as HTMLElement).closest('.situation-room-close')) {
        this.close();
      }
    });
    this.drawer.querySelector<HTMLFormElement>('.situation-room-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.send();
    });
    this.attachBtn.addEventListener('click', () => {
      this.attachment = this.attachment ? null : buildCurrentSituationRoomViewAttachment();
      this.renderAttachment();
    });
    this.roomTabsEl.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-room]');
      if (!target) return;
      const room = target.dataset.room as SituationRoomId;
      if (room === this.activeRoom) return;
      this.activeRoom = room;
      this.messages = [];
      this.attachment = null;
      this.renderRoomTabs();
      this.renderAttachment();
      this.updateHeader();
      this.connectRoomFeed();
    });

    this.authUnsubscribe = subscribeToAuth((state) => {
      this.authState = state;
      this.updateComposerState();
    });
    this.connectRoomFeed();
  }

  public async open(): Promise<void> {
    this.isOpen = true;
    this.overlay.hidden = false;
    this.overlay.classList.add('active');
    await this.refreshMessages();
    this.markRoomRead();
    this.composerEl.focus();
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.classList.remove('active');
    this.overlay.hidden = true;
  }

  public destroy(): void {
    this.roomSubscription?.();
    this.roomSubscription = null;
    this.stopPreviewPolling();
    this.authUnsubscribe?.();
    this.overlay.remove();
  }

  private renderRoomTabs(): void {
    this.roomTabsEl.innerHTML = SITUATION_ROOMS.map(room => `
      <button type="button" class="situation-room-tab ${room.id === this.activeRoom ? 'active' : ''}" data-room="${room.id}">
        # ${escapeHtml(room.label)}
      </button>
    `).join('');
  }

  private updateHeader(): void {
    const subtitle = this.drawer.querySelector<HTMLElement>('.situation-room-subtitle');
    if (!subtitle) return;
    subtitle.innerHTML = `${getSituationRoomLabel(this.activeRoom)} <span class="subtitle-viewer-divider">·</span> <span class="live-telemetry-dot-green"></span> ${this.getViewerCount().toLocaleString()} watching now`;
  }

  private updateComposerState(): void {
    const user = this.authState?.user ?? null;
    const isSignedIn = Boolean(user);
    this.composerEl.disabled = !isSignedIn || this.isSending;
    this.sendBtn.disabled = !isSignedIn || this.isSending;
    this.attachBtn.disabled = !isSignedIn || this.isSending;
    this.composerEl.placeholder = isSignedIn ? 'Message the room…' : 'Sign in to post. Everyone can read.';
    if (!isSignedIn) {
      this.statusEl.innerHTML = `Public room · <button type="button" class="situation-room-login">Sign in to post</button>`;
      this.statusEl.querySelector<HTMLButtonElement>('.situation-room-login')?.addEventListener('click', () => {
        void loginWithGoogle();
      });
    }
  }

  private async refreshMessages(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    if (this.messages.length === 0) {
      this.statusEl.textContent = 'Loading room…';
    }
    try {
      const messages = await fetchSituationRoomMessages(this.activeRoom);
      this.messages = messages;
      this.renderMessages();
      if (this.authState?.user) {
        this.statusEl.textContent = 'Public room · signed in';
      } else {
        this.updateComposerState();
      }
      if (this.isOpen) this.markRoomRead();
      else this.updateUnreadCount();
    } catch (error) {
      this.statusEl.textContent = error instanceof Error ? error.message : 'Situation Room unavailable';
      if (this.messages.length === 0) {
        this.messagesEl.innerHTML = '<div class="situation-room-empty">The room is unavailable right now.</div>';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private connectRoomFeed(): void {
    this.roomSubscription?.();
    this.roomSubscription = subscribeSituationRoomMessages(
      this.activeRoom,
      (messages) => {
        this.messages = messages;
        this.renderMessages();
        if (this.authState?.user) {
          this.statusEl.textContent = 'Public room · live';
        } else {
          this.updateComposerState();
        }
        if (this.isOpen) this.markRoomRead();
        else this.updateUnreadCount();
      },
      (error) => {
        this.statusEl.textContent = error.message || 'Situation Room realtime unavailable';
        if (!this.messages.length) void this.refreshMessages();
      },
    );

    if (this.roomSubscription) {
      this.stopPreviewPolling();
      return;
    }

    this.startPreviewPolling();
    void this.refreshMessages();
  }

  private renderMessages(): void {
    if (this.messages.length === 0) {
      this.messagesEl.innerHTML = '<div class="situation-room-empty">No messages yet. Be the first to post.</div>';
      return;
    }

    this.messagesEl.innerHTML = this.messages.map((message) => `
      <article class="situation-room-message">
        <div class="situation-room-message-meta">
          <span class="situation-room-message-time">${escapeHtml(formatMessageTime(message.createdAt))}</span>
          <span class="situation-room-message-user">${escapeHtml(message.userLabel)}</span>
        </div>
        <div class="situation-room-message-body">${escapeHtml(message.content)}</div>
        ${message.viewUrl && message.viewLabel ? `
          <button type="button" class="situation-room-view-link" data-view-url="${escapeHtml(message.viewUrl)}">
            Open shared view · ${escapeHtml(message.viewLabel)}
          </button>
        ` : ''}
      </article>
    `).join('');

    this.messagesEl.querySelectorAll<HTMLButtonElement>('.situation-room-view-link').forEach((button) => {
      button.addEventListener('click', () => {
        const url = button.dataset.viewUrl;
        if (url) window.location.assign(url);
      });
    });
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private renderAttachment(): void {
    const el = this.drawer.querySelector<HTMLElement>('.situation-room-attachment');
    if (!el) return;
    if (!this.attachment) {
      el.hidden = true;
      el.textContent = '';
      this.attachBtn.classList.remove('active');
      return;
    }
    el.hidden = false;
    el.textContent = `Attached view: ${this.attachment.label}`;
    this.attachBtn.classList.add('active');
  }

  private async send(): Promise<void> {
    if (this.isSending || !this.authState?.user) return;
    const content = this.composerEl.value.trim();
    if (!content) return;

    this.isSending = true;
    this.updateComposerState();
    try {
      const user = this.authState.user;
      const message = await sendSituationRoomMessage({
        room: this.activeRoom,
        content,
        displayName: user.displayName,
        avatarUrl: user.photoURL,
        attachment: this.attachment,
      });
      this.messages = [...this.messages.filter(existing => existing.id !== message.id), message]
        .sort((a, b) => a.createdAt - b.createdAt);
      this.composerEl.value = '';
      this.attachment = null;
      this.renderAttachment();
      this.renderMessages();
      this.markRoomRead();
      this.statusEl.textContent = 'Public room · signed in';
    } catch (error) {
      this.statusEl.textContent = error instanceof Error ? error.message : 'Message failed to send';
    } finally {
      this.isSending = false;
      this.updateComposerState();
    }
  }

  private startPreviewPolling(): void {
    if (isSituationRoomRealtimeConfigured()) return;
    this.stopPreviewPolling();
    this.previewPollTimer = window.setInterval(() => {
      if (!this.isOpen) void this.refreshMessages();
    }, PREVIEW_POLL_INTERVAL_MS);
    void this.refreshMessages();
  }

  private stopPreviewPolling(): void {
    if (this.previewPollTimer !== null) {
      window.clearInterval(this.previewPollTimer);
      this.previewPollTimer = null;
    }
  }

  private markRoomRead(): void {
    const latest = this.messages[this.messages.length - 1]?.createdAt ?? Date.now();
    writeLastReadAt(this.activeRoom, latest);
    this.onUnreadCountChange?.(0);
  }

  private updateUnreadCount(): void {
    const lastReadAt = readLastReadAt(this.activeRoom);
    const unread = this.messages.filter(message => message.createdAt > lastReadAt).length;
    this.onUnreadCountChange?.(unread);
  }
}
