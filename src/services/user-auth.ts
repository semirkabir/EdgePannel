import { User } from 'firebase/auth';
import { getFirebaseAuth, onAuthChange, isFirebaseConfigured, getCurrentUser, getIdToken, handleRedirectResult } from '@/services/firebase-auth';
import { canonicalizeTier, type FeatureTier } from '@/services/feature-entitlements';
import { log } from '@/utils/logger';

const AUTH_DEBUG = import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === '1';
const CHECKOUT_POLL_ATTEMPTS = 6;
const CHECKOUT_POLL_INTERVAL_MS = 1_000;
const TIER_ORDER: Record<UserTier, number> = {
  free: 0,
  enthusiast: 1,
  analyst: 2,
  strategist: 3,
  maximalist: 4,
};

// The auth tier mirrors the entitlements ladder exactly; `free` is the
// anonymous default (shown as "Hobbyist").
export type UserTier = FeatureTier;

export interface AuthState {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  tier: UserTier;
}

let authState: AuthState = {
  user: null,
  loading: true,
  isConfigured: false,
  tier: 'free',
};

const listeners: Set<(state: AuthState) => void> = new Set();
let tierRequestId = 0;

function notifyListeners(): void {
  for (const listener of listeners) {
    listener(authState);
  }
}

// Accepts current tier ids and legacy values (pro/business/enterprise/premium),
// mapping legacy paid tiers up so existing subscribers never lose access.
function normalizeTier(value: unknown): UserTier {
  return canonicalizeTier(value);
}

function setAuthState(nextState: Partial<AuthState>): void {
  authState = { ...authState, ...nextState };
  notifyListeners();
}

function getCheckoutExpectedTier(): UserTier | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') !== 'success') return null;
  return normalizeTier(params.get('tier'));
}

function clearCheckoutParams(): void {
  const url = new URL(window.location.href);
  // URLSearchParams.delete() returns void — use has() to detect presence first.
  const hadCheckout = url.searchParams.has('checkout');
  const hadTier = url.searchParams.has('tier');
  if (!hadCheckout && !hadTier) return;

  url.searchParams.delete('checkout');
  url.searchParams.delete('tier');
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns the user's tier from the API, or null on any transient failure
 * (network error, 5xx, 401, parse error). Returns 'free' only when there is
 * definitively no auth token — i.e. the user is genuinely anonymous.
 * Callers must NOT overwrite the current tier when null is returned.
 */
async function fetchResolvedTier(): Promise<UserTier | null> {
  const token = await getIdToken();
  if (!token) return 'free';   // legitimately anonymous — no token at all

  try {
    const resp = await fetch('/api/user-tier', {
      cache: 'no-store',
      headers: { 'x-edgepannel-token': token },
    });
    if (!resp.ok) return null;  // transient server/network error — preserve existing tier
    const data = await resp.json() as { tier?: string };
    return normalizeTier(data?.tier);
  } catch {
    return null;                // network failure or JSON parse error — preserve existing tier
  }
}

async function refreshUserTierInternal(expectedTier: UserTier | null = null): Promise<UserTier> {
  const user = authState.user;
  if (!user) {
    tierRequestId += 1;
    if (authState.tier !== 'free') setAuthState({ tier: 'free' });
    return 'free';
  }

  const requestId = ++tierRequestId;
  const attempts = expectedTier ? CHECKOUT_POLL_ATTEMPTS : 1;
  let tier: UserTier = authState.tier;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const resolved = await fetchResolvedTier();
    if (requestId !== tierRequestId || authState.user?.uid !== user.uid) {
      return authState.tier;
    }

    if (resolved === null) {
      // Transient failure — preserve the current tier, do not downgrade paid users.
      if (AUTH_DEBUG) log.debug('[Auth] Tier fetch failed transiently, keeping current tier:', authState.tier);
      tier = authState.tier;
    } else {
      tier = resolved;
      if (tier !== authState.tier) {
        setAuthState({ tier });
      }
    }

    if (!expectedTier || TIER_ORDER[tier] >= TIER_ORDER[expectedTier]) {
      break;
    }

    if (attempt < attempts - 1) {
      await wait(CHECKOUT_POLL_INTERVAL_MS);
    }
  }

  if (expectedTier) clearCheckoutParams();
  return tier;
}

function applyAuthUser(user: User | null): void {
  if (!user) {
    tierRequestId += 1;
    setAuthState({
      user: null,
      loading: false,
      tier: 'free',
    });
    return;
  }

  const tier = authState.user?.uid === user.uid ? authState.tier : 'free';
  setAuthState({
    user,
    loading: false,
    tier,
  });
  void refreshUserTierInternal(getCheckoutExpectedTier());
}

export function initAuth(): void {
  const isConfigured = isFirebaseConfigured();
  authState.isConfigured = isConfigured;
  
  if (!isConfigured) {
    setAuthState({ loading: false, tier: 'free' });
    return;
  }

  getFirebaseAuth();

  onAuthChange((user) => {
    if (AUTH_DEBUG) log.debug('[Auth] State changed:', { user: user?.email, uid: user?.uid, loading: false });
    applyAuthUser(user);
  });

  const current = getCurrentUser();
  if (current) {
    if (AUTH_DEBUG) log.debug('[Auth] Current user on init:', current.email);
    applyAuthUser(current);
  }

  handleRedirectResult().then((user) => {
    if (user && AUTH_DEBUG) log.debug('[Auth] User from redirect:', user.email);
    if (user) applyAuthUser(user);
  }).catch(() => {
    // Ignore redirect completion errors and let auth listener settle state.
  });
  
  // Initial state check after a delay
  setTimeout(() => {
    if (authState.loading) {
      if (AUTH_DEBUG) log.debug('[Auth] Timeout - assuming no user');
      setAuthState({ loading: false });
    }
  }, 3000);
}

export function subscribeToAuth(callback: (state: AuthState) => void): () => void {
  listeners.add(callback);
  callback(authState);
  return () => listeners.delete(callback);
}

export function getCurrentAuthState(): AuthState {
  return authState;
}

export function isLoggedIn(): boolean {
  return authState.user !== null;
}

export function getUserId(): string | null {
  return authState.user?.uid ?? null;
}

export async function refreshUserTier(): Promise<UserTier> {
  return refreshUserTierInternal(getCheckoutExpectedTier());
}

/**
 * Honors a `?upgrade=<tier>` intent carried from the marketing pricing page.
 * Once a signed-in user is present, hands off to Stripe checkout for that tier.
 * If the visitor never signs in, nothing happens — they simply land in the app.
 * The intent is captured synchronously so a later sign-in still completes it.
 */
export function consumeUpgradeIntent(): void {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('upgrade');
  if (!requested || requested === 'free') return;
  const interval = params.get('interval') === 'year' ? 'year' : 'month';

  let handled = false;
  const unsubscribe = subscribeToAuth((state) => {
    if (state.loading || handled) return;
    if (state.user) {
      handled = true;
      // Defer unsubscribe so we're not mutating the listener set mid-notify.
      setTimeout(unsubscribe, 0);
      window.location.href =
        `/api/checkout?tier=${encodeURIComponent(requested)}&uid=${state.user.uid}&interval=${interval}`;
    }
  });
}
