/**
 * Bridge between the published `thinking-orbs` React component and this
 * codebase's vanilla panel classes.
 *
 * The package is a React component and every panel here is a plain TS class
 * that owns a DOM node, so there is no tree for it to live in. This mounts one
 * into a host element via preact/compat (React is aliased to it in both
 * vite.config.ts and tsconfig.json) and hands back the node plus `update` and
 * `unmount`.
 *
 * Callers MUST call `unmount()` when the node leaves the DOM. The component
 * registers a rAF loop, an IntersectionObserver and a MutationObserver on
 * documentElement; dropping the node without unmounting leaks all three.
 */

import { render } from 'preact';
import { ThinkingOrb, type OrbSize, type OrbState } from 'thinking-orbs';

export type { OrbSize, OrbState };

export interface OrbOptions {
  state?: OrbState;
  size?: OrbSize;
  /**
   * Multiplier on the preset's baked speed.
   *
   * Changing this mid-animation is visible: the package drives its clock as
   * `performance.now() * speed`, so a new multiplier lands the orb at a
   * different phase and it jumps rather than easing. Fine as a deliberate
   * kick on hover; don't animate this value.
   */
  speed?: number;
  /** Screen-reader label; falls back to the package's per-state default. */
  label?: string;
}

export interface MountedOrb {
  /** Host element to insert wherever the orb should appear. */
  element: HTMLElement;
  /** Re-render with new props — used as a panel's progress state advances. */
  update: (options: OrbOptions) => void;
  /** Tear down the tree and release the component's observers. */
  unmount: () => void;
}

/**
 * `theme="dark"` is pinned rather than left on `auto`. The package's auto mode
 * walks ancestors for a `data-theme`/`.dark` class and otherwise falls back to
 * `prefers-color-scheme`, which is the OS setting — that disagrees with this
 * app whenever the in-app theme differs from the OS one. Panels are re-created
 * on theme change, so pinning is both correct and cheaper.
 */
function orbElement({ state = 'searching', size = 64, speed = 1, label }: OrbOptions) {
  const dark = document.documentElement.dataset.theme !== 'light';
  return (
    <ThinkingOrb
      state={state}
      size={size}
      speed={speed}
      theme={dark ? 'dark' : 'light'}
      aria-label={label}
    />
  );
}

export function mountThinkingOrb(options: OrbOptions = {}): MountedOrb {
  const element = document.createElement('span');
  element.className = 'thinking-orb-host';

  // Theme is baked into the element at render time, so a long-lived orb (the
  // findings badge lives for the whole session) would keep the palette it
  // mounted with. Re-render on the app's own theme event instead of leaving
  // the package's `auto` mode to sniff prefers-color-scheme, which disagrees
  // with the in-app theme whenever the two differ.
  let current = options;
  const paint = (): void => {
    render(orbElement(current), element);
  };
  const onThemeChanged = (): void => paint();

  paint();
  window.addEventListener('theme-changed', onThemeChanged);

  return {
    element,
    update: (next) => {
      current = next;
      paint();
    },
    unmount: () => {
      window.removeEventListener('theme-changed', onThemeChanged);
      // Rendering null is preact's documented unmount path — it runs the
      // component's effect cleanups, which is what releases the observers.
      render(null, element);
    },
  };
}
