/**
 * Auth module for the service worker.
 *
 * Extracts auth snapshot building, session validation, auth state management,
 * and structured diagnostics from the service worker monolith.
 *
 * Handles: CHECK_AUTH, GET_RUNTIME_SNAPSHOT, SESSION_USER_MISSING,
 *          SET_ACCOUNT_CONTEXT, START_AUTH_CAPTURE, CLOSE_AUTH_TAB, REAUTH_STATUS
 */

import type { MessageRequest } from "../types/messages";
import type { HandlerMap } from "./index";
import type {
  AuthState,
  AuthDiagnosticEntry,
  AuthDiagnosticStage,
  AuthDiagnosticStatus,
  AuthStatus,
  SessionSnapshot,
} from "../types/auth";
import {
  parseTwidUserId,
  getCookieHeaderValue,
  normalizeAuthState,
  normalizeSyncAccountId,
  getSyncBlockedReason,
} from "../lib/sw-pure";

// ── Constants ───────────────────────────────────────────────────

const ACCOUNT_CONTEXT_STORAGE_KEY = "totem_account_context_id";
const AUTH_WEAK_NEGATIVE_WINDOW_MS = 10_000;
const AUTH_WEAK_NEGATIVE_THRESHOLD = 2;

const BOOKMARK_EVENTS_STORAGE_KEY = "totem_bookmark_events";
const CACHE_SUMMARY_KEYS = [
  "totem_last_sync",
  "totem_last_light_sync",
  "totem_light_sync_needed",
  BOOKMARK_EVENTS_STORAGE_KEY,
];
const SYNC_ORCHESTRATOR_STORAGE_KEY = "totem_sync_orchestrator_state";
const RUNTIME_STATE_V2_STORAGE_KEY = "totem_runtime_state_v2";
const AUTH_DIAGNOSTICS_STORAGE_KEY = "totem_auth_diagnostics";

// ── In-memory auth state ────────────────────────────────────────

let authWeakNegativeHits: number[] = [];
let reauthInProgress = false;
let authTabId: number | null = null;
let authTabCleanup: (() => void) | null = null;

// ── Diagnostics ─────────────────────────────────────────────────

const diagnosticLog: AuthDiagnosticEntry[] = [];
const MAX_DIAGNOSTIC_ENTRIES = 50;

function logDiagnostic(
  stage: AuthDiagnosticStage,
  status: AuthDiagnosticStatus,
  reason?: string,
): void {
  diagnosticLog.push({ stage, status, timestamp: Date.now(), reason });
  if (diagnosticLog.length > MAX_DIAGNOSTIC_ENTRIES) {
    diagnosticLog.splice(0, diagnosticLog.length - MAX_DIAGNOSTIC_ENTRIES);
  }
}

export function getAuthDiagnosticLog(): readonly AuthDiagnosticEntry[] {
  return diagnosticLog;
}

// ── Auth state management ───────────────────────────────────────

export interface AuthDeps {
  storage: typeof chrome.storage.local;
  tabs: typeof chrome.tabs;
}

function defaultDeps(): AuthDeps {
  const g = globalThis as Record<string, unknown>;
  return {
    storage: (g.chrome as { storage: { local: typeof chrome.storage.local } })
      ?.storage?.local,
    tabs: (g.chrome as { tabs: typeof chrome.tabs })?.tabs,
  };
}

async function setAuthState(
  state: AuthState,
  reason: string,
  options: { clearAuth?: boolean } = {},
  storage: typeof chrome.storage.local,
): Promise<void> {
  const now = Date.now();
  const safeReason =
    typeof reason === "string" && reason ? reason.slice(0, 120) : "";
  const updates: Record<string, unknown> = {
    totem_auth_state: state,
    totem_auth_state_at: now,
    totem_auth_state_reason: safeReason,
  };
  if (options.clearAuth) {
    await Promise.all([
      storage.set(updates),
      storage.remove(["totem_auth_headers", "totem_auth_time"]),
    ]);
    return;
  }
  await storage.set(updates);
}

function resetWeakAuthSignals(): void {
  authWeakNegativeHits = [];
}

async function markAuthAuthenticated(
  reason: string = "auth_signal",
  storage: typeof chrome.storage.local,
): Promise<void> {
  resetWeakAuthSignals();
  await setAuthState("authenticated", reason, {}, storage);
}

async function markAuthLoggedOut(
  reason: string = "auth_missing",
  clearAuth: boolean = true,
  storage: typeof chrome.storage.local,
): Promise<void> {
  resetWeakAuthSignals();
  await setAuthState("logged_out", reason, { clearAuth }, storage);
}

async function recordWeakAuthNegativeSignal(
  reason: string,
  storage: typeof chrome.storage.local,
): Promise<void> {
  const now = Date.now();
  authWeakNegativeHits = authWeakNegativeHits.filter(
    (ts) => now - ts <= AUTH_WEAK_NEGATIVE_WINDOW_MS,
  );
  authWeakNegativeHits.push(now);
  if (authWeakNegativeHits.length < AUTH_WEAK_NEGATIVE_THRESHOLD) {
    return;
  }
  authWeakNegativeHits = [];
  try {
    await markAuthLoggedOut(reason, true, storage);
  } catch {
    // swallow errors
  }
}

// ── Session snapshot ────────────────────────────────────────────

export async function getSessionSnapshot(
  storage: typeof chrome.storage.local,
): Promise<SessionSnapshot> {
  const stored = await storage.get([
    "totem_user_id",
    ACCOUNT_CONTEXT_STORAGE_KEY,
    "totem_auth_headers",
    "totem_auth_state",
    "totem_auth_state_at",
  ]);

  let userId: string | null =
    typeof stored.totem_user_id === "string" && stored.totem_user_id
      ? stored.totem_user_id
      : null;
  const authHeaders = stored.totem_auth_headers as
    | Record<string, string>
    | undefined;
  const hasAuthHeader = Boolean(authHeaders?.authorization);

  if (!userId && typeof authHeaders?.cookie === "string") {
    const twidRaw = getCookieHeaderValue(authHeaders.cookie, "twid");
    const parsedUserId = parseTwidUserId(twidRaw);
    if (parsedUserId) {
      userId = parsedUserId;
      storage
        .set({
          totem_user_id: parsedUserId,
          [ACCOUNT_CONTEXT_STORAGE_KEY]: parsedUserId,
        })
        .catch(() => {});
    }
  }

  const storedAccountContextId =
    typeof stored[ACCOUNT_CONTEXT_STORAGE_KEY] === "string" &&
    stored[ACCOUNT_CONTEXT_STORAGE_KEY]
      ? (stored[ACCOUNT_CONTEXT_STORAGE_KEY] as string)
      : null;
  const accountContextId = userId || storedAccountContextId;
  if (userId && storedAccountContextId !== userId) {
    storage.set({ [ACCOUNT_CONTEXT_STORAGE_KEY]: userId }).catch(() => {});
  }

  const authState = normalizeAuthState(stored.totem_auth_state, hasAuthHeader);
  const sessionState =
    authState === "logged_out"
      ? ("logged_out" as const)
      : hasAuthHeader || authState === "authenticated"
        ? ("logged_in" as const)
        : ("unknown" as const);

  logDiagnostic(
    "snapshot_build",
    sessionState === "logged_in" ? "ok" : sessionState === "logged_out" ? "missing" : "error",
    `authState=${authState} session=${sessionState}`,
  );

  return {
    userId,
    accountContextId,
    authState,
    sessionState,
    capability: {
      bookmarksApi: sessionState === "logged_in" ? "ready" : "unknown",
      detailApi: "unknown",
    },
    hasAuthHeader,
  };
}

export function deriveAuthPhaseFromSession(
  sessionState: string,
): "need_login" | "connecting" | "ready" {
  if (sessionState === "logged_out") return "need_login";
  if (sessionState === "logged_in") return "ready";
  return "connecting";
}

// ── Sync orchestrator read helpers ──────────────────────────────

interface SyncAccountState {
  rateLimitBackoffUntil?: number;
  inFlight?: {
    leaseId?: string;
    mode?: string;
    trigger?: string;
    startedAt?: number;
  } | null;
  manualCooldownUntil?: number;
  lastAttemptAt?: number;
  lastSuccessAt?: number;
}

interface SyncOrchestratorState {
  accounts: Record<string, SyncAccountState>;
}

function createEmptySyncAccountState(): SyncAccountState {
  return {};
}

async function readSyncOrchestratorState(
  storage: typeof chrome.storage.local,
): Promise<SyncOrchestratorState> {
  const stored = await storage.get([SYNC_ORCHESTRATOR_STORAGE_KEY]);
  const state = stored[SYNC_ORCHESTRATOR_STORAGE_KEY];
  if (
    state &&
    typeof state === "object" &&
    !Array.isArray(state) &&
    typeof (state as SyncOrchestratorState).accounts === "object"
  ) {
    return state as SyncOrchestratorState;
  }
  return { accounts: {} };
}

// ── Runtime snapshot building ───────────────────────────────────

async function buildRuntimeSnapshot(
  stateOverride: SyncOrchestratorState | null = null,
  accountContextOverride: string | null = null,
  storage: typeof chrome.storage.local,
) {
  const now = Date.now();
  const sessionSnapshot = await getSessionSnapshot(storage);
  const requestedAccountContextId = normalizeSyncAccountId(
    accountContextOverride,
  );
  const accountContextId =
    requestedAccountContextId || sessionSnapshot.accountContextId;
  const accountKey = normalizeSyncAccountId(accountContextId);
  const state = stateOverride || (await readSyncOrchestratorState(storage));
  const account = accountKey
    ? state.accounts[accountKey] || createEmptySyncAccountState()
    : null;
  const blockedReason = getSyncBlockedReason(
    sessionSnapshot,
    account,
    accountKey,
    now,
  );

  const cacheStored = await storage.get(CACHE_SUMMARY_KEYS);
  const events = Array.isArray(cacheStored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? (cacheStored[BOOKMARK_EVENTS_STORAGE_KEY] as unknown[])
    : [];

  return {
    sessionState: sessionSnapshot.sessionState,
    authPhase: deriveAuthPhaseFromSession(sessionSnapshot.sessionState),
    accountContextId,
    capability: sessionSnapshot.capability,
    syncPolicy: {
      accountKey,
      inFlight: account?.inFlight
        ? {
            leaseId: account.inFlight.leaseId,
            mode:
              account.inFlight.mode === "full"
                ? "full"
                : account.inFlight.mode === "quick"
                  ? "quick"
                  : "incremental",
            trigger:
              account.inFlight.trigger === "manual" ? "manual" : "auto",
            startedAt: Number(account.inFlight.startedAt || 0),
          }
        : null,
      lastAttemptAt: Number(account?.lastAttemptAt || 0),
      lastSuccessAt: Number(account?.lastSuccessAt || 0),
      blockedReason,
    },
    blockedReason,
    cacheSummary: {
      lastSyncAt: Number(cacheStored.totem_last_sync || 0),
      lastSoftSyncAt: Number(cacheStored.totem_last_light_sync || 0),
      lightSyncNeededAt: Number(cacheStored.totem_light_sync_needed || 0),
      pendingBookmarkEventCount: events.length,
    },
  };
}

async function persistRuntimeStateV2(
  snapshot: Record<string, unknown>,
  storage: typeof chrome.storage.local,
): Promise<void> {
  const payload =
    snapshot && typeof snapshot === "object" ? snapshot : {};
  const safeCapability =
    payload.capability && typeof payload.capability === "object"
      ? payload.capability
      : { bookmarksApi: "unknown", detailApi: "unknown" };
  const safeSyncPolicy =
    payload.syncPolicy && typeof payload.syncPolicy === "object"
      ? payload.syncPolicy
      : {
          accountKey: null,
          inFlight: null,
          lastAttemptAt: 0,
          lastSuccessAt: 0,
          blockedReason: null,
        };
  const safeCacheSummary =
    payload.cacheSummary && typeof payload.cacheSummary === "object"
      ? payload.cacheSummary
      : {
          lastSyncAt: 0,
          lastSoftSyncAt: 0,
          lightSyncNeededAt: 0,
          pendingBookmarkEventCount: 0,
        };

  await storage.set({
    [RUNTIME_STATE_V2_STORAGE_KEY]: {
      sessionState: payload.sessionState || "unknown",
      authPhase: payload.authPhase || "loading",
      accountContextId: payload.accountContextId || null,
      capability: safeCapability,
      syncPolicy: safeSyncPolicy,
      blockedReason: payload.blockedReason ?? null,
      cacheSummary: safeCacheSummary,
      updatedAt: Date.now(),
    },
  });
}

// ── Diagnostics persistence ─────────────────────────────────────

async function persistDiagnostics(
  storage: typeof chrome.storage.local,
): Promise<void> {
  try {
    await storage.set({
      [AUTH_DIAGNOSTICS_STORAGE_KEY]: [...diagnosticLog],
    });
  } catch {
    // swallow
  }
}

// ── Handler map ─────────────────────────────────────────────────

export function createAuthHandlers(deps?: AuthDeps): HandlerMap {
  const { storage, tabs } = deps || defaultDeps();

  return {
    CHECK_AUTH: async () => {
      const snapshot = await getSessionSnapshot(storage);
      const responseUserId =
        snapshot.sessionState === "logged_out" ? null : snapshot.userId;
      const hasUser =
        snapshot.sessionState !== "logged_out" &&
        Boolean(responseUserId || snapshot.hasAuthHeader);

      logDiagnostic(
        "frontend_receipt",
        hasUser ? "ok" : "missing",
        `session=${snapshot.sessionState}`,
      );
      await persistDiagnostics(storage);

      const result: AuthStatus = {
        hasUser,
        hasAuth:
          snapshot.sessionState === "logged_in" && snapshot.hasAuthHeader,
        userId: responseUserId,
        accountContextId: snapshot.accountContextId,
        authState: snapshot.authState,
        sessionState: snapshot.sessionState,
        capability: snapshot.capability,
      };
      return result;
    },

    GET_RUNTIME_SNAPSHOT: async (message: MessageRequest) => {
      const msg = message as MessageRequest & {
        type: "GET_RUNTIME_SNAPSHOT";
        accountId?: string;
      };
      const requestedAccountId =
        typeof msg.accountId === "string" ? msg.accountId : null;
      const snapshot = await buildRuntimeSnapshot(
        null,
        requestedAccountId,
        storage,
      );
      if (!requestedAccountId) {
        await persistRuntimeStateV2(
          snapshot as unknown as Record<string, unknown>,
          storage,
        ).catch(() => {});
      }
      return { ok: true, data: snapshot };
    },

    SET_ACCOUNT_CONTEXT: async (message: MessageRequest) => {
      const msg = message as MessageRequest & {
        type: "SET_ACCOUNT_CONTEXT";
        accountId: string;
      };
      const accountContextId = normalizeSyncAccountId(msg.accountId);
      if (!accountContextId) {
        return { ok: false, error: "INVALID_ACCOUNT_CONTEXT" };
      }

      await storage.set({
        [ACCOUNT_CONTEXT_STORAGE_KEY]: accountContextId,
      });
      let snapshot;
      try {
        snapshot = await buildRuntimeSnapshot(
          null,
          accountContextId,
          storage,
        );
      } catch {
        snapshot = null;
      }
      if (snapshot) {
        await persistRuntimeStateV2(
          snapshot as unknown as Record<string, unknown>,
          storage,
        ).catch(() => {});
      }
      return { ok: true, accountContextId };
    },

    SESSION_USER_MISSING: async () => {
      await storage.remove("totem_user_id");
      const stored = await storage.get(["totem_auth_headers"]);
      const hasAuthHeader = Boolean(
        (stored.totem_auth_headers as Record<string, string> | undefined)
          ?.authorization,
      );

      logDiagnostic(
        "capture",
        "missing",
        `session_user_missing hasAuth=${hasAuthHeader}`,
      );
      await persistDiagnostics(storage);

      if (hasAuthHeader) {
        await setAuthState(
          "logged_out",
          "content_no_twid",
          { clearAuth: false },
          storage,
        );
      } else {
        await markAuthLoggedOut("content_no_twid", true, storage);
      }
      return { ok: true };
    },

    START_AUTH_CAPTURE: async () => {
      // Clean up any prior auth tab + listeners
      if (authTabCleanup) {
        authTabCleanup();
        authTabCleanup = null;
      }
      if (authTabId) {
        try {
          await tabs.remove(authTabId);
        } catch {
          // tab may already be closed
        }
        authTabId = null;
      }

      logDiagnostic("capture", "ok", "auth_capture_started");

      const tab = await tabs.create({
        url: "https://x.com/i/bookmarks",
        active: false,
      });
      authTabId = tab.id ?? null;
      const safeTabId = authTabId;

      const onChange = (
        changes: Record<string, { newValue?: unknown }>,
      ) => {
        const authHeaders = changes.totem_auth_headers?.newValue;
        const hasAuth = Boolean(
          authHeaders &&
            typeof authHeaders === "object" &&
            (authHeaders as Record<string, string>).authorization,
        );
        if (hasAuth) {
          logDiagnostic("capture", "ok", "auth_headers_captured");
          persistDiagnostics(storage);
          if (authTabCleanup) {
            authTabCleanup();
            authTabCleanup = null;
          }
          if (authTabId) {
            const tabToClose = authTabId;
            authTabId = null;
            tabs.remove(tabToClose).catch(() => {});
          }
        }
      };

      const onRemoved = (removedTabId: number) => {
        if (removedTabId === safeTabId) {
          authTabId = null;
          if (authTabCleanup) {
            authTabCleanup();
            authTabCleanup = null;
          }
        }
      };

      storage.onChanged.addListener(onChange);
      tabs.onRemoved.addListener(onRemoved);

      authTabCleanup = () => {
        storage.onChanged.removeListener(onChange);
        tabs.onRemoved.removeListener(onRemoved);
      };

      return { tabId: tab.id ?? null };
    },

    CLOSE_AUTH_TAB: async () => {
      if (authTabCleanup) {
        authTabCleanup();
        authTabCleanup = null;
      }
      if (authTabId) {
        try {
          await tabs.remove(authTabId);
        } catch {
          // tab may already be closed
        }
        authTabId = null;
      }
      return { ok: true };
    },

    REAUTH_STATUS: async () => {
      return { inProgress: reauthInProgress };
    },
  };
}

/** Default handlers using global chrome — for production use. */
export const authHandlers: HandlerMap = createAuthHandlers();

// ── Exports for external use ────────────────────────────────────

export {
  markAuthAuthenticated,
  markAuthLoggedOut,
  recordWeakAuthNegativeSignal,
  setAuthState,
};

// ── Test utilities ──────────────────────────────────────────────

export function _resetForTesting(): void {
  authWeakNegativeHits = [];
  reauthInProgress = false;
  authTabId = null;
  if (authTabCleanup) {
    authTabCleanup();
    authTabCleanup = null;
  }
  diagnosticLog.length = 0;
}
