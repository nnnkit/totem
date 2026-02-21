import { useState, useEffect, useCallback, useMemo } from "react";
import type { Bookmark, ReadingProgress } from "../types";
import { getAllReadingProgress } from "../db";

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

  const refresh = useCallback(() => {
    getAllReadingProgress().then(setAllProgress);
  }, []);

  useEffect(refresh, [refresh]);

  const { continueReading, allUnread } = useMemo(() => {
    const bookmarkMap = new Map(bookmarks.map((b) => [b.tweetId, b]));
    const progressIds = new Set<string>();
    const nextContinueReading: ContinueReadingItem[] = [];

    for (const progress of allProgress) {
      const bookmark = bookmarkMap.get(progress.tweetId);
      if (bookmark) {
        progressIds.add(progress.tweetId);
        nextContinueReading.push({ bookmark, progress });
      }
    }

    const unread = bookmarks.filter((b) => !progressIds.has(b.tweetId));

    return { continueReading: nextContinueReading, allUnread: unread };
  }, [allProgress, bookmarks]);

  return { continueReading, allUnread, refresh };
}
