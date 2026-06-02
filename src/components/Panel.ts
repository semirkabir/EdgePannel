import { isDesktopRuntime } from '../services/runtime';
import { invokeTauri } from '../services/tauri-bridge';
import { t } from '../services/i18n';
import { h, replaceChildren, safeHtml } from '../utils/dom-utils';
import { trackPanelResized } from '@/services/analytics';
import { getAiFlowSettings } from '@/services/ai-flow-settings';
import { getSecretState } from '@/services/runtime-config';
import { dataFreshness, type FreshnessStatus } from '@/services/data-freshness';
import { isLoggedIn, getCurrentAuthState, subscribeToAuth } from '@/services/user-auth';
import { buildPanelEmptyState, buildPanelErrorState, buildPanelLoadingState, type PanelEmptyKind } from './panel-state';


export interface PanelOptions {
  id: string;
  title: string;
  showCount?: boolean;
  className?: string;
  trackActivity?: boolean;
  infoTooltip?: string;
  premium?: 'locked' | 'enhanced';
  showCopyButton?: boolean;
}

const PANEL_SPANS_KEY = 'worldmonitor-panel-spans';

function loadPanelSpans(): Record<string, number> {
  try {
    const stored = localStorage.getItem(PANEL_SPANS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

const PANEL_COL_SPANS_KEY = 'worldmonitor-panel-col-spans';
const PANEL_HEIGHTS_KEY = 'worldmonitor-panel-heights';
const ROW_MIN_HEIGHT_PX = 120;
const ROW_MAX_HEIGHT_PX = 3000;
const COL_RESIZE_STEP_PX = 80;
const PANELS_GRID_MIN_TRACK_PX = 280;
const PANEL_GAP_PX = 6;

function loadPanelHeights(): Record<string, number> {
  try {
    const stored = localStorage.getItem(PANEL_HEIGHTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePanelHeight(panelId: string, height: number): void {
  const heights = loadPanelHeights();
  heights[panelId] = Math.round(height);
  localStorage.setItem(PANEL_HEIGHTS_KEY, JSON.stringify(heights));
}

function clearPanelHeight(panelId: string): void {
  const heights = loadPanelHeights();
  if (!(panelId in heights)) return;
  delete heights[panelId];
  if (Object.keys(heights).length === 0) {
    localStorage.removeItem(PANEL_HEIGHTS_KEY);
    return;
  }
  localStorage.setItem(PANEL_HEIGHTS_KEY, JSON.stringify(heights));
}

/** Grid row span for a desired visual height. Under 4px auto-rows and 6px gap, each grid row is 10px effective. */
function neededGridSpan(heightPx: number): number {
  const rowHeight = 4;
  const gap = PANEL_GAP_PX;
  const span = Math.round((heightPx + gap) / (rowHeight + gap));
  const minSpan = Math.round((ROW_MIN_HEIGHT_PX + gap) / (rowHeight + gap));
  return Math.max(minSpan, span);
}


/** Apply a pixel height to a panel element, reserving the right number of grid rows. */
function applyPixelHeight(element: HTMLElement, heightPx: number): void {
  const span = neededGridSpan(heightPx);
  element.style.gridRow = `span ${span}`;
  element.classList.add('resized');
  element.classList.remove('span-1', 'span-2', 'span-3', 'span-4');
}

/** Remove all pixel-resize inline styles from a panel element. */
function clearPixelHeight(element: HTMLElement): void {
  element.style.minHeight = '';
  element.style.height = '';
  element.style.gridRow = '';
  element.classList.remove('resized', 'span-1', 'span-2', 'span-3', 'span-4');
}

function loadPanelColSpans(): Record<string, number> {
  try {
    const stored = localStorage.getItem(PANEL_COL_SPANS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePanelColSpan(panelId: string, span: number): void {
  const spans = loadPanelColSpans();
  spans[panelId] = span;
  localStorage.setItem(PANEL_COL_SPANS_KEY, JSON.stringify(spans));
}

function clearPanelColSpan(panelId: string): void {
  const spans = loadPanelColSpans();
  if (!(panelId in spans)) return;
  delete spans[panelId];
  if (Object.keys(spans).length === 0) {
    localStorage.removeItem(PANEL_COL_SPANS_KEY);
    return;
  }
  localStorage.setItem(PANEL_COL_SPANS_KEY, JSON.stringify(spans));
}

function getDefaultColSpan(element: HTMLElement): number {
  return element.classList.contains('panel-wide') ? 2 : 1;
}

function getColSpan(element: HTMLElement): number {
  if (element.classList.contains('col-span-3')) return 3;
  if (element.classList.contains('col-span-2')) return 2;
  if (element.classList.contains('col-span-1')) return 1;
  return getDefaultColSpan(element);
}

function getGridColumnCount(element: HTMLElement): number {
  const grid = (element.closest('.panels-grid') || element.closest('.map-bottom-grid')) as HTMLElement | null;
  if (!grid) return 3;
  const style = window.getComputedStyle(grid);
  const template = style.gridTemplateColumns;
  if (!template || template === 'none') return 3;

  if (template.includes('repeat(')) {
    const repeatCountMatch = template.match(/repeat\(\s*(\d+)\s*,/i);
    if (repeatCountMatch) {
      const parsed = Number.parseInt(repeatCountMatch[1] ?? '0', 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    // For repeat(auto-fill/auto-fit, minmax(...)), infer count from rendered width.
    const autoRepeatMatch = template.match(/repeat\(\s*auto-(fill|fit)\s*,/i);
    if (autoRepeatMatch) {
      const gap = Number.parseFloat(style.columnGap || '0') || 0;
      const width = grid.getBoundingClientRect().width;
      if (width > 0) {
        return Math.max(1, Math.floor((width + gap) / (PANELS_GRID_MIN_TRACK_PX + gap)));
      }
    }
  }

  const columns = template.trim().split(/\s+/).filter(Boolean);
  return columns.length > 0 ? columns.length : 3;
}

function getMaxColSpan(element: HTMLElement): number {
  return Math.max(1, Math.min(3, getGridColumnCount(element)));
}

function clampColSpan(span: number, maxSpan: number): number {
  return Math.max(1, Math.min(maxSpan, span));
}

function persistPanelColSpan(panelId: string, element: HTMLElement): void {
  const maxSpan = getMaxColSpan(element);
  const naturalSpan = clampColSpan(getDefaultColSpan(element), maxSpan);
  const currentSpan = clampColSpan(getColSpan(element), maxSpan);
  if (currentSpan === naturalSpan) {
    element.classList.remove('col-span-1', 'col-span-2', 'col-span-3');
    clearPanelColSpan(panelId);
    return;
  }
  setColSpanClass(element, currentSpan);
  savePanelColSpan(panelId, currentSpan);
}

function deltaToColSpan(startSpan: number, deltaX: number, maxSpan = 3): number {
  const spanDelta = deltaX > 0
    ? Math.floor(deltaX / COL_RESIZE_STEP_PX)
    : Math.ceil(deltaX / COL_RESIZE_STEP_PX);
  return clampColSpan(startSpan + spanDelta, maxSpan);
}

function clearColSpanClass(element: HTMLElement): void {
  element.classList.remove('col-span-1', 'col-span-2', 'col-span-3');
}

function setColSpanClass(element: HTMLElement, span: number): void {
  clearColSpanClass(element);
  element.classList.add(`col-span-${span}`);
}



function setSpanClass(element: HTMLElement, span: number): void {
  element.classList.remove('span-1', 'span-2', 'span-3', 'span-4');
  element.classList.add(`span-${span}`);
  element.classList.add('resized');
}

export class Panel {
  protected element: HTMLElement;
  protected content: HTMLElement;
  protected header: HTMLElement;
  protected countEl: HTMLElement | null = null;
  protected statusBadgeEl: HTMLElement | null = null;
  private lastBadgeState: 'live' | 'cached' | 'unavailable' | null = null;
  private lastBadgeDetail?: string;
  protected newBadgeEl: HTMLElement | null = null;
  protected panelId: string;
  private abortController: AbortController = new AbortController();
  private tooltipCloseHandler: (() => void) | null = null;
  private infoTooltipEl: HTMLElement | null = null;
  private resizeHandle: HTMLElement | null = null;
  private isResizing = false;
  private startY = 0;
  private startHeight = 0;
  private maxResizeHeight = ROW_MAX_HEIGHT_PX;
  private belowPanelEl: HTMLElement | null = null;
  private belowPanelId = '';
  private startHeightBelow = 0;
  private onTouchMove: ((e: TouchEvent) => void) | null = null;
  private onTouchEnd: (() => void) | null = null;
  private onTouchCancel: (() => void) | null = null;
  private onDocMouseUp: (() => void) | null = null;
  private onRowMouseMove: ((e: MouseEvent) => void) | null = null;
  private onRowMouseUp: (() => void) | null = null;
  private onRowWindowBlur: (() => void) | null = null;
  private colResizeHandle: HTMLElement | null = null;
  private isColResizing = false;
  private startX = 0;
  private startColSpan = 1;
  private onColMouseMove: ((e: MouseEvent) => void) | null = null;
  private onColMouseUp: (() => void) | null = null;
  private onColWindowBlur: (() => void) | null = null;
  private onColTouchMove: ((e: TouchEvent) => void) | null = null;
  private onColTouchEnd: (() => void) | null = null;
  private onColTouchCancel: (() => void) | null = null;
  private colSpanReconcileRaf: number | null = null;
  private viewportObserver: IntersectionObserver | null = null;
  private viewportObserverRegistered = false;
  private readonly contentDebounceMs = 150;
  private pendingContentHtml: string | null = null;
  private contentDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCallback: (() => void) | null = null;
  private retryCountdownTimer: ReturnType<typeof setInterval> | null = null;
  private retryAttempt = 0;
  private _fetching = false;
  private _locked = false;
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private freshnessEl: HTMLElement | null = null;
  private freshnessUnsubscribe: (() => void) | null = null;
  private lastFreshnessStatus: FreshnessStatus | null = null;
  private nextUpdateCountdownTimer: ReturnType<typeof setInterval> | null = null;
  private nextUpdateEndTime = 0;

  constructor(options: PanelOptions) {
    this.panelId = options.id;
    this.element = document.createElement('div');
    this.element.className = `panel ${options.className || ''}`;
    this.element.dataset.panel = options.id;

    this.header = document.createElement('div');
    this.header.className = 'panel-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'panel-header-left';

    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = options.title;
    headerLeft.appendChild(title);

    // Data freshness indicator dot
    this.freshnessEl = document.createElement('span');
    this.freshnessEl.className = 'panel-freshness-dot';
    this.freshnessEl.style.display = 'none';
    headerLeft.appendChild(this.freshnessEl);
    this.setupFreshnessTracking();

    if (options.infoTooltip) {
      const infoBtn = h('button', { className: 'panel-info-btn', 'aria-label': t('components.panel.showMethodologyInfo') }, '?');

      const tooltip = h('div', { className: 'panel-info-tooltip' });
      tooltip.appendChild(safeHtml(options.infoTooltip));
      // Append to body so it escapes panel's overflow:hidden / contain
      document.body.appendChild(tooltip);
      this.infoTooltipEl = tooltip;

      const positionTooltip = () => {
        const r = infoBtn.getBoundingClientRect();
        tooltip.style.left = `${r.left + r.width / 2}px`;
        tooltip.style.top = `${r.bottom + 8}px`;
      };

      const showTooltip = () => { positionTooltip(); tooltip.classList.add('visible'); };
      const hideTooltip = () => tooltip.classList.remove('visible');

      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tooltip.classList.contains('visible')) { hideTooltip(); } else { showTooltip(); }
      });

      this.tooltipCloseHandler = () => tooltip.classList.remove('visible');
      document.addEventListener('click', this.tooltipCloseHandler);

      const infoWrapper = document.createElement('div');
      infoWrapper.className = 'panel-info-wrapper';
      infoWrapper.addEventListener('mouseenter', showTooltip);
      infoWrapper.addEventListener('mouseleave', hideTooltip);
      infoWrapper.addEventListener('focusin', showTooltip);
      infoWrapper.addEventListener('focusout', (e) => {
        if (infoWrapper.contains(e.relatedTarget as Node | null)) return;
        hideTooltip();
      });
      infoWrapper.appendChild(infoBtn);
      headerLeft.appendChild(infoWrapper);
    }

    // Add "new" badge element (hidden by default)
    if (options.trackActivity !== false) {
      this.newBadgeEl = document.createElement('span');
      this.newBadgeEl.className = 'panel-new-badge';
      this.newBadgeEl.style.display = 'none';
      headerLeft.appendChild(this.newBadgeEl);
    }

    if (isDesktopRuntime() && options.premium === 'enhanced' && !getSecretState('EDGEPANNEL_API_KEY').present) {
      const proBadge = h('span', { className: 'panel-pro-badge' }, t('premium.pro'));
      headerLeft.appendChild(proBadge);
    }

    this.header.appendChild(headerLeft);

    if (options.showCopyButton !== false) {
      // ── Copy-to-clipboard button ────────────────────────────────────────
      const copyBtn = document.createElement('button');
      copyBtn.className = 'panel-copy-btn';
      copyBtn.title = 'Copy panel data to clipboard';
      copyBtn.setAttribute('aria-label', 'Copy panel data');
      copyBtn.textContent = '\u29c9'; // ⧉ copy glyph
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = `[${options.title}] ${new Date().toUTCString()}\n\n${this.content.innerText ?? ''}`;
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '\u2713'; // ✓
          if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
          this.copyResetTimer = setTimeout(() => { copyBtn.textContent = '\u29c9'; }, 1600);
        }).catch(() => {});
      });
      this.header.appendChild(copyBtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'panel-remove-btn';
    removeBtn.title = 'Remove panel';
    removeBtn.setAttribute('aria-label', 'Remove panel');
    removeBtn.textContent = '\u2212';
    this.header.appendChild(removeBtn);

    this.statusBadgeEl = document.createElement('span');
    this.statusBadgeEl.className = 'panel-data-badge';
    this.statusBadgeEl.style.display = 'none';
    this.header.appendChild(this.statusBadgeEl);

    // Re-apply badge when auth state resolves (avoids stale "next update" for logged-in users)
    subscribeToAuth((state) => {
      if (!state.loading && this.lastBadgeState) {
        this.setDataBadge(this.lastBadgeState, this.lastBadgeDetail);
      }
    });

    if (options.showCount) {
      this.countEl = document.createElement('span');
      this.countEl.className = 'panel-count';
      this.countEl.textContent = '0';
      this.header.appendChild(this.countEl);
    }

    this.content = document.createElement('div');
    this.content.className = 'panel-content';
    this.content.id = `${options.id}Content`;

    this.element.appendChild(this.header);
    this.element.appendChild(this.content);

    this.content.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-panel-retry]');
      if (!target || this._fetching) return;
      this.retryCallback?.();
    });

    // Add resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'panel-resize-handle';
    this.resizeHandle.setAttribute('aria-label', 'Resize panel');

    const rowGrip = document.createElement('span');
    rowGrip.className = 'panel-resize-handle-grip';
    rowGrip.setAttribute('aria-hidden', 'true');
    rowGrip.textContent = '⋯';
    this.resizeHandle.appendChild(rowGrip);

    this.element.appendChild(this.resizeHandle);
    this.setupResizeHandlers();

    // Right-edge handle for width resizing
    this.colResizeHandle = document.createElement('div');
    this.colResizeHandle.className = 'panel-col-resize-handle';
    this.colResizeHandle.setAttribute('aria-label', 'Resize panel');

    const colGrip = document.createElement('span');
    colGrip.className = 'panel-col-resize-handle-grip';
    colGrip.setAttribute('aria-hidden', 'true');
    colGrip.textContent = '⋮';
    this.colResizeHandle.appendChild(colGrip);

    this.element.appendChild(this.colResizeHandle);
    this.setupColResizeHandlers();

    // Restore saved height — prefer pixel heights (new system), fall back to old span data
    const savedHeights = loadPanelHeights();
    let savedH = savedHeights[this.panelId];
    if (savedH && savedH > ROW_MIN_HEIGHT_PX) {
      // Proactively clamp any giant corrupted height values from the previous bug to a safe limit
      if (savedH > 1000) {
        savedH = 400; // safe elegant default height
        savePanelHeight(this.panelId, savedH);
      }
      const finalSavedH = savedH;
      // Defer so the element is attached to the DOM and getBoundingClientRect works
      requestAnimationFrame(() => {
        applyPixelHeight(this.element, finalSavedH);
      });
    } else {
      // Legacy: restore old grid-span data if present
      const savedSpans = loadPanelSpans();
      const savedSpan = savedSpans[this.panelId];
      if (typeof savedSpan === 'number' && savedSpan > 1) {
        const clampedSpan = Math.min(savedSpan, 80);
        setSpanClass(this.element, clampedSpan);
      }
    }

    // Restore saved col-span
    this.restoreSavedColSpan();
    this.reconcileColSpanAfterAttach();

    this.showLoading();
  }

  private restoreSavedColSpan(): void {
    const savedColSpans = loadPanelColSpans();
    const savedColSpan = savedColSpans[this.panelId];
    if (typeof savedColSpan === 'number' && Number.isInteger(savedColSpan) && savedColSpan >= 1) {
      const naturalSpan = getDefaultColSpan(this.element);
      if (savedColSpan === naturalSpan) {
        clearColSpanClass(this.element);
        clearPanelColSpan(this.panelId);
        return;
      }

      const maxSpan = getMaxColSpan(this.element);
      const clampedSavedSpan = clampColSpan(savedColSpan, maxSpan);
      setColSpanClass(this.element, clampedSavedSpan);
    } else if (savedColSpan !== undefined) {
      clearPanelColSpan(this.panelId);
    }
  }

  private reconcileColSpanAfterAttach(attempts = 3): void {
    if (this.colSpanReconcileRaf !== null) {
      cancelAnimationFrame(this.colSpanReconcileRaf);
      this.colSpanReconcileRaf = null;
    }

    const tryReconcile = (remaining: number) => {
      if (!this.element.isConnected || !this.element.parentElement) {
        if (remaining <= 0) return;
        this.colSpanReconcileRaf = requestAnimationFrame(() => tryReconcile(remaining - 1));
        return;
      }
      this.colSpanReconcileRaf = null;
      this.restoreSavedColSpan();
    };

    tryReconcile(attempts);
  }

  private addRowTouchDocumentListeners(): void {
    if (this.onTouchMove) {
      document.addEventListener('touchmove', this.onTouchMove, { passive: false });
    }
    if (this.onTouchEnd) {
      document.addEventListener('touchend', this.onTouchEnd);
    }
    if (this.onTouchCancel) {
      document.addEventListener('touchcancel', this.onTouchCancel);
    }
  }

  private removeRowTouchDocumentListeners(): void {
    if (this.onTouchMove) {
      document.removeEventListener('touchmove', this.onTouchMove);
    }
    if (this.onTouchEnd) {
      document.removeEventListener('touchend', this.onTouchEnd);
    }
    if (this.onTouchCancel) {
      document.removeEventListener('touchcancel', this.onTouchCancel);
    }
  }

  private setupResizeHandlers(): void {
    if (!this.resizeHandle) return;

    const commitResize = () => {
      this.isResizing = false;
      this.element.classList.remove('resizing');
      delete this.element.dataset.resizing;
      document.body.classList.remove('panel-resize-active');
      this.resizeHandle?.classList.remove('active');

      const finalH = Math.round(this.element.getBoundingClientRect().height);
      savePanelHeight(this.panelId, finalH);
      // Clear stale span-based data for this panel so it doesn't re-apply on reload
      const spans = loadPanelSpans();
      if (this.panelId in spans) {
        delete spans[this.panelId];
        localStorage.setItem(PANEL_SPANS_KEY, JSON.stringify(spans));
      }
      trackPanelResized(this.panelId, neededGridSpan(finalH));

      // Also persist the shrunken below panel height if it was affected
      if (this.belowPanelEl && this.belowPanelId) {
        const finalHBelow = Math.round(this.belowPanelEl.getBoundingClientRect().height);
        savePanelHeight(this.belowPanelId, finalHBelow);
        
        const belowSpans = loadPanelSpans();
        if (this.belowPanelId in belowSpans) {
          delete belowSpans[this.belowPanelId];
          localStorage.setItem(PANEL_SPANS_KEY, JSON.stringify(belowSpans));
        }
        trackPanelResized(this.belowPanelId, neededGridSpan(finalHBelow));
      }
    };

    const applyDrag = (clientY: number) => {
      const deltaY = clientY - this.startY;

      if (this.belowPanelEl && this.belowPanelId) {
        const minBelowH = 80;
        const maxDeltaY = Math.max(0, this.startHeightBelow - minBelowH);

        const minDeltaY = ROW_MIN_HEIGHT_PX - this.startHeight;

        const clampedDeltaY = Math.max(minDeltaY, Math.min(maxDeltaY, deltaY));

        let newH_A = this.startHeight + clampedDeltaY;
        let newH_B = this.startHeightBelow - clampedDeltaY;

        const startSpanA = this.element.style.gridRow ? parseInt(this.element.style.gridRow.replace('span ', ''), 10) : neededGridSpan(this.startHeight);
        const startSpanB = this.belowPanelEl.style.gridRow ? parseInt(this.belowPanelEl.style.gridRow.replace('span ', ''), 10) : neededGridSpan(this.startHeightBelow);
        const totalSpan = startSpanA + startSpanB;

        let spanA = neededGridSpan(newH_A);
        let spanB = totalSpan - spanA;

        const minSpanB = Math.round((minBelowH + PANEL_GAP_PX) / (4 + PANEL_GAP_PX)); // (80 + 6) / 10 = 8.6 -> rounds to 9 spans
        if (spanB < minSpanB) {
          spanB = minSpanB;
          spanA = totalSpan - spanB;
        }

        newH_A = spanA * (4 + PANEL_GAP_PX) - PANEL_GAP_PX;
        newH_B = spanB * (4 + PANEL_GAP_PX) - PANEL_GAP_PX;

        applyPixelHeight(this.element, newH_A);
        applyPixelHeight(this.belowPanelEl, newH_B);
      } else {
        let newH = Math.max(ROW_MIN_HEIGHT_PX, Math.min(this.maxResizeHeight, this.startHeight + deltaY));

        applyPixelHeight(this.element, newH);
      }
    };

    this.onRowMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      applyDrag(e.clientY);
    };

    this.onRowMouseUp = () => {
      if (!this.isResizing) return;
      if (this.onRowMouseMove) document.removeEventListener('mousemove', this.onRowMouseMove);
      if (this.onRowMouseUp) document.removeEventListener('mouseup', this.onRowMouseUp);
      if (this.onRowWindowBlur) window.removeEventListener('blur', this.onRowWindowBlur);
      commitResize();
    };

    this.onRowWindowBlur = () => this.onRowMouseUp?.();

    const beginResize = (clientY: number) => {
      this.isResizing = true;
      this.startY = clientY;
      // Use the live rendered height so partial-span panels start from their real size
      const myRect = this.element.getBoundingClientRect();
      this.startHeight = myRect.height;

      // Reset below panel tracking variables
      this.belowPanelEl = null;
      this.belowPanelId = '';
      this.startHeightBelow = 0;

      // Compute the height ceiling: stop at the top of the nearest panel below this one
      // that shares horizontal space (same column stack). Panels in adjacent columns
      // must not constrain this resize — they have their own independent vertical stacks.
      // Positions are snapshotted here before any reflow so the cap stays stable.
      const gridEl = this.element.closest('.panels-grid');
      let nearestBelowTop = Infinity;
      let nearestBelowPanel: HTMLElement | null = null;
      if (gridEl) {
        for (const other of Array.from(gridEl.querySelectorAll<HTMLElement>('.panel'))) {
          if (other === this.element) continue;
          const r = other.getBoundingClientRect();
          if (r.top < myRect.bottom - 4) continue;
          const sharesColumn = r.right > myRect.left + 4 && r.left < myRect.right - 4;
          if (sharesColumn) {
            if (r.top < nearestBelowTop) {
              nearestBelowTop = r.top;
              nearestBelowPanel = other;
            }
          }
        }
      }

      if (nearestBelowPanel) {
        this.belowPanelEl = nearestBelowPanel;
        this.belowPanelId = nearestBelowPanel.dataset.panel || '';
        this.startHeightBelow = nearestBelowPanel.getBoundingClientRect().height;
        
        const minBelowH = 80;
        const maxDeltaY = Math.max(0, this.startHeightBelow - minBelowH);
        this.maxResizeHeight = this.startHeight + maxDeltaY;
      } else {
        const maxAvailable = nearestBelowTop === Infinity
          ? ROW_MAX_HEIGHT_PX
          : Math.max(ROW_MIN_HEIGHT_PX, nearestBelowTop - myRect.top - PANEL_GAP_PX);
        this.maxResizeHeight = maxAvailable;
      }

      this.element.dataset.resizing = 'true';
      this.element.classList.add('resizing');
      document.body.classList.add('panel-resize-active');
      this.resizeHandle?.classList.add('active');
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      beginResize(e.clientY);
      if (this.onRowMouseMove) document.addEventListener('mousemove', this.onRowMouseMove);
      if (this.onRowMouseUp) document.addEventListener('mouseup', this.onRowMouseUp);
      if (this.onRowWindowBlur) window.addEventListener('blur', this.onRowWindowBlur);
    };

    this.resizeHandle.addEventListener('mousedown', onMouseDown);

    // Double-click to reset to default height
    this.resizeHandle.addEventListener('dblclick', () => {
      this.resetHeight();
    });

    // Touch support
    this.resizeHandle.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      beginResize(touch.clientY);
      this.removeRowTouchDocumentListeners();
      this.addRowTouchDocumentListeners();
    }, { passive: false });

    // Bound handlers so they can be removed in destroy()
    this.onTouchMove = (e: TouchEvent) => {
      if (!this.isResizing) return;
      const touch = e.touches[0];
      if (!touch) return;
      applyDrag(touch.clientY);
    };

    this.onTouchEnd = () => {
      if (!this.isResizing) {
        this.removeRowTouchDocumentListeners();
        return;
      }
      this.removeRowTouchDocumentListeners();
      commitResize();
    };
    this.onTouchCancel = this.onTouchEnd;

    this.onDocMouseUp = () => {
      if (this.element?.dataset.resizing) {
        delete this.element.dataset.resizing;
      }
      if (!this.isResizing && !this.isColResizing) {
        document.body?.classList.remove('panel-resize-active');
      }
    };

    document.addEventListener('mouseup', this.onDocMouseUp);
  }

  private addColTouchDocumentListeners(): void {
    if (this.onColTouchMove) {
      document.addEventListener('touchmove', this.onColTouchMove, { passive: false });
    }
    if (this.onColTouchEnd) {
      document.addEventListener('touchend', this.onColTouchEnd);
    }
    if (this.onColTouchCancel) {
      document.addEventListener('touchcancel', this.onColTouchCancel);
    }
  }

  private removeColTouchDocumentListeners(): void {
    if (this.onColTouchMove) {
      document.removeEventListener('touchmove', this.onColTouchMove);
    }
    if (this.onColTouchEnd) {
      document.removeEventListener('touchend', this.onColTouchEnd);
    }
    if (this.onColTouchCancel) {
      document.removeEventListener('touchcancel', this.onColTouchCancel);
    }
  }

  private setupColResizeHandlers(): void {
    if (!this.colResizeHandle) return;

    this.onColMouseMove = (e: MouseEvent) => {
      if (!this.isColResizing) return;
      const deltaX = e.clientX - this.startX;
      const maxSpan = getMaxColSpan(this.element);
      setColSpanClass(this.element, deltaToColSpan(this.startColSpan, deltaX, maxSpan));
    };

    this.onColMouseUp = () => {
      if (!this.isColResizing) return;
      this.isColResizing = false;
      this.element.classList.remove('col-resizing');
      delete this.element.dataset.resizing;
      document.body.classList.remove('panel-resize-active');
      this.colResizeHandle?.classList.remove('active');
      if (this.onColMouseMove) {
        document.removeEventListener('mousemove', this.onColMouseMove);
      }
      if (this.onColMouseUp) {
        document.removeEventListener('mouseup', this.onColMouseUp);
      }
      if (this.onColWindowBlur) {
        window.removeEventListener('blur', this.onColWindowBlur);
      }
      const finalSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
      if (finalSpan !== this.startColSpan) {
        persistPanelColSpan(this.panelId, this.element);
      }
    };

    this.onColWindowBlur = () => this.onColMouseUp?.();

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isColResizing = true;
      this.startX = e.clientX;
      this.startColSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
      this.element.dataset.resizing = 'true';
      this.element.classList.add('col-resizing');
      document.body.classList.add('panel-resize-active');
      this.colResizeHandle?.classList.add('active');
      if (this.onColMouseMove) {
        document.addEventListener('mousemove', this.onColMouseMove);
      }
      if (this.onColMouseUp) {
        document.addEventListener('mouseup', this.onColMouseUp);
      }
      if (this.onColWindowBlur) {
        window.addEventListener('blur', this.onColWindowBlur);
      }
    };

    this.colResizeHandle.addEventListener('mousedown', onMouseDown);

    // Double-click resets width
    this.colResizeHandle.addEventListener('dblclick', () => this.resetWidth());

    // Touch
    this.colResizeHandle.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      this.isColResizing = true;
      this.startX = touch.clientX;
      this.startColSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
      this.element.dataset.resizing = 'true';
      this.element.classList.add('col-resizing');
      document.body.classList.add('panel-resize-active');
      this.colResizeHandle?.classList.add('active');
      this.removeColTouchDocumentListeners();
      this.addColTouchDocumentListeners();
    }, { passive: false });

    this.onColTouchMove = (e: TouchEvent) => {
      if (!this.isColResizing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - this.startX;
      const maxSpan = getMaxColSpan(this.element);
      setColSpanClass(this.element, deltaToColSpan(this.startColSpan, deltaX, maxSpan));
    };

    this.onColTouchEnd = () => {
      if (!this.isColResizing) {
        this.removeColTouchDocumentListeners();
        return;
      }
      this.isColResizing = false;
      this.element.classList.remove('col-resizing');
      delete this.element.dataset.resizing;
      document.body.classList.remove('panel-resize-active');
      this.colResizeHandle?.classList.remove('active');
      this.removeColTouchDocumentListeners();
      const finalSpan = clampColSpan(getColSpan(this.element), getMaxColSpan(this.element));
      if (finalSpan !== this.startColSpan) {
        persistPanelColSpan(this.panelId, this.element);
      }
    };
    this.onColTouchCancel = this.onColTouchEnd;
  }


  private setupFreshnessTracking(): void {
    const update = () => {
      if (!this.freshnessEl) return;
      const status = dataFreshness.getStatusForPanel(this.panelId);
      if (status === this.lastFreshnessStatus) return;
      this.lastFreshnessStatus = status;

      // Hide for panels with no mapped data sources
      if (status === 'disabled') {
        this.freshnessEl.style.display = 'none';
        return;
      }

      this.freshnessEl.style.display = '';
      this.freshnessEl.className = `panel-freshness-dot freshness-${status}`;
      this.freshnessEl.title = dataFreshness.getFreshnessTooltipForPanel(this.panelId);
    };

    // Initial update after a short delay to let data load
    setTimeout(update, 3000);

    // Subscribe to changes
    this.freshnessUnsubscribe = dataFreshness.subscribe(update);
  }

  private clearNextUpdateCountdown(): void {
    if (this.nextUpdateCountdownTimer) {
      clearInterval(this.nextUpdateCountdownTimer);
      this.nextUpdateCountdownTimer = null;
    }
  }

  private startNextUpdateCountdown(seconds: number): void {
    this.clearNextUpdateCountdown();
    if (!this.statusBadgeEl) return;

    this.nextUpdateEndTime = Date.now() + seconds * 1000;

    const fmt = (secs: number): string => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    const tick = (): void => {
      const remaining = Math.max(0, Math.round((this.nextUpdateEndTime - Date.now()) / 1000));
      if (this.statusBadgeEl) {
        this.statusBadgeEl.textContent = remaining > 0 ? fmt(remaining) : '↻';
      }
      if (remaining <= 0) this.clearNextUpdateCountdown();
    };

    tick();
    this.nextUpdateCountdownTimer = setInterval(tick, 1000);
  }

  protected setDataBadge(state: 'live' | 'cached' | 'unavailable', detail?: string): void {
    if (!this.statusBadgeEl) return;
    this.lastBadgeState = state;
    this.lastBadgeDetail = detail;
    
    const labels = {
      live: t('common.live'),
      cached: t('common.cached'),
      unavailable: t('common.unavailable'),
    } as const;
    
    // For anonymous users, show actual last updated time (shared cached data)
    // Skip this path while auth is still loading to avoid flashing "next update" for logged-in users
    if (!isLoggedIn() && !getCurrentAuthState().loading) {
      if (state === 'live' || state === 'cached') {
        const timeSince = dataFreshness.getTimeSinceForPanel(this.panelId);

        if (timeSince && timeSince !== '') {
          // Real freshness timestamp available — stop any running countdown and show age
          this.clearNextUpdateCountdown();
          this.statusBadgeEl.textContent = `updated ${timeSince}`;
        } else if (!this.nextUpdateCountdownTimer) {
          // No freshness data yet — start a 10-minute countdown (anonymous throttle)
          this.startNextUpdateCountdown(600);
        }
        this.statusBadgeEl.className = `panel-data-badge cached`;
        this.statusBadgeEl.style.display = 'inline-flex';
        return;
      }
    }
    
    // For logged-in users, show LIVE even if data was cached (we have faster refresh)
    const displayState = isLoggedIn() && state === 'cached' ? 'live' : state;
    this.statusBadgeEl.textContent = detail ? `${labels[displayState]} · ${detail}` : labels[displayState];
    this.statusBadgeEl.className = `panel-data-badge ${displayState}`;
    this.statusBadgeEl.style.display = 'inline-flex';
  }

  protected clearDataBadge(): void {
    if (!this.statusBadgeEl) return;
    this.statusBadgeEl.style.display = 'none';
  }
  public getElement(): HTMLElement {
    return this.element;
  }

  public showLoading(message = t('common.loading')): void {
    if (this._locked) return;
    this.setErrorState(false);
    this.clearRetryCountdown();
    replaceChildren(this.content, buildPanelLoadingState(message));
  }

  public showError(message?: string, onRetry?: () => void, autoRetrySeconds?: number): void {
    if (this._locked) return;
    this.clearRetryCountdown();
    this.setErrorState(true);
    if (onRetry !== undefined) this.retryCallback = onRetry;
    const children: HTMLElement[] = [];

    if (this.retryCallback) {
      const backoffSeconds = autoRetrySeconds ?? Math.min(15 * Math.pow(2, this.retryAttempt), 180);
      this.retryAttempt++;
      let remaining = Math.round(backoffSeconds);
      const countdownEl = h('div', { className: 'panel-error-countdown' },
        `${t('common.retrying')} (${remaining}s)`,
      );
      children.push(countdownEl);
      this.retryCountdownTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          this.clearRetryCountdown();
          this.retryCallback?.();
          return;
        }
        countdownEl.textContent = `${t('common.retrying')} (${remaining}s)`;
      }, 1000);
    }
    replaceChildren(this.content, buildPanelErrorState(message || t('common.failedToLoad'), ...children));
  }

  public showEmptyState(message: string, kind: PanelEmptyKind = 'empty', detail?: string): void {
    if (this._locked) return;
    this.setErrorState(false);
    this.clearRetryCountdown();
    replaceChildren(this.content, buildPanelEmptyState(message, kind, detail));
  }

  public resetRetryBackoff(): void {
    this.retryAttempt = 0;
  }

  public showLocked(features: string[] = []): void {
    this._locked = true;
    this.clearRetryCountdown();

    for (let child = this.header.nextElementSibling; child && child !== this.content; child = child.nextElementSibling) {
      (child as HTMLElement).style.display = 'none';
    }
    this.element.classList.add('panel-is-locked');

    const lockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
    const iconEl = h('div', { className: 'panel-locked-icon' });
    iconEl.innerHTML = lockSvg;

    const lockedChildren: (HTMLElement | string)[] = [
      iconEl,
      h('div', { className: 'panel-locked-desc' }, t('premium.lockedDesc')),
    ];

    if (features.length > 0) {
      const featureList = h('ul', { className: 'panel-locked-features' });
      for (const feat of features) {
        featureList.appendChild(h('li', {}, feat));
      }
      lockedChildren.push(featureList);
    }

    const ctaBtn = h('button', { type: 'button', className: 'panel-locked-cta' }, t('premium.joinWaitlist'));
    if (isDesktopRuntime()) {
      ctaBtn.addEventListener('click', () => void invokeTauri<void>('open_settings_window_command').catch(() => {}));
    } else {
      ctaBtn.addEventListener('click', () => window.open('https://edgepannel.app/pro', '_blank'));
    }
    lockedChildren.push(ctaBtn);

    replaceChildren(this.content, h('div', { className: 'panel-locked-state' }, ...lockedChildren));
  }

  public showRetrying(message?: string, countdownSeconds?: number): void {
    if (this._locked) return;
    this.clearRetryCountdown();
    this.setErrorState(true);

    const radarEl = h('div', { className: 'panel-loading-radar panel-error-radar' },
      h('div', { className: 'panel-radar-sweep' }),
      h('div', { className: 'panel-radar-dot error' }),
    );

    const msgEl = h('div', { className: 'panel-error-msg' }, message || t('common.retrying'));
    const children: (HTMLElement | string)[] = [radarEl, msgEl];

    if (countdownSeconds && countdownSeconds > 0) {
      let remaining = countdownSeconds;
      const countdownEl = h('div', { className: 'panel-error-countdown' },
        `${t('common.retrying')} (${remaining}s)`,
      );
      children.push(countdownEl);
      this.retryCountdownTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          this.clearRetryCountdown();
          countdownEl.textContent = t('common.retrying');
          return;
        }
        countdownEl.textContent = `${t('common.retrying')} (${remaining}s)`;
      }, 1000);
    }

    replaceChildren(this.content,
      h('div', { className: 'panel-error-state' }, ...children),
    );
  }

  private clearRetryCountdown(): void {
    if (this.retryCountdownTimer) {
      clearInterval(this.retryCountdownTimer);
      this.retryCountdownTimer = null;
    }
  }

  protected setRetryCallback(fn: (() => void) | null): void {
    this.retryCallback = fn;
  }

  protected setFetching(v: boolean): void {
    this._fetching = v;
    const btn = this.content.querySelector<HTMLButtonElement>('[data-panel-retry]');
    if (btn) btn.disabled = v;
  }

  protected get isFetching(): boolean {
    return this._fetching;
  }

  public showConfigError(message: string): void {
    const msgEl = h('div', { className: 'config-error-message' }, message);
    if (isDesktopRuntime()) {
      msgEl.appendChild(
        h('button', {
          type: 'button',
          className: 'config-error-settings-btn',
          onClick: () => void invokeTauri<void>('open_settings_window_command').catch(() => { }),
        }, t('components.panel.openSettings')),
      );
    }
    replaceChildren(this.content, msgEl);
  }

  public setCount(count: number): void {
    if (this.countEl) {
      const prev = parseInt(this.countEl.textContent ?? '0', 10);
      this.countEl.textContent = count.toString();
      if (count > prev && getAiFlowSettings().badgeAnimation) {
        this.countEl.classList.remove('bump');
        void this.countEl.offsetWidth;
        this.countEl.classList.add('bump');
      }
    }
  }

  public setErrorState(hasError: boolean, tooltip?: string): void {
    this.header.classList.toggle('panel-header-error', hasError);
    if (tooltip) {
      this.header.title = tooltip;
    } else {
      this.header.removeAttribute('title');
    }
  }

  public setContent(html: string): void {
    if (this._locked) return;
    this.setErrorState(false);
    this.clearRetryCountdown();
    this.retryAttempt = 0;
    if (this.pendingContentHtml === html || this.content.innerHTML === html) {
      return;
    }

    this.pendingContentHtml = html;
    if (this.contentDebounceTimer) {
      clearTimeout(this.contentDebounceTimer);
    }

    this.contentDebounceTimer = setTimeout(() => {
      if (this.pendingContentHtml !== null) {
        this.setContentImmediate(this.pendingContentHtml);
      }
    }, this.contentDebounceMs);
  }

  protected setContentNow(html: string): void {
    if (this._locked) return;
    this.setErrorState(false);
    this.clearRetryCountdown();
    this.retryAttempt = 0;
    this.setContentImmediate(html);
  }

  private setContentImmediate(html: string): void {
    if (this.contentDebounceTimer) {
      clearTimeout(this.contentDebounceTimer);
      this.contentDebounceTimer = null;
    }

    this.pendingContentHtml = null;
    if (this.content.innerHTML !== html) {
      this.content.innerHTML = html;
    }
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }

  public toggle(visible: boolean): void {
    if (visible) this.show();
    else this.hide();
  }

  /**
   * Update the "new items" badge
   * @param count Number of new items (0 hides badge)
   * @param pulse Whether to pulse the badge (for important updates)
   */
  public setNewBadge(count: number, pulse = false): void {
    if (!this.newBadgeEl) return;

    if (count <= 0) {
      this.newBadgeEl.style.display = 'none';
      this.newBadgeEl.classList.remove('pulse');
      this.element.classList.remove('has-new');
      return;
    }

    this.newBadgeEl.textContent = count > 99 ? '99+' : `${count} ${t('common.new')}`;
    this.newBadgeEl.style.display = 'inline-flex';
    this.element.classList.add('has-new');

    if (pulse) {
      this.newBadgeEl.classList.add('pulse');
    } else {
      this.newBadgeEl.classList.remove('pulse');
    }
  }

  /**
   * Clear the new items badge
   */
  public clearNewBadge(): void {
    this.setNewBadge(0);
  }

  /**
   * Get the panel ID
   */
  public getId(): string {
    return this.panelId;
  }

  /**
   * Reset panel height to default
   */
  public resetHeight(): void {
    clearPixelHeight(this.element);
    clearPanelHeight(this.panelId);
    // Also clear legacy span data
    const spans = loadPanelSpans();
    if (this.panelId in spans) {
      delete spans[this.panelId];
      localStorage.setItem(PANEL_SPANS_KEY, JSON.stringify(spans));
    }
  }

  public resetWidth(): void {
    clearColSpanClass(this.element);
    clearPanelColSpan(this.panelId);
  }

  protected get signal(): AbortSignal {
    return this.abortController.signal;
  }

  protected isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  /**
   * Fire `callback` once when this panel scrolls within `marginPx` of the viewport.
   * Uses IntersectionObserver where available; falls back to an idle-callback tick.
   * Idempotent — repeat calls are ignored once observation is registered.
   * Disconnected automatically on destroy() and on first firing.
   */
  public observeNearViewport(callback: () => void, marginPx = 200): void {
    if (this.viewportObserverRegistered) return;
    if (typeof IntersectionObserver === 'undefined' || typeof window === 'undefined') {
      this.viewportObserverRegistered = true;
      const tick = (): void => { if (this.element.isConnected) callback(); };
      const ric = typeof window !== 'undefined'
        ? (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
        : undefined;
      if (typeof ric === 'function') ric(tick);
      else setTimeout(tick, 0);
      return;
    }
    this.viewportObserverRegistered = true;
    this.viewportObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          this.unobserveViewport();
          callback();
          return;
        }
      }
    }, { rootMargin: `${marginPx}px` });
    this.viewportObserver.observe(this.element);
  }

  private unobserveViewport(): void {
    if (this.viewportObserver) {
      this.viewportObserver.disconnect();
      this.viewportObserver = null;
    }
  }

  public destroy(): void {
    this.abortController.abort();
    this.clearRetryCountdown();
    this.unobserveViewport();
    this.clearNextUpdateCountdown();
    if (this.freshnessUnsubscribe) {
      this.freshnessUnsubscribe();
      this.freshnessUnsubscribe = null;
    }
    if (this.colSpanReconcileRaf !== null) {
      cancelAnimationFrame(this.colSpanReconcileRaf);
      this.colSpanReconcileRaf = null;
    }
    if (this.contentDebounceTimer) {
      clearTimeout(this.contentDebounceTimer);
      this.contentDebounceTimer = null;
    }
    this.pendingContentHtml = null;

    if (this.tooltipCloseHandler) {
      document.removeEventListener('click', this.tooltipCloseHandler);
      this.tooltipCloseHandler = null;
    }
    if (this.infoTooltipEl) {
      this.infoTooltipEl.remove();
      this.infoTooltipEl = null;
    }
    this.removeRowTouchDocumentListeners();
    if (this.onTouchMove) {
      this.onTouchMove = null;
    }
    if (this.onTouchEnd) {
      this.onTouchEnd = null;
    }
    if (this.onTouchCancel) {
      this.onTouchCancel = null;
    }
    if (this.onDocMouseUp) {
      document.removeEventListener('mouseup', this.onDocMouseUp);
      this.onDocMouseUp = null;
    }
    if (this.onRowMouseMove) {
      document.removeEventListener('mousemove', this.onRowMouseMove);
      this.onRowMouseMove = null;
    }
    if (this.onRowMouseUp) {
      document.removeEventListener('mouseup', this.onRowMouseUp);
      this.onRowMouseUp = null;
    }
    if (this.onRowWindowBlur) {
      window.removeEventListener('blur', this.onRowWindowBlur);
      this.onRowWindowBlur = null;
    }
    if (this.onColMouseMove) {
      document.removeEventListener('mousemove', this.onColMouseMove);
      this.onColMouseMove = null;
    }
    if (this.onColMouseUp) {
      document.removeEventListener('mouseup', this.onColMouseUp);
      this.onColMouseUp = null;
    }
    if (this.onColWindowBlur) {
      window.removeEventListener('blur', this.onColWindowBlur);
      this.onColWindowBlur = null;
    }
    this.removeColTouchDocumentListeners();
    if (this.onColTouchMove) {
      this.onColTouchMove = null;
    }
    if (this.onColTouchEnd) {
      this.onColTouchEnd = null;
    }
    if (this.onColTouchCancel) {
      this.onColTouchCancel = null;
    }
    this.element.classList.remove('resizing', 'col-resizing');
    delete this.element.dataset.resizing;
    document.body.classList.remove('panel-resize-active');
  }
}
