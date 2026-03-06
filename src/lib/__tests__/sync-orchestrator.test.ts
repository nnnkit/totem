import { describe, expect, it } from "vitest";
import {
  createEmptySyncOrchestratorState,
  completeSyncReservation,
  reserveSyncRun,
  type SyncOrchestratorState,
} from "../sync-orchestrator";

function reserve(
  state: SyncOrchestratorState,
  input: Parameters<typeof reserveSyncRun>[1],
  now: number,
) {
  return reserveSyncRun(state, input, now);
}

describe("sync orchestrator", () => {
  it("allows one auto bootstrap full sync for empty local cache", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 1_000_000;

    const first = reserve(initial, {
      accountId: "acct_a",
      trigger: "auto",
      localCount: 0,
    }, now);

    expect(first.decision.allow).toBe(true);
    expect(first.decision.mode).toBe("full");
    expect(first.decision.reason).toBe("bootstrap_empty");

    const second = reserve(first.state, {
      accountId: "acct_a",
      trigger: "auto",
      localCount: 0,
    }, now + 1);

    expect(second.decision.allow).toBe(false);
    expect(second.decision.reason).toBe("in_flight");
  });

  it("enforces stale interval for auto background sync after success", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 2_000_000;

    const reserved = reserve(initial, {
      accountId: "acct_a",
      trigger: "auto",
      localCount: 42,
    }, now);
    expect(reserved.decision.allow).toBe(true);
    expect(reserved.decision.mode).toBe("incremental");

    const completed = completeSyncReservation(reserved.state, {
      accountId: "acct_a",
      leaseId: reserved.decision.leaseId || "",
      mode: "incremental",
      status: "success",
      trigger: "auto",
    }, now + 10_000);

    const tooSoon = reserve(completed, {
      accountId: "acct_a",
      trigger: "auto",
      localCount: 42,
    }, now + 20_000);

    expect(tooSoon.decision.allow).toBe(false);
    expect(tooSoon.decision.reason).toBe("fresh_cache");
  });

  it("allows manual sync even when auto cooldown blocks", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 3_000_000;

    const autoReserved = reserve(initial, {
      accountId: "acct_a",
      trigger: "auto",
      localCount: 42,
    }, now);

    const afterAuto = completeSyncReservation(autoReserved.state, {
      accountId: "acct_a",
      leaseId: autoReserved.decision.leaseId || "",
      mode: "incremental",
      status: "success",
      trigger: "auto",
    }, now + 1_000);

    const manual = reserve(afterAuto, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "full",
      localCount: 42,
    }, now + 6_000);

    expect(manual.decision.allow).toBe(true);
    expect(manual.decision.mode).toBe("full");
    expect(manual.decision.reason).toBe("manual");
  });

  it("defaults manual sync mode to quick when not specified", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 3_300_000;

    const manual = reserve(initial, {
      accountId: "acct_a",
      trigger: "manual",
      localCount: 0,
    }, now);

    expect(manual.decision.allow).toBe(true);
    expect(manual.decision.mode).toBe("quick");
    expect(manual.decision.reason).toBe("manual");
  });

  it("applies cooldown to repeated manual clicks after success", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 3_500_000;

    const first = reserve(initial, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "full",
      localCount: 0,
    }, now);
    expect(first.decision.allow).toBe(true);

    const completed = completeSyncReservation(first.state, {
      accountId: "acct_a",
      leaseId: first.decision.leaseId || "",
      mode: "full",
      status: "success",
      trigger: "manual",
    }, now + 200);

    const tooSoon = reserve(completed, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "full",
      localCount: 0,
    }, now + 1_000);
    expect(tooSoon.decision.allow).toBe(false);
    expect(tooSoon.decision.reason).toBe("cooldown");
  });

  it("blocks manual sync after rate-limit failure until backoff expires", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 3_800_000;

    const first = reserve(initial, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "quick",
      localCount: 0,
    }, now);
    expect(first.decision.allow).toBe(true);

    const failed = completeSyncReservation(first.state, {
      accountId: "acct_a",
      leaseId: first.decision.leaseId || "",
      mode: "quick",
      status: "failure",
      trigger: "manual",
      errorCode: "RATE_LIMITED",
    }, now + 2_000);

    const blocked = reserve(failed, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "quick",
      localCount: 0,
    }, now + 10_000);
    expect(blocked.decision.allow).toBe(false);
    expect(blocked.decision.reason).toBe("rate_limited");

    const afterBackoff = reserve(failed, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "quick",
      localCount: 0,
    }, now + 63_000);
    expect(afterBackoff.decision.allow).toBe(true);
    expect(afterBackoff.decision.mode).toBe("quick");
  });

  it("does not apply manual cooldown after an incomplete full sync", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 3_900_000;

    const first = reserve(initial, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "full",
      localCount: 100,
    }, now);
    expect(first.decision.allow).toBe(true);

    const incomplete = completeSyncReservation(first.state, {
      accountId: "acct_a",
      leaseId: first.decision.leaseId || "",
      mode: "full",
      status: "failure",
      trigger: "manual",
      errorCode: "INCOMPLETE_FULL_SYNC",
    }, now + 2_000);

    const retry = reserve(incomplete, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "full",
      localCount: 100,
    }, now + 3_000);
    expect(retry.decision.allow).toBe(true);
    expect(retry.decision.mode).toBe("full");
    expect(retry.decision.reason).toBe("manual");
  });

  it("isolates lock/cooldown by account", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 4_000_000;

    const aReserved = reserve(initial, {
      accountId: "acct_a",
      trigger: "auto",
      localCount: 0,
    }, now);
    expect(aReserved.decision.allow).toBe(true);

    const bReserved = reserve(aReserved.state, {
      accountId: "acct_b",
      trigger: "auto",
      localCount: 0,
    }, now + 1);
    expect(bReserved.decision.allow).toBe(true);
    expect(bReserved.decision.accountKey).toBe("acct_b");
  });

  it("lets manual sync reclaim stale in-flight lock", () => {
    const initial = createEmptySyncOrchestratorState();
    const now = 5_000_000;

    const reserved = reserve(initial, {
      accountId: "acct_a",
      trigger: "auto",
      localCount: 0,
    }, now);
    expect(reserved.decision.allow).toBe(true);

    const manualTooSoon = reserve(reserved.state, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "full",
      localCount: 0,
    }, now + 10_000);
    expect(manualTooSoon.decision.allow).toBe(false);
    expect(manualTooSoon.decision.reason).toBe("in_flight");

    const manualReclaimed = reserve(reserved.state, {
      accountId: "acct_a",
      trigger: "manual",
      requestedMode: "full",
      localCount: 0,
    }, now + 95_000);
    expect(manualReclaimed.decision.allow).toBe(true);
    expect(manualReclaimed.decision.reason).toBe("manual");
  });
});
