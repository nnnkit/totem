/**
 * Keys that are WRITTEN exclusively by the service worker.
 *
 * ──────────────────────────────────────────────────────────────────────
 * LOAD-BEARING RULE (see ARCHITECTURE.md §16 Invariant #1):
 * ──────────────────────────────────────────────────────────────────────
 *   Only service-worker modules (src/service-worker/**) and the reset
 *   pathway (src/lib/reset.ts, which removes these keys during a full
 *   teardown) may import this file. Runtime code reads these values
 *   through the SW-owned RuntimeSnapshot, never through chrome.storage
 *   directly.
 *
 * Violations are caught by the import-boundary test in
 * src/lib/__tests__/storage-invariants.test.ts — if you see that test
 * failing, you're about to re-create a dual-writer bug class that Phase 1
 * of the architecture refactor specifically killed.
 * ──────────────────────────────────────────────────────────────────────
 */

/** Sync orchestrator state: in-flight leases, lastFullSyncAt, cooldowns. */
export const CS_SYNC_ORCHESTRATOR_STATE = "totem_sync_orchestrator_state";

/** Full RuntimeSnapshot the SW persists after every state transition. */
export const CS_RUNTIME_STATE_V2 = "totem_runtime_state_v2";

/** Timestamp of the last completed sync run (any mode). */
export const CS_LAST_SYNC = "totem_last_sync";

/** Timestamp of the last completed incremental sync run. */
export const CS_LAST_SOFT_SYNC = "totem_last_light_sync";

/** Set when a bookmark event arrives and cleared on next sync completion. */
export const CS_SOFT_SYNC_NEEDED = "totem_light_sync_needed";
