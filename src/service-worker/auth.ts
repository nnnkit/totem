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
  authHeaderTwidUserId,
  parseCapturedAuthHeaders,
  readLiveTwidUserId,
  usableAuthHeaderUserId,
} from "@make/x-twitter-extension-core/auth";
import {
  normalizeAuthState,
  normalizeSyncAccountId,
  getSyncBlockedReason,
} from "../lib/sw-pure";
import {
  CS_ACCOUNT_CONTEXT_ID,
  CS_BOOKMARK_EVENTS,
} from "../lib/storage-keys";
import {
  CS_LAST_SYNC,
  CS_LAST_SOFT_SYNC,
  CS_SOFT_SYNC_NEEDED,
  CS_SYNC_ORCHESTRATOR_STATE,
  CS_RUNTIME_STATE_V2,
} from "./storage-keys-sw";

// ── Constants ───────────────────────────────────────────────────

const AUTH_WEAK_NEGATIVE_WINDOW_MS = 10_000;
const AUTH_WEAK_NEGATIVE_THRESHOLD = 2;
const AUTH_CAPTURE_TIMEOUT_MS = 15_000;
const AUTH_CAPTURE_SILENT_COOLDOWN_MS = 5_000;
const X_AUTH_CAPTURE_URL = "https://x.com/i/bookmarks";

const CACHE_SUMMARY_KEYS = [
  CS_LAST_SYNC,
  CS_LAST_SOFT_SYNC,
  CS_SOFT_SYNC_NEEDED,
  CS_BOOKMARK_EVENTS,
];
const AUTH_DIAGNOSTICS_STORAGE_KEY = "totem_auth_diagnostics";

// ── In-memory auth state ────────────────────────────────────────

let authWeakNegativeHits: number[] = [];
let authTabId: number | null = null;
let authTabCleanup: (() => void) | null = null;
let authCapturePromise: Promise<AuthCaptureResult> | null = null;
let authCaptureCancel: ((reason: string) => void) | null = null;
let authCaptureLastCompletedAt = 0;

function runAuthTabCleanup() {
  if (authTabCleanup) {
    authTabCleanup();
    authTabCleanup = null;
  }
}

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
  storageChanges?: typeof chrome.storage.onChanged;
  tabs: typeof chrome.tabs;
  cookies?: typeof chrome.cookies;
}

interface AuthCaptureOptions {
  interactive?: boolean;
  force?: boolean;
  reason?: string;
  timeoutMs?: number;
}

interface AuthCaptureStartResult {
  authReady: boolean;
  inProgress: boolean;
  started: boolean;
  tabId: number | null;
  reason: string;
  liveUserId: string | null;
}

interface AuthCaptureResult {
  ok: boolean;
  started: boolean;
  tabId: number | null;
  reason: string;
  liveUserId: string | null;
}

function defaultDeps(): AuthDeps {
  const g = globalThis as Record<string, unknown>;
  const chromeApi = g.chrome as
    | {
        storage?: {
          local?: typeof chrome.storage.local;
          onChanged?: typeof chrome.storage.onChanged;
        };
        tabs?: typeof chrome.tabs;
        cookies?: typeof chrome.cookies;
      }
    | undefined;
  return {
    storage: chromeApi?.storage?.local as typeof chrome.storage.local,
    storageChanges: chromeApi?.storage?.onChanged,
    tabs: chromeApi?.tabs as typeof chrome.tabs,
    cookies: chromeApi?.cookies,
  };
}

function defaultCookies(): typeof chrome.cookies | undefined {
  return defaultDeps().cookies;
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
  cookies: typeof chrome.cookies | undefined = defaultCookies(),
): Promise<SessionSnapshot> {
  const stored = await storage.get([
    "totem_user_id",
    CS_ACCOUNT_CONTEXT_ID,
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
  const liveTwidUserId = await readLiveTwidUserId(cookies);
  const storedTwidUserId = authHeaderTwidUserId(authHeaders);
  const storedAuthMismatch =
    Boolean(authHeaders?.authorization) &&
    Boolean(storedTwidUserId) &&
    liveTwidUserId !== undefined &&
    (!liveTwidUserId || storedTwidUserId !== liveTwidUserId);

  if (storedAuthMismatch) {
    await markAuthLoggedOut("live_twid_mismatch", true, storage);
  }

  const hasAuthHeader = Boolean(
    !storedAuthMismatch &&
      usableAuthHeaderUserId(authHeaders, liveTwidUserId),
  );
  const effectiveUserId =
    liveTwidUserId === undefined
      ? userId || storedTwidUserId
      : liveTwidUserId;

  if (effectiveUserId) {
    userId = effectiveUserId;
    storage
      .set({
        totem_user_id: effectiveUserId,
        [CS_ACCOUNT_CONTEXT_ID]: effectiveUserId,
      })
      .catch(() => {});
  } else if (liveTwidUserId === null && userId) {
    userId = null;
  }

  const storedAccountContextId =
    typeof stored[CS_ACCOUNT_CONTEXT_ID] === "string" &&
    stored[CS_ACCOUNT_CONTEXT_ID]
      ? (stored[CS_ACCOUNT_CONTEXT_ID] as string)
      : null;
  const accountContextId = userId || storedAccountContextId;
  if (userId && storedAccountContextId !== userId) {
    storage.set({ [CS_ACCOUNT_CONTEXT_ID]: userId }).catch(() => {});
  }

  const normalizedAuthState = normalizeAuthState(
    storedAuthMismatch ? "logged_out" : stored.totem_auth_state,
    hasAuthHeader,
  );
  const authState =
    hasAuthHeader && normalizedAuthState === "logged_out"
      ? ("stale" as const)
      : liveTwidUserId && !hasAuthHeader
        ? ("stale" as const)
        : normalizedAuthState;
  let sessionState: SessionSnapshot["sessionState"];
  if (hasAuthHeader) {
    sessionState = "logged_in";
  } else if (liveTwidUserId) {
    sessionState = "unknown";
  } else if (authState === "logged_out") {
    sessionState = "logged_out";
  } else {
    sessionState = "unknown";
  }

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

// Auth only reads a subset of sync state for snapshot building.
// Canonical types live in sync.ts.
type SyncAccountStateReadonly = Partial<
  import("./sync").SyncAccountState
>;

interface SyncOrchestratorStateReadonly {
  accounts: Record<string, SyncAccountStateReadonly>;
}

function createEmptySyncAccountState(): SyncAccountStateReadonly {
  return {};
}

async function readSyncOrchestratorState(
  storage: typeof chrome.storage.local,
): Promise<SyncOrchestratorStateReadonly> {
  const stored = await storage.get([CS_SYNC_ORCHESTRATOR_STATE]);
  const state = stored[CS_SYNC_ORCHESTRATOR_STATE];
  if (
    state &&
    typeof state === "object" &&
    !Array.isArray(state) &&
    typeof (state as SyncOrchestratorStateReadonly).accounts === "object"
  ) {
    return state as SyncOrchestratorStateReadonly;
  }
  return { accounts: {} };
}

// ── Runtime snapshot building ───────────────────────────────────

async function buildRuntimeSnapshot(
  stateOverride: SyncOrchestratorStateReadonly | null = null,
  accountContextOverride: string | null = null,
  storage: typeof chrome.storage.local,
  cookies: typeof chrome.cookies | undefined = defaultCookies(),
) {
  const now = Date.now();
  const sessionSnapshot = await getSessionSnapshot(storage, cookies);
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
  const events = Array.isArray(cacheStored[CS_BOOKMARK_EVENTS])
    ? (cacheStored[CS_BOOKMARK_EVENTS] as unknown[])
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
    [CS_RUNTIME_STATE_V2]: {
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

function resolveAuthDeps(deps?: Partial<AuthDeps>): AuthDeps {
  const defaults = defaultDeps();
  return {
    storage: deps?.storage ?? defaults.storage,
    storageChanges: deps?.storageChanges ?? defaults.storageChanges,
    tabs: deps?.tabs ?? defaults.tabs,
    cookies: deps?.cookies ?? defaults.cookies,
  };
}

function captureHeadersMatch(
  authHeaders: unknown,
  liveUserId: string | null | undefined,
  interactive: boolean,
): string | null {
  return usableAuthHeaderUserId(
    authHeaders,
    liveUserId,
    interactive || liveUserId === null,
  );
}

export async function startAuthCaptureSession(
  deps?: Partial<AuthDeps>,
  options: AuthCaptureOptions = {},
): Promise<AuthCaptureStartResult> {
  const { storage, storageChanges, tabs, cookies } = resolveAuthDeps(deps);
  const onStorageChanged =
    storageChanges ??
    (storage as typeof chrome.storage.local & {
      onChanged?: typeof chrome.storage.onChanged;
    }).onChanged;
  const interactive = options.interactive === true;
  const force = options.force === true;
  const [liveUserId, stored] = await Promise.all([
    readLiveTwidUserId(cookies),
    storage.get(["totem_auth_headers"]),
  ]);

  if (
    !force &&
    usableAuthHeaderUserId(stored.totem_auth_headers, liveUserId)
  ) {
    return {
      authReady: true,
      inProgress: false,
      started: false,
      tabId: null,
      reason: "auth_present",
      liveUserId: liveUserId ?? null,
    };
  }

  if (!interactive && liveUserId === null) {
    return {
      authReady: false,
      inProgress: false,
      started: false,
      tabId: null,
      reason: "no_live_twid",
      liveUserId: null,
    };
  }

  if (force && authCapturePromise) {
    authCaptureCancel?.("replaced");
  }

  if (authCapturePromise) {
    return {
      authReady: false,
      inProgress: true,
      started: false,
      tabId: authTabId,
      reason: "capture_in_progress",
      liveUserId: liveUserId ?? null,
    };
  }

  const now = Date.now();
  if (
    !force &&
    !interactive &&
    authCaptureLastCompletedAt > 0 &&
    now - authCaptureLastCompletedAt < AUTH_CAPTURE_SILENT_COOLDOWN_MS
  ) {
    return {
      authReady: false,
      inProgress: false,
      started: false,
      tabId: null,
      reason: "silent_capture_cooldown",
      liveUserId: liveUserId ?? null,
    };
  }

  let resolveCapture: (result: AuthCaptureResult) => void = () => {};
  authCapturePromise = new Promise<AuthCaptureResult>((resolve) => {
    resolveCapture = resolve;
  });

  let tab: chrome.tabs.Tab;
  try {
    tab = await tabs.create({
      url: X_AUTH_CAPTURE_URL,
      active: interactive && !liveUserId,
    });
  } catch {
    authCapturePromise = null;
    authCaptureLastCompletedAt = Date.now();
    resolveCapture({
      ok: false,
      started: false,
      tabId: null,
      reason: "tab_create_failed",
      liveUserId: liveUserId ?? null,
    });
    return {
      authReady: false,
      inProgress: false,
      started: false,
      tabId: null,
      reason: "tab_create_failed",
      liveUserId: liveUserId ?? null,
    };
  }
  authTabId = tab.id ?? null;
  const safeTabId = authTabId;
  const timeoutMs = options.timeoutMs ?? AUTH_CAPTURE_TIMEOUT_MS;

  {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (closeTab: boolean) => {
      if (timeout !== null) clearTimeout(timeout);
      onStorageChanged?.removeListener(onChange);
      tabs.onRemoved.removeListener(onRemoved);
      authTabCleanup = null;
      authCaptureCancel = null;

      const tabToClose = authTabId;
      authTabId = null;
      if (closeTab && tabToClose !== null) {
        tabs.remove(tabToClose).catch(() => {});
      }
    };

    const settle = (result: AuthCaptureResult, closeTab: boolean) => {
      if (settled) return;
      settled = true;
      cleanup(closeTab);
      authCaptureLastCompletedAt = Date.now();
      authCapturePromise = null;
      resolveCapture(result);
    };

    const onChange = (changes: Record<string, { newValue?: unknown }>) => {
      const authHeaders = changes.totem_auth_headers?.newValue;
      const capturedUserId = captureHeadersMatch(
        authHeaders,
        liveUserId,
        interactive,
      );
      if (!capturedUserId) return;

      logDiagnostic("capture", "ok", "auth_headers_captured");
      markAuthAuthenticated("auth_capture_success", storage).catch(() => {});
      persistDiagnostics(storage).catch(() => {});
      settle(
        {
          ok: true,
          started: true,
          tabId: safeTabId,
          reason: "auth_headers_captured",
          liveUserId: capturedUserId,
        },
        true,
      );
    };

    const onRemoved = (removedTabId: number) => {
      if (removedTabId !== safeTabId) return;
      settle(
        {
          ok: false,
          started: true,
          tabId: safeTabId,
          reason: "tab_closed",
          liveUserId: liveUserId ?? null,
        },
        false,
      );
    };

    onStorageChanged?.addListener(onChange);
    tabs.onRemoved.addListener(onRemoved);
    authTabCleanup = () => cleanup(false);
    authCaptureCancel = (reason: string) => {
      settle(
        {
          ok: false,
          started: true,
          tabId: safeTabId,
          reason,
          liveUserId: liveUserId ?? null,
        },
        true,
      );
    };

    timeout = setTimeout(() => {
      settle(
        {
          ok: false,
          started: true,
          tabId: safeTabId,
          reason: "capture_timeout",
          liveUserId: liveUserId ?? null,
        },
        true,
      );
    }, timeoutMs);
  }

  logDiagnostic(
    "capture",
    "ok",
    options.reason
      ? `auth_capture_started:${options.reason}`
      : "auth_capture_started",
  );

  return {
    authReady: false,
    inProgress: true,
    started: true,
    tabId: authTabId,
    reason: "capture_started",
    liveUserId: liveUserId ?? null,
  };
}

export async function ensureAuthCapture(
  deps?: Partial<AuthDeps>,
  options: AuthCaptureOptions = {},
): Promise<AuthCaptureResult> {
  const start = await startAuthCaptureSession(deps, options);
  if (start.authReady) {
    return {
      ok: true,
      started: false,
      tabId: start.tabId,
      reason: start.reason,
      liveUserId: start.liveUserId,
    };
  }
  if (!start.inProgress && !start.started) {
    return {
      ok: false,
      started: false,
      tabId: start.tabId,
      reason: start.reason,
      liveUserId: start.liveUserId,
    };
  }
  return authCapturePromise ??
    {
      ok: false,
      started: start.started,
      tabId: start.tabId,
      reason: start.reason,
      liveUserId: start.liveUserId,
    };
}

// ── Handler map ─────────────────────────────────────────────────

export function createAuthHandlers(deps?: AuthDeps): HandlerMap {
  const { storage, storageChanges, tabs, cookies } = deps || defaultDeps();

  return {
    CHECK_AUTH: async () => {
      const snapshot = await getSessionSnapshot(storage, cookies);
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
        cookies,
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
        [CS_ACCOUNT_CONTEXT_ID]: accountContextId,
      });
      let snapshot;
      try {
        snapshot = await buildRuntimeSnapshot(
          null,
          accountContextId,
          storage,
          cookies,
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
      const hasAuthHeader = parseCapturedAuthHeaders(
        stored.totem_auth_headers,
      ).ok;

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

    START_AUTH_CAPTURE: async (message: MessageRequest) => {
      const msg = message as MessageRequest & {
        interactive?: boolean;
        force?: boolean;
      };
      const result = await startAuthCaptureSession(
        { storage, storageChanges, tabs, cookies },
        {
          interactive: msg.interactive === true,
          force: msg.force === true,
          reason: msg.interactive ? "auth_capture_interactive" : "auth_capture_silent",
        },
      );
      await persistDiagnostics(storage);
      return result;
    },

    CLOSE_AUTH_TAB: async () => {
      authCaptureCancel?.("cancelled");
      runAuthTabCleanup();
      return { ok: true };
    },

    REAUTH_STATUS: async () => {
      return { inProgress: Boolean(authCapturePromise), tabId: authTabId };
    },
  };
}

/** Default handlers using global chrome — for production use. */
export const authHandlers: HandlerMap = createAuthHandlers();

// ── Exports for external use ────────────────────────────────────

export {
  buildRuntimeSnapshot,
  markAuthAuthenticated,
  markAuthLoggedOut,
  recordWeakAuthNegativeSignal,
  setAuthState,
};

// ── Test utilities ──────────────────────────────────────────────

export function _resetForTesting(): void {
  authWeakNegativeHits = [];
  authTabId = null;
  authCapturePromise = null;
  authCaptureCancel = null;
  authCaptureLastCompletedAt = 0;
  runAuthTabCleanup();
  diagnosticLog.length = 0;
}
