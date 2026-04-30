export interface DetailPanelBaseOptions {
  id: string;
  ariaLabel: string;
  contentId: string;
  closeId: string;
  rootClassName?: string;
  shellClassName?: string;
  closeClassName?: string;
  contentClassName?: string;
  activeClassName?: string;
  maximizedClassName?: string;
  closeText?: string;
  closeAriaLabel?: string;
}

/**
 * Shared right-rail detail panel mechanics.
 *
 * Subclasses own rendering and data lifecycle; this base owns DOM shell,
 * focus trapping, Escape handling, backdrop minimize, and maximize state.
 */
export abstract class DetailPanelBase {
  protected readonly panel: HTMLElement;
  protected readonly content: HTMLElement;
  protected readonly closeButton: HTMLButtonElement;
  protected isMaximizedState = false;
  protected lastFocusedElement: HTMLElement | null = null;
  protected onCloseCallback?: () => void;

  private readonly activeClassName: string;
  private readonly maximizedClassName: string;
  private readonly contentClassName: string;

  private readonly handleGlobalKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.hide();
      return;
    }

    if (e.key === 'Tab') {
      const focusable = this.getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  protected constructor(options: DetailPanelBaseOptions) {
    this.activeClassName = options.activeClassName ?? 'dp-active';
    this.maximizedClassName = options.maximizedClassName ?? 'dp-maximized';
    this.contentClassName = options.contentClassName ?? 'dp-panel-content';

    this.panel = this.getOrCreatePanel(options);

    const content = this.panel.querySelector<HTMLElement>(`#${options.contentId}`);
    const closeButton = this.panel.querySelector<HTMLButtonElement>(`#${options.closeId}`);
    if (!content || !closeButton) {
      throw new Error(`Detail panel structure is invalid for ${options.id}`);
    }

    this.content = content;
    this.closeButton = closeButton;
    this.closeButton.addEventListener('click', () => this.hide());

    this.panel.addEventListener('click', (e) => {
      const target = e.target;
      if (
        this.isMaximizedState
        && target instanceof HTMLElement
        && !target.closest(`.${this.contentClassName}`)
      ) {
        this.minimize();
      }
    });
  }

  public abstract hide(): void;

  public isVisible(): boolean {
    return this.panel.classList.contains(this.activeClassName);
  }

  public onClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  public maximize(): void {
    if (this.isMaximizedState) return;
    this.isMaximizedState = true;
    this.panel.classList.add(this.maximizedClassName);
  }

  public minimize(): void {
    if (!this.isMaximizedState) return;
    this.isMaximizedState = false;
    this.panel.classList.remove(this.maximizedClassName);
  }

  protected openPanel(): void {
    if (this.panel.classList.contains(this.activeClassName)) return;
    if (!this.panel.isConnected) {
      document.body.appendChild(this.panel);
    }
    this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.panel.classList.add(this.activeClassName);
    this.panel.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', this.handleGlobalKeydown);
    requestAnimationFrame(() => this.closeButton.focus());
  }

  protected closePanel(): void {
    if (!this.panel.classList.contains(this.activeClassName)) return;
    this.panel.classList.remove(this.activeClassName);
    this.panel.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    if (this.lastFocusedElement) this.lastFocusedElement.focus();
  }

  protected el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  private getFocusableElements(): HTMLElement[] {
    const selectors = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.querySelectorAll<HTMLElement>(selectors))
      .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
  }

  private getOrCreatePanel(options: DetailPanelBaseOptions): HTMLElement {
    const existing = document.getElementById(options.id);
    if (existing) return existing;

    const panel = this.el('aside', options.rootClassName ?? 'detail-panel');
    panel.id = options.id;
    panel.setAttribute('aria-label', options.ariaLabel);
    panel.setAttribute('aria-hidden', 'true');

    const shell = this.el('div', options.shellClassName ?? 'dp-shell');
    const close = this.el('button', options.closeClassName ?? 'dp-close', options.closeText ?? 'x') as HTMLButtonElement;
    close.id = options.closeId;
    close.setAttribute('aria-label', options.closeAriaLabel ?? 'Close');

    const content = this.el('div', this.contentClassName);
    content.id = options.contentId;
    shell.append(close, content);

    panel.addEventListener('wheel', (e) => {
      e.stopPropagation();
      content.scrollTop += e.deltaY;
    }, { passive: true });

    panel.append(shell);
    document.body.append(panel);
    return panel;
  }
}
