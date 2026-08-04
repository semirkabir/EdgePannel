/**
 * Aircraft follow-mode controller.
 *
 * A tiny mediator between the map (which owns the camera) and any UI that wants
 * to start or stop following an aircraft — currently the entity detail panel
 * and the map's own follow HUD. Neither of those can reach `DeckGLMap`
 * directly, and threading a map reference through the entity renderer registry
 * would mean widening `EntityRenderContext` for a single feature.
 *
 * The map registers itself as the backend on init and clears it on destroy;
 * calls made while no backend is attached are dropped.
 */

export interface AircraftFollowBackend {
  startFollowing(icao24: string): void;
  stopFollowing(): void;
}

export interface AircraftFollowState {
  icao24: string | null;
  /** Callsign or registration for display, when the caller knows it. */
  label: string;
}

type FollowListener = (state: AircraftFollowState) => void;

let backend: AircraftFollowBackend | null = null;
let state: AircraftFollowState = { icao24: null, label: '' };
const listeners = new Set<FollowListener>();

function emit(): void {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error('[aircraft-follow] listener failed', err);
    }
  }
}

export function setAircraftFollowBackend(next: AircraftFollowBackend | null): void {
  backend = next;
  if (!next && state.icao24) {
    state = { icao24: null, label: '' };
    emit();
  }
}

export function isAircraftFollowAvailable(): boolean {
  return backend !== null;
}

/** Start following `icao24`. No-op when already following that aircraft. */
export function followAircraft(icao24: string, label = ''): void {
  const hex = icao24.trim().toLowerCase();
  if (!hex || !backend) return;
  if (state.icao24 === hex) return;
  state = { icao24: hex, label: label || hex.toUpperCase() };
  backend.startFollowing(hex);
  emit();
}

export function unfollowAircraft(): void {
  if (!state.icao24) return;
  state = { icao24: null, label: '' };
  backend?.stopFollowing();
  emit();
}

export function toggleFollowAircraft(icao24: string, label = ''): void {
  if (isFollowingAircraft(icao24)) unfollowAircraft();
  else followAircraft(icao24, label);
}

export function getFollowedAircraft(): string | null {
  return state.icao24;
}

export function isFollowingAircraft(icao24: string): boolean {
  return state.icao24 !== null && state.icao24 === icao24.trim().toLowerCase();
}

/**
 * Called by the map when follow mode ends for a reason the UI did not trigger
 * (user panned away, aircraft lost, map torn down). Does not call back into the
 * backend — it is the backend reporting in.
 */
export function notifyAircraftFollowEnded(): void {
  if (!state.icao24) return;
  state = { icao24: null, label: '' };
  emit();
}

export function subscribeAircraftFollow(listener: FollowListener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
