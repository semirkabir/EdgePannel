import type { PopupType } from './MapPopup';
import type { EntityRenderer, EntityRenderContext, EntityRendererRegistry } from './entity-detail/types';
import { GenericEntityRenderer } from './entity-detail/renderers/generic';
import { DetailPanelBase } from './detail-panel/DetailPanelBase';
import { attachEntityGraphEnrichment } from './entity-detail/entity-graph-enrichment';
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
        });
    } else {
      void this.attachEntityGraph(type, data, ctx, this.abortController.signal);
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

  private createMaximizeButton(): HTMLButtonElement {
    const button = this.el('button', 'edp-maximize') as HTMLButtonElement;
    button.type = 'button';
    button.setAttribute('aria-label', 'Fullscreen');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Fullscreen';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
        <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
        <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
        <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
      </svg>
    `;
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
    this.maximizeButton.title = this.isMaximizedState ? 'Exit fullscreen' : 'Fullscreen';
    this.maximizeButton.setAttribute('aria-label', this.maximizeButton.title);
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
}
