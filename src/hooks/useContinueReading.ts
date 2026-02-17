import { useState, useEffect, useCallback } from "react";
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

function hasSubstantialContent(bookmark: Bookmark): boolean {
  if (bookmark.tweetKind === "article") return true;
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return true;
  if (bookmark.isLongText) return true;
  if (bookmark.hasLink) return true;
  if (bookmark.article?.plainText) return true;
  return false;
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

  // Build continue reading items and recommended list
  const bookmarkMap = new Map(bookmarks.map((b) => [b.tweetId, b]));
  const progressIds = new Set<string>();
  const continueReading: ContinueReadingItem[] = [];
  const orphanIds: string[] = [];

  for (const progress of allProgress) {
    const bookmark = bookmarkMap.get(progress.tweetId);
    if (bookmark) {
      progressIds.add(progress.tweetId);
      continueReading.push({ bookmark, progress });
    } else {
      orphanIds.push(progress.tweetId);
    }
  }

  // Clean up orphan progress records
  if (orphanIds.length > 0) {
    deleteReadingProgressByTweetIds(orphanIds);
  }

  // Recommended: bookmarks with no progress record, preferring substantial content and recent saves
  const unread = bookmarks.filter((b) => !progressIds.has(b.tweetId));
  const scored = unread.map((b) => {
    let score = 0;
    if (hasSubstantialContent(b)) score += 10;
    // Prefer more recent saves (higher sortIndex = more recent)
    score += Number(b.sortIndex) / 1e18;
    return { bookmark: b, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const allUnread = scored.map((s) => s.bookmark);

  return { continueReading, allUnread, refresh };
}
