import { useState, useEffect, useCallback, useMemo } from "react";
import type { Bookmark, ReadingProgress } from "../types";
import { getAllReadingProgress, deleteReadingProgressByTweetIds } from "../db";

export interface ContinueReadingItem {
  bookmark: Bookmark;
  progress: ReadingProgress;
}

interface UseContinueReadingReturn {
  continueReading: ContinueReadingItem[];
  allUnread: Bookmark[];
  refresh: () => void;
}

export function useContinueReading(
  bookmarks: Bookmark[],
): UseContinueReadingReturn {
  const [allProgress, setAllProgress] = useState<ReadingProgress[]>([]);

  const load = useCallback(() => {
    getAllReadingProgress().then(setAllProgress);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  const { continueReading, allUnread, orphanIds } = useMemo(() => {
    // Build continue reading items and recommended list
    const bookmarkMap = new Map(bookmarks.map((b) => [b.tweetId, b]));
    const progressIds = new Set<string>();
    const nextContinueReading: ContinueReadingItem[] = [];
    const nextOrphanIds: string[] = [];

    for (const progress of allProgress) {
      const bookmark = bookmarkMap.get(progress.tweetId);
      if (bookmark) {
        progressIds.add(progress.tweetId);
        nextContinueReading.push({ bookmark, progress });
      } else {
        nextOrphanIds.push(progress.tweetId);
      }
    }

    const unread = bookmarks.filter((b) => !progressIds.has(b.tweetId));

    return {
      continueReading: nextContinueReading,
      allUnread: unread,
      orphanIds: nextOrphanIds,
    };
  }, [allProgress, bookmarks]);

  const orphanIdsKey = orphanIds.join("|");
  useEffect(() => {
    if (orphanIds.length === 0) return;
    deleteReadingProgressByTweetIds(orphanIds).catch(() => {});
  }, [orphanIdsKey]);

  return { continueReading, allUnread, refresh };
}
