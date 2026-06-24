import { describe, it, expect } from "vitest";
import {
  decideCompletion,
  type SyncCompletionDecision,
  type SyncAccountState,
  type SyncInFlight,
} from "../sync";
import type { SyncMode } from "../../types/sync";

const NOW = 1_000_000;

const inFlight = (overrides: Partial<SyncInFlight> = {}): SyncInFlight => ({
  leaseId: "lease-1",
  mode: "incremental",
  trigger: "auto",
  reason: "background_stale",
  startedAt: 1_000,
  ...overrides,
});

const account = (
  overrides: Partial<SyncAccountState> = {},
): SyncAccountState => ({
  inFlight: inFlight(),
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
  ...overrides,
});

function expectApplied(d: SyncCompletionDecision) {
  if (d.kind !== "applied") throw new Error(`expected applied, got ${d.kind}`);
  return d;
}

describe("decideCompletion — lease identity", () => {
  it("ignores a completion whose leaseId does not match the in-flight lease, mutating nothing", () => {
    const acct = account({ inFlight: inFlight({ leaseId: "A" }), lastFullSyncAt: 0 });
    const d = decideCompletion({
      account: acct,
      leaseId: "B",
      status: "success",
      errorCode: "",
      now: NOW,
    });
    expect(d).toEqual({ kind: "ignored", reason: "lease_mismatch" });
    expect(acct.inFlight?.leaseId).toBe("A");
    expect(acct.lastFullSyncAt).toBe(0);
  });

  it("treats an empty leaseId as a mismatch", () => {
    expect(
      decideCompletion({
        account: account({ inFlight: inFlight({ leaseId: "A" }) }),
        leaseId: "",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    ).toEqual({ kind: "ignored", reason: "lease_mismatch" });
  });

  it("returns missing_inflight when there is no lease to close", () => {
    expect(
      decideCompletion({
        account: account({ inFlight: null }),
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    ).toEqual({ kind: "ignored", reason: "missing_inflight" });
    expect(
      decideCompletion({
        account: null,
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    ).toEqual({ kind: "ignored", reason: "missing_inflight" });
  });
});

describe("decideCompletion — lease-owned mode/trigger", () => {
  it("stamps lastFullSyncAt only when the LEASE mode is full (cannot be spoofed by payload)", () => {
    const incr = expectApplied(
      decideCompletion({
        account: account({ inFlight: inFlight({ mode: "incremental" }) }),
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    );
    expect(incr.mode).toBe("incremental");
    expect(incr.next.lastFullSyncAt).toBe(0);
    expect(incr.next.lastIncrementalSyncAt).toBe(NOW);

    const full = expectApplied(
      decideCompletion({
        account: account({ inFlight: inFlight({ mode: "full" }) }),
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    );
    expect(full.mode).toBe("full");
    expect(full.next.lastFullSyncAt).toBe(NOW);
    expect(full.next.lastIncrementalSyncAt).toBe(0);
  });

  it("sets the manual success cooldown only when the LEASE trigger is manual", () => {
    const auto = expectApplied(
      decideCompletion({
        account: account({ inFlight: inFlight({ trigger: "auto" }) }),
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    );
    expect(auto.trigger).toBe("auto");
    expect(auto.next.manualCooldownUntil).toBe(0);

    const manual = expectApplied(
      decideCompletion({
        account: account({ inFlight: inFlight({ trigger: "manual" }) }),
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    );
    expect(manual.trigger).toBe("manual");
    expect(manual.next.manualCooldownUntil).toBeGreaterThan(NOW);
  });

  it("clears the in-flight slot on every applied completion", () => {
    const d = expectApplied(
      decideCompletion({
        account: account(),
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    );
    expect(d.next.inFlight).toBeNull();
  });
});

describe("decideCompletion — backoff math", () => {
  it("escalates rate-limit backoff and floors manual cooldown to it on a RATE_LIMITED failure", () => {
    const d = expectApplied(
      decideCompletion({
        account: account({
          inFlight: inFlight({ trigger: "manual" }),
          rateLimitConsecutive: 2,
        }),
        leaseId: "lease-1",
        status: "failure",
        errorCode: "RATE_LIMITED",
        now: NOW,
      }),
    );
    expect(d.next.rateLimitConsecutive).toBe(3);
    // base 60_000 * 2^(3-1) = 240_000, below the 15-min cap.
    expect(d.next.rateLimitBackoffUntil).toBe(NOW + 240_000);
    expect(d.next.manualCooldownUntil).toBe(d.next.rateLimitBackoffUntil);
    expect(d.next.lastFailureCode).toBe("RATE_LIMITED");
  });

  it("a non-rate-limited failure resets the rate-limit streak", () => {
    const d = expectApplied(
      decideCompletion({
        account: account({ rateLimitConsecutive: 4, rateLimitBackoffUntil: NOW + 999 }),
        leaseId: "lease-1",
        status: "failure",
        errorCode: "NETWORK_ERROR",
        now: NOW,
      }),
    );
    expect(d.next.rateLimitConsecutive).toBe(0);
    expect(d.next.rateLimitBackoffUntil).toBe(0);
  });
});

describe("decideCompletion — cache descriptor", () => {
  it("incremental success: lastSync + lastSoftSync + clearSoftNeeded", () => {
    const d = expectApplied(
      decideCompletion({
        account: account({ inFlight: inFlight({ mode: "incremental" }) }),
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    );
    expect(d.cache).toEqual({ lastSync: NOW, lastSoftSync: NOW, clearSoftNeeded: true });
  });

  it("full success: lastSync + clearSoftNeeded, NO lastSoftSync", () => {
    const d = expectApplied(
      decideCompletion({
        account: account({ inFlight: inFlight({ mode: "full" }) }),
        leaseId: "lease-1",
        status: "success",
        errorCode: "",
        now: NOW,
      }),
    );
    expect(d.cache).toEqual({ lastSync: NOW, clearSoftNeeded: true });
    expect(d.cache.lastSoftSync).toBeUndefined();
  });

  it("timeout: lastSync ONLY — no clearSoftNeeded, no lastSoftSync (preserves the prior timeout cache stamp)", () => {
    const d = expectApplied(
      decideCompletion({
        account: account({ inFlight: inFlight({ mode: "incremental" }) }),
        leaseId: "lease-1",
        status: "timeout",
        errorCode: "",
        now: NOW,
      }),
    );
    expect(d.cache).toEqual({ lastSync: NOW });
    expect(d.cache.clearSoftNeeded).toBeUndefined();
    expect(d.cache.lastSoftSync).toBeUndefined();
  });

  it("failure and skipped request no cache write", () => {
    expect(
      expectApplied(
        decideCompletion({
          account: account(),
          leaseId: "lease-1",
          status: "failure",
          errorCode: "",
          now: NOW,
        }),
      ).cache,
    ).toEqual({});
    expect(
      expectApplied(
        decideCompletion({
          account: account(),
          leaseId: "lease-1",
          status: "skipped",
          errorCode: "",
          now: NOW,
        }),
      ).cache,
    ).toEqual({});
  });
});

describe("SyncMode", () => {
  it("is exactly 'full' | 'incremental' — 'quick' is gone (compile-time guard)", () => {
    // @ts-expect-error 'quick' is no longer a member of SyncMode.
    const reintroduced: SyncMode = "quick";
    void reintroduced;
    const members: SyncMode[] = ["full", "incremental"];
    expect(members).toHaveLength(2);
  });
});
