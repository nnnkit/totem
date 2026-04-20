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
