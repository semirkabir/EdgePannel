import { h } from '@/utils/dom-utils';

export type PanelEmptyKind = 'empty' | 'filtered' | 'disabled' | 'unavailable';

export function buildPanelLoadingState(message: string): HTMLElement {
  return h('div', { className: 'panel-loading' },
    h('div', { className: 'panel-loading-radar' },
      h('div', { className: 'panel-radar-sweep' }),
      h('div', { className: 'panel-radar-dot' }),
    ),
    h('div', { className: 'panel-loading-text' }, message),
  );
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
