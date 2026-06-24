import { describe, it, expect } from "vitest";
import {
  asSyncBlockedReason,
  SYNC_BLOCKED_REASONS,
  syncRetryAfterMs,
  type SyncRetryWindowAccount,
} from "../sync-block-window";
import {
  SYNC_AUTO_BACKOFF_MS,
  SYNC_AUTO_INTERVAL_MS,
  SYNC_AUTO_RECLAIM_MS,
  SYNC_LOCK_TTL_MS,
  SYNC_MANUAL_RECLAIM_MS,
  SYNC_SEED_BACKOFF_MS,
} from "../constants/sync-policy";

const NOW = 1_000_000;

const acct = (
  overrides: Partial<SyncRetryWindowAccount> = {},
): SyncRetryWindowAccount => ({
  manualCooldownUntil: 0,
  rateLimitBackoffUntil: 0,
  lastAttemptAt: 0,
  lastSuccessAt: 0,
  lastFullSyncAt: 0,
  inFlight: null,
  ...overrides,
});

describe("syncRetryAfterMs", () => {
  it("cooldown returns manualCooldownUntil - now, clamped at 0", () => {
    expect(
      syncRetryAfterMs({
        reason: "cooldown",
        now: NOW,
        trigger: "manual",
        account: acct({ manualCooldownUntil: NOW + 5_000 }),
      }),
    ).toBe(5_000);
    expect(
      syncRetryAfterMs({
        reason: "cooldown",
        now: NOW,
        trigger: "manual",
        account: acct({ manualCooldownUntil: NOW - 5_000 }),
      }),
    ).toBe(0);
  });

  it("rate_limited returns rateLimitBackoffUntil - now", () => {
    expect(
      syncRetryAfterMs({
        reason: "rate_limited",
        now: NOW,
        trigger: "auto",
        account: acct({ rateLimitBackoffUntil: NOW + 42_000 }),
      }),
    ).toBe(42_000);
  });

  it("in_flight is trigger-split: manual uses MANUAL_RECLAIM (90s); auto uses LOCK_TTL (12min) and is NOT coupled to the auto reclaim constant", () => {
    const startedAt = NOW - 10_000;
    const account = acct({ inFlight: { startedAt } });

    expect(
      syncRetryAfterMs({ reason: "in_flight", now: NOW, trigger: "manual", account }),
    ).toBe(Math.max(0, startedAt + SYNC_MANUAL_RECLAIM_MS - NOW));

    const autoWindow = syncRetryAfterMs({
      reason: "in_flight",
      now: NOW,
      trigger: "auto",
      account,
    });
    expect(autoWindow).toBe(Math.max(0, startedAt + SYNC_LOCK_TTL_MS - NOW));
    // The auto in_flight RETRY window is the hard lease cap, deliberately not
    // the auto reclaim-eligibility window — they are decoupled on the auto path.
    expect(autoWindow).not.toBe(
      Math.max(0, startedAt + SYNC_AUTO_RECLAIM_MS - NOW),
    );
  });

  it("in_flight with no inFlight or startedAt===0 returns 0", () => {
    expect(
      syncRetryAfterMs({
        reason: "in_flight",
        now: NOW,
        trigger: "manual",
        account: acct({ inFlight: null }),
      }),
    ).toBe(0);
    expect(
      syncRetryAfterMs({
        reason: "in_flight",
        now: NOW,
        trigger: "auto",
        account: acct({ inFlight: { startedAt: 0 } }),
      }),
    ).toBe(0);
  });

  it("auto_backoff picks the SEED window when lastFullSyncAt<=0, else the AUTO window", () => {
    const lastAttemptAt = NOW - 1_000;
    expect(
      syncRetryAfterMs({
        reason: "auto_backoff",
        now: NOW,
        trigger: "auto",
        account: acct({ lastAttemptAt, lastFullSyncAt: 0 }),
      }),
    ).toBe(Math.max(0, lastAttemptAt + SYNC_SEED_BACKOFF_MS - NOW));
    expect(
      syncRetryAfterMs({
        reason: "auto_backoff",
        now: NOW,
        trigger: "auto",
        account: acct({ lastAttemptAt, lastFullSyncAt: NOW - 9_000 }),
      }),
    ).toBe(Math.max(0, lastAttemptAt + SYNC_AUTO_BACKOFF_MS - NOW));
  });

  it("fresh_cache returns lastSuccessAt + AUTO_INTERVAL - now (4h window)", () => {
    const lastSuccessAt = NOW - 60_000;
    expect(
      syncRetryAfterMs({
        reason: "fresh_cache",
        now: NOW,
        trigger: "auto",
        account: acct({ lastSuccessAt }),
      }),
    ).toBe(Math.max(0, lastSuccessAt + SYNC_AUTO_INTERVAL_MS - NOW));
  });

  it("null account and non-time-bounded reasons return 0 (no NaN, no throw)", () => {
    for (const reason of ["no_account", "not_ready", "garbage", "cooldown"]) {
      expect(
        syncRetryAfterMs({ reason, now: NOW, trigger: "auto", account: null }),
      ).toBe(0);
    }
    for (const reason of ["no_account", "not_ready", "totally_unknown"]) {
      const out = syncRetryAfterMs({
        reason,
        now: NOW,
        trigger: "manual",
        account: acct({ manualCooldownUntil: NOW + 5_000 }),
      });
      expect(out).toBe(0);
      expect(Number.isNaN(out)).toBe(false);
    }
  });
});

describe("asSyncBlockedReason / SYNC_BLOCKED_REASONS", () => {
  it("narrows each of the 5 members to itself", () => {
    for (const reason of [
      "in_flight",
      "cooldown",
      "rate_limited",
      "no_account",
      "not_ready",
    ]) {
      expect(asSyncBlockedReason(reason)).toBe(reason);
    }
  });

  it("returns null for non-members, including auto_backoff/fresh_cache and empty/nullish", () => {
    for (const reason of [
      "auto_backoff",
      "fresh_cache",
      "blocked",
      "",
      "garbage",
      null,
      undefined,
    ]) {
      expect(asSyncBlockedReason(reason)).toBeNull();
    }
  });

  it("the set contains exactly the 5 SyncBlockedReason members", () => {
    expect([...SYNC_BLOCKED_REASONS].sort()).toEqual(
      ["cooldown", "in_flight", "no_account", "not_ready", "rate_limited"].sort(),
    );
  });
});
