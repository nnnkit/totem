/**
 * Sync slice — explicit state machine with named states and typed transitions.
 *
 * Owns: sync machine state, syncBlockedReason, syncGeneration.
 *
 * The sync lifecycle is formalized as a discriminated union of named states:
 *   idle → reserving → syncing_quick/syncing_full/syncing_incremental →
 *   recovering → completing → idle/error
 *
 * Three prior cancellation mechanisms (timeout timer, generation guards,
 * abortState object) are unified into state machine transitions with a
 * single AbortSignal per sync run.
 */

import { create } from "zustand";
import type {
  SyncBlockedReason,
  SyncMode,
} from "../../types/sync";
import type { SyncStatus } from "../../types";

// ── Sync machine states (discriminated union) ─────────────────

export interface SyncStateIdle {
  readonly name: "idle";
}

export interface SyncStateReserving {
  readonly name: "reserving";
  readonly trigger: "manual" | "auto";
}

interface SyncingBase {
  readonly leaseId: string;
  readonly trigger: "manual" | "auto";
  readonly accountKey: string | null;
  readonly mode: SyncMode;
  readonly generation: number;
  readonly abortController: AbortController;
}

export interface SyncStateSyncingQuick extends SyncingBase {
  readonly name: "syncing_quick";
  readonly mode: "quick";
}

export interface SyncStateSyncingFull extends SyncingBase {
  readonly name: "syncing_full";
  readonly mode: "full";
}

export interface SyncStateSyncingIncremental extends SyncingBase {
  readonly name: "syncing_incremental";
  readonly mode: "incremental";
}

export interface SyncStateRecovering extends SyncingBase {
  readonly name: "recovering";
}

export interface SyncStateCompleting {
  readonly name: "completing";
  readonly leaseId: string;
  readonly accountKey: string | null;
  readonly mode: SyncMode;
  readonly trigger: "manual" | "auto";
}

export interface SyncStateError {
  readonly name: "error";
  readonly reason: string;
}

export type SyncMachineState =
  | SyncStateIdle
  | SyncStateReserving
  | SyncStateSyncingQuick
  | SyncStateSyncingFull
  | SyncStateSyncingIncremental
  | SyncStateRecovering
  | SyncStateCompleting
  | SyncStateError;

export type SyncMachineStateName = SyncMachineState["name"];

// ── Typed transition table ────────────────────────────────────

/**
 * Legal state transitions. Any transition not in this map is illegal
 * and will be rejected by `transition()`.
 */
export const SYNC_TRANSITIONS: Record<SyncMachineStateName, readonly SyncMachineStateName[]> = {
  idle: ["reserving"],
  reserving: ["syncing_quick", "syncing_full", "syncing_incremental", "idle", "error"],
  syncing_quick: ["recovering", "completing", "error", "idle"],
  syncing_full: ["recovering", "completing", "error", "idle"],
  syncing_incremental: ["recovering", "completing", "error", "idle"],
  recovering: ["completing", "error", "idle"],
  completing: ["idle", "error"],
  error: ["reserving", "idle"],
} as const;

export function isValidSyncTransition(
  from: SyncMachineStateName,
  to: SyncMachineStateName,
): boolean {
  if (from === to) return true;
  return SYNC_TRANSITIONS[from].includes(to);
}

// ── Derive legacy SyncStatus from machine state ───────────────

export function deriveSyncStatus(machine: SyncMachineState): SyncStatus {
  switch (machine.name) {
    case "idle": return "idle";
    case "reserving":
    case "syncing_quick":
    case "syncing_full":
    case "syncing_incremental":
    case "recovering":
    case "completing":
      return "syncing";
    case "error":
      return machine.reason === "AUTH_EXPIRED" || machine.reason === "NO_AUTH"
        ? "reauthing"
        : "error";
  }
}

export type SyncJobKind = "none" | "bootstrap" | "backfill";

export function deriveSyncJobKind(
  machine: SyncMachineState,
  hasBookmarks: boolean,
): SyncJobKind {
  const status = deriveSyncStatus(machine);
  if (status !== "syncing") return "none";
  return hasBookmarks ? "backfill" : "bootstrap";
}

// ── Slice state ───────────────────────────────────────────────

export interface SyncSliceState {
  syncMachine: SyncMachineState;
  syncBlockedReason: SyncBlockedReason | null;
  syncGeneration: number;
}

export interface SyncSliceActions {
  /** Begin a sync run. Returns false if transition is illegal. */
  startReservation: (trigger: "manual" | "auto") => boolean;
  /** Transition from reserving to syncing with lease details. */
  leaseGranted: (opts: {
    leaseId: string;
    mode: SyncMode;
    trigger: "manual" | "auto";
    accountKey: string | null;
  }) => AbortSignal | null;
  /** Transition from reserving to idle (lease denied). */
  leaseDenied: (reason?: SyncBlockedReason | null) => void;
  /** Move to recovering state (needs recovery pass). */
  startRecovery: () => boolean;
  /** Begin completion (lease release). */
  startCompleting: () => boolean;
  /** Mark sync complete (success). */
  complete: () => void;
  /** Mark sync failed. */
  fail: (reason: string) => void;
  /** Cancel current sync (abort signal + transition to idle). */
  cancel: () => void;
  /** Set blocked reason for UI display. */
  setBlockedReason: (reason: SyncBlockedReason | null) => void;
  /** Get current machine state (convenience). */
  getMachineState: () => SyncMachineState;
  /** Get the AbortSignal for the current sync, or null. */
  getAbortSignal: () => AbortSignal | null;
}

// ── Dependencies ──────────────────────────────────────────────

export interface SyncSliceDeps {
  /** Called when sync enters error with AUTH_EXPIRED/NO_AUTH. */
  onReauthNeeded?: () => void;
}

// ── Slice factory ─────────────────────────────────────────────

export type SyncStore = ReturnType<typeof createSyncSlice>;

export function createSyncSlice(deps: SyncSliceDeps = {}) {
  const store = create<SyncSliceState & { actions: SyncSliceActions }>((set, get) => {
    const transition = (
      to: SyncMachineState,
      extra?: Partial<SyncSliceState>,
    ): boolean => {
      const current = get().syncMachine;
      if (!isValidSyncTransition(current.name, to.name)) {
        return false;
      }
      set({
        syncMachine: to,
        ...extra,
      });
      return true;
    };

    const abortCurrentSync = () => {
      const machine = get().syncMachine;
      if ("abortController" in machine) {
        machine.abortController.abort();
      }
    };

    const actions: SyncSliceActions = {
      startReservation: (trigger) => {
        return transition(
          { name: "reserving", trigger },
          { syncBlockedReason: null },
        );
      },

      leaseGranted: (opts) => {
        const syncGeneration = get().syncGeneration + 1;
        const abortController = new AbortController();
        const common = {
          leaseId: opts.leaseId,
          trigger: opts.trigger,
          accountKey: opts.accountKey,
          generation: syncGeneration,
          abortController,
        };
        let machineState: SyncMachineState;
        switch (opts.mode) {
          case "quick":
            machineState = { ...common, name: "syncing_quick", mode: "quick" };
            break;
          case "full":
            machineState = { ...common, name: "syncing_full", mode: "full" };
            break;
          case "incremental":
            machineState = { ...common, name: "syncing_incremental", mode: "incremental" };
            break;
        }

        const ok = transition(machineState, {
          syncGeneration,
          syncBlockedReason: null,
        });
        return ok ? abortController.signal : null;
      },

      leaseDenied: (reason) => {
        transition({ name: "idle" }, {
          syncBlockedReason: reason ?? null,
        });
      },

      startRecovery: () => {
        const current = get().syncMachine;
        if (!("abortController" in current)) return false;
        return transition({
          name: "recovering",
          leaseId: current.leaseId,
          trigger: current.trigger,
          accountKey: current.accountKey,
          mode: current.mode,
          generation: current.generation,
          abortController: current.abortController,
        });
      },

      startCompleting: () => {
        const current = get().syncMachine;
        if (current.name !== "syncing_quick" &&
            current.name !== "syncing_full" &&
            current.name !== "syncing_incremental" &&
            current.name !== "recovering") {
          return false;
        }
        return transition({
          name: "completing",
          leaseId: current.leaseId,
          accountKey: current.accountKey,
          mode: current.mode,
          trigger: current.trigger,
        });
      },

      complete: () => {
        transition({ name: "idle" }, { syncBlockedReason: null });
      },

      fail: (reason) => {
        abortCurrentSync();
        const ok = transition({ name: "error", reason });
        if (ok && (reason === "AUTH_EXPIRED" || reason === "NO_AUTH")) {
          deps.onReauthNeeded?.();
        }
      },

      cancel: () => {
        abortCurrentSync();
        transition({ name: "idle" }, { syncBlockedReason: null });
      },

      setBlockedReason: (reason) => {
        set({ syncBlockedReason: reason });
      },

      getMachineState: () => get().syncMachine,

      getAbortSignal: () => {
        const machine = get().syncMachine;
        if ("abortController" in machine) {
          return machine.abortController.signal;
        }
        return null;
      },
    };

    return {
      syncMachine: { name: "idle" } as SyncMachineState,
      syncBlockedReason: null,
      syncGeneration: 0,
      actions,
    };
  });

  return store;
}
