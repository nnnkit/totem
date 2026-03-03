import type { SyncStatus } from "../types";

export type SyncMode = "incremental" | "full" | "quick";

export interface SyncMachineState {
  syncStatus: SyncStatus;
  syncing: boolean;
  lastSyncMode: SyncMode;
  initRunId: number;
}

export type SyncMachineEvent =
  | { type: "SYNC_REQUEST"; isReady: boolean; mode: SyncMode }
  | { type: "SYNC_SUCCESS" }
  | { type: "SYNC_FAILURE"; message: string }
  | { type: "SYNC_TIMEOUT" }
  | { type: "RESET" }
  | { type: "INIT_INVALIDATE" }
  | { type: "MARK_IDLE" }
  | { type: "MARK_ERROR" };

export function createSyncMachineState(
  initialStatus: SyncStatus = "loading",
): SyncMachineState {
  return {
    syncStatus: initialStatus,
    syncing: false,
    lastSyncMode: "incremental",
    initRunId: 0,
  };
}

function errorToStatus(message: string): SyncStatus {
  if (message === "AUTH_EXPIRED" || message === "NO_AUTH") {
    return "reauthing";
  }
  return "error";
}

export function reduceSyncMachine(
  state: SyncMachineState,
  event: SyncMachineEvent,
): SyncMachineState {
  switch (event.type) {
    case "SYNC_REQUEST": {
      if (!event.isReady) {
        return { ...state, syncing: false, syncStatus: "idle" };
      }
      if (state.syncing) return state;
      return {
        ...state,
        syncStatus: "syncing",
        syncing: true,
        lastSyncMode: event.mode,
        initRunId: state.initRunId + 1,
      };
    }
    case "SYNC_SUCCESS": {
      if (!state.syncing) return state;
      return { ...state, syncing: false, syncStatus: "idle" };
    }
    case "SYNC_FAILURE": {
      if (!state.syncing) return state;
      return {
        ...state,
        syncing: false,
        syncStatus: errorToStatus(event.message),
      };
    }
    case "SYNC_TIMEOUT": {
      if (!state.syncing) return state;
      return { ...state, syncing: false, syncStatus: "idle" };
    }
    case "RESET":
      return {
        ...state,
        syncing: false,
        syncStatus: "idle",
        initRunId: state.initRunId + 1,
      };
    case "INIT_INVALIDATE":
      return { ...state, initRunId: state.initRunId + 1 };
    case "MARK_IDLE":
      return { ...state, syncing: false, syncStatus: "idle" };
    case "MARK_ERROR":
      return { ...state, syncing: false, syncStatus: "error" };
    default:
      return state;
  }
}
