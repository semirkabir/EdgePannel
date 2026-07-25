/**
 * DataSourcesPanel — audit view of the live data pipeline.
 *
 * Lists every registered data source with its health (live / cached / stale /
 * error / idle) and last successful fetch, so "is this stale?" is answerable
 * without opening devtools. Self-contained overlay, mirroring the
 * AgentChatPanel / SituationReportPanel pattern.
 */
import { getDataSourceStatuses, type DataSourceHealth, type DataSourceStatus } from '@/utils/circuit-breaker';
import { FEEDS } from '@/config/feeds';
import { escapeHtml } from '@/utils/sanitize';

const HEALTH_ORDER: DataSourceHealth[] = ['error', 'stale', 'cached', 'live', 'idle'];

const HEALTH_LABEL: Record<DataSourceHealth, string> = {
  live: 'Live',
  cached: 'Cached',
  stale: 'Stale',
  error: 'Error',
  idle: 'Idle',
};

export class DataSourcesPanel {
  private overlay: HTMLElement;
  private summaryEl: HTMLElement;
  private listEl: HTMLElement;
  private searchEl: HTMLInputElement;
  private subtitleEl: HTMLElement;
  private statuses: DataSourceStatus[] = [];
  private filter: DataSourceHealth | 'all' = 'all';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'dsrc-overlay';
    this.overlay.hidden = true;

    const panel = document.createElement('aside');
    panel.className = 'dsrc-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Data sources and status');
    panel.innerHTML = `
      <header class="dsrc-header">
        <div>
          <h2>Sources &amp; Status</h2>
          <p class="dsrc-subtitle"></p>
        </div>
        <button type="button" class="dsrc-close" aria-label="Close">×</button>
      </header>
      <div class="dsrc-summary"></div>
      <div class="dsrc-search-wrap">
        <input type="search" class="dsrc-search" placeholder="Search sources…" aria-label="Search sources">
      </div>
      <div class="dsrc-list" aria-live="polite"></div>
      <footer class="dsrc-footer">
        All data is sourced from publicly available APIs, RSS feeds and open datasets.
      </footer>
    `;
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.summaryEl = panel.querySelector<HTMLElement>('.dsrc-summary')!;
    this.listEl = panel.querySelector<HTMLElement>('.dsrc-list')!;
    this.searchEl = panel.querySelector<HTMLInputElement>('.dsrc-search')!;
    this.subtitleEl = panel.querySelector<HTMLElement>('.dsrc-subtitle')!;

    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay || (event.target as HTMLElement).closest('.dsrc-close')) {
        this.close();
      }
    });
    this.searchEl.addEventListener('input', () => this.renderList());
    this.summaryEl.addEventListener('click', (event) => {
      const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-health]');
      if (!chip) return;
      const health = chip.dataset.health as DataSourceHealth | 'all';
      this.filter = this.filter === health ? 'all' : health;
      this.renderSummary();
      this.renderList();
    });
  }

  public open(): void {
    this.overlay.hidden = false;
    this.overlay.classList.add('active');
    this.refresh();
    // Health changes as fetches land while the panel is open.
    this.refreshTimer ??= setInterval(() => this.refresh(), 5000);
  }

  public close(): void {
    this.overlay.classList.remove('active');
    this.overlay.hidden = true;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  public destroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    this.overlay.remove();
  }

  private refresh(): void {
    this.statuses = getDataSourceStatuses();
    const feedCount = safeFeedCount();
    const tracked = this.statuses.length;
    this.subtitleEl.textContent = tracked
      ? `${tracked} tracked service${tracked === 1 ? '' : 's'}${feedCount ? ` · ${feedCount} news feeds configured` : ''}`
      : 'No services have reported yet';
    this.renderSummary();
    this.renderList();
  }

  private counts(): Record<DataSourceHealth, number> {
    const c: Record<DataSourceHealth, number> = { live: 0, cached: 0, stale: 0, error: 0, idle: 0 };
    for (const s of this.statuses) c[s.health] += 1;
    return c;
  }

  private renderSummary(): void {
    const counts = this.counts();
    const chips = HEALTH_ORDER
      .filter(h => counts[h] > 0)
      .map(h => `
        <button type="button" class="dsrc-chip health-${h}${this.filter === h ? ' active' : ''}" data-health="${h}">
          <span class="dsrc-chip-n">${counts[h]}</span>
          <span class="dsrc-chip-l">${HEALTH_LABEL[h]}</span>
        </button>
      `).join('');
    this.summaryEl.innerHTML = chips || '<div class="dsrc-empty">Waiting for the first fetches…</div>';
  }

  private renderList(): void {
    const query = this.searchEl.value.trim().toLowerCase();
    const rows = this.statuses.filter(s =>
      (this.filter === 'all' || s.health === this.filter)
      && (!query || s.name.toLowerCase().includes(query)));

    if (rows.length === 0) {
      this.listEl.innerHTML = `<div class="dsrc-empty">${
        this.statuses.length === 0
          ? 'No services have reported yet. Data sources register as they are first used.'
          : 'No sources match this filter.'
      }</div>`;
      return;
    }

    this.listEl.innerHTML = rows.map(s => `
      <div class="dsrc-row">
        <span class="dsrc-dot health-${s.health}" title="${escapeHtml(HEALTH_LABEL[s.health])}"></span>
        <span class="dsrc-name">${escapeHtml(s.name)}</span>
        <span class="dsrc-detail">${escapeHtml(s.detail === 'ok' ? '' : s.detail)}</span>
        <span class="dsrc-age">${s.lastUpdated ? escapeHtml(formatAge(s.lastUpdated)) : '—'}</span>
      </div>
    `).join('');
  }
}

/**
 * Feeds configured for the *running* variant. Deliberately not
 * `getTotalFeedCount()`, which always counts the full variant's catalogue and
 * would overstate the number on tech/finance/happy/commodity/conflicts builds.
 */
function safeFeedCount(): number {
  try {
    const names = new Set<string>();
    for (const feeds of Object.values(FEEDS)) {
      for (const f of feeds) names.add(f.name);
    }
    return names.size;
  } catch {
    return 0;
  }
}

function formatAge(ts: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
