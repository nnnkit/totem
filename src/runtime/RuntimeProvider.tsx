import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { useAuth, type AuthPhase } from "../hooks/useAuth";
import { useBookmarks, useDetailedTweetIds } from "../hooks/useBookmarks";
import type {
  ApiCapability,
  Bookmark,
  SyncBlockedReason,
  SyncRequestResult,
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
  activeAccountId: string | null;
  hasQueryId: boolean;
  syncStatus: SyncStatus;
  bookmarks: Bookmark[];
  runtimeMode: RuntimeMode;
  isReady: boolean;
  offlineMode: boolean;
  canSync: boolean;
  syncBlockedReason: SyncBlockedReason | null;
  syncDisabledReason?: string;
  startLogin: () => Promise<void>;
  refresh: () => Promise<SyncRequestResult>;
  reset: () => void;
  unbookmark: (tweetId: string) => Promise<{ apiError?: string }>;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

function deriveRuntimeMode(
  phase: AuthPhase,
  syncStatus: SyncStatus,
  hasDisplayableCache: boolean,
  capability: ApiCapability,
): RuntimeMode {
  if (phase === "loading" || phase === "connecting") {
    return "booting";
  }

  if (phase === "need_login") {
    return hasDisplayableCache ? "offline_cached" : "offline_empty";
  }

  if (syncStatus === "reauthing") {
    return hasDisplayableCache ? "offline_cached" : "offline_empty";
  }

  if (capability.bookmarksApi === "ready") {
    return "online_ready";
  }

  return "online_degraded";
}

function describeBlockedReason(reason: SyncBlockedReason | null): string | undefined {
  switch (reason) {
    case "in_flight":
      return "A sync is already running.";
    case "cooldown":
      return "Please wait before syncing again.";
    case "rate_limited":
      return "Rate limited by X. Please wait and try again.";
    case "no_account":
      return "Account context is not available yet.";
    case "not_ready":
      return "Sync is not ready yet.";
    default:
      return undefined;
  }
}

function deriveSyncDisabledReason(
  mode: RuntimeMode,
  phase: AuthPhase,
  blockedReason: SyncBlockedReason | null,
): string | undefined {
  const blocked = describeBlockedReason(blockedReason);
  if (blocked) return blocked;

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
  const {
    phase,
    sessionState,
    capability,
    activeAccountId,
    hasQueryId,
    startLogin,
  } = useAuth();
  const syncReady = phase === "ready" && capability.bookmarksApi === "ready";
  const { bookmarks, syncStatus, syncBlockedReason, refresh, reset, unbookmark } = useBookmarks(
    syncReady,
    activeAccountId,
  );
  const detailsRefreshKey = `${activeAccountId || "__none__"}:${bookmarks.length}:${syncStatus}`;
  const { ids: detailedTweetIds, loaded: detailedIdsLoaded } = useDetailedTweetIds(
    detailsRefreshKey,
  );
  const hasDisplayableCache = useMemo(() => {
    if (bookmarks.length === 0) return false;
    if (!detailedIdsLoaded) return true;
    return bookmarks.some((bookmark) => detailedTweetIds.has(bookmark.tweetId));
  }, [bookmarks, detailedIdsLoaded, detailedTweetIds]);

  const runtimeMode = useMemo(
    () => deriveRuntimeMode(phase, syncStatus, hasDisplayableCache, capability),
    [phase, syncStatus, hasDisplayableCache, capability],
  );

  const value = useMemo<RuntimeContextValue>(() => {
    const canSync = runtimeMode === "online_ready";
    return {
      phase,
      sessionState,
      capability,
      activeAccountId,
      hasQueryId,
      syncStatus,
      bookmarks,
      runtimeMode,
      isReady: phase === "ready",
      offlineMode: runtimeMode === "offline_cached",
      canSync,
      syncBlockedReason,
      syncDisabledReason: canSync
        ? undefined
        : deriveSyncDisabledReason(runtimeMode, phase, syncBlockedReason),
      startLogin,
      refresh,
      reset,
      unbookmark,
    };
  }, [
    phase,
    sessionState,
    capability,
    activeAccountId,
    hasQueryId,
    syncStatus,
    bookmarks,
    runtimeMode,
    syncBlockedReason,
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
