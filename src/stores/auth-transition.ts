/**
 * Pure derivation of an auth/session transition for the runtime store.
 *
 * `deriveAuthTransition` takes the runtime's current read-subset plus a
 * normalized auth payload and returns a `patch` (the single set of store facts
 * to write) together with an ORDERED list of `effects` the shell must run, in
 * array order, after applying the patch. It performs no I/O, reads no store,
 * touches no clock — the returned `{ patch, effects }` is the entire test
 * surface for the auth phase machine, the account/IDB-pointer asymmetry, the
 * hydration decision, the lastSyncAt max-merge, and reauth recovery.
 *
 * Effect ordering is load-bearing: the shell executes effects left-to-right
 * with no reordering, filtering, or dedup. A `hydrate` effect is terminal —
 * `hydrateCurrentAccount` itself performs the post-hydrate auto-sync and
 * prefetch reconcile, so no further effects follow it.
 */

import type {
  ApiCapability,
  ApiCapabilityState,
  AuthPhase,
  AuthState as SessionAuthState,
  Bookmark,
  SessionState,
  SyncStatus,
} from "../types";
import type { SyncJobKind } from "./runtime-store";
import { AUTH_QUICK_CHECK_MS } from "../lib/constants/timing";

export interface AuthPayload {
  hasUser: boolean;
  hasAuth: boolean;
  authState: SessionAuthState;
  sessionState: SessionState;
  userId: string | null;
  accountContextId: string | null;
  bookmarksApi: ApiCapabilityState;
  detailApi: ApiCapabilityState;
  lastSyncAt: number;
}

/** The read-subset of RuntimeState the derivation depends on. */
export interface AuthTransitionInput {
  authPhase: AuthPhase;
  activeAccountId: string | null;
  bookmarksLoaded: boolean;
  detailedIdsLoaded: boolean;
  bookmarks: Bookmark[];
  detailedTweetIds: Set<string>;
  syncStatus: SyncStatus;
  syncJobKind: SyncJobKind;
  bootGeneration: number;
  lastSyncAt: number;
}

/** The exact set of store facts the transition writes. */
export interface AuthTransitionPatch {
  authPhase: AuthPhase;
  authState: SessionAuthState;
  sessionState: SessionState;
  capability: ApiCapability;
  activeAccountId: string | null;
  authRetryDelayMs: number | null;
  bootGeneration: number;
  bookmarksLoaded: boolean;
  detailedIdsLoaded: boolean;
  bookmarks: Bookmark[];
  detailedTweetIds: Set<string>;
  lastSyncAt: number;
  syncStatus: SyncStatus;
  syncJobKind: SyncJobKind;
}

export type AuthTransitionEffect =
  | { kind: "releaseActiveWork" }
  | { kind: "clearScheduledAutoRetry" }
  | { kind: "startAuthCapture"; interactive: boolean }
  | { kind: "hydrate"; bootGeneration: number; allowAutoSync: boolean }
  | { kind: "maybeAutoSync" }
  | { kind: "reconcilePrefetch" };

export interface AuthTransitionOptions {
  allowHydration: boolean;
  allowAutoSync: boolean;
}

export interface AuthTransition {
  patch: AuthTransitionPatch;
  effects: AuthTransitionEffect[];
}

/**
 * Mirror of the runtime's auth-capture guard: capture is worth starting only
 * when we have a user but no live auth and aren't already logged in.
 */
function shouldStartAuthCapture(payload: AuthPayload): boolean {
  return !(
    payload.sessionState === "logged_in" ||
    payload.hasAuth ||
    !payload.hasUser
  );
}

export function deriveAuthTransition(
  prev: AuthTransitionInput,
  payload: AuthPayload,
  options: AuthTransitionOptions,
): AuthTransition {
  const nextAccountId =
    payload.sessionState === "logged_out" || payload.authState === "logged_out"
      ? prev.activeAccountId || payload.accountContextId || null
      : payload.userId || payload.accountContextId || prev.activeAccountId;

  let phase: AuthPhase;
  let sessionState: SessionState;
  let authRetryDelayMs: number | null = null;

  if (
    payload.sessionState === "logged_out" ||
    payload.authState === "logged_out"
  ) {
    phase = "need_login";
    sessionState = "logged_out";
  } else if (payload.sessionState === "logged_in") {
    phase = "ready";
    sessionState = "logged_in";
  } else if (!payload.hasUser && !payload.hasAuth) {
    phase = "need_login";
    sessionState = "logged_out";
  } else {
    phase = "connecting";
    sessionState = payload.sessionState;
    authRetryDelayMs = AUTH_QUICK_CHECK_MS;
  }

  const accountChanged = nextAccountId !== prev.activeAccountId;
  const needsHydration =
    options.allowHydration &&
    (accountChanged || !prev.bookmarksLoaded || !prev.detailedIdsLoaded);
  const phaseChanged = phase !== prev.authPhase;

  // Invalidate any in-flight sync when the runtime's view of the session
  // becomes non-ready, or when we're about to re-hydrate against a cleared
  // cache — otherwise a stale lease keeps writing into a DB we no longer own.
  const shouldReleaseActiveWork =
    needsHydration || (prev.syncStatus === "syncing" && phase !== "ready");

  const nextBootGeneration = needsHydration
    ? prev.bootGeneration + 1
    : prev.bootGeneration;

  // Snapshot-push path (allowHydration=false) cannot move the IDB pointer, so
  // it leaves activeAccountId untouched and defers to the follow-up checkAuth.
  const nextStoreAccountId =
    accountChanged && !options.allowHydration
      ? prev.activeAccountId
      : nextAccountId;
  const recoveredFromReauth =
    phase === "ready" && prev.syncStatus === "reauthing";
  const needLoginWhileSyncing =
    phase === "need_login" && prev.syncStatus === "syncing";

  const patch: AuthTransitionPatch = {
    authPhase: phase,
    authState: payload.authState,
    sessionState,
    capability: {
      bookmarksApi: payload.bookmarksApi,
      detailApi: payload.detailApi,
    },
    activeAccountId: nextStoreAccountId,
    authRetryDelayMs,
    bootGeneration: nextBootGeneration,
    bookmarksLoaded: needsHydration ? false : prev.bookmarksLoaded,
    detailedIdsLoaded: needsHydration ? false : prev.detailedIdsLoaded,
    bookmarks: needsHydration ? [] : prev.bookmarks,
    detailedTweetIds: needsHydration
      ? new Set<string>()
      : prev.detailedTweetIds,
    // Never regress: the SW can push a snapshot after this session already
    // advanced lastSyncAt.
    lastSyncAt:
      payload.lastSyncAt > prev.lastSyncAt
        ? payload.lastSyncAt
        : prev.lastSyncAt,
    syncStatus:
      needLoginWhileSyncing || recoveredFromReauth ? "idle" : prev.syncStatus,
    syncJobKind:
      needLoginWhileSyncing || recoveredFromReauth ? "none" : prev.syncJobKind,
  };

  const effects: AuthTransitionEffect[] = [];
  if (shouldReleaseActiveWork) {
    effects.push({ kind: "releaseActiveWork" });
  }
  // An auth/account transition invalidates whatever block window a prior sync
  // decision set up; a pending long timer would otherwise silence post-login
  // auto-sync.
  if (accountChanged || (phaseChanged && phase === "ready")) {
    effects.push({ kind: "clearScheduledAutoRetry" });
  }
  if (phase === "connecting" && shouldStartAuthCapture(payload)) {
    effects.push({ kind: "startAuthCapture", interactive: false });
  }
  if (needsHydration) {
    effects.push({
      kind: "hydrate",
      bootGeneration: nextBootGeneration,
      allowAutoSync: options.allowAutoSync && !recoveredFromReauth,
    });
  } else {
    if (options.allowAutoSync && !recoveredFromReauth) {
      effects.push({ kind: "maybeAutoSync" });
    }
    effects.push({ kind: "reconcilePrefetch" });
  }

  return { patch, effects };
}
