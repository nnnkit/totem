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
  it("grants a manual lease for logged-in user", async () => {
    const { handlers } = createTestDeps();
    const result = (await handlers.REQUEST_SYNC(
      { type: "REQUEST_SYNC", trigger: "manual", localCount: 0 } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as Record<string, unknown>;

    expect(result.ok).toBe(true);
    expect(result.allow).toBe(true);
    expect(result.mode).toBe("quick"); // manual trigger defaults to "quick" when no requestedMode
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

  it("selects incremental mode for auto sync with existing bookmarks", async () => {
    const { handlers } = createTestDeps();

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
});
