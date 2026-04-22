/**
 * Sync lease module — lease allocation, cooldown, and rate-limiting.
 *
 * Extracted from the SW monolith. Owns the sync orchestrator state
 * in chrome.storage with typed contract:
 *   reserveLease() → { leaseId, expiresAt }
 *   completeLease(leaseId)
 *
 * Handler map for REQUEST_SYNC and COMPLETE_SYNC.
 */

import type { MessageRequest } from "../types/messages";
import type { HandlerMap } from "./index";
import { getSessionSnapshot, buildRuntimeSnapshot } from "./auth";
import { normalizeSyncAccountId } from "../lib/sw-pure";
import {
  CS_LAST_SOFT_SYNC,
  CS_LAST_SYNC,
  CS_SOFT_SYNC_NEEDED,
  CS_SYNC_ORCHESTRATOR_STATE,
  CS_RUNTIME_STATE_V2,
} from "./storage-keys-sw";

// ── Constants ───────────────────────────────────────────────────

const SYNC_ORCHESTRATOR_VERSION = 1;
const SYNC_ORCHESTRATOR_LOCK_TTL_MS = 12 * 60 * 1000;
const SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS = 5 * 60 * 1000;
// When the seed has never completed (`lastFullSyncAt === 0`), an auto-sync
// retry represents a user reloading to resume — not unsolicited polling.
// The 5-minute window is appropriate for incremental polling; it's wrong
// for seed resume. Use a short window so a reload actually retries.
const SYNC_ORCHESTRATOR_SEED_BACKOFF_MS = 30 * 1000;
const SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS = 4 * 60 * 60 * 1000;
const SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS = 90_000;
// An auto-triggered reserve can also reclaim an in-flight lease that's
// older than this threshold. This recovers from orphaned leases — the
// previous sync tab closed before its COMPLETE_SYNC could be delivered
// (MV3 service-worker messaging during tab unload is unreliable). Without
// reclaim, every reload gets blocked with `in_flight` for up to
// SYNC_ORCHESTRATOR_LOCK_TTL_MS (12 min). Symmetric with the manual path.
const SYNC_ORCHESTRATOR_AUTO_RECLAIM_MS = 90_000;
// Window within which a repeat of the same block reason for the same
// account is considered noise. Multiple open pages + focus/visibility
// events fan out into redundant REQUEST_SYNC calls; suppressing the log
// for back-to-back duplicates (FINDINGS §5) keeps the diagnostic readable
// without hiding first-of-reason transitions.
const RESERVE_BLOCK_LOG_DEDUPE_MS = 2_000;
const SYNC_ORCHESTRATOR_MANUAL_SUCCESS_COOLDOWN_MS = 15 * 60 * 1000;
const SYNC_ORCHESTRATOR_MANUAL_FAILURE_RETRY_MS = 30_000;
const SYNC_ORCHESTRATOR_RATE_LIMIT_BACKOFF_BASE_MS = 60_000;
const SYNC_ORCHESTRATOR_RATE_LIMIT_BACKOFF_MAX_MS = 15 * 60 * 1000;

// ── Types ───────────────────────────────────────────────────────

export interface SyncInFlight {
  leaseId: string;
  mode: "full" | "quick" | "incremental";
  trigger: "manual" | "auto";
  reason: string;
  startedAt: number;
}

export interface SyncAccountState {
  inFlight: SyncInFlight | null;
  lastSuccessAt: number;
  // INVARIANT: the SW's record of a completed full reconcile for this account.
  // Not a claim about IDB contents. IDB may have rows without this being set
  // (e.g. post-restore from a previous install with a wiped SW state), and
  // `lastFullSyncAt === 0` forces the orchestrator to pick `full` on the
  // next reservation so the runtime re-walks pages and confirms completeness.
  // Only ever written by `handleSyncPolicyComplete` on a successful `full` run.
  lastFullSyncAt: number;
  lastIncrementalSyncAt: number;
  manualCooldownUntil: number;
  rateLimitBackoffUntil: number;
  rateLimitConsecutive: number;
  lastAttemptAt: number;
  lastCompletedAt: number;
  lastCompletedStatus: string | null;
  lastDecisionAt: number;
  lastDecisionReason: string | null;
  lastError: string | null;
  lastFailureCode: string | null;
}

export interface SyncOrchestratorState {
  version: number;
  accounts: Record<string, SyncAccountState>;
}

// ── State management ────────────────────────────────────────────

function createEmptySyncAccountState(): SyncAccountState {
  return {
    inFlight: null,
    lastSuccessAt: 0,
    lastFullSyncAt: 0,
    lastIncrementalSyncAt: 0,
    manualCooldownUntil: 0,
    rateLimitBackoffUntil: 0,
    rateLimitConsecutive: 0,
    lastAttemptAt: 0,
    lastCompletedAt: 0,
    lastCompletedStatus: null,
    lastDecisionAt: 0,
    lastDecisionReason: null,
    lastError: null,
    lastFailureCode: null,
  };
}

function createEmptySyncOrchestratorState(): SyncOrchestratorState {
  return { version: SYNC_ORCHESTRATOR_VERSION, accounts: {} };
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeSyncOrchestratorState(raw: unknown): SyncOrchestratorState {
  const fallback = createEmptySyncOrchestratorState();
  if (!raw || typeof raw !== "object") return fallback;
  const root = raw as Record<string, unknown>;
  const accountsRaw =
    root.accounts && typeof root.accounts === "object"
      ? (root.accounts as Record<string, Record<string, unknown>>)
      : {};

  const state: SyncOrchestratorState = {
    version: normalizeFiniteNumber(root.version, SYNC_ORCHESTRATOR_VERSION),
    accounts: {},
  };

  for (const [accountKey, account] of Object.entries(accountsRaw)) {
    if (!account || typeof account !== "object") continue;

    const inFlightRaw = account.inFlight as Record<string, unknown> | null;
    const inFlight: SyncInFlight | null =
      inFlightRaw &&
      typeof inFlightRaw === "object" &&
      typeof inFlightRaw.leaseId === "string" &&
      inFlightRaw.leaseId
        ? {
            leaseId: inFlightRaw.leaseId,
            mode:
              inFlightRaw.mode === "full"
                ? "full"
                : inFlightRaw.mode === "quick"
                  ? "quick"
                  : "incremental",
            trigger:
              inFlightRaw.trigger === "manual" ? "manual" : "auto",
            reason:
              typeof inFlightRaw.reason === "string" && inFlightRaw.reason
                ? inFlightRaw.reason
                : "background_stale",
            startedAt: normalizeFiniteNumber(inFlightRaw.startedAt, 0),
          }
        : null;

    state.accounts[accountKey] = {
      inFlight,
      lastSuccessAt: normalizeFiniteNumber(account.lastSuccessAt, 0),
      lastFullSyncAt: normalizeFiniteNumber(account.lastFullSyncAt, 0),
      lastIncrementalSyncAt: normalizeFiniteNumber(account.lastIncrementalSyncAt, 0),
      manualCooldownUntil: normalizeFiniteNumber(account.manualCooldownUntil, 0),
      rateLimitBackoffUntil: normalizeFiniteNumber(account.rateLimitBackoffUntil, 0),
      rateLimitConsecutive: normalizeFiniteNumber(account.rateLimitConsecutive, 0),
      lastAttemptAt: normalizeFiniteNumber(account.lastAttemptAt, 0),
      lastCompletedAt: normalizeFiniteNumber(account.lastCompletedAt, 0),
      lastCompletedStatus:
        typeof account.lastCompletedStatus === "string"
          ? account.lastCompletedStatus
          : null,
      lastDecisionAt: normalizeFiniteNumber(account.lastDecisionAt, 0),
      lastDecisionReason:
        typeof account.lastDecisionReason === "string"
          ? account.lastDecisionReason
          : null,
      lastError:
        typeof account.lastError === "string" ? account.lastError : null,
      lastFailureCode:
        typeof account.lastFailureCode === "string"
          ? account.lastFailureCode
          : null,
    };
  }

  return state;
}

async function readSyncOrchestratorState(): Promise<SyncOrchestratorState> {
  const stored = await chrome.storage.local.get([CS_SYNC_ORCHESTRATOR_STATE]);
  return normalizeSyncOrchestratorState(stored[CS_SYNC_ORCHESTRATOR_STATE]);
}

async function writeSyncOrchestratorState(
  state: SyncOrchestratorState,
): Promise<void> {
  await chrome.storage.local.set({
    [CS_SYNC_ORCHESTRATOR_STATE]: state,
  });
}

// Sequential execution using promise chaining
let syncOrchestratorMutation: Promise<unknown> = Promise.resolve();

function withSyncOrchestratorLock<T>(task: () => Promise<T>): Promise<T> {
  const run = syncOrchestratorMutation.then(task, task) as Promise<T>;
  syncOrchestratorMutation = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function createSyncLeaseId(accountKey: string, now: number): string {
  return `${accountKey}:${now}:${Math.random().toString(36).slice(2, 10)}`;
}

async function persistRuntimeStateV2(snapshot: unknown): Promise<void> {
  await chrome.storage.local.set({ [CS_RUNTIME_STATE_V2]: snapshot });
}

// ── Handlers ────────────────────────────────────────────────────

interface SyncDeps {
  getSessionSnapshot?: () => Promise<{ userId: string | null; accountContextId: string | null; sessionState: string; hasAuthHeader: boolean }>;
  buildRuntimeSnapshot?: (stateOverride: unknown) => Promise<unknown>;
  readState?: typeof readSyncOrchestratorState;
  writeState?: typeof writeSyncOrchestratorState;
}

function defaultChromeStorage(): typeof chrome.storage.local {
  const g = globalThis as Record<string, unknown>;
  return (g.chrome as { storage: { local: typeof chrome.storage.local } })
    ?.storage?.local;
}

function defaultGetSessionSnapshot() {
  return getSessionSnapshot(defaultChromeStorage());
}

function defaultBuildRuntimeSnapshot(stateOverride: unknown) {
  return buildRuntimeSnapshot(
    stateOverride as Parameters<typeof buildRuntimeSnapshot>[0],
    null,
    defaultChromeStorage(),
  );
}

export function createSyncHandlers(deps: SyncDeps = {}): HandlerMap {
  const getSession = deps.getSessionSnapshot ?? defaultGetSessionSnapshot;
  const buildSnapshot = deps.buildRuntimeSnapshot ?? defaultBuildRuntimeSnapshot;
  const readState = deps.readState ?? readSyncOrchestratorState;
  const writeState = deps.writeState ?? writeSyncOrchestratorState;

  async function handleSyncPolicyReserve(
    message: MessageRequest,
  ): Promise<unknown> {
    return withSyncOrchestratorLock(async () => {
      const msg = message as unknown as Record<string, unknown>;
      const now = Date.now();
      const trigger =
        msg.trigger === "manual" ? ("manual" as const) : ("auto" as const);
      const localCount = normalizeFiniteNumber(msg.localCount, 0);

      const state = await readState();
      const sessionSnapshot = await getSession();
      const accountKey = normalizeSyncAccountId(
        (msg.accountId as string) || sessionSnapshot.accountContextId,
      );

      const retryAfterFor = (
        reason: string,
        account: SyncAccountState | null,
      ): number => {
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
          if (trigger === "manual") {
            return Math.max(
              0,
              startedAt + SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS - now,
            );
          }
          return Math.max(
            0,
            startedAt + SYNC_ORCHESTRATOR_LOCK_TTL_MS - now,
          );
        }
        if (reason === "auto_backoff") {
          // Match whichever backoff window the block used: seed-incomplete
          // accounts use the short one, post-seed accounts the 5-min one.
          const window = account.lastFullSyncAt <= 0
            ? SYNC_ORCHESTRATOR_SEED_BACKOFF_MS
            : SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS;
          return Math.max(0, account.lastAttemptAt + window - now);
        }
        if (reason === "fresh_cache") {
          return Math.max(
            0,
            account.lastSuccessAt + SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS - now,
          );
        }
        return 0;
      };

      const returnBlocked = async (
        reason: string,
        account?: SyncAccountState | null,
      ) => {
        const safeAccountKey = accountKey || "__none__";
        const retryAfterMs = retryAfterFor(reason, account ?? null);
        // Suppress log spam when multiple pages (or rapid-fire subscribers)
        // all hit the same block decision in quick succession. The previous
        // decision we persisted tells us whether this is a duplicate.
        const isDuplicate =
          account?.lastDecisionReason === reason &&
          account?.lastDecisionAt > 0 &&
          now - account.lastDecisionAt < RESERVE_BLOCK_LOG_DEDUPE_MS;
        if (accountKey) {
          state.accounts[accountKey] = {
            ...(account || createEmptySyncAccountState()),
            lastDecisionAt: now,
            lastDecisionReason: reason,
          };
          await writeState(state);
        }
        const snapshot = await buildSnapshot(state).catch(() => null);
        if (snapshot) {
          await persistRuntimeStateV2(snapshot).catch(() => {});
        }
        if (!isDuplicate) {
          // [TOTEM-DIAG] Reserve blocked — answers: "sync didn't run on
          // refresh, what blocked it?" (cooldown / fresh_cache / in_flight
          // / auto_backoff / rate_limited / not_ready / no_account)
          console.log("[TOTEM-DIAG] sync.reserve blocked", {
            trigger,
            reason,
            retryAfterMs,
            lastFullSyncAt: account?.lastFullSyncAt ?? 0,
            lastAttemptAt: account?.lastAttemptAt ?? 0,
            lastSuccessAt: account?.lastSuccessAt ?? 0,
            inFlightStartedAt: account?.inFlight?.startedAt ?? null,
          });
        }
        return {
          ok: true,
          allow: false,
          mode: null,
          reason,
          accountKey: safeAccountKey,
          retryAfterMs,
        };
      };

      if (!accountKey) {
        return returnBlocked("no_account");
      }

      let account =
        state.accounts[accountKey] || createEmptySyncAccountState();

      if (sessionSnapshot.sessionState !== "logged_in") {
        return returnBlocked("not_ready", account);
      }

      // Expired lock TTL
      if (
        account.inFlight &&
        now - account.inFlight.startedAt >= SYNC_ORCHESTRATOR_LOCK_TTL_MS
      ) {
        account = { ...account, inFlight: null };
      }

      if (account.inFlight) {
        const leaseAge = now - account.inFlight.startedAt;
        const canReclaimManualLock =
          trigger === "manual" &&
          leaseAge >= SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS;
        const canReclaimAutoLock =
          trigger === "auto" &&
          leaseAge >= SYNC_ORCHESTRATOR_AUTO_RECLAIM_MS;
        if (canReclaimManualLock || canReclaimAutoLock) {
          // [TOTEM-DIAG] Lease reclaim — the previous sync tab died without
          // completing its run. Clearing the orphaned lease so this one can
          // take over. Without this, MV3 service-worker unload flakiness
          // traps users in `in_flight` for up to 12 minutes.
          console.log("[TOTEM-DIAG] sync.reserve reclaim", {
            trigger,
            leaseAgeMs: leaseAge,
            reclaimedLeaseId: account.inFlight.leaseId,
          });
          account = { ...account, inFlight: null };
        } else {
          return returnBlocked("in_flight", account);
        }
      }

      if (account.rateLimitBackoffUntil > now) {
        return returnBlocked("rate_limited", account);
      }

      if (trigger === "manual" && account.manualCooldownUntil > now) {
        return returnBlocked("cooldown", account);
      }

      // Mode is derived purely from the orchestrator's own state — the caller
      // does not get to request a mode. Two split-brain conditions both force
      // a full seed: the historical one where runtime thought it was seeded
      // but the SW had no record (`lastFullSyncAt === 0`), and the symmetric
      // post-reset case where the SW remembers a prior full sync but the DB
      // is empty (`localCount <= 0`). Without the second check, the manual
      // sync after a reset picks `incremental` and fetches only the delta
      // since `lastFullSyncAt`, leaving the wiped bookmarks gone (FINDINGS §2).
      const needsFullSync = account.lastFullSyncAt <= 0 || localCount <= 0;

      let mode: string;
      let reason: string;

      if (trigger === "manual") {
        mode = needsFullSync ? "full" : "incremental";
        reason = needsFullSync ? "manual_seed" : "manual";
      } else if (needsFullSync) {
        if (
          account.lastAttemptAt > 0 &&
          now - account.lastAttemptAt < SYNC_ORCHESTRATOR_SEED_BACKOFF_MS
        ) {
          return returnBlocked("auto_backoff", account);
        }
        mode = "full";
        reason = localCount <= 0 ? "bootstrap_empty" : "bootstrap_seed";
      } else {
        // fresh_cache gates auto-syncs after a recent *successful* completion.
        // If the most recent completion was skipped or failed — typically
        // because a mid-sync reload released the lease — don't treat the
        // stale lastSuccessAt as proof of freshness; fall through so the
        // auto_backoff window governs retry cadence instead (FINDINGS §3).
        const lastCompletionWasSuccess =
          account.lastCompletedStatus === "success";
        if (
          lastCompletionWasSuccess &&
          account.lastSuccessAt > 0 &&
          now - account.lastSuccessAt < SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS
        ) {
          return returnBlocked("fresh_cache", account);
        }
        if (
          account.lastAttemptAt > 0 &&
          now - account.lastAttemptAt < SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS
        ) {
          return returnBlocked("auto_backoff", account);
        }
        mode = "incremental";
        reason = "background_stale";
      }

      const leaseId = createSyncLeaseId(accountKey, now);
      state.accounts[accountKey] = {
        ...account,
        inFlight: { leaseId, mode: mode as SyncInFlight["mode"], trigger, reason, startedAt: now },
        lastAttemptAt: now,
        lastDecisionAt: now,
        lastDecisionReason: reason,
      };
      await writeState(state);
      const snapshot = await buildSnapshot(state).catch(() => null);
      if (snapshot) {
        await persistRuntimeStateV2(snapshot).catch(() => {});
      }

      // [TOTEM-DIAG] Reserve decision — answers: "why did the orchestrator
      // pick this mode / reason on refresh?" Log BEFORE returning so the
      // reservation grants are always visible in SW console.
      console.log("[TOTEM-DIAG] sync.reserve allow", {
        trigger,
        localCount,
        lastFullSyncAt: account.lastFullSyncAt,
        lastAttemptAt: account.lastAttemptAt,
        lastSuccessAt: account.lastSuccessAt,
        needsFullSync,
        chosenMode: mode,
        chosenReason: reason,
      });

      return { ok: true, allow: true, mode, reason, leaseId, accountKey };
    });
  }

  async function handleSyncPolicyComplete(
    message: MessageRequest,
  ): Promise<unknown> {
    return withSyncOrchestratorLock(async () => {
      const msg = message as unknown as Record<string, unknown>;
      const accountKey = normalizeSyncAccountId(msg.accountId as string);
      if (!accountKey)
        return { ok: true, ignored: true, reason: "no_account" };

      const leaseId =
        typeof msg.leaseId === "string" ? msg.leaseId : "";
      const trigger =
        msg.trigger === "manual" ? ("manual" as const) : ("auto" as const);
      const mode =
        msg.mode === "full"
          ? ("full" as const)
          : msg.mode === "quick"
            ? ("quick" as const)
            : ("incremental" as const);
      const status =
        msg.status === "success" ||
        msg.status === "failure" ||
        msg.status === "timeout" ||
        msg.status === "skipped"
          ? (msg.status as string)
          : "failure";
      const errorCode =
        typeof msg.errorCode === "string" && msg.errorCode
          ? msg.errorCode.slice(0, 120)
          : "";
      const isRateLimited = errorCode === "RATE_LIMITED";
      const isIncompleteFullSync = errorCode === "INCOMPLETE_FULL_SYNC";

      const state = await readState();
      const account = state.accounts[accountKey];
      if (!account || !account.inFlight) {
        const snapshot = await buildSnapshot(state).catch(() => null);
        if (snapshot) {
          await persistRuntimeStateV2(snapshot).catch(() => {});
        }
        return { ok: true, ignored: true, reason: "missing_inflight" };
      }
      if (!leaseId || account.inFlight.leaseId !== leaseId) {
        const snapshot = await buildSnapshot(state).catch(() => null);
        if (snapshot) {
          await persistRuntimeStateV2(snapshot).catch(() => {});
        }
        return { ok: true, ignored: true, reason: "lease_mismatch" };
      }

      const now = Date.now();
      const next: SyncAccountState = {
        ...account,
        inFlight: null,
        lastCompletedAt: now,
        lastCompletedStatus: status,
      };

      if (status === "success") {
        next.lastSuccessAt = now;
        if (mode === "full") {
          next.lastFullSyncAt = now;
        } else {
          next.lastIncrementalSyncAt = now;
        }
        if (trigger === "manual") {
          next.manualCooldownUntil =
            now + SYNC_ORCHESTRATOR_MANUAL_SUCCESS_COOLDOWN_MS;
        }
        next.rateLimitConsecutive = 0;
        next.rateLimitBackoffUntil = 0;
        next.lastError = null;
        next.lastFailureCode = null;
      } else if (status !== "skipped") {
        next.lastError = status;
        next.lastFailureCode = errorCode || null;
        if (trigger === "manual" && !isIncompleteFullSync) {
          next.manualCooldownUntil = Math.max(
            next.manualCooldownUntil,
            now + SYNC_ORCHESTRATOR_MANUAL_FAILURE_RETRY_MS,
          );
        }
        if (isRateLimited) {
          const nextStreak = Math.max(
            1,
            next.rateLimitConsecutive + 1,
          );
          const backoffMs = Math.min(
            SYNC_ORCHESTRATOR_RATE_LIMIT_BACKOFF_BASE_MS *
              Math.pow(2, nextStreak - 1),
            SYNC_ORCHESTRATOR_RATE_LIMIT_BACKOFF_MAX_MS,
          );
          next.rateLimitConsecutive = nextStreak;
          next.rateLimitBackoffUntil = now + backoffMs;
          next.manualCooldownUntil = Math.max(
            next.manualCooldownUntil,
            next.rateLimitBackoffUntil,
          );
        } else {
          next.rateLimitConsecutive = 0;
          next.rateLimitBackoffUntil = 0;
        }
      }

      state.accounts[accountKey] = next;
      await writeState(state);

      // [TOTEM-DIAG] Complete — answers: "did the previous run stamp
      // lastFullSyncAt, which would push the next refresh to incremental?"
      console.log("[TOTEM-DIAG] sync.complete", {
        trigger,
        mode,
        status,
        errorCode: errorCode || null,
        stampedLastFullSyncAt:
          status === "success" && mode === "full" ? next.lastFullSyncAt : 0,
      });

      // Mirror the completion timestamp into the cache-summary keys the
      // runtime's snapshot consumes. Single writer: the SW. The runtime
      // never writes these keys — preventing the split-brain that previously
      // let `totem_last_sync` disagree with the orchestrator's record.
      const cacheStorage = defaultChromeStorage();
      if (cacheStorage) {
        try {
          if (status === "success") {
            const cacheWrite: Record<string, number> = { [CS_LAST_SYNC]: now };
            if (mode === "incremental") {
              cacheWrite[CS_LAST_SOFT_SYNC] = now;
            }
            await cacheStorage.set(cacheWrite);
            await cacheStorage.remove(CS_SOFT_SYNC_NEEDED);
          } else if (status === "timeout") {
            await cacheStorage.set({ [CS_LAST_SYNC]: now });
          }
        } catch {
          // non-fatal: cache-summary write is best-effort
        }
      }

      const snapshot = await buildSnapshot(state).catch(() => null);
      if (snapshot) {
        await persistRuntimeStateV2(snapshot).catch(() => {});
      }
      return { ok: true };
    });
  }

  async function handleResetSwState(): Promise<unknown> {
    // Serialize against any in-flight orchestrator mutation so we don't
    // stomp a reservation that's mid-write. Once we own the lock, wipe the
    // orchestrator state durably; the runtime's reset also removes it, but
    // doing it here makes the reset a single atomic RPC from the runtime's
    // perspective (send → ack → safe to delete the DB).
    return withSyncOrchestratorLock(async () => {
      await writeState(createEmptySyncOrchestratorState());
      return { ok: true };
    });
  }

  return {
    REQUEST_SYNC: handleSyncPolicyReserve,
    COMPLETE_SYNC: handleSyncPolicyComplete,
    RESET_SW_STATE: handleResetSwState,
  };
}

export const syncHandlers: HandlerMap = createSyncHandlers();

export function _resetForTesting(): void {
  syncOrchestratorMutation = Promise.resolve();
}
