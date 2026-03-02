import { BACKGROUND_SYNC_MIN_INTERVAL_MS } from "./constants";

export type SyncTrigger = "auto" | "manual";
export type SyncMode = "full" | "incremental";
export type SyncCompletionStatus = "success" | "failure" | "timeout" | "skipped";

export const SYNC_ORCHESTRATOR_VERSION = 1;
export const SYNC_ORCHESTRATOR_LOCK_TTL_MS = 12 * 60 * 1000;
export const SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS = 5 * 60 * 1000;
export const SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS = BACKGROUND_SYNC_MIN_INTERVAL_MS;
export const SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS = 90_000;
export const SYNC_ORCHESTRATOR_MANUAL_COOLDOWN_MS = 4_000;

const ACCOUNT_ID_SANITIZE_RE = /[^A-Za-z0-9_-]/g;

export interface SyncReservationInput {
  accountId: string | null | undefined;
  trigger: SyncTrigger;
  localCount: number;
  requestedMode?: SyncMode;
}

export interface SyncReservationDecision {
  allow: boolean;
  mode: SyncMode | null;
  reason:
    | "manual"
    | "bootstrap_empty"
    | "background_stale"
    | "in_flight"
    | "cooldown"
    | "not_ready"
    | "fresh_cache"
    | "auto_backoff"
    | "no_account";
  leaseId?: string;
  accountKey: string;
}

export interface SyncReservationResult {
  state: SyncOrchestratorState;
  decision: SyncReservationDecision;
}

interface InFlightSyncState {
  leaseId: string;
  mode: SyncMode;
  trigger: SyncTrigger;
  reason: SyncReservationDecision["reason"];
  startedAt: number;
}

interface SyncAccountState {
  inFlight: InFlightSyncState | null;
  lastSuccessAt: number;
  lastFullSyncAt: number;
  lastIncrementalSyncAt: number;
  lastAttemptAt: number;
  lastCompletedAt: number;
  lastCompletedStatus: SyncCompletionStatus | null;
  lastDecisionAt: number;
  lastDecisionReason: SyncReservationDecision["reason"] | null;
  lastError: string | null;
}

export interface SyncOrchestratorState {
  version: number;
  accounts: Record<string, SyncAccountState>;
}

export interface SyncCompletionInput {
  accountId: string | null | undefined;
  leaseId: string;
  mode: SyncMode;
  status: SyncCompletionStatus;
  trigger: SyncTrigger;
}

function normalizeAccountId(accountId: string | null | undefined): string | null {
  if (typeof accountId !== "string") return null;
  const trimmed = accountId.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(ACCOUNT_ID_SANITIZE_RE, "_").slice(0, 120);
  return sanitized || null;
}

function createEmptyAccountState(): SyncAccountState {
  return {
    inFlight: null,
    lastSuccessAt: 0,
    lastFullSyncAt: 0,
    lastIncrementalSyncAt: 0,
    lastAttemptAt: 0,
    lastCompletedAt: 0,
    lastCompletedStatus: null,
    lastDecisionAt: 0,
    lastDecisionReason: null,
    lastError: null,
  };
}

export function createEmptySyncOrchestratorState(): SyncOrchestratorState {
  return {
    version: SYNC_ORCHESTRATOR_VERSION,
    accounts: {},
  };
}

function withAccount(
  state: SyncOrchestratorState,
  accountKey: string,
  nextAccount: SyncAccountState,
): SyncOrchestratorState {
  return {
    ...state,
    accounts: {
      ...state.accounts,
      [accountKey]: nextAccount,
    },
  };
}

function makeLeaseId(accountKey: string, now: number): string {
  return `${accountKey}:${now}:${Math.random().toString(36).slice(2, 10)}`;
}

export function reserveSyncRun(
  state: SyncOrchestratorState,
  input: SyncReservationInput,
  now = Date.now(),
): SyncReservationResult {
  const normalized = normalizeAccountId(input.accountId);
  const accountKey = normalized || "__none__";
  const localCount = Number.isFinite(input.localCount) ? input.localCount : 0;

  if (!normalized) {
    return {
      state,
      decision: {
        allow: false,
        mode: null,
        reason: "no_account",
        accountKey,
      },
    };
  }

  let account = state.accounts[accountKey] || createEmptyAccountState();
  if (
    account.inFlight &&
    now - account.inFlight.startedAt >= SYNC_ORCHESTRATOR_LOCK_TTL_MS
  ) {
    account = { ...account, inFlight: null };
  }

  if (account.inFlight) {
    const canReclaimManualLock =
      input.trigger === "manual" &&
      now - account.inFlight.startedAt >= SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS;
    if (canReclaimManualLock) {
      account = { ...account, inFlight: null };
    } else {
      return {
        state,
        decision: {
          allow: false,
          mode: null,
          reason: "in_flight",
          accountKey,
        },
      };
    }
  }

  if (
    input.trigger === "manual" &&
    account.lastAttemptAt > 0 &&
    now - account.lastAttemptAt < SYNC_ORCHESTRATOR_MANUAL_COOLDOWN_MS
  ) {
    return {
      state: withAccount(state, accountKey, {
        ...account,
        lastDecisionAt: now,
        lastDecisionReason: "cooldown",
      }),
      decision: {
        allow: false,
        mode: null,
        reason: "cooldown",
        accountKey,
      },
    };
  }

  if (account.inFlight) {
    return {
      state,
      decision: {
        allow: false,
        mode: null,
        reason: "in_flight",
        accountKey,
      },
    };
  }

  let mode: SyncMode | null = null;
  let reason: SyncReservationDecision["reason"] = "fresh_cache";

  if (input.trigger === "manual") {
    mode = input.requestedMode || "full";
    reason = "manual";
  } else {
    if (localCount <= 0) {
      if (account.lastAttemptAt > 0 && now - account.lastAttemptAt < SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS) {
        return {
          state: withAccount(state, accountKey, {
            ...account,
            lastDecisionAt: now,
            lastDecisionReason: "auto_backoff",
          }),
          decision: {
            allow: false,
            mode: null,
            reason: "auto_backoff",
            accountKey,
          },
        };
      }
      mode = "full";
      reason = "bootstrap_empty";
    } else {
      if (account.lastSuccessAt > 0 && now - account.lastSuccessAt < SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS) {
        return {
          state: withAccount(state, accountKey, {
            ...account,
            lastDecisionAt: now,
            lastDecisionReason: "fresh_cache",
          }),
          decision: {
            allow: false,
            mode: null,
            reason: "fresh_cache",
            accountKey,
          },
        };
      }
      if (account.lastAttemptAt > 0 && now - account.lastAttemptAt < SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS) {
        return {
          state: withAccount(state, accountKey, {
            ...account,
            lastDecisionAt: now,
            lastDecisionReason: "auto_backoff",
          }),
          decision: {
            allow: false,
            mode: null,
            reason: "auto_backoff",
            accountKey,
          },
        };
      }
      mode = "incremental";
      reason = "background_stale";
    }
  }

  const leaseId = makeLeaseId(accountKey, now);
  const nextAccount: SyncAccountState = {
    ...account,
    inFlight: {
      leaseId,
      mode,
      trigger: input.trigger,
      reason,
      startedAt: now,
    },
    lastAttemptAt: now,
    lastDecisionAt: now,
    lastDecisionReason: reason,
  };

  return {
    state: withAccount(state, accountKey, nextAccount),
    decision: {
      allow: true,
      mode,
      reason,
      leaseId,
      accountKey,
    },
  };
}

export function completeSyncReservation(
  state: SyncOrchestratorState,
  input: SyncCompletionInput,
  now = Date.now(),
): SyncOrchestratorState {
  const accountKey = normalizeAccountId(input.accountId);
  if (!accountKey) return state;

  const account = state.accounts[accountKey];
  if (!account || !account.inFlight) return state;
  if (!input.leaseId || account.inFlight.leaseId !== input.leaseId) return state;

  const nextAccount: SyncAccountState = {
    ...account,
    inFlight: null,
    lastCompletedAt: now,
    lastCompletedStatus: input.status,
  };

  if (input.status === "success") {
    nextAccount.lastSuccessAt = now;
    nextAccount.lastIncrementalSyncAt = now;
    if (input.mode === "full") {
      nextAccount.lastFullSyncAt = now;
    }
    nextAccount.lastError = null;
  } else if (input.status !== "skipped") {
    nextAccount.lastError = input.status;
  }

  return withAccount(state, accountKey, nextAccount);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function normalizeSyncOrchestratorState(value: unknown): SyncOrchestratorState {
  const fallback = createEmptySyncOrchestratorState();
  const root = toRecord(value);
  if (!root) return fallback;

  const version = toNumber(root.version) || SYNC_ORCHESTRATOR_VERSION;
  const accountsRaw = toRecord(root.accounts);
  if (!accountsRaw) {
    return {
      version,
      accounts: {},
    };
  }

  const accounts: Record<string, SyncAccountState> = {};
  for (const [key, entry] of Object.entries(accountsRaw)) {
    const safeKey = normalizeAccountId(key);
    if (!safeKey) continue;

    const accountRaw = toRecord(entry);
    if (!accountRaw) {
      accounts[safeKey] = createEmptyAccountState();
      continue;
    }

    const inFlightRaw = toRecord(accountRaw.inFlight);
    const inFlight = inFlightRaw
      ? {
          leaseId: toStringOrNull(inFlightRaw.leaseId) || "",
          mode: inFlightRaw.mode === "full"
            ? ("full" as SyncMode)
            : ("incremental" as SyncMode),
          trigger: inFlightRaw.trigger === "manual"
            ? ("manual" as SyncTrigger)
            : ("auto" as SyncTrigger),
          reason: (toStringOrNull(inFlightRaw.reason) || "background_stale") as SyncReservationDecision["reason"],
          startedAt: toNumber(inFlightRaw.startedAt),
        }
      : null;

    accounts[safeKey] = {
      inFlight: inFlight && inFlight.leaseId ? inFlight : null,
      lastSuccessAt: toNumber(accountRaw.lastSuccessAt),
      lastFullSyncAt: toNumber(accountRaw.lastFullSyncAt),
      lastIncrementalSyncAt: toNumber(accountRaw.lastIncrementalSyncAt),
      lastAttemptAt: toNumber(accountRaw.lastAttemptAt),
      lastCompletedAt: toNumber(accountRaw.lastCompletedAt),
      lastCompletedStatus: (toStringOrNull(accountRaw.lastCompletedStatus) as SyncCompletionStatus | null) || null,
      lastDecisionAt: toNumber(accountRaw.lastDecisionAt),
      lastDecisionReason: (toStringOrNull(accountRaw.lastDecisionReason) as SyncReservationDecision["reason"] | null) || null,
      lastError: toStringOrNull(accountRaw.lastError),
    };
  }

  return {
    version,
    accounts,
  };
}
