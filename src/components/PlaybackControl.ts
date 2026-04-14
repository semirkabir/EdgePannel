import { getSnapshotTimestamps, getSnapshotAt, type DashboardSnapshot } from '@/services/storage';
import { t } from '@/services/i18n';
import { checkFeatureAccess } from '@/services/auth-modal';

const PLAYBACK_PANEL_CLOSE_DELAY_MS = 320;
const PLAYBACK_PANEL_OFFSET_PX = 4;
const SPEEDS = [0.5, 1, 2, 4] as const;

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const totalMins = Math.floor(diff / 60_000);
  if (totalMins < 1) return 'just now';
  if (totalMins < 60) return `${totalMins}m ago`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m ago` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h ago` : `${days}d ago`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC';
}

export class PlaybackControl {
  private element: HTMLElement;
  private toggleButton: HTMLButtonElement;
  private panel: HTMLElement;
  private isPlaybackMode = false;
  private isPanelOpen = false;
  private isPlaying = false;
  private playbackSpeed: number = 1;
  private playInterval: ReturnType<typeof setInterval> | null = null;
  private timestamps: number[] = [];
  private currentIndex = 0;
  private onSnapshotChange: ((snapshot: DashboardSnapshot | null) => void) | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'playback-control';
    this.element.innerHTML = `
      <button class="playback-toggle" title="${t('components.playback.toggleMode')}" aria-label="${t('components.playback.toggleMode')}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="playback-icon"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
      </button>
      <div class="playback-panel hidden">

        <!-- Header -->
        <div class="playback-header">
          <div class="playback-header-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            HISTORICAL PLAYBACK
          </div>
          <div class="playback-header-right">
            <div class="playback-speed-group">
              ${SPEEDS.map(s => `<button class="playback-speed-btn${s === 1 ? ' active' : ''}" data-speed="${s}">${s === 0.5 ? '½×' : `${s}×`}</button>`).join('')}
            </div>
            <button class="playback-close" aria-label="${t('components.playback.close')}">×</button>
          </div>
        </div>

        <!-- Time display -->
        <div class="playback-time-display">
          <div class="playback-live-state">
            <span class="playback-live-dot"></span>
            <span class="playback-live-label">LIVE</span>
          </div>
          <div class="playback-historical-state" style="display:none">
            <div class="playback-ts-main"></div>
            <div class="playback-ts-relative"></div>
          </div>
        </div>

        <!-- Scrubber -->
        <div class="playback-scrubber">
          <input type="range" class="playback-slider" min="0" max="100" value="100">
          <div class="playback-scrubber-labels">
            <span class="playback-oldest-label">oldest</span>
            <span class="playback-now-label">now</span>
          </div>
        </div>

        <!-- Transport -->
        <div class="playback-footer">
          <div class="playback-transport">
            <button class="playback-btn" data-action="start" title="${t('components.playback.skipToStart')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
            </button>
            <button class="playback-btn" data-action="prev" title="${t('components.playback.previous')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><polygon points="10 20 0 12 10 4 10 20"/></svg>
            </button>
            <button class="playback-btn playback-playpause" data-action="playpause" title="Play / Pause">
              <svg class="icon-play" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <svg class="icon-pause" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
            <button class="playback-btn" data-action="next" title="${t('components.playback.next')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><polygon points="14 4 24 12 14 20 14 4"/></svg>
            </button>
            <button class="playback-btn playback-live-btn" data-action="live">LIVE</button>
          </div>
        </div>

      </div>
    `;

    this.toggleButton = this.element.querySelector('.playback-toggle') as HTMLButtonElement;
    this.panel = this.element.querySelector('.playback-panel') as HTMLElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const closeBtn = this.panel.querySelector('.playback-close')!;
    const slider = this.panel.querySelector('.playback-slider') as HTMLInputElement;

    this.toggleButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!checkFeatureAccess('historical-playback')) return;
      if (this.isPanelOpen) { this.closePanel(); return; }
      await this.openPanel();
    });

    this.element.addEventListener('mouseenter', () => { void this.openPanel(); });
    this.element.addEventListener('mouseleave', () => { this.scheduleClose(); });
    this.element.addEventListener('focusin', () => { void this.openPanel(); });
    this.element.addEventListener('focusout', (e) => {
      const related = e.relatedTarget as Node | null;
      if (related && (this.element.contains(related) || this.panel.contains(related))) return;
      this.scheduleClose();
    });

    this.panel.addEventListener('mouseenter', () => this.cancelClose());
    this.panel.addEventListener('mouseleave', () => this.scheduleClose());
    this.panel.addEventListener('focusin', () => this.cancelClose());
    this.panel.addEventListener('focusout', (e) => {
      const related = e.relatedTarget as Node | null;
      if (related && (this.element.contains(related) || this.panel.contains(related))) return;
      this.scheduleClose();
    });

    document.addEventListener('click', (e) => {
      const target = e.target as Node | null;
      if (target && (this.element.contains(target) || this.panel.contains(target))) return;
      this.closePanel();
    });
    window.addEventListener('resize', () => this.positionPanel());
    window.addEventListener('scroll', () => this.positionPanel(), true);

    closeBtn.addEventListener('click', () => { this.closePanel(); this.goLive(); });

    slider.addEventListener('input', () => {
      this.pausePlay();
      const idx = parseInt(slider.value);
      this.currentIndex = idx;
      void this.loadSnapshot(idx);
    });

    // Transport buttons
    this.panel.querySelectorAll('.playback-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleAction((btn as HTMLElement).dataset.action!);
      });
    });

    // Speed buttons
    this.panel.querySelectorAll('.playback-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat((btn as HTMLElement).dataset.speed!);
        this.setSpeed(speed);
      });
    });
  }

  // ── Panel open/close ───────────────────────────────────────────────────────

  private cancelClose(): void {
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; }
  }

  private scheduleClose(): void {
    this.cancelClose();
    this.closeTimer = setTimeout(() => this.closePanel(), PLAYBACK_PANEL_CLOSE_DELAY_MS);
  }

  private async openPanel(): Promise<void> {
    this.cancelClose();
    if (!this.panel.isConnected || this.panel.parentElement !== document.body) {
      document.body.appendChild(this.panel);
    }
    this.panel.classList.remove('hidden');
    this.toggleButton.setAttribute('aria-expanded', 'true');
    this.isPanelOpen = true;
    this.positionPanel();
    await this.loadTimestamps();
  }

  private closePanel(): void {
    this.cancelClose();
    if (!this.isPanelOpen) return;
    this.pausePlay();
    this.panel.classList.add('hidden');
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.isPanelOpen = false;
  }

  private positionPanel(): void {
    if (!this.isPanelOpen) return;
    const rect = this.toggleButton.getBoundingClientRect();
    const panelWidth = this.panel.offsetWidth || 300;
    const panelHeight = this.panel.offsetHeight || 240;
    const pad = 8;
    let left = rect.right - panelWidth;
    left = Math.min(left, window.innerWidth - panelWidth - pad);
    left = Math.max(pad, left);
    let top = rect.bottom + PLAYBACK_PANEL_OFFSET_PX;
    if (top + panelHeight > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - panelHeight - PLAYBACK_PANEL_OFFSET_PX);
    }
    this.panel.style.left = `${left}px`;
    this.panel.style.top = `${top}px`;
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  private async loadTimestamps(): Promise<void> {
    this.timestamps = await getSnapshotTimestamps();
    if (!this.element?.isConnected) return;
    this.timestamps.sort((a, b) => a - b);

    const slider = this.panel.querySelector('.playback-slider') as HTMLInputElement;
    slider.max = String(Math.max(0, this.timestamps.length - 1));
    slider.value = slider.max;
    this.currentIndex = this.timestamps.length - 1;

    this.updateOldestLabel();
    this.updateTimeDisplay();
  }

  private async loadSnapshot(index: number): Promise<void> {
    if (index < 0 || index >= this.timestamps.length) { this.goLive(); return; }
    const timestamp = this.timestamps[index];
    if (!timestamp) { this.goLive(); return; }

    this.isPlaybackMode = true;
    this.updateTimeDisplay();
    this.updateSlider();

    const snapshot = await getSnapshotAt(timestamp);
    if (!this.element?.isConnected) return;
    this.onSnapshotChange?.(snapshot);
    document.body.classList.add('playback-mode');
    this.panel.querySelector('.playback-live-btn')?.classList.remove('active');
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  private startPlay(): void {
    if (this.timestamps.length === 0) return;
    // If already at the end, restart from beginning
    if (this.currentIndex >= this.timestamps.length - 1) {
      this.currentIndex = 0;
    }
    this.isPlaying = true;
    this.updatePlayPauseIcon();

    const intervalMs = Math.round(1000 / this.playbackSpeed);
    this.playInterval = setInterval(() => {
      if (this.currentIndex >= this.timestamps.length - 1) {
        this.pausePlay();
        this.goLive();
        return;
      }
      this.currentIndex++;
      void this.loadSnapshot(this.currentIndex);
    }, intervalMs);
  }

  private pausePlay(): void {
    if (this.playInterval) { clearInterval(this.playInterval); this.playInterval = null; }
    this.isPlaying = false;
    this.updatePlayPauseIcon();
  }

  private setSpeed(speed: number): void {
    this.playbackSpeed = speed;
    this.panel.querySelectorAll('.playback-speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseFloat((btn as HTMLElement).dataset.speed!) === speed);
    });
    // Restart interval at new speed if currently playing
    if (this.isPlaying) {
      this.pausePlay();
      this.startPlay();
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private goLive(): void {
    this.pausePlay();
    this.isPlaybackMode = false;
    this.currentIndex = this.timestamps.length - 1;
    this.updateSlider();
    this.updateTimeDisplay();
    this.onSnapshotChange?.(null);
    document.body.classList.remove('playback-mode');
    this.panel.querySelector('.playback-live-btn')?.classList.add('active');
  }

  private handleAction(action: string): void {
    switch (action) {
      case 'start':
        this.pausePlay();
        this.currentIndex = 0;
        void this.loadSnapshot(this.currentIndex);
        return;
      case 'prev':
        this.pausePlay();
        this.currentIndex = Math.max(0, this.currentIndex - 1);
        void this.loadSnapshot(this.currentIndex);
        return;
      case 'playpause':
        this.isPlaying ? this.pausePlay() : this.startPlay();
        return;
      case 'next':
        this.pausePlay();
        this.currentIndex = Math.min(this.timestamps.length - 1, this.currentIndex + 1);
        void this.loadSnapshot(this.currentIndex);
        return;
      case 'live':
        this.goLive();
        return;
    }
  }

  // ── Display updates ────────────────────────────────────────────────────────

  private updateSlider(): void {
    const slider = this.panel.querySelector('.playback-slider') as HTMLInputElement;
    if (slider) slider.value = String(this.currentIndex);
  }

  private updatePlayPauseIcon(): void {
    const btn = this.panel.querySelector('.playback-playpause');
    if (!btn) return;
    (btn.querySelector('.icon-play') as HTMLElement).style.display = this.isPlaying ? 'none' : '';
    (btn.querySelector('.icon-pause') as HTMLElement).style.display = this.isPlaying ? '' : 'none';
  }

  private updateOldestLabel(): void {
    const label = this.panel.querySelector('.playback-oldest-label') as HTMLElement;
    if (!label || this.timestamps.length === 0) return;
    label.textContent = formatRelative(this.timestamps[0]);
  }

  private updateTimeDisplay(): void {
    const liveState = this.panel.querySelector('.playback-live-state') as HTMLElement;
    const histState = this.panel.querySelector('.playback-historical-state') as HTMLElement;
    if (!liveState || !histState) return;

    if (!this.isPlaybackMode || this.timestamps.length === 0) {
      liveState.style.display = '';
      histState.style.display = 'none';
      return;
    }

    const ts = this.timestamps[this.currentIndex];
    if (!ts) return;

    liveState.style.display = 'none';
    histState.style.display = '';
    (histState.querySelector('.playback-ts-main') as HTMLElement).textContent = formatTimestamp(ts);
    (histState.querySelector('.playback-ts-relative') as HTMLElement).textContent = formatRelative(ts);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public onSnapshot(callback: (snapshot: DashboardSnapshot | null) => void): void {
    this.onSnapshotChange = callback;
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public isInPlaybackMode(): boolean {
    return this.isPlaybackMode;
  }
}
