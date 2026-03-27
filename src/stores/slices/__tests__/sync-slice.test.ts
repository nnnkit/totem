import { describe, expect, it, vi } from "vitest";
import {
  createSyncSlice,
  deriveSyncJobKind,
  deriveSyncStatus,
  isValidSyncTransition,
  SYNC_TRANSITIONS,
  type SyncMachineStateName,
} from "../sync-slice";

// ── Transition table validation ───────────────────────────────

describe("sync state machine transitions", () => {
  const allStates: SyncMachineStateName[] = [
    "idle",
    "reserving",
    "syncing_quick",
    "syncing_full",
    "syncing_incremental",
    "recovering",
    "completing",
    "error",
  ];

  it("defines transitions for every state", () => {
    for (const state of allStates) {
      expect(SYNC_TRANSITIONS[state]).toBeDefined();
      expect(Array.isArray(SYNC_TRANSITIONS[state])).toBe(true);
    }
  });

  it("allows idle → reserving", () => {
    expect(isValidSyncTransition("idle", "reserving")).toBe(true);
  });

  it("allows reserving → syncing_quick", () => {
    expect(isValidSyncTransition("reserving", "syncing_quick")).toBe(true);
  });

  it("allows reserving → syncing_full", () => {
    expect(isValidSyncTransition("reserving", "syncing_full")).toBe(true);
  });

  it("allows reserving → syncing_incremental", () => {
    expect(isValidSyncTransition("reserving", "syncing_incremental")).toBe(true);
  });

  it("allows reserving → idle (lease denied)", () => {
    expect(isValidSyncTransition("reserving", "idle")).toBe(true);
  });

  it("allows syncing_* → recovering", () => {
    expect(isValidSyncTransition("syncing_quick", "recovering")).toBe(true);
    expect(isValidSyncTransition("syncing_full", "recovering")).toBe(true);
    expect(isValidSyncTransition("syncing_incremental", "recovering")).toBe(true);
  });

  it("allows syncing_* → completing", () => {
    expect(isValidSyncTransition("syncing_quick", "completing")).toBe(true);
    expect(isValidSyncTransition("syncing_full", "completing")).toBe(true);
    expect(isValidSyncTransition("syncing_incremental", "completing")).toBe(true);
  });

  it("allows syncing_* → error", () => {
    expect(isValidSyncTransition("syncing_quick", "error")).toBe(true);
    expect(isValidSyncTransition("syncing_full", "error")).toBe(true);
    expect(isValidSyncTransition("syncing_incremental", "error")).toBe(true);
  });

  it("allows syncing_* → idle (cancel)", () => {
    expect(isValidSyncTransition("syncing_quick", "idle")).toBe(true);
    expect(isValidSyncTransition("syncing_full", "idle")).toBe(true);
  });

  it("allows recovering → completing", () => {
    expect(isValidSyncTransition("recovering", "completing")).toBe(true);
  });

  it("allows recovering → error", () => {
    expect(isValidSyncTransition("recovering", "error")).toBe(true);
  });

  it("allows completing → idle", () => {
    expect(isValidSyncTransition("completing", "idle")).toBe(true);
  });

  it("allows completing → error", () => {
    expect(isValidSyncTransition("completing", "error")).toBe(true);
  });

  it("allows error → reserving (retry)", () => {
    expect(isValidSyncTransition("error", "reserving")).toBe(true);
  });

  it("allows error → idle (reset)", () => {
    expect(isValidSyncTransition("error", "idle")).toBe(true);
  });

  // ── Illegal transitions ─────────────────────────────────────

  it("rejects idle → syncing_quick (must go through reserving)", () => {
    expect(isValidSyncTransition("idle", "syncing_quick")).toBe(false);
  });

  it("rejects idle → completing", () => {
    expect(isValidSyncTransition("idle", "completing")).toBe(false);
  });

  it("rejects idle → error", () => {
    expect(isValidSyncTransition("idle", "error")).toBe(false);
  });

  it("rejects completing → syncing_quick", () => {
    expect(isValidSyncTransition("completing", "syncing_quick")).toBe(false);
  });

  it("rejects error → syncing_full (must go through reserving)", () => {
    expect(isValidSyncTransition("error", "syncing_full")).toBe(false);
  });

  it("rejects reserving → recovering", () => {
    expect(isValidSyncTransition("reserving", "recovering")).toBe(false);
  });

  it("treats same-state as valid (no-op)", () => {
    expect(isValidSyncTransition("idle", "idle")).toBe(true);
    expect(isValidSyncTransition("error", "error")).toBe(true);
  });
});

// ── Status derivation ─────────────────────────────────────────

describe("deriveSyncStatus", () => {
  it("maps idle to idle", () => {
    expect(deriveSyncStatus({ name: "idle" })).toBe("idle");
  });

  it("maps syncing states to syncing", () => {
    expect(deriveSyncStatus({ name: "reserving", trigger: "manual" })).toBe("syncing");
    expect(deriveSyncStatus({
      name: "syncing_quick", mode: "quick", leaseId: "", trigger: "manual",
      accountKey: null, generation: 1, abortController: new AbortController(),
    })).toBe("syncing");
  });

  it("maps error with AUTH_EXPIRED to reauthing", () => {
    expect(deriveSyncStatus({ name: "error", reason: "AUTH_EXPIRED" })).toBe("reauthing");
    expect(deriveSyncStatus({ name: "error", reason: "NO_AUTH" })).toBe("reauthing");
  });

  it("maps error with other reasons to error", () => {
    expect(deriveSyncStatus({ name: "error", reason: "NETWORK" })).toBe("error");
  });
});

describe("deriveSyncJobKind", () => {
  it("returns none when idle", () => {
    expect(deriveSyncJobKind({ name: "idle" }, true)).toBe("none");
  });

  it("returns bootstrap when syncing with no bookmarks", () => {
    expect(deriveSyncJobKind({ name: "reserving", trigger: "manual" }, false)).toBe("bootstrap");
  });

  it("returns backfill when syncing with existing bookmarks", () => {
    expect(deriveSyncJobKind({ name: "reserving", trigger: "manual" }, true)).toBe("backfill");
  });
});

// ── Sync slice actions ────────────────────────────────────────

describe("sync slice actions", () => {
  it("starts in idle state", () => {
    const store = createSyncSlice();
    expect(store.getState().syncMachine.name).toBe("idle");
    expect(store.getState().syncGeneration).toBe(0);
  });

  it("startReservation transitions idle → reserving", () => {
    const store = createSyncSlice();
    const ok = store.getState().actions.startReservation("manual");
    expect(ok).toBe(true);
    expect(store.getState().syncMachine.name).toBe("reserving");
    const machine = store.getState().syncMachine;
    expect(machine.name === "reserving" && machine.trigger).toBe("manual");
  });

  it("rejects startReservation when already syncing", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "lease-1", mode: "quick", trigger: "manual", accountKey: "acct-1",
    });

    const ok = store.getState().actions.startReservation("manual");
    expect(ok).toBe(false);
    expect(store.getState().syncMachine.name).toBe("syncing_quick");
  });

  it("leaseGranted transitions reserving → syncing_* and returns AbortSignal", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");

    const signal = store.getState().actions.leaseGranted({
      leaseId: "lease-1", mode: "full", trigger: "manual", accountKey: "acct-1",
    });

    expect(signal).not.toBeNull();
    expect(signal!.aborted).toBe(false);
    expect(store.getState().syncMachine.name).toBe("syncing_full");
    expect(store.getState().syncGeneration).toBe(1);
  });

  it("leaseGranted maps mode to correct state name", () => {
    for (const mode of ["quick", "full", "incremental"] as const) {
      const store = createSyncSlice();
      store.getState().actions.startReservation("manual");
      store.getState().actions.leaseGranted({
        leaseId: "l", mode, trigger: "manual", accountKey: null,
      });
      expect(store.getState().syncMachine.name).toBe(`syncing_${mode}`);
    }
  });

  it("leaseDenied transitions reserving → idle with blocked reason", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseDenied("cooldown");

    expect(store.getState().syncMachine.name).toBe("idle");
    expect(store.getState().syncBlockedReason).toBe("cooldown");
  });

  it("startRecovery transitions syncing → recovering", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });

    const ok = store.getState().actions.startRecovery();
    expect(ok).toBe(true);
    expect(store.getState().syncMachine.name).toBe("recovering");
  });

  it("startCompleting transitions syncing → completing", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "full", trigger: "manual", accountKey: "a",
    });

    const ok = store.getState().actions.startCompleting();
    expect(ok).toBe(true);
    expect(store.getState().syncMachine.name).toBe("completing");

    const machine = store.getState().syncMachine;
    if (machine.name === "completing") {
      expect(machine.leaseId).toBe("l");
      expect(machine.accountKey).toBe("a");
      expect(machine.mode).toBe("full");
    }
  });

  it("complete transitions completing → idle", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });
    store.getState().actions.startCompleting();
    store.getState().actions.complete();

    expect(store.getState().syncMachine.name).toBe("idle");
    expect(store.getState().syncBlockedReason).toBeNull();
  });

  it("fail transitions syncing → error and aborts signal", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    const signal = store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    })!;

    expect(signal.aborted).toBe(false);
    store.getState().actions.fail("NETWORK");
    expect(signal.aborted).toBe(true);
    const machine = store.getState().syncMachine;
    expect(machine.name).toBe("error");
    expect(machine.name === "error" && machine.reason).toBe("NETWORK");
  });

  it("cancel aborts signal and transitions to idle", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    const signal = store.getState().actions.leaseGranted({
      leaseId: "l", mode: "full", trigger: "manual", accountKey: null,
    })!;

    store.getState().actions.cancel();
    expect(signal.aborted).toBe(true);
    expect(store.getState().syncMachine.name).toBe("idle");
  });

  it("getAbortSignal returns signal during sync, null when idle", () => {
    const store = createSyncSlice();
    expect(store.getState().actions.getAbortSignal()).toBeNull();

    store.getState().actions.startReservation("manual");
    expect(store.getState().actions.getAbortSignal()).toBeNull(); // reserving has no abort controller

    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });
    expect(store.getState().actions.getAbortSignal()).not.toBeNull();
    expect(store.getState().actions.getAbortSignal()!.aborted).toBe(false);
  });
});

// ── Cross-slice triggers ──────────────────────────────────────

describe("sync slice cross-slice triggers", () => {
  it("calls onReauthNeeded when error is AUTH_EXPIRED", () => {
    const onReauthNeeded = vi.fn();
    const store = createSyncSlice({ onReauthNeeded });

    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });
    store.getState().actions.fail("AUTH_EXPIRED");

    expect(onReauthNeeded).toHaveBeenCalledTimes(1);
  });

  it("calls onReauthNeeded when error is NO_AUTH", () => {
    const onReauthNeeded = vi.fn();
    const store = createSyncSlice({ onReauthNeeded });

    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });
    store.getState().actions.fail("NO_AUTH");

    expect(onReauthNeeded).toHaveBeenCalledTimes(1);
  });

  it("does not call onReauthNeeded for non-auth errors", () => {
    const onReauthNeeded = vi.fn();
    const store = createSyncSlice({ onReauthNeeded });

    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });
    store.getState().actions.fail("NETWORK_ERROR");

    expect(onReauthNeeded).not.toHaveBeenCalled();
  });
});

// ── Illegal transition rejection ──────────────────────────────

describe("sync slice illegal transition rejection", () => {
  it("rejects leaseGranted when not in reserving state", () => {
    const store = createSyncSlice();
    const signal = store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });
    expect(signal).toBeNull();
    expect(store.getState().syncMachine.name).toBe("idle");
  });

  it("rejects startRecovery when idle", () => {
    const store = createSyncSlice();
    const ok = store.getState().actions.startRecovery();
    expect(ok).toBe(false);
    expect(store.getState().syncMachine.name).toBe("idle");
  });

  it("rejects startCompleting when idle", () => {
    const store = createSyncSlice();
    const ok = store.getState().actions.startCompleting();
    expect(ok).toBe(false);
  });

  it("rejects startReservation when in completing state", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });
    store.getState().actions.startCompleting();

    const ok = store.getState().actions.startReservation("manual");
    expect(ok).toBe(false);
    expect(store.getState().syncMachine.name).toBe("completing");
  });
});

// ── Full lifecycle: reservation → sync → recovery → complete ──

describe("sync slice full lifecycle", () => {
  it("happy path: idle → reserve → sync → complete → idle", () => {
    const store = createSyncSlice();

    // Reserve
    expect(store.getState().actions.startReservation("manual")).toBe(true);
    expect(store.getState().syncMachine.name).toBe("reserving");

    // Lease granted
    const signal = store.getState().actions.leaseGranted({
      leaseId: "lease-1", mode: "quick", trigger: "manual", accountKey: "acct-1",
    })!;
    expect(store.getState().syncMachine.name).toBe("syncing_quick");
    expect(signal.aborted).toBe(false);

    // Complete
    store.getState().actions.startCompleting();
    expect(store.getState().syncMachine.name).toBe("completing");

    store.getState().actions.complete();
    expect(store.getState().syncMachine.name).toBe("idle");
  });

  it("recovery path: sync → recover → complete → idle", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "full", trigger: "manual", accountKey: null,
    });

    // Recovery needed
    store.getState().actions.startRecovery();
    expect(store.getState().syncMachine.name).toBe("recovering");

    // Recovery completes
    store.getState().actions.startCompleting();
    store.getState().actions.complete();
    expect(store.getState().syncMachine.name).toBe("idle");
  });

  it("error → retry path: sync → error → reserve → sync → complete", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l1", mode: "quick", trigger: "manual", accountKey: null,
    });

    // Error
    store.getState().actions.fail("NETWORK");
    expect(store.getState().syncMachine.name).toBe("error");

    // Retry
    store.getState().actions.startReservation("manual");
    expect(store.getState().syncMachine.name).toBe("reserving");

    store.getState().actions.leaseGranted({
      leaseId: "l2", mode: "quick", trigger: "manual", accountKey: null,
    });
    store.getState().actions.startCompleting();
    store.getState().actions.complete();
    expect(store.getState().syncMachine.name).toBe("idle");
  });

  it("cancellation aborts signal and returns to idle cleanly", () => {
    const store = createSyncSlice();
    store.getState().actions.startReservation("auto");
    const signal = store.getState().actions.leaseGranted({
      leaseId: "l", mode: "incremental", trigger: "auto", accountKey: null,
    })!;

    expect(signal.aborted).toBe(false);
    store.getState().actions.cancel();
    expect(signal.aborted).toBe(true);
    expect(store.getState().syncMachine.name).toBe("idle");
    expect(store.getState().syncBlockedReason).toBeNull();
  });

  it("preserves generation across transitions", () => {
    const store = createSyncSlice();
    expect(store.getState().syncGeneration).toBe(0);

    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l", mode: "quick", trigger: "manual", accountKey: null,
    });
    expect(store.getState().syncGeneration).toBe(1);

    store.getState().actions.cancel();
    store.getState().actions.startReservation("manual");
    store.getState().actions.leaseGranted({
      leaseId: "l2", mode: "full", trigger: "manual", accountKey: null,
    });
    expect(store.getState().syncGeneration).toBe(2);
  });
});
