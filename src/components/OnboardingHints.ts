/**
 * OnboardingHints — lightweight first-run hints for power features.
 *
 * Shows one hint at a time. After "Got it" the next hint appears; "Dismiss all"
 * clears every remaining hint permanently. State stored in localStorage.
 */

import { UI_PREFERENCE_KEYS } from '@/app/ui-preferences';

interface HintDef {
  id: string;
  anchor: string;
  title: string;
  body: string;
  placement?: 'below' | 'above' | 'left' | 'right';
}

const HINTS: HintDef[] = [
  {
    id: 'panel-drag',
    anchor: '.panels-grid .panel-header',
    title: 'Drag to reorder',
    body: 'Drag any panel header to reorder panels. Your layout is saved automatically.',
    placement: 'below',
  },
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

type ChipEl = HTMLElement & { _anchor?: HTMLElement };

export class OnboardingHints {
  private container: HTMLElement | null = null;
  private currentChip: ChipEl | null = null;
  private queue: HintDef[] = [];
  private queueIndex = 0;
  private resizeObserver: ResizeObserver | null = null;

  init(): void {
    if (window.innerWidth < 900 || areAllDismissed()) return;
    setTimeout(() => this.mount(), 1800);
  }

  private mount(): void {
    if (areAllDismissed()) return;

    const dismissed = getDismissedSet();
    this.queue = HINTS.filter(h => !dismissed.has(h.id));
    if (this.queue.length === 0) return;

    this.container = document.createElement('div');
    this.container.className = 'ohint-layer';
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);

    this.resizeObserver = new ResizeObserver(() => this.repositionCurrent());
    this.resizeObserver.observe(document.documentElement);

    this.advance();
  }

  private advance(): void {
    while (this.queueIndex < this.queue.length) {
      const hint = this.queue[this.queueIndex];
      if (!hint) { this.queueIndex++; continue; }
      const anchor = this.resolveAnchor(hint.anchor);
      if (anchor) {
        this.showHint(hint, anchor);
        return;
      }
      // anchor not in DOM — skip this hint silently
      this.queueIndex++;
    }
    this.destroy();
  }

  private showHint(hint: HintDef, anchor: HTMLElement): void {
    const remaining = this.queue.length - this.queueIndex;
    const chip: ChipEl = document.createElement('div');
    chip.className = 'ohint-chip';
    chip.dataset.hintId = hint.id;
    chip.dataset.placement = hint.placement ?? 'below';
    chip._anchor = anchor;

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
    dismissOne.textContent = remaining > 1 ? 'Got it  →' : 'Got it';
    dismissOne.addEventListener('click', () => this.dismissCurrent(hint.id));

    const dismissAll = document.createElement('button');
    dismissAll.className = 'ohint-dismiss-all';
    dismissAll.textContent = 'Dismiss all hints';
    dismissAll.addEventListener('click', () => this.dismissAll());

    actions.append(dismissOne, dismissAll);
    chip.append(titleEl, bodyEl, actions);

    chip.style.opacity = '0';
    chip.style.transform = 'translateY(6px)';
    this.container!.appendChild(chip);
    this.currentChip = chip;

    const placement = hint.placement ?? 'below';
    // Two rAFs: first lets the browser measure chip height, second triggers the transition
    requestAnimationFrame(() => {
      this.positionChip(chip, anchor, placement);
      requestAnimationFrame(() => {
        chip.style.transition = 'opacity 0.3s var(--ease-reveal, ease), transform 0.3s var(--ease-reveal, ease)';
        chip.style.opacity = '1';
        chip.style.transform = '';
      });
    });
  }

  private dismissCurrent(id: string): void {
    const dismissed = getDismissedSet();
    dismissed.add(id);
    saveDismissedSet(dismissed);
    this.animateOutCurrentChip(() => {
      this.queueIndex++;
      this.advance();
    });
  }

  private dismissAll(): void {
    const allIds = new Set(HINTS.map(h => h.id));
    saveDismissedSet(allIds);
    this.animateOutCurrentChip(() => this.destroy());
  }

  private animateOutCurrentChip(onDone: () => void): void {
    const chip = this.currentChip;
    if (!chip) { onDone(); return; }
    chip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    chip.style.opacity = '0';
    chip.style.transform = 'translateY(-4px)';
    this.currentChip = null;
    setTimeout(() => {
      chip.remove();
      onDone();
    }, 220);
  }

  private resolveAnchor(selector: string): HTMLElement | null {
    for (const sel of selector.split(',').map(s => s.trim())) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }
    return null;
  }

  private positionChip(chip: HTMLElement, anchor: HTMLElement, placement: HintDef['placement']): void {
    const rect = anchor.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    const gap = 10;
    const chipW = 260;

    chip.style.position = 'fixed';
    chip.style.width = `${chipW}px`;
    chip.style.zIndex = '10020';

    const clampLeft = (x: number) => Math.min(Math.max(x, 8), window.innerWidth - chipW - 8);

    switch (placement) {
      case 'above':
        chip.style.left = `${clampLeft(rect.left)}px`;
        chip.style.top = `${Math.max(rect.top - chip.offsetHeight - gap, 8)}px`;
        break;
      case 'left':
        chip.style.left = `${Math.max(rect.left - chipW - gap, 8)}px`;
        chip.style.top = `${Math.max(rect.top + rect.height / 2 - 40, 8)}px`;
        break;
      case 'right':
        chip.style.left = `${clampLeft(rect.right + gap)}px`;
        chip.style.top = `${Math.max(rect.top + rect.height / 2 - 40, 8)}px`;
        break;
      default: // below
        chip.style.left = `${clampLeft(rect.left)}px`;
        chip.style.top = `${rect.bottom + gap}px`;
    }
  }

  private repositionCurrent(): void {
    const chip = this.currentChip;
    if (!chip || !chip._anchor) return;
    const hint = this.queue[this.queueIndex];
    const placement = hint?.placement ?? 'below';
    this.positionChip(chip, chip._anchor, placement);
  }

  private destroy(): void {
    this.resizeObserver?.disconnect();
    this.currentChip?.remove();
    this.container?.remove();
    this.container = null;
    this.currentChip = null;
  }
}
