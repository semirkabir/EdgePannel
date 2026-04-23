export const PLAYBACK_WINDOW_FREE_MS = 48 * 60 * 60 * 1000;
export const PLAYBACK_WINDOW_LOGGED_IN_MS = 7 * 24 * 60 * 60 * 1000;
export const PLAYBACK_WINDOW_PRO_MS = 30 * 24 * 60 * 60 * 1000;

export function getPlaybackWindowMsForAccess(isAuthenticated: boolean, hasPaid: boolean): number {
  if (hasPaid) return PLAYBACK_WINDOW_PRO_MS;
  if (isAuthenticated) return PLAYBACK_WINDOW_LOGGED_IN_MS;
  return PLAYBACK_WINDOW_FREE_MS;
}
