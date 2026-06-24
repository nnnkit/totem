import type { SyncBlockedReason } from "../types/sync";
import {
  SYNC_AUTO_BACKOFF_MS,
  SYNC_AUTO_INTERVAL_MS,
  SYNC_LOCK_TTL_MS,
  SYNC_MANUAL_RECLAIM_MS,
  SYNC_SEED_BACKOFF_MS,
} from "./constants/sync-policy";

export interface SyncRetryWindowAccount {
  manualCooldownUntil: number;
  rateLimitBackoffUntil: number;
  lastAttemptAt: number;
  lastSuccessAt: number;
  lastFullSyncAt: number;
  inFlight: { startedAt: number } | null;
}

export interface SyncRetryWindowInput {
  reason: string;
  now: number;
  trigger: "auto" | "manual";
  account: SyncRetryWindowAccount | null;
}

/**
 * How long until a blocked reserve may retry, given the reason it was blocked
 * for. Pure: the caller injects `now` and the already-decided reason. It does
 * NOT re-derive reason precedence — the two reserve call sites order reasons
 * differently and each keeps its own order.
 *
 * The in_flight window is trigger-split:
 *   manual → SYNC_MANUAL_RECLAIM_MS (90s); the same constant the manual reclaim
 *            check uses, so the "can I reclaim now" test and the "retry after"
 *            answer stay in lockstep on the manual path.
 *   auto   → SYNC_LOCK_TTL_MS (12min), the hard lease cap. This is deliberately
 *            NOT SYNC_AUTO_RECLAIM_MS (90s): an auto reserve can reclaim an
 *            orphaned lease early, but when it is genuinely still in flight it
 *            answers "retry at the TTL", so the two are not coupled here.
 */
export function syncRetryAfterMs(input: SyncRetryWindowInput): number {
  const { reason, now, trigger, account } = input;
  if (!account) return 0;
  if (reason === "cooldown") {
    return Math.max(0, account.manualCooldownUntil - now);
  }
  if (reason === "rate_limited") {
    return Math.max(0, account.rateLimitBackoffUntil - now);
  }
  if (reason === "in_flight" && account.inFlight) {
    const startedAt = account.inFlight.startedAt;
    if (!startedAt) return 0;
    const window =
      trigger === "manual" ? SYNC_MANUAL_RECLAIM_MS : SYNC_LOCK_TTL_MS;
    return Math.max(0, startedAt + window - now);
  }
  if (reason === "auto_backoff") {
    const window =
      account.lastFullSyncAt <= 0 ? SYNC_SEED_BACKOFF_MS : SYNC_AUTO_BACKOFF_MS;
    return Math.max(0, account.lastAttemptAt + window - now);
  }
  if (reason === "fresh_cache") {
    return Math.max(0, account.lastSuccessAt + SYNC_AUTO_INTERVAL_MS - now);
  }
  return 0;
}

export const SYNC_BLOCKED_REASONS: ReadonlySet<SyncBlockedReason> =
  new Set<SyncBlockedReason>([
    "in_flight",
    "cooldown",
    "rate_limited",
    "no_account",
    "not_ready",
  ]);

export function asSyncBlockedReason(
  reason: string | null | undefined,
): SyncBlockedReason | null {
  return reason && SYNC_BLOCKED_REASONS.has(reason as SyncBlockedReason)
    ? (reason as SyncBlockedReason)
    : null;
}
