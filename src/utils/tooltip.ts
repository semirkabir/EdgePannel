/**
 * Global custom tooltip system.
 *
 * Intercepts native [title] attributes on any element in the document and
 * renders a polished, theme-aware tooltip instead of the browser default.
 * Works automatically — no per-component wiring needed.
 */

let tipEl: HTMLDivElement | null = null;
let activeTarget: HTMLElement | null = null;
let savedTitle = '';
let rafId = 0;

function getEl(): HTMLDivElement {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'wm-tooltip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function reposition(x: number, y: number): void {
  const tip = tipEl;
  if (!tip) return;
  const gap = 14;
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const w   = tip.offsetWidth;
  const h   = tip.offsetHeight;

  let left = x + gap;
  let top  = y - h - gap;

  if (left + w > vw - 10) left = x - w - gap;   // flip left
  if (top < 8)            top  = y + gap;        // flip below

  tip.style.left = `${Math.max(8, Math.min(left, vw - w - 8))}px`;
  tip.style.top  = `${Math.max(8, Math.min(top,  vh - h - 8))}px`;
}

function show(text: string, x: number, y: number): void {
  const tip = getEl();
  tip.textContent = text;
  // Initial off-screen position so getBoundingClientRect is valid
  tip.style.left = '-9999px';
  tip.style.top  = '-9999px';
  tip.classList.add('wm-tooltip--visible');
  reposition(x, y);
}

function hide(): void {
  tipEl?.classList.remove('wm-tooltip--visible');
}

function deactivate(): void {
  if (!activeTarget) return;
  if (savedTitle) activeTarget.setAttribute('title', savedTitle);
  delete activeTarget.dataset.wmTitle;
  activeTarget = null;
  savedTitle   = '';
  hide();
}

export function initTooltips(): void {
  document.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[title]');

    // Leaving a title-element to a non-title child — keep tooltip alive
    if (!target) return;
    if (target === activeTarget) return;

    // Deactivate previous before switching
    if (activeTarget) deactivate();

    const text = target.getAttribute('title');
    if (!text?.trim()) return;

    activeTarget = target;
    savedTitle   = text;

    // Suppress browser native tooltip by blanking the attribute
    target.setAttribute('title', '');
    target.dataset.wmTitle = savedTitle;

    show(savedTitle, e.clientX, e.clientY);
  });

  document.addEventListener('mouseout', (e) => {
    if (!activeTarget) return;
    const to = e.relatedTarget as HTMLElement | null;
    // Still inside the same element (moved to a child)
    if (to && activeTarget.contains(to)) return;
    deactivate();
  });

  document.addEventListener('mousemove', (e) => {
    if (!activeTarget) return;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => reposition(e.clientX, e.clientY));
  });

  // Hide on scroll (tooltip position would be stale)
  document.addEventListener('scroll', hide, { capture: true, passive: true });
}
