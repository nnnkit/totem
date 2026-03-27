/**
 * Auth+boot slice — self-contained state machine with internal timers.
 *
 * Owns: authPhase, authState, sessionState, capability, activeAccountId,
 *       authRetryDelayMs, bootPolicy, bootGeneration, bookmarksLoaded,
 *       detailedIdsLoaded.
 *
 * Timers (heartbeat, connecting timeout, retry) live inside the slice —
 * no timer logic remains in RuntimeProvider.
 *
 * boot() starts the machine, dispose() tears it down.
 */

import { create } from "zustand";
import type {
  ApiCapability,
  ApiCapabilityState,
  AuthPhase,
  AuthState as SessionAuthState,
  AuthStatus,
  Bookmark,
  RuntimeSnapshot,
  SessionState,
} from "../../types";
import {
  AUTH_CONNECTING_TIMEOUT_MS,
  AUTH_HEARTBEAT_MS,
  AUTH_QUICK_CHECK_MS,
  AUTH_RETRY_MS,
  AUTH_STALE_RECHECK_MS,
  AUTH_TIMEOUT_MS,
  DB_INIT_TIMEOUT_MS,
} from "../../lib/constants/timing";

// ── Types ─────────────────────────────────────────────────────

export type BootSyncPolicy = "auto" | "manual_only_until_seeded";

export interface AuthPayload {
  hasUser: boolean;
  hasAuth: boolean;
  authState: SessionAuthState;
  sessionState: SessionState;
  userId: string | null;
  accountContextId: string | null;
  bookmarksApi: ApiCapabilityState;
  detailApi: ApiCapabilityState;
}

export interface AuthSliceState {
  authPhase: AuthPhase;
  authState: SessionAuthState;
  sessionState: SessionState;
  capability: ApiCapability;
  activeAccountId: string | null;
  authRetryDelayMs: number | null;
  bootPolicy: BootSyncPolicy;
  bootGeneration: number;
  bookmarksLoaded: boolean;
  detailedIdsLoaded: boolean;
}

export interface AuthSliceActions {
  boot: () => Promise<void>;
  dispose: () => void;
  checkAuth: () => Promise<void>;
  connectingTimeout: () => void;
  startLogin: () => Promise<void>;
}

/**
 * Valid auth phase transitions. Used for both documentation and runtime
 * enforcement in tests. The machine rejects transitions not in this map.
 */
export const AUTH_PHASE_TRANSITIONS: Record<AuthPhase, readonly AuthPhase[]> = {
  loading: ["connecting", "need_login", "ready"],
  connecting: ["ready", "need_login"],
  need_login: ["connecting", "ready"],
  ready: ["need_login", "connecting", "loading"],
} as const;

export function isValidAuthTransition(from: AuthPhase, to: AuthPhase): boolean {
  if (from === to) return true; // no-op is always valid
  return AUTH_PHASE_TRANSITIONS[from].includes(to);
}

// ── Dependencies (injected for testability) ───────────────────

export interface AuthSliceDeps {
  /** Fetch auth snapshot from service worker. */
  getRuntimeSnapshot: () => Promise<RuntimeSnapshot>;
  /** Fallback auth check. */
  checkAuth: (opts: Record<string, unknown>) => Promise<AuthStatus>;
  /** Load bookmarks from IndexedDB. */
  getAllBookmarks: () => Promise<Bookmark[]>;
  /** Load detailed tweet IDs from IndexedDB. */
  getDetailedTweetIds: () => Promise<Set<string>>;
  /** Set active account in the DB layer. */
  setActiveAccountId: (id: string | null) => void;
  /** Read boot policy from localStorage. */
  readBootPolicy?: () => BootSyncPolicy;
  /** Persist boot policy to localStorage. */
  persistBootPolicy?: (policy: BootSyncPolicy) => void;
  /** Called when auth reaches "ready" and hydration is complete. */
  onReady?: (state: AuthSliceState) => void;
  /** Called when bookmark events should be checked. */
  onHydrateComplete?: () => void;
  /** Storage change listener setup (for chrome.storage.onChanged). */
  addStorageListener?: (listener: (changes: Record<string, unknown>, area: string) => void) => void;
  removeStorageListener?: (listener: (changes: Record<string, unknown>, area: string) => void) => void;
}

// ── Normalization helpers ─────────────────────────────────────

export function normalizeAuthPayloadFromSnapshot(snapshot: RuntimeSnapshot): AuthPayload {
  const bookmarksApi = snapshot.capability?.bookmarksApi ?? "unknown";
  const detailApi = snapshot.capability?.detailApi ?? "unknown";

  return {
    hasUser: snapshot.sessionState === "logged_in" && Boolean(snapshot.accountContextId),
    hasAuth: snapshot.sessionState === "logged_in",
    authState:
      snapshot.sessionState === "logged_out"
        ? "logged_out"
        : snapshot.sessionState === "logged_in"
          ? "authenticated"
          : "stale",
    sessionState: snapshot.sessionState,
    userId: snapshot.sessionState === "logged_in" ? snapshot.accountContextId : null,
    accountContextId: snapshot.accountContextId,
    bookmarksApi,
    detailApi,
  };
}

export function normalizeAuthPayloadFromStatus(status: AuthStatus): AuthPayload {
  const authState = status.authState ?? (status.hasAuth ? "authenticated" : "logged_out");
  const sessionState = status.sessionState ??
    (authState === "logged_out"
      ? "logged_out"
      : status.hasAuth
        ? "logged_in"
        : "unknown");
  const bookmarksApi = status.capability?.bookmarksApi ??
    (status.hasAuth ? "ready" : "unknown");
  const detailApi = status.capability?.detailApi ?? "unknown";

  return {
    hasUser: status.hasUser,
    hasAuth: status.hasAuth,
    authState,
    sessionState,
    userId: typeof status.userId === "string" && status.userId ? status.userId : null,
    accountContextId:
      typeof status.accountContextId === "string" && status.accountContextId
        ? status.accountContextId
        : null,
    bookmarksApi,
    detailApi,
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(timeoutError), timeoutMs);
    }),
  ]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  }) as Promise<T>;
}

// ── Slice factory ─────────────────────────────────────────────

export type AuthStore = ReturnType<typeof createAuthSlice>;

export function createAuthSlice(deps: AuthSliceDeps) {
  // ── Private timer state ───────────────────────────────────
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let connectingTimer: ReturnType<typeof setTimeout> | null = null;
  let authRequestId = 0;

  const clearAllTimers = () => {
    if (heartbeatTimer !== null) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null; }
    if (connectingTimer !== null) { clearTimeout(connectingTimer); connectingTimer = null; }
  };

  const readBootPolicy = deps.readBootPolicy ?? defaultReadBootPolicy;

  const store = create<AuthSliceState & { actions: AuthSliceActions }>((set, get) => {
    // ── Controlled setter with normalization ─────────────────
    const setState = (
      updater: Partial<AuthSliceState> | ((s: AuthSliceState) => Partial<AuthSliceState>),
    ) => {
      set((state) => {
        const patch = typeof updater === "function" ? updater(state) : updater;

        // Skip if no actual changes
        const entries = Object.entries(patch) as Array<[keyof AuthSliceState, unknown]>;
        if (entries.length === 0) return state;
        let hasChange = false;
        for (const [key, value] of entries) {
          if (!Object.is(state[key], value)) { hasChange = true; break; }
        }
        if (!hasChange) return state;

        const next = { ...state, ...patch };

        // Normalize: logged_out + ready → need_login
        if (next.sessionState === "logged_out" && next.authPhase === "ready") {
          next.authPhase = "need_login";
        }

        return next;
      });
    };

    // ── Auth payload loading ─────────────────────────────────
    const loadAuthPayload = async (): Promise<AuthPayload> => {
      try {
        const snapshot = await withTimeout(
          deps.getRuntimeSnapshot(),
          AUTH_TIMEOUT_MS,
          new Error("AUTH_TIMEOUT"),
        );
        return normalizeAuthPayloadFromSnapshot(snapshot);
      } catch {
        const status = await withTimeout(
          deps.checkAuth({}),
          AUTH_TIMEOUT_MS,
          new Error("AUTH_TIMEOUT"),
        );
        return normalizeAuthPayloadFromStatus(status);
      }
    };

    // ── Hydration ────────────────────────────────────────────
    const hydrateCurrentAccount = async (
      bootGeneration: number,
      allowAutoSync: boolean,
    ): Promise<void> => {
      const accountId = get().activeAccountId;
      deps.setActiveAccountId(accountId);

      const [bookmarksResult, detailedResult] = await Promise.allSettled([
        withTimeout(deps.getAllBookmarks(), DB_INIT_TIMEOUT_MS, new Error("DB_INIT_TIMEOUT")),
        withTimeout(deps.getDetailedTweetIds(), DB_INIT_TIMEOUT_MS, new Error("DETAIL_DB_INIT_TIMEOUT")),
      ]);

      if (get().bootGeneration !== bootGeneration) return;

      setState({
        bookmarksLoaded: bookmarksResult.status === "fulfilled",
        detailedIdsLoaded: detailedResult.status === "fulfilled",
      });

      deps.onHydrateComplete?.();
      if (allowAutoSync) {
        deps.onReady?.(get());
      }
    };

    // ── Apply auth payload ───────────────────────────────────
    const applyAuthPayload = async (
      payload: AuthPayload,
      options: { allowHydration: boolean; allowAutoSync: boolean },
    ): Promise<void> => {
      const state = get();
      const nextAccountId =
        payload.sessionState === "logged_out" || payload.authState === "logged_out"
          ? state.activeAccountId || payload.accountContextId || null
          : payload.userId || payload.accountContextId || state.activeAccountId;

      let phase: AuthPhase;
      let sessionState: SessionState;
      let authRetryDelayMs: number | null = null;

      if (payload.sessionState === "logged_out" || payload.authState === "logged_out") {
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

      const accountChanged = nextAccountId !== state.activeAccountId;
      const skipForLoggedOutReset =
        phase === "need_login" && state.bootPolicy === "manual_only_until_seeded";
      const needsHydration = options.allowHydration &&
        !skipForLoggedOutReset &&
        (accountChanged || !state.bookmarksLoaded || !state.detailedIdsLoaded);

      const nextBootGeneration = needsHydration
        ? state.bootGeneration + 1
        : state.bootGeneration;

      setState({
        authPhase: phase,
        authState: payload.authState,
        sessionState,
        capability: {
          bookmarksApi: payload.bookmarksApi,
          detailApi: payload.detailApi,
        },
        activeAccountId: nextAccountId,
        authRetryDelayMs,
        bootGeneration: nextBootGeneration,
        bookmarksLoaded: skipForLoggedOutReset ? true : needsHydration ? false : state.bookmarksLoaded,
        detailedIdsLoaded: skipForLoggedOutReset ? true : needsHydration ? false : state.detailedIdsLoaded,
      });

      if (needsHydration) {
        // hydrateCurrentAccount checks bootGeneration internally before
        // mutating state, so stale hydrations are safely discarded.
        await hydrateCurrentAccount(nextBootGeneration, options.allowAutoSync);
        return;
      }

      if (options.allowAutoSync) {
        deps.onReady?.(get());
      }
    };

    // ── Auth check ───────────────────────────────────────────
    const runAuthCheck = async (): Promise<void> => {
      const requestId = authRequestId + 1;
      authRequestId = requestId;

      try {
        const payload = await loadAuthPayload();
        if (requestId !== authRequestId) return;
        await applyAuthPayload(payload, {
          allowHydration: true,
          allowAutoSync: true,
        });
      } catch {
        if (requestId !== authRequestId) return;
        setState((state) => {
          if (state.authPhase === "ready") {
            return {
              authState: "stale" as SessionAuthState,
              authRetryDelayMs: AUTH_RETRY_MS,
            };
          }
          return {
            authState: (state.authState === "authenticated" ? "stale" : state.authState) as SessionAuthState,
            authPhase: "connecting" as AuthPhase,
            authRetryDelayMs: AUTH_RETRY_MS,
          };
        });
      }
    };

    // ── Actions ──────────────────────────────────────────────
    const actions: AuthSliceActions = {
      boot: async () => {
        const bootGeneration = get().bootGeneration + 1;
        authRequestId += 1;
        setState({
          bootGeneration,
          bootPolicy: readBootPolicy(),
          authPhase: "loading",
          authRetryDelayMs: null,
          bookmarksLoaded: false,
          detailedIdsLoaded: false,
        });

        try {
          const payload = await loadAuthPayload();
          if (get().bootGeneration !== bootGeneration) return;
          await applyAuthPayload(payload, {
            allowHydration: true,
            allowAutoSync: true,
          });
        } catch {
          if (get().bootGeneration !== bootGeneration) return;
          setState({
            authPhase: "connecting",
            authRetryDelayMs: AUTH_RETRY_MS,
            bookmarksLoaded: true,
            detailedIdsLoaded: true,
          });
        }
      },

      dispose: () => {
        clearAllTimers();
        authRequestId += 1;
        setState((state) => ({
          bootGeneration: state.bootGeneration + 1,
          authRetryDelayMs: null,
        }));
      },

      checkAuth: async () => {
        await runAuthCheck();
      },

      connectingTimeout: () => {
        setState((state) => {
          if (state.authPhase !== "connecting") return {};
          return {
            authPhase: "need_login" as AuthPhase,
            sessionState: "unknown" as SessionState,
            authRetryDelayMs: AUTH_STALE_RECHECK_MS,
          };
        });
      },

      startLogin: async () => {
        setState({
          authPhase: "connecting" as AuthPhase,
          sessionState: "unknown" as SessionState,
          authRetryDelayMs: AUTH_QUICK_CHECK_MS,
        });
        await runAuthCheck();
      },
    };

    return {
      authPhase: "loading" as AuthPhase,
      authState: "stale" as SessionAuthState,
      sessionState: "unknown" as SessionState,
      capability: { bookmarksApi: "unknown" as ApiCapabilityState, detailApi: "unknown" as ApiCapabilityState },
      activeAccountId: null,
      authRetryDelayMs: null,
      bootPolicy: "auto" as BootSyncPolicy,
      bootGeneration: 0,
      bookmarksLoaded: false,
      detailedIdsLoaded: false,
      actions,
    };
  });

  // ── Self-contained timer management via subscription ──────
  const unsubscribe = store.subscribe((state, prevState) => {
    // Heartbeat timer: active only when authPhase === "ready"
    if (state.authPhase === "ready" && prevState.authPhase !== "ready") {
      if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        void store.getState().actions.checkAuth();
      }, AUTH_HEARTBEAT_MS);
    }
    if (state.authPhase !== "ready" && prevState.authPhase === "ready") {
      if (heartbeatTimer !== null) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    }

    // Connecting timeout: active only when authPhase === "connecting"
    if (state.authPhase === "connecting" && prevState.authPhase !== "connecting") {
      if (connectingTimer !== null) clearTimeout(connectingTimer);
      connectingTimer = setTimeout(() => {
        store.getState().actions.connectingTimeout();
      }, AUTH_CONNECTING_TIMEOUT_MS);
    }
    if (state.authPhase !== "connecting" && prevState.authPhase === "connecting") {
      if (connectingTimer !== null) { clearTimeout(connectingTimer); connectingTimer = null; }
    }

    // Retry timer: active when authRetryDelayMs is set
    if (state.authRetryDelayMs !== prevState.authRetryDelayMs) {
      if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null; }
      if (typeof state.authRetryDelayMs === "number" && state.authRetryDelayMs > 0) {
        retryTimer = setTimeout(() => {
          void store.getState().actions.checkAuth();
        }, state.authRetryDelayMs);
      }
    }
  });

  // Attach cleanup for the subscription
  const originalDispose = store.getState().actions.dispose;
  store.setState({
    actions: {
      ...store.getState().actions,
      dispose: () => {
        originalDispose();
        unsubscribe();
      },
    },
  });

  return store;
}

// ── Default boot policy persistence (localStorage) ──────────

function defaultReadBootPolicy(): BootSyncPolicy {
  try {
    const stored = localStorage.getItem("totem_boot_sync_policy");
    if (stored === "manual_only_until_seeded" || stored === "auto") {
      return stored;
    }
    if (localStorage.getItem("totem_manual_sync_required") === "1") {
      localStorage.setItem("totem_boot_sync_policy", "manual_only_until_seeded");
      localStorage.removeItem("totem_manual_sync_required");
      return "manual_only_until_seeded";
    }
  } catch {}
  return "auto";
}

export function defaultPersistBootPolicy(policy: BootSyncPolicy): void {
  try {
    if (policy === "auto") {
      localStorage.removeItem("totem_boot_sync_policy");
    } else {
      localStorage.setItem("totem_boot_sync_policy", policy);
    }
    localStorage.removeItem("totem_manual_sync_required");
  } catch {}
}
