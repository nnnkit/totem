/**
 * Sync types shared between service worker and frontend.
 * Canonical source of truth for lease contracts and sync state.
 */

export type SyncTrigger = "auto" | "manual";
export type SyncCompletionStatus = "success" | "failure" | "timeout" | "skipped";
export type SyncMode = "full" | "incremental" | "quick";

export type SyncBlockedReason =
  | "in_flight"
  | "cooldown"
  | "rate_limited"
  | "no_account"
  | "not_ready";

/** A sync lease issued by the service worker. */
export interface SyncLeaseContract {
  leaseId: string;
  mode: SyncMode;
  trigger: SyncTrigger;
  startedAt: number;
}

export interface SyncReservationDecision {
  allow: boolean;
  mode: SyncMode | null;
  reason: string;
  leaseId?: string;
  accountKey?: string;
  retryAfterMs?: number;
}

export interface RuntimeSyncPolicy {
  accountKey: string | null;
  inFlight: SyncLeaseContract | null;
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
