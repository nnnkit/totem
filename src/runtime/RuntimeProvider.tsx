import { useEffect, type PropsWithChildren } from "react";
import {
  AUTH_CONNECTING_TIMEOUT_MS,
  AUTH_HEARTBEAT_MS,
} from "../lib/constants/timing";
import { closeDb } from "../db";
import {
  CS_ACCOUNT_CONTEXT_ID,
  CS_AUTH_HEADERS,
  CS_AUTH_STATE,
  CS_BOOKMARK_EVENTS,
  CS_RESET_EPOCH,
  CS_USER_ID,
} from "../lib/storage-keys";
// Allowlisted runtime-side import of an SW-owned key: RuntimeProvider
// subscribes to the SW's snapshot writes via chrome.storage.onChanged — it
// reads the key to match change events, never to write. Any use of this
// import to call chrome.storage.local.set/remove is caught by the
// source-grep test in src/lib/__tests__/storage-invariants.test.ts.
import { CS_RUNTIME_STATE_V2 } from "../service-worker/storage-keys-sw";
import {
  useAuthPhase,
  useAuthRetryDelayMs,
  useRuntimeActions,
} from "../stores/selectors";
import type { RuntimeSnapshot } from "../types";

export function RuntimeProvider({ children }: PropsWithChildren) {
  const actions = useRuntimeActions();
  const authPhase = useAuthPhase();
  const authRetryDelayMs = useAuthRetryDelayMs();

  useEffect(() => {
    void actions.boot();
    return () => {
      actions.dispose();
    };
  }, [actions]);

  useEffect(() => {
    if (authPhase !== "ready") return;
    const id = setInterval(() => {
      void actions.checkAuth();
    }, AUTH_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [actions, authPhase]);

  useEffect(() => {
    if (typeof authRetryDelayMs !== "number" || authRetryDelayMs <= 0) return;
    const id = setTimeout(() => {
      void actions.checkAuth();
    }, authRetryDelayMs);
    return () => clearTimeout(id);
  }, [actions, authRetryDelayMs]);

  useEffect(() => {
    if (authPhase !== "connecting") return;
    const id = setTimeout(() => {
      actions.connectingTimeout();
    }, AUTH_CONNECTING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [actions, authPhase]);

  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return;

      // Reset broadcast: drop our IDB handle so the resetting tab's
      // deleteDatabase() isn't blocked by this page's live connection.
      if (typeof changes[CS_RESET_EPOCH]?.newValue === "number") {
        actions.prepareForReset();
        closeDb();
      }

      const hasAuthChange = Boolean(
        changes[CS_AUTH_HEADERS] ||
        changes[CS_AUTH_STATE] ||
        changes[CS_USER_ID] ||
        changes[CS_ACCOUNT_CONTEXT_ID],
      );
      if (hasAuthChange) {
        void actions.checkAuth();
      }

      if (changes[CS_BOOKMARK_EVENTS]) {
        void actions.handleBookmarkEvents();
      }

      // Reactive snapshot push: the SW writes CS_RUNTIME_STATE_V2 after
      // every sync reservation / completion / capability update. Apply it
      // directly so UI-visible facts (capability, session state) propagate
      // without waiting for the next auth heartbeat.
      const snapshotChange = changes[CS_RUNTIME_STATE_V2];
      if (snapshotChange && snapshotChange.newValue && !hasAuthChange) {
        const snapshot = snapshotChange.newValue as RuntimeSnapshot;
        void actions.applyRuntimeSnapshot(snapshot);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [actions]);

  useEffect(() => {
    const onPageHide = () => {
      actions.releaseLease();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [actions]);

  return <>{children}</>;
}
