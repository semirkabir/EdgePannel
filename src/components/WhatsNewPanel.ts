import { DetailPanelBase } from './detail-panel/DetailPanelBase';
import { RELEASE_AUTHOR, RELEASE_SOURCE_URL, RELEASE_TIMELINE, type ReleaseTimelineEntry } from '@/data/release-timeline';
import { sanitizeUrl } from '@/utils/sanitize';

export class WhatsNewPanel extends DetailPanelBase {
  private readonly maximizeButton: HTMLButtonElement;

  private static readonly ICON_BACK = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>`;

  constructor() {
    super({
      id: 'whats-new-panel',
      ariaLabel: "What's New",
      contentId: 'whats-new-content',
      closeId: 'whats-new-close',
      rootClassName: 'entity-detail-panel whats-new-panel edp-has-history',
      shellClassName: 'edp-shell whats-new-shell',
      closeClassName: 'edp-close whats-new-close',
      contentClassName: 'edp-panel-content whats-new-content',
      activeClassName: 'edp-active',
      maximizedClassName: 'edp-maximized',
      closeText: '\u00d7',
      panelTypeLabel: 'RELEASES',
    });
    this.maximizeButton = this.createMaximizeButton();
    this.createBackButton();
  }

  public show(): void {
    this.content.replaceChildren(this.render());
    this.openPanel();
    this.syncMaximizeButton();
  }

  public hide(): void {
    if (this.isMaximizedState) this.minimize();
    this.syncMaximizeButton();
    this.closePanel();
    this.onCloseCallback?.();
  }

  private render(): HTMLElement {
    const root = this.el('div', 'whats-new-view');

    // Sticky mini-header — only visible in fullscreen/maximized mode
    const stickyBar = this.el('div', 'whats-new-sticky-bar');
    const stickyTitle = this.el('span', 'whats-new-sticky-title', "What\u2019s New");
    const stickyCount = this.el('span', 'whats-new-sticky-count', `${RELEASE_TIMELINE.length} releases`);
    stickyBar.append(stickyTitle, stickyCount);
    root.append(stickyBar);

    const header = this.el('section', 'edp-header whats-new-hero');
    const kicker = this.el('div', 'whats-new-kicker', 'Release timeline');
    const title = this.el('h2', 'edp-title whats-new-title', "What's New");
    const subtitle = this.el(
      'p',
      'edp-subtitle whats-new-subtitle',
      `Product updates released by ${RELEASE_AUTHOR}. Newest updates are shown first.`,
    );

    const meta = this.el('div', 'whats-new-meta');
    meta.append(
      this.renderMetaChip(`${RELEASE_TIMELINE.length} releases`),
      this.renderMetaChip('Newest first'),
      this.renderMetaChip('Expandable panel'),
    );

    const source = this.el('a', 'whats-new-source') as HTMLAnchorElement;
    source.href = sanitizeUrl(RELEASE_SOURCE_URL);
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Open GitHub releases ↗';

    header.append(kicker, title, subtitle, meta, source);
    root.append(header);

    const timeline = this.el('section', 'whats-new-timeline');
    for (const entry of RELEASE_TIMELINE) {
      timeline.append(this.renderTimelineEntry(entry));
    }
    root.append(timeline);

    return root;
  }

  private renderMetaChip(text: string): HTMLElement {
    return this.el('span', 'whats-new-meta-chip', text);
  }

  private renderTimelineEntry(entry: ReleaseTimelineEntry): HTMLElement {
    const article = this.el('article', `whats-new-release${entry.status === 'current' ? ' is-current' : ''}`);

    const marker = this.el('div', 'whats-new-marker');
    marker.setAttribute('aria-hidden', 'true');

    const body = this.el('div', 'whats-new-release-body');
    const eyebrow = this.el('div', 'whats-new-release-eyebrow');
    eyebrow.append(
      this.el('span', 'whats-new-version', entry.version),
      this.el('span', 'whats-new-date', entry.date),
    );
    if (entry.status === 'current') {
      eyebrow.append(this.el('span', 'whats-new-status', 'Current'));
    }

    const title = this.el('h3', 'whats-new-release-title', entry.title);
    const summary = this.el('p', 'whats-new-release-summary', entry.summary);
    const list = this.el('ul', 'whats-new-highlights');
    for (const highlight of entry.highlights) {
      list.append(this.el('li', undefined, highlight));
    }

    body.append(eyebrow, title, summary, list);
    article.append(marker, body);
    return article;
  }

  private static readonly ICON_FULLSCREEN = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>`;

  private static readonly ICON_RIGHT_PANEL = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2"/>
    <line x1="15" y1="3" x2="15" y2="21" stroke-width="1.5"/>
    <rect x="15" y="3" width="7" height="18" fill="currentColor" opacity="0.25" stroke="none"/>
  </svg>`;

  private createMaximizeButton(): HTMLButtonElement {
    const button = this.el('button', 'edp-maximize whats-new-maximize') as HTMLButtonElement;
    button.type = 'button';
    button.setAttribute('aria-label', 'Expand release timeline to full view');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Expand release timeline to full view';
    button.innerHTML = WhatsNewPanel.ICON_FULLSCREEN;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.isMaximizedState) this.minimize();
      else this.maximize();
      this.syncMaximizeButton();
    });
    this.panel.querySelector<HTMLElement>('.whats-new-shell')?.append(button);
    return button;
  }

  private createBackButton(): HTMLButtonElement {
    const button = this.el('button', 'edp-back whats-new-back') as HTMLButtonElement;
    button.type = 'button';
    button.setAttribute('aria-label', 'Back to previous panel');
    button.title = 'Back';
    button.innerHTML = WhatsNewPanel.ICON_BACK;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.hide();
    });
    this.panel.querySelector<HTMLElement>('.whats-new-shell')?.append(button);
    return button;
  }

  private syncMaximizeButton(): void {
    this.maximizeButton.setAttribute('aria-pressed', String(this.isMaximizedState));
    if (this.isMaximizedState) {
      this.maximizeButton.innerHTML = WhatsNewPanel.ICON_RIGHT_PANEL;
      this.maximizeButton.title = 'Back to side panel';
      this.maximizeButton.setAttribute('aria-label', 'Back to side panel');
      return;
    }

    this.maximizeButton.innerHTML = WhatsNewPanel.ICON_FULLSCREEN;
    this.maximizeButton.title = 'Expand release timeline to full view';
    this.maximizeButton.setAttribute('aria-label', 'Expand release timeline to full view');
  }
}
