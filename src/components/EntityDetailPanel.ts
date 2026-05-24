import type { PopupType } from './MapPopup';
import type { EntityRenderer, EntityRenderContext, EntityRendererRegistry } from './entity-detail/types';
import { GenericEntityRenderer } from './entity-detail/renderers/generic';
import { DetailPanelBase } from './detail-panel/DetailPanelBase';
import { attachEntityGraphEnrichment } from './entity-detail/entity-graph-enrichment';
import { attachExternalDatasetEnrichment } from './entity-detail/external-enrichment';
import { resolveEntityHeroImage, type EntityHeroImage } from '@/services/entity-hero-image';
import { sanitizeUrl } from '@/utils/sanitize';

/**
 * Right-side detail panel that slides in when a user clicks a map entity.
 * Modeled on CountryDeepDivePanel — same slide-in animation, card system, maximize support.
 */
export class EntityDetailPanel extends DetailPanelBase {
  private currentType: PopupType | null = null;
  private currentData: unknown = null;
  private abortController: AbortController = new AbortController();
  private navStack: HTMLElement[][] = [];
  private readonly maximizeButton: HTMLButtonElement;
  private tabObserver: MutationObserver | null = null;

  private readonly registry: EntityRendererRegistry;
  private readonly generic: GenericEntityRenderer = new GenericEntityRenderer();

  constructor(registry: EntityRendererRegistry = {}) {
    super({
      id: 'entity-detail-panel',
      ariaLabel: 'Entity Details',
      contentId: 'entity-detail-content',
      closeId: 'entity-detail-close',
      rootClassName: 'entity-detail-panel',
      shellClassName: 'edp-shell',
      closeClassName: 'edp-close',
      contentClassName: 'edp-panel-content',
      activeClassName: 'edp-active',
      maximizedClassName: 'edp-maximized',
      closeText: '\u00d7',
    });
    this.registry = registry;
    this.maximizeButton = this.createMaximizeButton();
    this.setupTabTransitionObserver();
  }

  // ---- Public API ----

  public show(type: PopupType, data: unknown): void {
    this.navStack = [];
    this.abortController.abort();
    this.abortController = new AbortController();
    this.currentType = type;
    this.currentData = data;

    const renderer: EntityRenderer = this.registry[type] ?? this.generic;
    const ctx = this.buildContext();
    const skeleton = renderer.renderSkeleton(data, ctx);

    this.content.replaceChildren(skeleton);
    this.openPanel();

    const imagePromise = type === 'company'
      ? Promise.resolve(null)
      : resolveEntityHeroImage(type, data, this.abortController.signal).catch(() => null);

    void imagePromise.then((image) => {
      if (!this.abortController.signal.aborted && this.currentData === data) {
        this.injectHeroImage(image);
      }
    });

    // Kick off async enrichment
    if (renderer.enrich) {
      const signal = this.abortController.signal;
      renderer.enrich(data, signal)
        .then((enriched) => {
          if (!signal.aborted && this.currentData === data) {
            renderer.renderEnriched?.(this.content, enriched, ctx);
            void imagePromise.then((image) => {
              if (!signal.aborted && this.currentData === data) {
                this.injectHeroImage(image);
              }
            });
            void this.attachEntityGraph(type, data, ctx, signal);
            void this.attachExternalEnrichment(type, data, ctx, signal);
          }
        })
        .catch((err) => {
          if (signal.aborted || this.currentData !== data) return;
          console.error('[EntityDetailPanel] Enrichment failed:', err);
          const errorEl = document.createElement('div');
          errorEl.className = 'edp-error-banner';
          errorEl.textContent = 'Failed to load details. Please try again later.';
          this.content.append(errorEl);
          void this.attachEntityGraph(type, data, ctx, signal);
          void this.attachExternalEnrichment(type, data, ctx, signal);
        });
    } else {
      void this.attachEntityGraph(type, data, ctx, this.abortController.signal);
      void this.attachExternalEnrichment(type, data, ctx, this.abortController.signal);
    }
  }

  public hide(): void {
    if (this.isMaximizedState) {
      this.minimize();
    }
    this.syncMaximizeButton();
    this.abortController.abort();
    this.closePanel();
    this.currentType = null;
    this.currentData = null;
    this.onCloseCallback?.();
  }

  public getEntityType(): PopupType | null {
    return this.currentType;
  }

  // ---- Private ----

  private navigateTo(el: HTMLElement): void {
    this.navStack.push(Array.from(this.content.children) as HTMLElement[]);
    const backBtn = this.el('button', 'edp-back-btn', '← Back');
    backBtn.addEventListener('click', () => this.navBack());
    el.prepend(backBtn);
    this.content.replaceChildren(el);
  }

  private navBack(): void {
    const prev = this.navStack.pop();
    if (prev) this.content.replaceChildren(...prev);
  }

  private buildContext(): EntityRenderContext {
    return {
      el: this.el.bind(this),
      sectionCard: this.sectionCard.bind(this),
      badge: this.badge.bind(this),
      makeLoading: this.makeLoading.bind(this),
      makeEmpty: this.makeEmpty.bind(this),
      signal: this.abortController.signal,
      navigate: (el) => this.navigateTo(el),
    };
  }

  // Expand icon shown in right-panel mode — click to go full-screen
  private static readonly ICON_FULLSCREEN = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>`;

  // Right-panel split icon shown in full-screen mode — click to go back to side rail
  private static readonly ICON_RIGHT_PANEL = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2"/>
    <line x1="15" y1="3" x2="15" y2="21" stroke-width="1.5"/>
    <rect x="15" y="3" width="7" height="18" fill="currentColor" opacity="0.25" stroke="none"/>
  </svg>`;

  private createMaximizeButton(): HTMLButtonElement {
    const button = this.el('button', 'edp-maximize') as HTMLButtonElement;
    button.type = 'button';
    button.setAttribute('aria-label', 'Expand to full view');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Expand to full view';
    button.innerHTML = EntityDetailPanel.ICON_FULLSCREEN;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.isMaximizedState) this.minimize();
      else this.maximize();
      this.syncMaximizeButton();
    });
    const shell = this.panel.querySelector<HTMLElement>('.edp-shell');
    shell?.append(button);
    return button;
  }

  private syncMaximizeButton(): void {
    this.maximizeButton.setAttribute('aria-pressed', String(this.isMaximizedState));
    if (this.isMaximizedState) {
      this.maximizeButton.innerHTML = EntityDetailPanel.ICON_RIGHT_PANEL;
      this.maximizeButton.title = 'Back to side panel';
      this.maximizeButton.setAttribute('aria-label', 'Back to side panel');
    } else {
      this.maximizeButton.innerHTML = EntityDetailPanel.ICON_FULLSCREEN;
      this.maximizeButton.title = 'Expand to full view';
      this.maximizeButton.setAttribute('aria-label', 'Expand to full view');
    }
  }

  private injectHeroImage(image: EntityHeroImage | null): void {
    if (!image) return;
    if (this.content.querySelector('.edp-flight-media, .edp-nuclear-photo, .edp-base-photo, .edp-vessel-photo, .edp-vessel-wiki-wrap, .edp-article-hero, .edp-auto-hero')) return;

    const hero = this.el('section', 'edp-auto-hero');
    const img = this.el('img', 'edp-auto-hero-img') as HTMLImageElement;
    img.src = sanitizeUrl(image.imageUrl);
    img.alt = image.alt;
    img.loading = 'lazy';
    hero.append(img);

    const credit = this.el('div', 'edp-auto-hero-credit');
    credit.append(this.el('span', 'edp-auto-hero-credit-label', 'Source'));
    const sourceText = image.sourceLabel === 'Image via Wikipedia' ? 'Wikipedia' : image.sourceLabel;
    if (image.pageUrl) {
      const link = this.el('a', 'edp-auto-hero-link') as HTMLAnchorElement;
      link.href = sanitizeUrl(image.pageUrl);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = sourceText;
      credit.append(link);
    } else {
      credit.append(this.el('span', 'edp-auto-hero-source', sourceText));
    }
    hero.append(credit);

    const header = this.content.querySelector('.edp-header');
    if (header) {
      header.insertAdjacentElement('beforebegin', hero);
      return;
    }

    this.content.prepend(hero);
  }

  private async attachEntityGraph(
    type: PopupType,
    data: unknown,
    ctx: EntityRenderContext,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await attachEntityGraphEnrichment(this.content, type, data, ctx, signal);
    } catch (error) {
      if (!signal.aborted && this.currentData === data) {
        console.warn('[EntityDetailPanel] Entity graph enrichment failed:', error);
      }
    }
  }

  private async attachExternalEnrichment(
    type: PopupType,
    data: unknown,
    ctx: EntityRenderContext,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await attachExternalDatasetEnrichment(this.content, type, data, ctx, signal);
    } catch (error) {
      if (!signal.aborted && this.currentData === data) {
        console.warn('[EntityDetailPanel] External dataset enrichment failed:', error);
      }
    }
  }

  private sectionCard(title: string): [HTMLElement, HTMLElement] {
    const card = this.el('section', 'edp-card');
    const heading = this.el('h3', 'edp-card-title', title);
    const body = this.el('div', 'edp-card-body');
    card.append(heading, body);
    return [card, body];
  }

  private badge(text: string, className: string): HTMLElement {
    return this.el('span', className, text);
  }

  private makeLoading(text: string): HTMLElement {
    const wrap = this.el('div', 'edp-loading-inline');
    wrap.append(
      this.el('div', 'edp-loading-line'),
      this.el('div', 'edp-loading-line edp-loading-line-short'),
      this.el('span', 'edp-loading-text', text),
    );
    return wrap;
  }

  private makeEmpty(text: string): HTMLElement {
    return this.el('div', 'edp-empty', text);
  }

  private setupTabTransitionObserver(): void {
    if (this.tabObserver) {
      this.tabObserver.disconnect();
    }

    this.tabObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // A child node was added/removed inside a tab-content container
          const target = mutation.target as HTMLElement;
          if (target && target.nodeType === Node.ELEMENT_NODE) {
            const isTabContent =
              target.getAttribute('data-slot') === 'tab-content' ||
              target.classList.contains('cp-tab-content') ||
              target.classList.contains('edp-portfolio-tab-content') ||
              target.classList.contains('crypto-tab-content') ||
              target.className.includes('tab-content') ||
              target.className.includes('tab-pane');

            if (isTabContent) {
              target.classList.remove('cp-tab-transition');
              void target.offsetWidth; // Force visual reflow
              target.classList.add('cp-tab-transition');
            }
          }
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'hidden') {
          // Hidden attribute toggled (e.g. crypto-tab-pane)
          const target = mutation.target as HTMLElement;
          if (target && target.nodeType === Node.ELEMENT_NODE) {
            const isTabPane =
              target.className.includes('tab-pane') ||
              target.className.includes('tab-content');

            if (isTabPane && !target.hidden) {
              target.classList.remove('cp-tab-transition');
              void target.offsetWidth; // Force visual reflow
              target.classList.add('cp-tab-transition');
            }
          }
        }
      }
    });

    this.tabObserver.observe(this.content, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden'],
    });
  }
}
