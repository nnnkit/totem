import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { useAuth, type AuthPhase } from "../hooks/useAuth";
import { useBookmarks } from "../hooks/useBookmarks";
import type {
  ApiCapability,
  Bookmark,
  SessionState,
  SyncStatus,
} from "../types";

export type RuntimeMode =
  | "booting"
  | "online_ready"
  | "online_degraded"
  | "offline_cached"
  | "offline_empty";

interface RuntimeContextValue {
  phase: AuthPhase;
  sessionState: SessionState;
  capability: ApiCapability;
  hasQueryId: boolean;
  syncStatus: SyncStatus;
  bookmarks: Bookmark[];
  runtimeMode: RuntimeMode;
  isReady: boolean;
  offlineMode: boolean;
  canSync: boolean;
  syncDisabledReason?: string;
  startLogin: () => Promise<void>;
  refresh: () => void;
  reset: () => void;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

function deriveRuntimeMode(
  phase: AuthPhase,
  syncStatus: SyncStatus,
  hasBookmarks: boolean,
  capability: ApiCapability,
): RuntimeMode {
  if (phase === "loading" || phase === "connecting") {
    return "booting";
  }

  if (phase === "need_login") {
    return hasBookmarks ? "offline_cached" : "offline_empty";
  }

  if (syncStatus === "reauthing") {
    return hasBookmarks ? "offline_cached" : "offline_empty";
  }

  if (capability.bookmarksApi === "ready") {
    return "online_ready";
  }

  return "online_degraded";
}

function deriveSyncDisabledReason(mode: RuntimeMode, phase: AuthPhase): string | undefined {
  switch (mode) {
    case "booting":
      return phase === "connecting" ? "Connecting to X..." : "Loading...";
    case "online_degraded":
      return "Preparing X API...";
    case "offline_cached":
    case "offline_empty":
      return "Log in to X to sync bookmarks";
    case "online_ready":
    default:
      return undefined;
  }
}

export function RuntimeProvider({ children }: PropsWithChildren) {
  const { phase, sessionState, capability, hasQueryId, startLogin } = useAuth();
  const syncReady = phase === "ready" && capability.bookmarksApi === "ready";
  const { bookmarks, syncStatus, refresh, reset, unbookmark } = useBookmarks(syncReady);
  const hasBookmarks = bookmarks.length > 0;

  const runtimeMode = useMemo(
    () => deriveRuntimeMode(phase, syncStatus, hasBookmarks, capability),
    [phase, syncStatus, hasBookmarks, capability],
  );

  const value = useMemo<RuntimeContextValue>(() => {
    const canSync = runtimeMode === "online_ready";
    return {
      phase,
      sessionState,
      capability,
      hasQueryId,
      syncStatus,
      bookmarks,
      runtimeMode,
      isReady: phase === "ready",
      offlineMode: runtimeMode === "offline_cached",
      canSync,
      syncDisabledReason: canSync ? undefined : deriveSyncDisabledReason(runtimeMode, phase),
      startLogin,
      refresh,
      reset,
      unbookmark,
    };
  }, [
    phase,
    sessionState,
    capability,
    hasQueryId,
    syncStatus,
    bookmarks,
    runtimeMode,
    startLogin,
    refresh,
    reset,
    unbookmark,
  ]);

  return (
    <RuntimeContext.Provider value={value}>
      {children}
    </RuntimeContext.Provider>
  );
}

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (!value) {
    throw new Error("useRuntime must be used within RuntimeProvider");
  }
  return value;
}

