/**
 * OnboardingHints — lightweight first-run hints for power features.
 *
 * Each hint is a small anchored chip pointing at a UI element. Hints appear
 * after a short delay on first visit, are individually dismissible, and all
 * disappear permanently when the user clicks "Got it, dismiss all".
 *
 * State is stored in localStorage under `wm-ui-power-hints-dismissed-v1`.
 */

import { UI_PREFERENCE_KEYS } from '@/app/ui-preferences';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HintDef {
  id: string;
  /** CSS selector for the anchor element */
  anchor: string;
  title: string;
  body: string;
  /** Preferred position relative to anchor. Default 'below'. */
  placement?: 'below' | 'above' | 'left' | 'right';
}

/* ------------------------------------------------------------------ */
/*  Hint definitions                                                   */
/* ------------------------------------------------------------------ */

const HINTS: HintDef[] = [
  {
    id: 'search',
    anchor: '#searchBtn',
    title: 'Command palette',
    body: 'Press ⌘K / Ctrl+K anywhere to search countries, entities, news, and run quick actions.',
    placement: 'below',
  },
  {
    id: 'layers',
    anchor: '.map-layers-btn, #layersBtn, [data-action="layers"], .deck-layers-btn',
    title: 'Layer controls',
    body: 'Toggle 45+ data layers: cables, satellites, shipping, conflicts, and more.',
    placement: 'below',
  },
  {
    id: 'panel-drag',
    anchor: '.panels-grid .panel-header',
    title: 'Drag to reorder',
    body: 'Drag any panel header to reorder panels. Your layout is saved automatically.',
    placement: 'above',
  },
  {
    id: 'right-panel',
    anchor: '.edp-maximize, .entity-detail-panel .edp-close',
    title: 'Expand detail panels',
    body: 'Click ⤢ to expand any detail panel to full screen for deeper reading.',
    placement: 'left',
  },
  {
    id: 'save-layout',
    anchor: '#saveLayoutBtn, [data-action="save-layout"], .header-overflow-btn',
    title: 'Save & reset layout',
    body: 'Open the ⋯ menu to save your current layout or reset to defaults.',
    placement: 'below',
  },
];

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = UI_PREFERENCE_KEYS.powerHintsDismissed;

function getDismissedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set<string>(parsed as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveDismissedSet(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

function areAllDismissed(): boolean {
  const dismissed = getDismissedSet();
  return HINTS.every(h => dismissed.has(h.id));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export class OnboardingHints {
  private container: HTMLElement | null = null;
  private chips = new Map<string, HTMLElement>();
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  init(): void {
    // Don't show on mobile or if all already dismissed
    if (window.innerWidth < 900 || areAllDismissed()) return;

    // Wait until after initial render
    setTimeout(() => this.mount(), 1800);
  }

  private mount(): void {
    if (areAllDismissed()) return;

    this.container = document.createElement('div');
    this.container.className = 'ohint-layer';
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);

    const dismissed = getDismissedSet();
    for (const hint of HINTS) {
      if (dismissed.has(hint.id)) continue;
      const anchor = this.resolveAnchor(hint.anchor);
      if (!anchor) continue;
      this.createChip(hint, anchor);
    }

    if (this.chips.size === 0) {
      this.destroy();
      return;
    }

    // Re-position on resize
    this.resizeObserver = new ResizeObserver(() => this.repositionAll());
    this.resizeObserver.observe(document.documentElement);

    // Watch for anchor elements appearing later (e.g. detail panels)
    this.mutationObserver = new MutationObserver(() => this.checkForNewAnchors());
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  private resolveAnchor(selector: string): HTMLElement | null {
    const parts = selector.split(',').map(s => s.trim());
    for (const sel of parts) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }
    return null;
  }

  private createChip(hint: HintDef, anchor: HTMLElement): void {
    const chip = document.createElement('div');
    chip.className = 'ohint-chip';
    chip.dataset.hintId = hint.id;
    chip.dataset.placement = hint.placement ?? 'below';

    const titleEl = document.createElement('div');
    titleEl.className = 'ohint-title';
    titleEl.textContent = hint.title;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'ohint-body';
    bodyEl.textContent = hint.body;

    const actions = document.createElement('div');
    actions.className = 'ohint-actions';

    const dismissOne = document.createElement('button');
    dismissOne.className = 'ohint-dismiss-one';
    dismissOne.textContent = 'Got it';
    dismissOne.addEventListener('click', () => this.dismissHint(hint.id));

    const dismissAll = document.createElement('button');
    dismissAll.className = 'ohint-dismiss-all';
    dismissAll.textContent = 'Dismiss all hints';
    dismissAll.addEventListener('click', () => this.dismissAll());

    actions.append(dismissOne, dismissAll);
    chip.append(titleEl, bodyEl, actions);

    // Animate in with stagger
    chip.style.opacity = '0';
    chip.style.transform = 'translateY(6px)';
    this.container!.appendChild(chip);
    this.chips.set(hint.id, chip);

    this.positionChip(chip, anchor, hint.placement ?? 'below');

    // Stagger entry animation
    const delay = this.chips.size * 120;
    setTimeout(() => {
      chip.style.transition = 'opacity 0.3s var(--ease-reveal, ease), transform 0.3s var(--ease-reveal, ease)';
      chip.style.opacity = '1';
      chip.style.transform = '';
    }, delay);

    // Store anchor reference for repositioning
    (chip as HTMLElement & { _anchor?: HTMLElement })._anchor = anchor;
  }

  private positionChip(
    chip: HTMLElement,
    anchor: HTMLElement,
    placement: HintDef['placement'],
  ): void {
    const rect = anchor.getBoundingClientRect();
    if (!rect.width && !rect.height) return; // anchor not visible yet

    const gap = 10;
    const chipW = 240;

    chip.style.position = 'fixed';
    chip.style.width = `${chipW}px`;
    chip.style.zIndex = '10020';

    switch (placement) {
      case 'above':
        chip.style.left = `${Math.min(Math.max(rect.left, 8), window.innerWidth - chipW - 8)}px`;
        chip.style.top = ''; // set after measuring chip height
        // We'll set top after the element is in DOM
        requestAnimationFrame(() => {
          chip.style.top = `${rect.top - chip.offsetHeight - gap}px`;
        });
        break;
      case 'left':
        chip.style.left = `${Math.max(rect.left - chipW - gap, 8)}px`;
        chip.style.top = `${rect.top + rect.height / 2 - 40}px`;
        break;
      case 'right':
        chip.style.left = `${Math.min(rect.right + gap, window.innerWidth - chipW - 8)}px`;
        chip.style.top = `${rect.top + rect.height / 2 - 40}px`;
        break;
      default: // below
        chip.style.left = `${Math.min(Math.max(rect.left, 8), window.innerWidth - chipW - 8)}px`;
        chip.style.top = `${rect.bottom + gap}px`;
        break;
    }
  }

  private repositionAll(): void {
    for (const [id, chip] of this.chips) {
      const hint = HINTS.find(h => h.id === id);
      const anchor = (chip as HTMLElement & { _anchor?: HTMLElement })._anchor;
      if (hint && anchor) {
        this.positionChip(chip, anchor, hint.placement ?? 'below');
      }
    }
  }

  private checkForNewAnchors(): void {
    const dismissed = getDismissedSet();
    for (const hint of HINTS) {
      if (dismissed.has(hint.id) || this.chips.has(hint.id)) continue;
      const anchor = this.resolveAnchor(hint.anchor);
      if (anchor && this.container) {
        this.createChip(hint, anchor);
      }
    }
  }

  private dismissHint(id: string): void {
    const chip = this.chips.get(id);
    if (chip) {
      chip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      chip.style.opacity = '0';
      chip.style.transform = 'translateY(-4px)';
      setTimeout(() => chip.remove(), 220);
      this.chips.delete(id);
    }
    const dismissed = getDismissedSet();
    dismissed.add(id);
    saveDismissedSet(dismissed);

    if (this.chips.size === 0) this.destroy();
  }

  private dismissAll(): void {
    const allIds = new Set(HINTS.map(h => h.id));
    saveDismissedSet(allIds);
    // Animate all chips out
    for (const chip of this.chips.values()) {
      chip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      chip.style.opacity = '0';
      chip.style.transform = 'translateY(-4px)';
    }
    setTimeout(() => this.destroy(), 250);
  }

  private destroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.container?.remove();
    this.container = null;
    this.chips.clear();
  }
}
