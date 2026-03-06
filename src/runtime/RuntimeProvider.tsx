import { useEffect, type PropsWithChildren } from "react";
import {
  AUTH_CONNECTING_TIMEOUT_MS,
  AUTH_HEARTBEAT_MS,
} from "../lib/constants";
import {
  CS_ACCOUNT_CONTEXT_ID,
  CS_AUTH_HEADERS,
  CS_AUTH_STATE,
  CS_BOOKMARK_EVENTS,
  CS_USER_ID,
} from "../lib/storage-keys";
import {
  useAuthPhase,
  useAuthRetryDelayMs,
  useRuntimeActions,
} from "../stores/selectors";

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
