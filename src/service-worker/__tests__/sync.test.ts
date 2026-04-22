import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeChrome } from "../../test-utils/fake-chrome";
import { createSyncHandlers, _resetForTesting } from "../sync";
import type { MessageRequest } from "../../types/messages";

function createTestDeps() {
  const fakeChrome = createFakeChrome();
  const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;

  const sessionSnapshot = {
    userId: "user-1",
    accountContextId: "acct-1",
    authState: "authenticated" as const,
    sessionState: "logged_in" as const,
    capability: { bookmarksApi: "ready", detailApi: "unknown" },
    hasAuthHeader: true,
  };

  const getSessionSnapshot = vi.fn().mockResolvedValue(sessionSnapshot);
  const buildRuntimeSnapshot = vi.fn().mockResolvedValue({ ok: true });

  const readState = async () => {
    const stored = await storage.get(["totem_sync_orchestrator_state"]);
    const raw = stored["totem_sync_orchestrator_state"];
    if (!raw || typeof raw !== "object") {
      return { version: 1, accounts: {} };
    }
    return raw as { version: number; accounts: Record<string, unknown> };
  };

  const writeState = async (state: unknown) => {
    await storage.set({ totem_sync_orchestrator_state: state });
  };

  const handlers = createSyncHandlers({
    getSessionSnapshot,
    buildRuntimeSnapshot,
    readState: readState as never,
    writeState: writeState as never,
  });

  return {
    fakeChrome,
    storage,
    handlers,
    getSessionSnapshot,
    buildRuntimeSnapshot,
    sessionSnapshot,
  };
}

beforeEach(() => {
  _resetForTesting();
});

describe("sync lease lifecycle", () => {
  it("grants a manual lease for logged-in user as a full seed when never synced", async () => {
    const { handlers } = createTestDeps();
    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.ok).toBe(true);
    expect(result.allow).toBe(true);
    // Self-heal: no prior lastFullSyncAt → orchestrator forces a full seed,
    // regardless of trigger or localCount.
    expect(result.mode).toBe("full");
    expect(result.reason).toBe("manual_seed");
    expect(result.leaseId).toBeTruthy();
    expect(result.accountKey).toBe("acct-1");
  });

  it("blocks when user is not logged in", async () => {
    const { handlers, getSessionSnapshot, sessionSnapshot } = createTestDeps();
    getSessionSnapshot.mockResolvedValue({
      ...sessionSnapshot,
      sessionState: "logged_out",
    });

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(false);
    expect(result.reason).toBe("not_ready");
  });

  it("blocks concurrent leases (in_flight)", async () => {
    const { handlers } = createTestDeps();

    const first = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;
    expect(first.allow).toBe(true);

    const second = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;
    expect(second.allow).toBe(false);
    expect(second.reason).toBe("in_flight");
  });

  it("auto-reclaims an orphaned lease older than 90s (regression: reset → tab reload trap)", async () => {
    const { handlers, storage } = createTestDeps();

    // Simulate a post-reset scenario: previous auto-sync was issued,
    // never completed (tab unload ate the COMPLETE_SYNC message), and
    // the lease is now 2 minutes old.
    const now = Date.now();
    await storage.set({
      totem_sync_orchestrator_state: {
        version: 1,
        accounts: {
          "acct-1": {
            inFlight: {
              leaseId: "acct-1:stale-lease",
              mode: "full",
              trigger: "auto",
              reason: "bootstrap_empty",
              startedAt: now - 2 * 60 * 1000,
            },
            lastSuccessAt: 0,
            lastFullSyncAt: 0,
            lastIncrementalSyncAt: 0,
            manualCooldownUntil: 0,
            rateLimitBackoffUntil: 0,
            rateLimitConsecutive: 0,
            lastAttemptAt: now - 2 * 60 * 1000,
            lastCompletedAt: 0,
            lastCompletedStatus: null,
            lastDecisionAt: 0,
            lastDecisionReason: null,
            lastError: null,
            lastFailureCode: null,
          },
        },
      },
    });

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "auto", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    // Previously would have been blocked with "in_flight" for up to 12 min.
    expect(result.allow).toBe(true);
    expect(result.mode).toBe("full");
    expect(result.leaseId).not.toBe("acct-1:stale-lease");
  });

  it("still blocks auto reserve when the in-flight lease is fresh (under 90s)", async () => {
    const { handlers, storage } = createTestDeps();

    // Lease 30 seconds old: a sync could legitimately still be running.
    // Must not be reclaimed — that would cause two concurrent writers.
    const now = Date.now();
    await storage.set({
      totem_sync_orchestrator_state: {
        version: 1,
        accounts: {
          "acct-1": {
            inFlight: {
              leaseId: "acct-1:active-lease",
              mode: "full",
              trigger: "auto",
              reason: "bootstrap_empty",
              startedAt: now - 30 * 1000,
            },
            lastSuccessAt: 0,
            lastFullSyncAt: 0,
            lastIncrementalSyncAt: 0,
            manualCooldownUntil: 0,
            rateLimitBackoffUntil: 0,
            rateLimitConsecutive: 0,
            lastAttemptAt: now - 30 * 1000,
            lastCompletedAt: 0,
            lastCompletedStatus: null,
            lastDecisionAt: 0,
            lastDecisionReason: null,
            lastError: null,
            lastFailureCode: null,
          },
        },
      },
    });

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "auto", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(false);
    expect(result.reason).toBe("in_flight");
  });

  it("completes a lease successfully", async () => {
    const { handlers } = createTestDeps();

    const reserve = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    const complete = (await handlers.COMPLETE_SYNC(
      {
        type: "COMPLETE_SYNC",
        accountId: reserve.accountKey,
        leaseId: reserve.leaseId,
        mode: "full",
        status: "success",
        trigger: "manual",
      } as unknown as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(complete.ok).toBe(true);
    expect(complete.ignored).toBeUndefined();
  });

  it("applies cooldown after successful manual sync", async () => {
    const { handlers } = createTestDeps();

    const reserve = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    await handlers.COMPLETE_SYNC(
      {
        type: "COMPLETE_SYNC",
        accountId: reserve.accountKey,
        leaseId: reserve.leaseId,
        mode: "full",
        status: "success",
        trigger: "manual",
      } as unknown as MessageRequest,
      {} as chrome.runtime.MessageSender,
    );

    const retry = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 10 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(retry.allow).toBe(false);
    expect(retry.reason).toBe("cooldown");
  });

  it("ignores completion with mismatched lease ID", async () => {
    const { handlers } = createTestDeps();

    await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    );

    const complete = (await handlers.COMPLETE_SYNC(
      {
        type: "COMPLETE_SYNC",
        accountId: "acct-1",
        leaseId: "wrong-lease-id",
        mode: "full",
        status: "success",
        trigger: "manual",
      } as unknown as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(complete.ignored).toBe(true);
    expect(complete.reason).toBe("lease_mismatch");
  });

  it("applies rate limit backoff on RATE_LIMITED error", async () => {
    const { handlers } = createTestDeps();

    const reserve = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    await handlers.COMPLETE_SYNC(
      {
        type: "COMPLETE_SYNC",
        accountId: reserve.accountKey,
        leaseId: reserve.leaseId,
        mode: "full",
        status: "failure",
        trigger: "manual",
        errorCode: "RATE_LIMITED",
      } as unknown as MessageRequest,
      {} as chrome.runtime.MessageSender,
    );

    const retry = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(retry.allow).toBe(false);
    expect(retry.reason).toBe("rate_limited");
  });

  it("forces full mode for manual sync when localCount is zero even after a prior full sync", async () => {
    const { handlers, storage } = createTestDeps();

    // Post-reset scenario: orchestrator still remembers a recent full sync,
    // but the local DB has been wiped. The manual Sync press must re-seed,
    // not pick incremental from a stale watermark (FINDINGS §2).
    const now = Date.now();
    await storage.set({
      totem_sync_orchestrator_state: {
        version: 1,
        accounts: {
          "acct-1": {
            inFlight: null,
            lastSuccessAt: now - 60 * 1000,
            lastFullSyncAt: now - 60 * 1000,
            lastIncrementalSyncAt: 0,
            manualCooldownUntil: 0,
            rateLimitBackoffUntil: 0,
            rateLimitConsecutive: 0,
            lastAttemptAt: now - 60 * 1000,
            lastCompletedAt: 0,
            lastCompletedStatus: null,
            lastDecisionAt: 0,
            lastDecisionReason: null,
            lastError: null,
            lastFailureCode: null,
          },
        },
      },
    });

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(true);
    expect(result.mode).toBe("full");
    expect(result.reason).toBe("manual_seed");
  });

  it("selects incremental mode for auto sync once the account has a prior full sync", async () => {
    const { handlers, storage } = createTestDeps();

    // Seed orchestrator state with a prior successful full sync so the
    // self-heal condition (lastFullSyncAt === 0) doesn't force "full".
    // Make lastAttemptAt/lastSuccessAt far enough in the past to avoid
    // auto_backoff (5min) and fresh_cache (4hr) blocks.
    await storage.set({
      totem_sync_orchestrator_state: {
        version: 1,
        accounts: {
          "acct-1": {
            inFlight: null,
            lastSuccessAt: Date.now() - 5 * 60 * 60 * 1000,
            lastFullSyncAt: Date.now() - 5 * 60 * 60 * 1000,
            lastIncrementalSyncAt: 0,
            manualCooldownUntil: 0,
            rateLimitBackoffUntil: 0,
            rateLimitConsecutive: 0,
            lastAttemptAt: Date.now() - 5 * 60 * 60 * 1000,
            lastCompletedAt: 0,
            lastCompletedStatus: null,
            lastDecisionAt: 0,
            lastDecisionReason: null,
            lastError: null,
            lastFailureCode: null,
          },
        },
      },
    });

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "auto", localCount: 100 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(true);
    expect(result.mode).toBe("incremental");
  });

  it("selects full mode for auto sync with no bookmarks", async () => {
    const { handlers } = createTestDeps();

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "auto", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(true);
    expect(result.mode).toBe("full");
  });

  it("uses a short backoff window when seed has not completed (lastFullSyncAt === 0)", async () => {
    const { handlers, storage } = createTestDeps();

    // Seed-incomplete state with a very recent failed attempt. The old
    // behavior (5-minute auto_backoff) would block a tab reload for ~4+
    // minutes after a failed seed run. The new behavior uses a 30-second
    // window for seed-incomplete accounts so reloads resume quickly.
    const now = Date.now();
    await storage.set({
      totem_sync_orchestrator_state: {
        version: 1,
        accounts: {
          "acct-1": {
            inFlight: null,
            lastSuccessAt: 0,
            lastFullSyncAt: 0,
            lastIncrementalSyncAt: 0,
            manualCooldownUntil: 0,
            rateLimitBackoffUntil: 0,
            rateLimitConsecutive: 0,
            // 45 seconds ago: past the new 30s window, but well inside
            // the old 5-minute window.
            lastAttemptAt: now - 45 * 1000,
            lastCompletedAt: 0,
            lastCompletedStatus: null,
            lastDecisionAt: 0,
            lastDecisionReason: null,
            lastError: "failure",
            lastFailureCode: "INCOMPLETE_FULL_SYNC",
          },
        },
      },
    });

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "auto", localCount: 99 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(true);
    expect(result.mode).toBe("full");
    expect(result.reason).toBe("bootstrap_seed");
  });

  it("still blocks during the short seed-backoff window if the attempt was just now", async () => {
    const { handlers, storage } = createTestDeps();

    const now = Date.now();
    await storage.set({
      totem_sync_orchestrator_state: {
        version: 1,
        accounts: {
          "acct-1": {
            inFlight: null,
            lastSuccessAt: 0,
            lastFullSyncAt: 0,
            lastIncrementalSyncAt: 0,
            manualCooldownUntil: 0,
            rateLimitBackoffUntil: 0,
            rateLimitConsecutive: 0,
            // 5 seconds ago: inside the 30s seed-backoff window.
            lastAttemptAt: now - 5 * 1000,
            lastCompletedAt: 0,
            lastCompletedStatus: null,
            lastDecisionAt: 0,
            lastDecisionReason: null,
            lastError: null,
            lastFailureCode: null,
          },
        },
      },
    });

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "auto", localCount: 99 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(false);
    expect(result.reason).toBe("auto_backoff");
    // retryAfterMs should be <= 30s (not the old 5-minute window).
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs as number).toBeLessThanOrEqual(30_000);
  });

  it("keeps the 5-minute backoff window for post-seed incremental retries", async () => {
    const { handlers, storage } = createTestDeps();

    const now = Date.now();
    await storage.set({
      totem_sync_orchestrator_state: {
        version: 1,
        accounts: {
          "acct-1": {
            inFlight: null,
            lastSuccessAt: now - 5 * 60 * 60 * 1000,
            // Seed has completed: post-seed incremental path should
            // still use the 5-minute backoff to avoid hammering X.
            lastFullSyncAt: now - 5 * 60 * 60 * 1000,
            lastIncrementalSyncAt: 0,
            manualCooldownUntil: 0,
            rateLimitBackoffUntil: 0,
            rateLimitConsecutive: 0,
            // 45 seconds ago: inside the 5-min window but outside the 30s
            // seed window. Must still be blocked on this path.
            lastAttemptAt: now - 45 * 1000,
            lastCompletedAt: 0,
            lastCompletedStatus: null,
            lastDecisionAt: 0,
            lastDecisionReason: null,
            lastError: null,
            lastFailureCode: null,
          },
        },
      },
    });

    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "auto", localCount: 100 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(false);
    expect(result.reason).toBe("auto_backoff");
    expect(result.retryAfterMs as number).toBeGreaterThan(30_000);
  });

  it("selects full mode for auto sync with bookmarks when no prior full sync exists (self-heal)", async () => {
    const { handlers } = createTestDeps();

    // Fresh orchestrator state: lastFullSyncAt === 0.
    // Even with 100 local bookmarks, orchestrator forces a full sync once
    // so lastFullSyncAt gets written — heals the historical split-brain
    // where runtime thought it was seeded but SW had no record.
    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "auto", localCount: 100 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.allow).toBe(true);
    expect(result.mode).toBe("full");
    expect(result.reason).toBe("bootstrap_seed");
  });
});
