import { describe, expect, it } from "vitest";
import {
  createSyncMachineState,
  reduceSyncMachine,
  type SyncMachineState,
} from "../sync-state-machine";

function apply(
  state: SyncMachineState,
  ...events: Parameters<typeof reduceSyncMachine>[1][]
): SyncMachineState {
  return events.reduce(reduceSyncMachine, state);
}

describe("sync-state-machine", () => {
  it("starts sync only when ready and not already syncing", () => {
    const initial = createSyncMachineState("loading");

    const notReady = reduceSyncMachine(initial, {
      type: "SYNC_REQUEST",
      isReady: false,
      mode: "full",
    });
    expect(notReady.syncStatus).toBe("idle");
    expect(notReady.syncing).toBe(false);

    const started = reduceSyncMachine(notReady, {
      type: "SYNC_REQUEST",
      isReady: true,
      mode: "full",
    });
    expect(started.syncStatus).toBe("syncing");
    expect(started.syncing).toBe(true);
    expect(started.lastSyncMode).toBe("full");
    expect(started.initRunId).toBe(1);

    const duplicate = reduceSyncMachine(started, {
      type: "SYNC_REQUEST",
      isReady: true,
      mode: "incremental",
    });
    expect(duplicate).toEqual(started);
  });

  it("maps auth failures to reauthing and other failures to error", () => {
    const syncing = apply(createSyncMachineState(), {
      type: "SYNC_REQUEST",
      isReady: true,
      mode: "full",
    });

    const reauth = reduceSyncMachine(syncing, {
      type: "SYNC_FAILURE",
      message: "AUTH_EXPIRED",
    });
    expect(reauth.syncStatus).toBe("reauthing");
    expect(reauth.syncing).toBe(false);

    const syncingAgain = reduceSyncMachine(reauth, {
      type: "SYNC_REQUEST",
      isReady: true,
      mode: "full",
    });
    const error = reduceSyncMachine(syncingAgain, {
      type: "SYNC_FAILURE",
      message: "PAGE_FETCH_TIMEOUT",
    });
    expect(error.syncStatus).toBe("error");
    expect(error.syncing).toBe(false);

    const syncingThird = reduceSyncMachine(error, {
      type: "SYNC_REQUEST",
      isReady: true,
      mode: "full",
    });
    const capabilityBlocked = reduceSyncMachine(syncingThird, {
      type: "SYNC_FAILURE",
      message: "NO_QUERY_ID",
    });
    expect(capabilityBlocked.syncStatus).toBe("error");
    expect(capabilityBlocked.syncing).toBe(false);
  });

  it("ensures reset always returns to idle and ignores late sync completions", () => {
    const syncing = apply(createSyncMachineState(), {
      type: "SYNC_REQUEST",
      isReady: true,
      mode: "full",
    });

    const reset = reduceSyncMachine(syncing, { type: "RESET" });
    expect(reset.syncStatus).toBe("idle");
    expect(reset.syncing).toBe(false);

    const lateSuccess = reduceSyncMachine(reset, { type: "SYNC_SUCCESS" });
    expect(lateSuccess).toEqual(reset);

    const lateFailure = reduceSyncMachine(reset, {
      type: "SYNC_FAILURE",
      message: "AUTH_EXPIRED",
    });
    expect(lateFailure).toEqual(reset);
  });

  it("supports deterministic recovery chain: auth failure -> retry -> success", () => {
    const final = apply(
      createSyncMachineState(),
      { type: "SYNC_REQUEST", isReady: true, mode: "full" },
      { type: "SYNC_FAILURE", message: "NO_AUTH" },
      { type: "SYNC_REQUEST", isReady: true, mode: "full" },
      { type: "SYNC_SUCCESS" },
    );

    expect(final.syncStatus).toBe("idle");
    expect(final.syncing).toBe(false);
    expect(final.lastSyncMode).toBe("full");
  });

  it("keeps explicit run-id invalidation deterministic", () => {
    const initial = createSyncMachineState();
    const next = apply(
      initial,
      { type: "INIT_INVALIDATE" },
      { type: "INIT_INVALIDATE" },
      { type: "RESET" },
    );
    expect(next.initRunId).toBe(initial.initRunId + 3);
  });
});
