// Canonical sync types for service worker ↔ frontend contracts

export type SyncTrigger = "auto" | "manual";
export type SyncCompletionStatus = "success" | "failure" | "timeout" | "skipped";
export type SyncMode = "full" | "incremental" | "quick";

export type SyncBlockedReason =
  | "in_flight"
  | "cooldown"
  | "rate_limited"
  | "no_account"
  | "not_ready";

/** Lease returned by reserveSyncRun / handleSyncPolicyReserve */
export interface SyncReservationDecision {
  allow: boolean;
  mode: SyncMode | null;
  reason: string;
  leaseId?: string;
  accountKey?: string;
  retryAfterMs?: number;
}

/** Per-account sync orchestrator state (persisted in chrome.storage.local) */
export interface AccountSyncState {
  inFlight: {
    leaseId: string;
    mode: SyncMode;
    trigger: SyncTrigger;
    startedAt: number;
  } | null;
  lastAttemptAt: number;
  lastSuccessAt: number;
  cooldownUntil: number;
  rateLimitedUntil: number;
  consecutiveFailures: number;
}

/** Top-level sync orchestrator state shape */
export interface SyncOrchestratorState {
  version: number;
  accounts: Record<string, AccountSyncState>;
}

/** Runtime sync policy exposed to UI */
export interface RuntimeSyncPolicy {
  accountKey: string | null;
  inFlight: {
    leaseId: string;
    mode: SyncMode;
    trigger: SyncTrigger;
    startedAt: number;
  } | null;
  lastAttemptAt: number;
  lastSuccessAt: number;
  blockedReason: SyncBlockedReason | null;
}

export interface RuntimeCacheSummary {
  lastSyncAt: number;
  lastSoftSyncAt: number;
  lightSyncNeededAt: number;
  pendingBookmarkEventCount: number;
}
