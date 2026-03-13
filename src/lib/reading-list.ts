import type { ContinueReadingItem } from "../hooks/useContinueReading";
import type { Bookmark } from "../types";
import { LS_READING_SORTS } from "./storage-keys";
import { sortIndexToTimestamp } from "./time";

export type ReadingTab = "continue" | "read" | "unread";
export type ReadingSort = "recent" | "oldest" | "annotated";

export interface AnnotationCountsLike {
  highlights: number;
  notes: number;
}

export interface ReadingSortPreferences {
  unread: ReadingSort;
  continue: ReadingSort;
  read: ReadingSort;
}

export const DEFAULT_READING_SORT_PREFERENCES: ReadingSortPreferences = {
  unread: "recent",
  continue: "recent",
  read: "recent",
};

function isReadingSort(value: unknown): value is ReadingSort {
  return value === "recent" || value === "oldest" || value === "annotated";
}

function getAnnotationTotal(
  tweetId: string,
  counts: ReadonlyMap<string, AnnotationCountsLike> | undefined,
): number {
  const value = counts?.get(tweetId);
  return (value?.highlights ?? 0) + (value?.notes ?? 0);
}

function getBookmarkRecentAt(bookmark: Bookmark): number {
  try {
    return sortIndexToTimestamp(bookmark.sortIndex);
  } catch {
    return bookmark.createdAt;
  }
}

function compareBySortMode(
  leftRecentAt: number,
  rightRecentAt: number,
  leftAnnotations: number,
  rightAnnotations: number,
  sort: ReadingSort,
): number {
  if (sort === "annotated" && leftAnnotations !== rightAnnotations) {
    return rightAnnotations - leftAnnotations;
  }

  if (sort === "oldest") {
    return leftRecentAt - rightRecentAt;
  }

  return rightRecentAt - leftRecentAt;
}

export function readStoredReadingSortPreferences(): ReadingSortPreferences {
  if (typeof localStorage === "undefined") {
    return DEFAULT_READING_SORT_PREFERENCES;
  }

  const raw = localStorage.getItem(LS_READING_SORTS);
  if (!raw) {
    return DEFAULT_READING_SORT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Record<ReadingTab, unknown>>;
    return {
      unread: isReadingSort(parsed.unread)
        ? parsed.unread
        : DEFAULT_READING_SORT_PREFERENCES.unread,
      continue: isReadingSort(parsed.continue)
        ? parsed.continue
        : DEFAULT_READING_SORT_PREFERENCES.continue,
      read: isReadingSort(parsed.read)
        ? parsed.read
        : DEFAULT_READING_SORT_PREFERENCES.read,
    };
  } catch {
    return DEFAULT_READING_SORT_PREFERENCES;
  }
}

export function writeStoredReadingSortPreferences(
  preferences: ReadingSortPreferences,
): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(LS_READING_SORTS, JSON.stringify(preferences));
}

export function sortUnreadBookmarks(
  bookmarks: Bookmark[],
  sort: ReadingSort,
  counts?: ReadonlyMap<string, AnnotationCountsLike>,
): Bookmark[] {
  return [...bookmarks].sort((left, right) =>
    compareBySortMode(
      getBookmarkRecentAt(left),
      getBookmarkRecentAt(right),
      getAnnotationTotal(left.tweetId, counts),
      getAnnotationTotal(right.tweetId, counts),
      sort,
    )
  );
}

export function sortContinueReadingItems(
  items: ContinueReadingItem[],
  sort: ReadingSort,
  counts?: ReadonlyMap<string, AnnotationCountsLike>,
): ContinueReadingItem[] {
  return [...items].sort((left, right) =>
    compareBySortMode(
      left.progress.lastReadAt,
      right.progress.lastReadAt,
      getAnnotationTotal(left.bookmark.tweetId, counts),
      getAnnotationTotal(right.bookmark.tweetId, counts),
      sort,
    )
  );
}
