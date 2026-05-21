/**
 * Returns the base URL for RPC service calls.
 * Empty string = relative URLs (dev server / Vercel edge functions).
 * In the full upstream build this reads from the desktop sidecar runtime;
 * for this fork a relative base is always correct.
 */
export function getRpcBaseUrl(): string {
  return '';
}
