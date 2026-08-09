import { h } from '@/utils/dom-utils';
import { mountThinkingOrb, type MountedOrb } from './ThinkingOrbMount';

export type PanelEmptyKind = 'empty' | 'filtered' | 'disabled' | 'unavailable';

/**
 * The loading state mounts a live component, so the caller gets the handle back
 * and is responsible for `unmount()`ing it when the content is replaced —
 * otherwise its rAF loop and observers outlive the DOM node.
 */
export interface PanelLoadingState {
  element: HTMLElement;
  orb: MountedOrb;
}

export function buildPanelLoadingState(message: string): PanelLoadingState {
  // 'working' at 64, sped up 1.6x — a panel in this state is actively doing
  // something on the user's behalf, not idly waiting on a feed.
  const orb = mountThinkingOrb({ state: 'working', size: 64, speed: 1.60, label: message });
  const element = h('div', { className: 'panel-loading' },
    h('div', { className: 'panel-loading-orb' }, orb.element),
    h('div', { className: 'panel-loading-text' }, message),
  );
  return { element, orb };
}

export function buildPanelErrorState(message: string, ...children: HTMLElement[]): HTMLElement {
  // Standardised copy — show "Retrying shortly" sub-label when no manual retry supplied
  const hasRetry = children.length > 0;
  const subLabel = hasRetry
    ? null
    : h('div', { className: 'panel-error-sub' }, 'Retrying shortly');

  const radarEl = h('div', { className: 'panel-loading-radar panel-error-radar' },
    h('div', { className: 'panel-radar-sweep' }),
    h('div', { className: 'panel-radar-dot error' }),
  );
  const msgEl = h('div', { className: 'panel-error-msg' }, message);
  const nodes: (HTMLElement | null)[] = [radarEl, msgEl, subLabel, ...children];
  return h('div', { className: 'panel-error-state' },
    ...nodes.filter((n): n is HTMLElement => n !== null),
  );
}

export function buildPanelEmptyState(message: string, kind: PanelEmptyKind = 'empty', detail?: string): HTMLElement {
  const className = kind === 'empty' ? 'panel-empty' : `panel-empty panel-empty-${kind}`;
  const children: Array<HTMLElement | string> = [message];
  if (detail) {
    children.push(h('div', { className: 'panel-empty-detail' }, detail));
  }
  return h('div', { className }, ...children);
}
