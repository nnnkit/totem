import { useState, useEffect, useCallback, useMemo } from "react";
import type { Bookmark, ReadingProgress } from "../types";
import { getAllReadingProgress } from "../db";
import { subscribeToReaderActivity } from "../lib/reader-activity";

export interface ContinueReadingItem {
  bookmark: Bookmark;
  progress: ReadingProgress;
}

interface UseContinueReadingReturn {
  continueReading: ContinueReadingItem[];
  allUnread: Bookmark[];
  refresh: () => void;
}

export interface ComputeContinueReadingResult {
  continueReading: ContinueReadingItem[];
  allUnread: Bookmark[];
}

// Pure: join progress rows to the bookmark set and partition unread.
// IMPORTANT: `bookmarks` must be the full bookmark set (useAllBookmarks),
// not a filtered subset like displayBookmarks. Filtering on the read side
// silently drops progress rows whose bookmarks are temporarily hidden
// (e.g. during connecting/reauthing when detail isn't cached).
export function computeContinueReading(
  allProgress: ReadingProgress[],
  bookmarks: Bookmark[],
): ComputeContinueReadingResult {
  const bookmarkMap = new Map(bookmarks.map((b) => [b.tweetId, b]));
  const progressIds = new Set<string>();
  const continueReading: ContinueReadingItem[] = [];

  for (const progress of allProgress) {
    const bookmark = bookmarkMap.get(progress.tweetId);
    if (bookmark) {
      progressIds.add(progress.tweetId);
      continueReading.push({ bookmark, progress });
    }
  }

  const allUnread = bookmarks.filter((b) => !progressIds.has(b.tweetId));
  return { continueReading, allUnread };
}

export function useContinueReading(
  bookmarks: Bookmark[],
  refreshKey: unknown = 0,
): UseContinueReadingReturn {
  const [allProgress, setAllProgress] = useState<ReadingProgress[]>([]);

  const refresh = useCallback(() => {
    getAllReadingProgress()
      .then(setAllProgress)
      .catch(() => setAllProgress([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    return subscribeToReaderActivity(refresh);
  }, [refresh]);

  const { continueReading, allUnread } = useMemo(
    () => computeContinueReading(allProgress, bookmarks),
    [allProgress, bookmarks],
  );

  return { continueReading, allUnread, refresh };
}
