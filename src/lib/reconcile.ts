import type { Bookmark } from "../types";
import type { BookmarkPageResult } from "../api/parsers";
import { SYNC_PAGE_SIZE } from "./constants";

interface ReconcileResult {
  newBookmarks: Bookmark[];
  staleIds: string[];
  pagesRequested: number;
  lastCursor: string | null;
  needsRecovery: boolean;
  capReached: "maxPages" | "maxBookmarks" | null;
  terminationReason:
    | "cursor_missing"
    | "page_cap"
    | "duplicate_stop"
    | "complete";
}

interface ReconcileOptions {
  localIds: Set<string>;
  fetchPage: (cursor?: string) => Promise<BookmarkPageResult>;
  fullReconcile: boolean;
  onPage?: (newBookmarks: Bookmark[]) => void | Promise<void>;
  maxPages?: number;
  maxBookmarks?: number;
  continueOnNoNewItems?: boolean;
}

export async function reconcileBookmarks(
  opts: ReconcileOptions,
): Promise<ReconcileResult> {
  const {
    localIds,
    fetchPage,
    fullReconcile,
    onPage,
    maxPages,
    maxBookmarks,
    continueOnNoNewItems,
  } = opts;
  const seen = new Set(localIds);
  const seenCursors = new Set<string>();
  const remoteIds = new Set<string>();
  const allNew: Bookmark[] = [];
  let cursor: string | undefined;
  let lastCursor: string | null = null;
  let pagesRequested = 0;
  let terminationReason: ReconcileResult["terminationReason"] = "complete";
  let capReached: ReconcileResult["capReached"] = null;
  const cappedMode = !fullReconcile;
  const effectiveMaxPages =
    cappedMode && Number.isFinite(maxPages) && (maxPages || 0) > 0
      ? Math.floor(maxPages as number)
      : Number.POSITIVE_INFINITY;
  const effectiveMaxBookmarks =
    cappedMode && Number.isFinite(maxBookmarks) && (maxBookmarks || 0) > 0
      ? Math.floor(maxBookmarks as number)
      : Number.POSITIVE_INFINITY;

  const shouldContinueOnNoNewItems = continueOnNoNewItems === true;
  while (true) {
    if (pagesRequested >= effectiveMaxPages) {
      terminationReason = "page_cap";
      capReached = "maxPages";
      break;
    }
    if (allNew.length >= effectiveMaxBookmarks) {
      terminationReason = "page_cap";
      capReached = "maxBookmarks";
      break;
    }

    if (cursor) {
      if (seenCursors.has(cursor)) {
        terminationReason = "duplicate_stop";
        break;
      }
      seenCursors.add(cursor);
    }

    const result = await fetchPage(cursor);
    pagesRequested++;
    lastCursor = result.cursor;

    const pageNewRaw = result.bookmarks.filter((b) => !seen.has(b.tweetId));
    const remaining = effectiveMaxBookmarks - allNew.length;
    const pageNew =
      remaining > 0 ? pageNewRaw.slice(0, remaining) : [];

    if (fullReconcile) {
      for (const b of result.bookmarks) {
        remoteIds.add(b.tweetId);
      }
    }

    if (pageNewRaw.length === 0 && !fullReconcile && !shouldContinueOnNoNewItems) {
      terminationReason = "duplicate_stop";
      break;
    }
    if (result.stopOnEmptyResponse && result.bookmarks.length === 0) {
      terminationReason = "complete";
      break;
    }

    if (pageNew.length > 0) {
      for (const b of pageNew) {
        seen.add(b.tweetId);
      }
      allNew.push(...pageNew);
      await onPage?.(pageNew);
    }
    if (allNew.length >= effectiveMaxBookmarks) {
      terminationReason = "page_cap";
      capReached = "maxBookmarks";
      break;
    }

    const nextCursor = result.cursor || undefined;
    if (!nextCursor) {
      terminationReason = "cursor_missing";
      break;
    }
    if (nextCursor === cursor) {
      terminationReason = "duplicate_stop";
      break;
    }
    cursor = nextCursor;
  }

  let staleIds: string[] = [];
  if (fullReconcile) {
    staleIds = [...localIds].filter((id) => !remoteIds.has(id));
  }

  const needsRecovery =
    pagesRequested === 1 &&
    allNew.length === SYNC_PAGE_SIZE &&
    !cursor &&
    terminationReason === "cursor_missing";

  if (needsRecovery) {
    console.warn(
      `[totem] Sync stopped after 1 full page (${allNew.length} bookmarks) with no cursor. Triggering recovery path.`,
    );
  }

  return {
    newBookmarks: allNew,
    staleIds,
    pagesRequested,
    lastCursor,
    needsRecovery,
    capReached,
    terminationReason,
  };
}
