/**
 * Dev-gated diagnostic logging.
 *
 * `console.warn` / `console.error` should stay unconditional — they surface real
 * problems that matter in production. `log.debug(...)` is for diagnostic chatter
 * (fetch traces, pipeline progress, score dumps) that should not ship to prod
 * consoles but is invaluable while developing.
 *
 * Gating: enabled automatically in dev builds. To enable in a production build at
 * runtime, set `localStorage.setItem('wm:debug', '1')` and reload.
 */

let verbose = Boolean(import.meta.env?.DEV);

try {
  // `localStorage` is absent in Web Workers and some sandboxed contexts.
  if (typeof localStorage !== 'undefined' && localStorage.getItem('wm:debug') === '1') {
    verbose = true;
  }
} catch {
  /* localStorage access can throw (privacy mode, sandbox) — ignore. */
}

export const log = {
  /** Log only when diagnostic logging is enabled. Signature mirrors console.log. */
  debug(...args: unknown[]): void {
    if (verbose) console.log(...args);
  },

  /** Whether diagnostic logging is currently enabled. */
  get enabled(): boolean {
    return verbose;
  },
};
