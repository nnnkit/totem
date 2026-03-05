import type { AuthPhase } from "../hooks/useAuth";
import type { SyncStatus } from "../types";

interface HasTweetId {
  tweetId: string;
}

export function shouldRestrictToCachedDetails(
  phase: AuthPhase,
  syncStatus: SyncStatus,
): boolean {
  return (
    phase === "need_login" ||
    phase === "connecting" ||
    syncStatus === "reauthing"
  );
}

export function selectDisplayBookmarks<T extends HasTweetId>(
  bookmarks: T[],
  detailedTweetIds: ReadonlySet<string>,
  phase: AuthPhase,
  syncStatus: SyncStatus,
): T[] {
  if (!shouldRestrictToCachedDetails(phase, syncStatus)) {
    return bookmarks;
  }

  return bookmarks.filter((bookmark) => detailedTweetIds.has(bookmark.tweetId));
}
